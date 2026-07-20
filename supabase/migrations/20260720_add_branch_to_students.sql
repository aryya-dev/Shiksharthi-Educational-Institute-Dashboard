-- Migration: Add branch_id and board to students table and update RLS policies
-- Date: 2026-07-20

-- 1. Add columns to students table if not exists
ALTER TABLE students ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS board VARCHAR(20);

-- 2. Populate existing branch_id and board from enrollments
UPDATE students s
SET branch_id = e.branch_id,
    board = COALESCE(s.board, e.board)
FROM enrollments e
WHERE e.student_id = s.id;

-- 3. Drop old RLS policies
DROP POLICY IF EXISTS "View Students if enrolled in user branch" ON students;
DROP POLICY IF EXISTS "Manage Students if director" ON students;

-- 4. Create updated, branch-aware RLS policies
CREATE POLICY "View Students based on branch assignment" ON students FOR SELECT TO authenticated
  USING (
    is_director(auth.uid()) OR
    (branch_id IS NOT NULL AND has_branch_access(auth.uid(), branch_id)) OR
    EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.student_id = students.id AND has_branch_access(auth.uid(), e.branch_id)
    )
  );

CREATE POLICY "Manage Students based on branch assignment" ON students FOR ALL TO authenticated
  USING (
    is_director(auth.uid()) OR
    (branch_id IS NOT NULL AND has_branch_access(auth.uid(), branch_id))
  )
  WITH CHECK (
    is_director(auth.uid()) OR
    (branch_id IS NOT NULL AND has_branch_access(auth.uid(), branch_id))
  );
