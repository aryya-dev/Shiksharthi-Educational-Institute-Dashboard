-- ============================================================================
-- Migration: Academic Year Rollover Stored Procedure
-- Date: 2026-07-26
-- Description:
--   Automates the end-of-year class promotion:
--     • Class 11 Active students → new enrollment in new year at Class 12
--     • Class 12 Active students → status set to 'Completed' (graduated/archived)
--     • Batches for old year that belong to Class 11 are cloned under the new year
--       with class updated to 12. Class 12 batches are not cloned (they graduate).
--   Returns a JSONB summary of all actions taken.
-- ============================================================================

CREATE OR REPLACE FUNCTION rollover_academic_year(p_new_year_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_year_id       UUID;
  v_old_year_label    VARCHAR;
  v_new_year_label    VARCHAR;

  -- Batch cloning
  v_old_batch         RECORD;
  v_new_batch_id      UUID;
  v_old_subject       RECORD;

  -- Enrollment promotion
  v_enrollment        RECORD;
  v_new_class         VARCHAR(10);
  v_new_batch_for_enr UUID;

  -- Counters
  v_promoted_count    INT := 0;
  v_graduated_count   INT := 0;
  v_batches_cloned    INT := 0;
  v_errors            JSONB := '[]'::jsonb;

  -- Batch mapping: old_batch_id -> new_batch_id
  -- Using a temp table for portability
BEGIN

  -- ── 0. Validate new year exists and is not already current ─────────────────
  IF NOT EXISTS (SELECT 1 FROM academic_years WHERE id = p_new_year_id) THEN
    RAISE EXCEPTION 'New academic year ID does not exist: %', p_new_year_id;
  END IF;

  SELECT label INTO v_new_year_label FROM academic_years WHERE id = p_new_year_id;

  SELECT id, label INTO v_old_year_id, v_old_year_label
  FROM academic_years WHERE is_current = true LIMIT 1;

  IF v_old_year_id IS NULL THEN
    RAISE EXCEPTION 'No current academic year is set. Cannot roll over.';
  END IF;

  IF v_old_year_id = p_new_year_id THEN
    RAISE EXCEPTION 'New year is the same as the current year. Cannot roll over to itself.';
  END IF;

  -- ── 1. Create a temporary table to map old batch IDs → new batch IDs ───────
  CREATE TEMP TABLE _batch_map (
    old_batch_id UUID,
    new_batch_id UUID
  ) ON COMMIT DROP;

  -- ── 2. Clone Class 11 batches (only) into the new year as Class 12 ─────────
  FOR v_old_batch IN
    SELECT b.*, br.id AS branch_id_val
    FROM batches b
    JOIN branches br ON br.id = b.branch_id
    WHERE b.academic_year_id = v_old_year_id
      AND b.class = '11'
  LOOP
    -- Build a new batch name: replace "11" with "12" in the name string if present,
    -- otherwise prepend "Class 12 " to the old name
    DECLARE
      v_new_name VARCHAR(100);
    BEGIN
      v_new_name := REPLACE(v_old_batch.name, '11', '12');
      IF v_new_name = v_old_batch.name THEN
        v_new_name := 'Class 12 ' || v_old_batch.name;
      END IF;

      -- Insert new batch (skip if already exists — idempotent)
      INSERT INTO batches (name, class, branch_id, academic_year_id)
      VALUES (v_new_name, '12', v_old_batch.branch_id, p_new_year_id)
      ON CONFLICT (branch_id, academic_year_id, name) DO UPDATE
        SET class = EXCLUDED.class
      RETURNING id INTO v_new_batch_id;

      -- Store mapping
      INSERT INTO _batch_map (old_batch_id, new_batch_id)
      VALUES (v_old_batch.id, v_new_batch_id)
      ON CONFLICT DO NOTHING;

      -- Clone batch_subjects from old batch to new batch
      FOR v_old_subject IN
        SELECT * FROM batch_subjects WHERE batch_id = v_old_batch.id
      LOOP
        INSERT INTO batch_subjects (batch_id, subject_name, faculty_id, current_chapter, progress_percentage)
        VALUES (v_new_batch_id, v_old_subject.subject_name, v_old_subject.faculty_id, '', 0)
        ON CONFLICT (batch_id, subject_name) DO NOTHING;
      END LOOP;

      v_batches_cloned := v_batches_cloned + 1;
    END;
  END LOOP;

  -- ── 3. Process existing enrollments from the current year ──────────────────
  FOR v_enrollment IN
    SELECT e.*
    FROM enrollments e
    WHERE e.academic_year_id = v_old_year_id
      AND e.status = 'Active'
  LOOP
    BEGIN
      IF v_enrollment.class = '11' THEN
        -- Look up the new batch from mapping
        SELECT bm.new_batch_id INTO v_new_batch_for_enr
        FROM _batch_map bm
        WHERE bm.old_batch_id = v_enrollment.batch_id;

        -- Create new enrollment for the next year at class 12
        INSERT INTO enrollments (
          student_id, academic_year_id, branch_id, class,
          batch_id, package_type, add_on_subjects, subjects_taken,
          board, status, status_effective_date, previous_enrollment_id
        )
        VALUES (
          v_enrollment.student_id,
          p_new_year_id,
          v_enrollment.branch_id,
          '12',
          v_new_batch_for_enr, -- may be NULL if old batch wasn't class 11 batch; that's OK, editable later
          v_enrollment.package_type,
          v_enrollment.add_on_subjects,
          v_enrollment.subjects_taken,
          v_enrollment.board,
          'Active',
          CURRENT_DATE,
          v_enrollment.id
        )
        ON CONFLICT (student_id, academic_year_id) DO NOTHING; -- Idempotent: skip if already promoted

        v_promoted_count := v_promoted_count + 1;

      ELSIF v_enrollment.class = '12' THEN
        -- Graduate: mark as Completed in old year
        UPDATE enrollments
        SET status = 'Completed',
            status_effective_date = CURRENT_DATE,
            updated_at = NOW()
        WHERE id = v_enrollment.id;

        v_graduated_count := v_graduated_count + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'enrollment_id', v_enrollment.id,
        'student_id', v_enrollment.student_id,
        'error', SQLERRM
      );
    END;
  END LOOP;

  -- ── 4. Switch active academic year ─────────────────────────────────────────
  UPDATE academic_years SET is_current = false WHERE is_current = true;
  UPDATE academic_years SET is_current = true  WHERE id = p_new_year_id;

  -- ── 5. Return summary ──────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'success',          true,
    'old_year',         v_old_year_label,
    'new_year',         v_new_year_label,
    'promoted_count',   v_promoted_count,
    'graduated_count',  v_graduated_count,
    'batches_cloned',   v_batches_cloned,
    'errors',           v_errors
  );
