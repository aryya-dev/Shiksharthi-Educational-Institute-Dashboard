-- ============================================================================
-- Migration: Complete Class Submission System & Daily Class Reports
-- Date: 2026-07-10
-- ============================================================================

-- 1. Add new columns to class_sessions
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Completed' NOT NULL;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS homework_title VARCHAR(255);
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS homework_description TEXT;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS homework_due_date DATE;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS faculty_notes TEXT;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- 2. Create homework_defaulters table
CREATE TABLE IF NOT EXISTS homework_defaulters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES class_sessions(id) ON DELETE CASCADE NOT NULL,
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(session_id, enrollment_id)
);

-- Enable RLS
ALTER TABLE homework_defaulters ENABLE ROW LEVEL SECURITY;

-- RLS Policies for homework_defaulters
CREATE POLICY "View Homework Defaulters" ON homework_defaulters FOR SELECT TO authenticated
  USING (
    is_director(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.id = homework_defaulters.enrollment_id AND has_branch_access(auth.uid(), e.branch_id)
    )
  );

CREATE POLICY "Manage Homework Defaulters" ON homework_defaulters FOR ALL TO authenticated
  USING (
    is_director(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.id = homework_defaulters.enrollment_id AND has_branch_access(auth.uid(), e.branch_id)
    )
  );

-- 3. Create daily_class_reports table
CREATE TABLE IF NOT EXISTS daily_class_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES class_sessions(id) ON DELETE CASCADE UNIQUE NOT NULL,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE NOT NULL,
  subject_name VARCHAR(100) NOT NULL,
  faculty_id UUID REFERENCES faculty(id) ON DELETE SET NULL,
  faculty_name VARCHAR(255) NOT NULL,
  batch_name VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  present_count INT NOT NULL DEFAULT 0,
  absent_count INT NOT NULL DEFAULT 0,
  leave_count INT NOT NULL DEFAULT 0,
  attendance_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
  chapter_covered VARCHAR(255) NOT NULL,
  homework_title VARCHAR(255),
  homework_description TEXT,
  homework_due_date DATE,
  absentee_list JSONB DEFAULT '[]'::jsonb NOT NULL,
  homework_defaulter_list JSONB DEFAULT '[]'::jsonb NOT NULL,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE daily_class_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_class_reports
CREATE POLICY "View Daily Class Reports" ON daily_class_reports FOR SELECT TO authenticated
  USING (is_director(auth.uid()) OR has_branch_access(auth.uid(), branch_id));

CREATE POLICY "Manage Daily Class Reports" ON daily_class_reports FOR ALL TO authenticated
  USING (is_director(auth.uid()) OR has_branch_access(auth.uid(), branch_id));

