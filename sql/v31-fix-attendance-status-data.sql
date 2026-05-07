-- =============================================
-- V31 — FIX ATTENDANCE STATUS DATA
-- =============================================
-- Membersihkan data attendance_logs yang masih menggunakan
-- status lama ('verified', 'absent', 'draft') dan mengubahnya
-- ke status baru yang sesuai dengan constraint v28
-- =============================================

-- 1. Update status lama ke status baru
UPDATE attendance_logs 
SET status = 'hadir' 
WHERE status = 'verified';

UPDATE attendance_logs 
SET status = 'tidak_hadir' 
WHERE status = 'absent';

UPDATE attendance_logs 
SET status = 'pending' 
WHERE status = 'draft';

-- 2. Update status NULL menjadi 'pending'
UPDATE attendance_logs 
SET status = 'pending' 
WHERE status IS NULL;

-- 3. Update status yang tidak dikenali menjadi 'pending'
UPDATE attendance_logs 
SET status = 'pending' 
WHERE status NOT IN ('hadir', 'tidak_hadir', 'pending', 'libur', 'izin', 'sakit');

-- 4. Verifikasi hasil
SELECT 
  status, 
  COUNT(*) as jumlah 
FROM attendance_logs 
GROUP BY status 
ORDER BY status;

-- =============================================
-- SELESAI V31
-- =============================================
-- Setelah menjalankan file ini:
-- 1. Semua data attendance_logs sudah menggunakan status baru
-- 2. Tidak ada lagi error constraint violation saat check-in/check-out
-- 3. Status yang valid: hadir, tidak_hadir, pending, libur, izin, sakit
-- =============================================
