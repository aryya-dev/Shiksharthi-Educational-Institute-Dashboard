-- Add is_transferred column to enrollments table
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS is_transferred BOOLEAN DEFAULT FALSE NOT NULL;
