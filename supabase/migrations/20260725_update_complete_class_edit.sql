-- ============================================================================
-- Migration: Update complete_class to support editing existing attendance
-- Date: 2026-07-25
-- Description: Makes complete_class idempotent - if a session already exists
--              for the same batch/date/time/subject, it updates instead of inserting.
-- ============================================================================

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
  p_attendance JSONB,
  p_defaulter_ids UUID[],
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

    -- Check if session already exists for this batch, date, start_time, end_time, subject_name
    SELECT id INTO v_session_id
    FROM class_sessions
    WHERE batch_id = v_batch_id
      AND date = p_date
      AND start_time = p_start_time
      AND end_time = p_end_time
      AND subject_name = p_subject_name
    LIMIT 1;

    IF v_session_id IS NOT NULL THEN
      -- Existing session: update class_sessions and clean up old attendance/defaulters/daily_class_reports
      UPDATE class_sessions
      SET
        faculty_id = p_faculty_id,
        room_id = p_room_id,
        is_extra_class = p_is_extra_class,
        chapter_covered = p_chapter_covered,
        faculty_notes = NULLIF(TRIM(COALESCE(p_faculty_notes, '')), ''),
        homework_title = NULLIF(TRIM(COALESCE(p_homework_title, '')), ''),
        homework_description = NULLIF(TRIM(COALESCE(p_homework_description, '')), ''),
        homework_due_date = p_homework_due_date,
        status = 'Completed',
        completed_at = NOW()
      WHERE id = v_session_id;

      DELETE FROM attendance WHERE session_id = v_session_id;
      DELETE FROM homework_defaulters WHERE session_id = v_session_id;
      DELETE FROM daily_class_reports WHERE session_id = v_session_id;
    ELSE
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
    END IF;

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
    RETURNING id INTO v_session_id;
    v_report_ids := v_report_ids || v_session_id;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'report_ids', to_jsonb(v_report_ids),
    'session_ids', to_jsonb(v_session_ids)
  );
END;
$$;
