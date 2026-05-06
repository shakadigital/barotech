-- =============================================
-- V25 — Fix RLS daily_activities untuk custom auth
-- Ganti auth.uid() → get_my_id() agar kompatibel
-- dengan sistem login username/password (non-Supabase Auth)
-- Jalankan di Supabase SQL Editor
-- =============================================

-- Pastikan get_my_id() ada (dari v19)
CREATE OR REPLACE FUNCTION get_my_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM profiles
  WHERE username = current_setting('request.jwt.claims', true)::json->>'username';
$$;

-- Pastikan get_my_role() ada (dari v1/v19)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM profiles
  WHERE username = current_setting('request.jwt.claims', true)::json->>'username';
$$;

-- ── Drop semua policy lama ──────────────────────────────────────
DROP POLICY IF EXISTS daily_activities_karyawan_select ON daily_activities;
DROP POLICY IF EXISTS daily_activities_admin_select    ON daily_activities;
DROP POLICY IF EXISTS daily_activities_karyawan_insert ON daily_activities;
DROP POLICY IF EXISTS daily_activities_karyawan_update ON daily_activities;
DROP POLICY IF EXISTS daily_activities_admin_all       ON daily_activities;

-- ── Buat ulang dengan get_my_id() / get_my_role() ──────────────

-- SELECT: user bisa lihat kegiatan milik sendiri
CREATE POLICY daily_activities_karyawan_select ON daily_activities
  FOR SELECT
  USING (
    attendance_id IN (
      SELECT id FROM attendance_logs WHERE employee_id = get_my_id()
    )
  );

-- SELECT: admin ke atas bisa lihat semua
CREATE POLICY daily_activities_admin_select ON daily_activities
  FOR SELECT
  USING (
    get_my_role() IN ('superadmin','owner','admin')
  );

-- INSERT: user bisa tambah kegiatan untuk attendance milik sendiri
CREATE POLICY daily_activities_karyawan_insert ON daily_activities
  FOR INSERT
  WITH CHECK (
    attendance_id IN (
      SELECT id FROM attendance_logs WHERE employee_id = get_my_id()
    )
  );

-- INSERT: admin ke atas bisa tambah kegiatan untuk siapapun
CREATE POLICY daily_activities_admin_insert ON daily_activities
  FOR INSERT
  WITH CHECK (
    get_my_role() IN ('superadmin','owner','admin')
  );

-- UPDATE: user bisa update kegiatan milik sendiri
CREATE POLICY daily_activities_karyawan_update ON daily_activities
  FOR UPDATE
  USING (
    attendance_id IN (
      SELECT id FROM attendance_logs WHERE employee_id = get_my_id()
    )
  )
  WITH CHECK (
    attendance_id IN (
      SELECT id FROM attendance_logs WHERE employee_id = get_my_id()
    )
  );

-- DELETE: user bisa hapus kegiatan milik sendiri
CREATE POLICY daily_activities_karyawan_delete ON daily_activities
  FOR DELETE
  USING (
    attendance_id IN (
      SELECT id FROM attendance_logs WHERE employee_id = get_my_id()
    )
  );

-- ALL: admin ke atas bisa semua operasi
CREATE POLICY daily_activities_admin_all ON daily_activities
  FOR ALL
  USING (
    get_my_role() IN ('superadmin','owner','admin')
  );
