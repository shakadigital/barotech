-- ============================================================
-- V19: Self check-in/out untuk semua role + overtime request oleh karyawan
-- ============================================================
-- Fitur:
--   1. Semua user bisa check-in & check-out mandiri
--   2. Lokasi GPS tersimpan saat check-in & check-out
--   3. Auto check-out setelah 15 jam jika belum check-out
--   4. Karyawan bisa mengajukan permintaan lembur (status: pending)
--   5. Admin ke atas verifikasi lembur (approve/reject + edit jam & upah)
--   6. Tag lokasi hanya terbaca oleh admin ke atas
-- ============================================================

-- ── 0. Function definitions (MUST be before RLS policies) ──

-- Helper: ambil ID user yang login (via JWT claims)
CREATE OR REPLACE FUNCTION get_my_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM profiles
  WHERE username = current_setting('request.jwt.claims', true)::json->>'username';
$$;

-- Pastikan get_my_role() ada (sudah dari v1, tapi confirm)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT role FROM profiles
  WHERE username = current_setting('request.jwt.claims', true)::json->>'username';
$$;

-- Auto check-out: record yang sudah > 15 jam dari check_in dan belum check_out
CREATE OR REPLACE FUNCTION auto_checkout_stale()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE attendance_logs
  SET check_out = check_in + INTERVAL '15 hours',
      notes     = COALESCE(notes, 'Hadir') || ' [Auto check-out: 15 jam]'
  WHERE check_out IS NULL
    AND check_in < NOW() - INTERVAL '15 hours';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- ── 1. Tambah kolom lokasi di attendance_logs ──────────────
ALTER TABLE attendance_logs
  ADD COLUMN IF NOT EXISTS checkin_lat  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS checkin_lng  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS checkout_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS checkout_lng DOUBLE PRECISION;

-- ── 2. Tambah kolom status & verified_by di overtime_logs ──
ALTER TABLE overtime_logs
  ADD COLUMN IF NOT EXISTS status      TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);

-- Backfill: data lama dianggap approved
UPDATE overtime_logs SET status = 'approved' WHERE status IS NULL OR status = 'approved';

-- ── 3. RLS: Karyawan bisa INSERT attendance_logs (self check-in) ──
DROP POLICY IF EXISTS attendance_karyawan_insert ON attendance_logs;
CREATE POLICY attendance_karyawan_insert ON attendance_logs
  FOR INSERT
  WITH CHECK (employee_id = get_my_id());

-- ── 4. RLS: Karyawan bisa UPDATE attendance_logs (self check-out) ──
DROP POLICY IF EXISTS attendance_karyawan_update ON attendance_logs;
CREATE POLICY attendance_karyawan_update ON attendance_logs
  FOR UPDATE
  USING (employee_id = get_my_id())
  WITH CHECK (employee_id = get_my_id());

-- ── 5. RLS: Karyawan bisa SELECT overtime_logs milik sendiri ──
DROP POLICY IF EXISTS overtime_karyawan_select ON overtime_logs;
CREATE POLICY overtime_karyawan_select ON overtime_logs
  FOR SELECT
  USING (employee_id = get_my_id());

-- ── 6. RLS: Karyawan bisa INSERT overtime_logs (ajukan lembur) ──
DROP POLICY IF EXISTS overtime_karyawan_insert ON overtime_logs;
CREATE POLICY overtime_karyawan_insert ON overtime_logs
  FOR INSERT
  WITH CHECK (employee_id = get_my_id() AND status = 'pending');

-- ── 7. RLS: Admin ke atas bisa UPDATE overtime_logs (verifikasi) ──
DROP POLICY IF EXISTS overtime_admin_update ON overtime_logs;
CREATE POLICY overtime_admin_update ON overtime_logs
  FOR UPDATE
  USING (get_my_role() IN ('superadmin','owner','admin'));
