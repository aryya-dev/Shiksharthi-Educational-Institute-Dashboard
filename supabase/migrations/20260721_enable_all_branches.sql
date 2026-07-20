-- Migration: Enable all branches permanently by setting is_active to true
-- Date: 2026-07-21

UPDATE branches SET is_active = true;
