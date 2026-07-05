-- 1. Create subject_chapters table
CREATE TABLE IF NOT EXISTS subject_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_subject_id UUID REFERENCES batch_subjects(id) ON DELETE CASCADE NOT NULL,
  chapter_name VARCHAR(255) NOT NULL,
  max_allotted_lectures INT NOT NULL DEFAULT 10,
  status VARCHAR(20) NOT NULL DEFAULT 'In Progress' CHECK (status IN ('Not Started', 'In Progress', 'Completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(batch_subject_id, chapter_name)
);

-- 2. Enable RLS
ALTER TABLE subject_chapters ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Public Read Subject Chapters" ON subject_chapters 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manage Subject Chapters" ON subject_chapters 
  FOR ALL TO authenticated USING (true);
