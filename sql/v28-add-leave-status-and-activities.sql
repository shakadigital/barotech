-- =============================================
-- V28 — ADD LEAVE STATUS & ACTIVITIES COLUMN
-- ✅ SUDAH DIJALANKAN
-- =============================================
-- Menambahkan:
-- 1. Status baru: 'libur', 'izin', 'sakit' untuk attendance_logs
-- 2. Kolom 'kegiatan' untuk mencatat aktivitas user yang hadir
-- =============================================

-- 1. Tambah kolom kegiatan untuk mencatat aktivitas user
ALTER TABLE attendance_logs 
ADD COLUMN IF NOT EXISTS kegiatan TEXT;

COMMENT ON COLUMN attendance_logs.kegiatan IS 'Deskripsi kegiatan yang dilakukan user saat hadir/masuk';

-- 2. Migrasi data existing ke status baru
-- Update status lama ke status baru sebelum mengubah constraint
UPDATE attendance_logs SET status = 'hadir' WHERE status = 'verified';
UPDATE attendance_logs SET status = 'tidak_hadir' WHERE status = 'absent';
UPDATE attendance_logs SET status = 'pending' WHERE status = 'draft';
UPDATE attendance_logs SET status = 'pending' WHERE status IS NULL;

-- Update status yang tidak dikenali menjadi 'pending'
UPDATE attendance_logs 
SET status = 'pending' 
WHERE status NOT IN ('hadir', 'tidak_hadir', 'pending', 'libur', 'izin', 'sakit');

-- 3. Drop constraint lama jika ada
ALTER TABLE attendance_logs 
DROP CONSTRAINT IF EXISTS attendance_logs_status_check;

-- 4. Tambah constraint baru dengan status lengkap
ALTER TABLE attendance_logs 
ADD CONSTRAINT attendance_logs_status_check 
CHECK (status IN ('hadir', 'tidak_hadir', 'pending', 'libur', 'izin', 'sakit'));

-- 5. Buat index untuk mempercepat query berdasarkan status
CREATE INDEX IF NOT EXISTS idx_attendance_status 
ON attendance_logs(status);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_date 
ON attendance_logs(employee_id, created_at);

-- =============================================
-- SELESAI V28
-- =============================================
-- Setelah menjalankan file ini:
-- 1. Admin bisa verifikasi attendance dengan status: hadir, tidak_hadir, libur, izin, sakit
-- 2. User yang hadir bisa mencatat kegiatan di kolom 'kegiatan'
-- 3. Laporan bisa filter berdasarkan status (misal: exclude 'libur' dari perhitungan gaji)
-- 4. Data lama otomatis dimigrasi:
--    - 'verified' → 'hadir'
--    - 'absent' → 'tidak_hadir'
--    - 'draft' → 'pending'
-- =============================================
