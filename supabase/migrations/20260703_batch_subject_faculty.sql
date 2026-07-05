-- 1. Junction table for many-to-many: batch_subjects <-> faculty
CREATE TABLE IF NOT EXISTS batch_subject_faculty (
  batch_subject_id UUID REFERENCES batch_subjects(id) ON DELETE CASCADE NOT NULL,
  faculty_id UUID REFERENCES faculty(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (batch_subject_id, faculty_id)
);

-- 2. Enable RLS
ALTER TABLE batch_subject_faculty ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Public Read Batch Subject Faculty" ON batch_subject_faculty
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manage Batch Subject Faculty" ON batch_subject_faculty
  FOR ALL TO authenticated USING (true);
