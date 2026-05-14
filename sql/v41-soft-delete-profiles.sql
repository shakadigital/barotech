-- v41: Soft delete untuk profiles
-- Masalah: hard delete profiles gagal karena ada FK dari attendance_logs,
-- bon_transactions, overtime_logs, salary_payments, dll (17 FK total).
-- Solusi: tambah kolom is_active, delete = set is_active = false.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);
