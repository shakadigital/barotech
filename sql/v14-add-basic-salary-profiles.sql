-- Add basic_salary column to profiles table for non-karyawan roles
-- This is needed for self-attendance of Admin, Kepala Gudang, Kepala Proyek, Kepala Lapangan

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS basic_salary NUMERIC DEFAULT 0;

-- Update existing non-karyawan users with default salary if they don't have one
UPDATE profiles
SET basic_salary = 5000000 -- Default 5 juta, adjust as needed
WHERE basic_salary = 0
  AND role IN ('admin', 'kepala_gudang', 'kepala_proyek', 'kepala_lapangan');