-- 4. Create the complete_class RPC function (atomic transaction)
CREATE OR REPLACE FUNCTION complete_class(
  p_batch_ids UUID[],
  p_subject_name VARCHAR,
  p_faculty_id UUID,
  p_room_id UUID,
  p_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_is_extra_class BOOLEAN,
  p_chapter_covered VARCHAR,
  p_faculty_notes TEXT,
  p_homework_title VARCHAR,
  p_homework_description TEXT,
  p_homework_due_date DATE,
  p_attendance JSONB,          -- [{ "enrollment_id": "...", "status": "Present|Absent|Leave", "batch_id": "..." }]
  p_defaulter_ids UUID[],      -- enrollment IDs of homework defaulters
  p_academic_year_id UUID,
  p_branch_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch_id UUID;
  v_session_id UUID;
  v_att JSONB;
  v_present_count INT;
  v_absent_count INT;
  v_leave_count INT;
  v_total INT;
  v_att_pct NUMERIC(5,2);
  v_absentee_list JSONB;
  v_defaulter_list JSONB;
  v_faculty_name VARCHAR;
  v_batch_name VARCHAR;
  v_report_ids UUID[] := '{}';
  v_session_ids UUID[] := '{}';
BEGIN
  -- Validate chapter_covered is not empty
  IF p_chapter_covered IS NULL OR TRIM(p_chapter_covered) = '' THEN
    RAISE EXCEPTION 'Chapter Covered is required';
  END IF;

  -- Validate homework: if title is given, due date must be given
  IF p_homework_title IS NOT NULL AND TRIM(p_homework_title) != '' AND p_homework_due_date IS NULL THEN
    RAISE EXCEPTION 'Homework Due Date is required when homework is assigned';
  END IF;

  -- Get faculty name
  SELECT name INTO v_faculty_name FROM faculty WHERE id = p_faculty_id;
  IF v_faculty_name IS NULL THEN
    v_faculty_name := 'Unknown';
  END IF;

  -- Process each batch
  FOREACH v_batch_id IN ARRAY p_batch_ids LOOP
    -- Get batch name
    SELECT name INTO v_batch_name FROM batches WHERE id = v_batch_id;

    -- Insert class_session
    INSERT INTO class_sessions (
      batch_id, subject_name, faculty_id, room_id, date,
      start_time, end_time, is_extra_class, chapter_covered,
      faculty_notes, homework_title, homework_description,
      homework_due_date, status, completed_at
    ) VALUES (
      v_batch_id, p_subject_name, p_faculty_id, p_room_id, p_date,
      p_start_time, p_end_time, p_is_extra_class, p_chapter_covered,
      NULLIF(TRIM(COALESCE(p_faculty_notes, '')), ''),
      NULLIF(TRIM(COALESCE(p_homework_title, '')), ''),
      NULLIF(TRIM(COALESCE(p_homework_description, '')), ''),
      p_homework_due_date,
      'Completed',
      NOW()
    )
    RETURNING id INTO v_session_id;

    v_session_ids := v_session_ids || v_session_id;

    -- Insert attendance for students in this batch
    v_present_count := 0;
    v_absent_count := 0;
    v_leave_count := 0;
    v_absentee_list := '[]'::jsonb;

    FOR v_att IN SELECT * FROM jsonb_array_elements(p_attendance)
    LOOP
      IF (v_att->>'batch_id')::UUID = v_batch_id THEN
        INSERT INTO attendance (enrollment_id, session_id, status)
        VALUES ((v_att->>'enrollment_id')::UUID, v_session_id, v_att->>'status');

        IF v_att->>'status' = 'Present' THEN
          v_present_count := v_present_count + 1;
        ELSIF v_att->>'status' = 'Absent' THEN
          v_absent_count := v_absent_count + 1;
          v_absentee_list := v_absentee_list || to_jsonb(v_att->>'student_name');
        ELSIF v_att->>'status' = 'Leave' THEN
          v_leave_count := v_leave_count + 1;
          v_absentee_list := v_absentee_list || to_jsonb(v_att->>'student_name');
        END IF;
      END IF;
    END LOOP;

    -- Insert homework defaulters for this batch
    IF p_defaulter_ids IS NOT NULL AND array_length(p_defaulter_ids, 1) > 0 THEN
      DECLARE
        v_def_id UUID;
        v_def_batch UUID;
      BEGIN
        FOREACH v_def_id IN ARRAY p_defaulter_ids LOOP
          -- Only insert if this defaulter belongs to this batch
          SELECT e.batch_id INTO v_def_batch FROM enrollments e WHERE e.id = v_def_id;
          IF v_def_batch = v_batch_id THEN
            INSERT INTO homework_defaulters (session_id, enrollment_id)
            VALUES (v_session_id, v_def_id)
            ON CONFLICT DO NOTHING;
          END IF;
        END LOOP;
      END;
    END IF;

    -- Update batch_subjects current_chapter
    UPDATE batch_subjects
    SET current_chapter = p_chapter_covered
    WHERE batch_id = v_batch_id AND subject_name = p_subject_name;

    -- Compute attendance percentage
    v_total := v_present_count + v_absent_count + v_leave_count;
    IF v_total > 0 THEN
      v_att_pct := ROUND((v_present_count::NUMERIC / v_total::NUMERIC) * 100, 2);
    ELSE
      v_att_pct := 0;
    END IF;

    -- Build defaulter names list for this batch
    v_defaulter_list := '[]'::jsonb;
    IF p_defaulter_ids IS NOT NULL AND array_length(p_defaulter_ids, 1) > 0 THEN
      SELECT COALESCE(jsonb_agg(s.name), '[]'::jsonb)
      INTO v_defaulter_list
      FROM enrollments e
      JOIN students s ON s.id = e.student_id
      WHERE e.id = ANY(p_defaulter_ids)
        AND e.batch_id = v_batch_id;
    END IF;

    -- Insert daily class report
    INSERT INTO daily_class_reports (
      session_id, batch_id, subject_name, faculty_id, faculty_name,
      batch_name, date, start_time, end_time,
      present_count, absent_count, leave_count, attendance_percentage,
      chapter_covered, homework_title, homework_description, homework_due_date,
      absentee_list, homework_defaulter_list,
      academic_year_id, branch_id
    ) VALUES (
      v_session_id, v_batch_id, p_subject_name, p_faculty_id, v_faculty_name,
      v_batch_name, p_date, p_start_time, p_end_time,
      v_present_count, v_absent_count, v_leave_count, v_att_pct,
      p_chapter_covered,
      NULLIF(TRIM(COALESCE(p_homework_title, '')), ''),
      NULLIF(TRIM(COALESCE(p_homework_description, '')), ''),
      p_homework_due_date,
      v_absentee_list, v_defaulter_list,
      p_academic_year_id, p_branch_id
    )
    RETURNING id INTO v_session_id; -- reuse variable for report id
    v_report_ids := v_report_ids || v_session_id;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'report_ids', to_jsonb(v_report_ids),
    'session_ids', to_jsonb(v_session_ids)
  );
END;
$$;
