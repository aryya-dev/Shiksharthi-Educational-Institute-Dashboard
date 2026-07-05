-- Add school column to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS school VARCHAR(255);
