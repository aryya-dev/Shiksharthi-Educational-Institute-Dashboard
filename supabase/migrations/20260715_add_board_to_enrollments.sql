-- Migration: Add board to enrollments table
-- Date: 2026-07-15

ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS board VARCHAR(20);

ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS check_enrollments_board;
ALTER TABLE enrollments ADD CONSTRAINT check_enrollments_board CHECK (board IN ('ICSE', 'CBSE', 'ISC'));
