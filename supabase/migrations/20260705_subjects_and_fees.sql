-- 1. Create batch_subject_faculty junction table if not exists
CREATE TABLE IF NOT EXISTS batch_subject_faculty (
  batch_subject_id UUID REFERENCES batch_subjects(id) ON DELETE CASCADE NOT NULL,
  faculty_id UUID REFERENCES faculty(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (batch_subject_id, faculty_id)
);

-- Enable RLS
ALTER TABLE batch_subject_faculty ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'batch_subject_faculty' AND policyname = 'Public Read Batch Subject Faculty'
  ) THEN
    CREATE POLICY "Public Read Batch Subject Faculty" ON batch_subject_faculty
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'batch_subject_faculty' AND policyname = 'Manage Batch Subject Faculty'
  ) THEN
    CREATE POLICY "Manage Batch Subject Faculty" ON batch_subject_faculty
      FOR ALL TO authenticated USING (true);
  END IF;
END $$;

-- 2. Add subjects_taken column to enrollments table
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS subjects_taken JSONB DEFAULT '[]'::jsonb NOT NULL;

-- 3. Add columns for additional amount to student_fees table
ALTER TABLE student_fees ADD COLUMN IF NOT EXISTS additional_amount NUMERIC(10, 2) DEFAULT 0.00 NOT NULL;
ALTER TABLE student_fees ADD COLUMN IF NOT EXISTS additional_amount_start_month INT CHECK (additional_amount_start_month BETWEEN 1 AND 12);
