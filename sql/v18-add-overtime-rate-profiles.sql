-- =============================================
-- V18 — Add overtime_rate to profiles
-- =============================================
-- Tambah kolom overtime_rate (ongkos lembur per jam default) di profiles
-- =============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS overtime_rate NUMERIC DEFAULT 0;

-- Set default overtime_rate untuk karyawan yang sudah ada (misal 15% dari gaji per jam)
UPDATE profiles
SET overtime_rate = COALESCE(basic_salary, 0) / 8 * 1.5
WHERE overtime_rate = 0 AND role = 'karyawan';
