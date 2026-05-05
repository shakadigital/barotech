-- =============================================
-- V20 — Daily Activities (Multi-Item Kegiatan)
-- =============================================
-- Fitur:
--   1. Tabel daily_activities untuk multi-item kegiatan per absensi
--   2. Karyawan bisa input kegiatan sendiri saat check-in/check-out
--   3. Admin bisa input kegiatan saat check-in karyawan dari penugasan
--   4. RLS policies untuk akses berdasarkan role
-- =============================================

-- ── 1. Buat tabel daily_activities ──────────────────────────────
CREATE TABLE IF NOT EXISTS daily_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id   UUID NOT NULL REFERENCES attendance_logs(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
    CHECK (status IN ('pending', 'done')),
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Index untuk performa ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_daily_activities_attendance ON daily_activities(attendance_id);
CREATE INDEX IF NOT EXISTS idx_daily_activities_created_by ON daily_activities(created_by);

-- ── 3. RLS Policies ─────────────────────────────────────────────
ALTER TABLE daily_activities ENABLE ROW LEVEL SECURITY;

-- Policy: Karyawan bisa SELECT daily_activities milik sendiri (via attendance_logs.employee_id)
DROP POLICY IF EXISTS daily_activities_karyawan_select ON daily_activities;
CREATE POLICY daily_activities_karyawan_select ON daily_activities
  FOR SELECT
  USING (
    attendance_id IN (
      SELECT id FROM attendance_logs WHERE employee_id = auth.uid()
    )
  );

-- Policy: Admin ke atas bisa SELECT semua
DROP POLICY IF EXISTS daily_activities_admin_select ON daily_activities;
CREATE POLICY daily_activities_admin_select ON daily_activities
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('superadmin','owner','admin')
    )
  );

-- Policy: Karyawan bisa INSERT daily_activities untuk attendance_logs milik sendiri
DROP POLICY IF EXISTS daily_activities_karyawan_insert ON daily_activities;
CREATE POLICY daily_activities_karyawan_insert ON daily_activities
  FOR INSERT
  WITH CHECK (
    attendance_id IN (
      SELECT id FROM attendance_logs WHERE employee_id = auth.uid()
    )
  );

-- Policy: Karyawan bisa UPDATE daily_activities milik sendiri
DROP POLICY IF EXISTS daily_activities_karyawan_update ON daily_activities;
CREATE POLICY daily_activities_karyawan_update ON daily_activities
  FOR UPDATE
  USING (
    attendance_id IN (
      SELECT id FROM attendance_logs WHERE employee_id = auth.uid()
    )
  )
  WITH CHECK (
    attendance_id IN (
      SELECT id FROM attendance_logs WHERE employee_id = auth.uid()
    )
  );

-- Policy: Admin ke atas bisa INSERT/UPDATE/DELETE semua
DROP POLICY IF EXISTS daily_activities_admin_all ON daily_activities;
CREATE POLICY daily_activities_admin_all ON daily_activities
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('superadmin','owner','admin')
    )
  );
