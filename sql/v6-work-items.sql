-- =============================================
-- V6 — Work Items di attendance_logs
-- ✅ SUDAH DIJALANKAN — Jangan jalankan ulang
-- =============================================

-- Tambah kolom work_items di attendance_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME='attendance_logs' AND COLUMN_NAME='work_items'
  ) THEN
    ALTER TABLE attendance_logs ADD COLUMN work_items TEXT;
  END IF;
END $$;

-- UPDATE RLS: kepala_teknik & kepala_proyek bisa UPDATE work_items
-- (policy attendance_update sudah cover ini dari v4, tidak perlu tambah)
-- Verifikasi policy yang ada:
-- SELECT policyname FROM pg_policies WHERE tablename = 'attendance_logs';
