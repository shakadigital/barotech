-- Make project_id nullable in attendance_logs
-- This is needed for non-karyawan roles who don't have a specific project assignment

ALTER TABLE attendance_logs ALTER COLUMN project_id DROP NOT NULL;