END;
$$;

-- ── Preview helper: call this BEFORE rollover to show counts ─────────────────
CREATE OR REPLACE FUNCTION preview_rollover(p_new_year_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_year_id       UUID;
  v_old_year_label    VARCHAR;
  v_new_year_label    VARCHAR;
  v_promoted_count    INT;
  v_graduated_count   INT;
  v_batches_to_clone  INT;
  v_promoted_names    JSONB;
  v_graduated_names   JSONB;
BEGIN
  SELECT id, label INTO v_old_year_id, v_old_year_label
  FROM academic_years WHERE is_current = true LIMIT 1;

  SELECT label INTO v_new_year_label
  FROM academic_years WHERE id = p_new_year_id;

  -- Count promotions (class 11 active)
  SELECT COUNT(*), COALESCE(jsonb_agg(s.name ORDER BY s.name), '[]'::jsonb)
  INTO v_promoted_count, v_promoted_names
  FROM enrollments e
  JOIN students s ON s.id = e.student_id
  WHERE e.academic_year_id = v_old_year_id
    AND e.status = 'Active'
    AND e.class = '11';

  -- Count graduations (class 12 active)
  SELECT COUNT(*), COALESCE(jsonb_agg(s.name ORDER BY s.name), '[]'::jsonb)
  INTO v_graduated_count, v_graduated_names
  FROM enrollments e
  JOIN students s ON s.id = e.student_id
  WHERE e.academic_year_id = v_old_year_id
    AND e.status = 'Active'
    AND e.class = '12';

  -- Count batches to clone (class 11 batches in old year)
  SELECT COUNT(*) INTO v_batches_to_clone
  FROM batches
  WHERE academic_year_id = v_old_year_id AND class = '11';

  RETURN jsonb_build_object(
    'old_year',          v_old_year_label,
    'new_year',          v_new_year_label,
    'promoted_count',    v_promoted_count,
    'promoted_names',    v_promoted_names,
    'graduated_count',   v_graduated_count,
    'graduated_names',   v_graduated_names,
    'batches_to_clone',  v_batches_to_clone
  );
END;
$$;
