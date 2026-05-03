-- =============================================
-- V4 — ROLE RESTRUCTURE
-- Tambah role: kepala_gudang, kepala_proyek
-- Update RLS: admin tidak bisa delete, kepala_teknik akses semua proyek
-- Tambah kolom status di projects
-- ✅ SUDAH DIJALANKAN — Jangan jalankan ulang
-- =============================================

-- 1. Update CHECK constraint role di profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('superadmin','owner','admin','kepala_teknik','kepala_gudang','kepala_proyek','karyawan'));

-- 2. Tambah kolom status di projects
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='projects' AND COLUMN_NAME='status') THEN
    ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'aktif'
      CHECK (status IN ('aktif','selesai','pending'));
  END IF;
END $$;

-- =============================================
-- UPDATE RLS: attendance_logs
-- =============================================

-- Hapus semua policy attendance lama
DROP POLICY IF EXISTS "attendance_select_own"    ON attendance_logs;
DROP POLICY IF EXISTS "attendance_insert"        ON attendance_logs;
DROP POLICY IF EXISTS "attendance_admin"         ON attendance_logs;
DROP POLICY IF EXISTS "attendance_update_kepala" ON attendance_logs;

-- SELECT:
-- - karyawan: hanya milik sendiri
-- - kepala_teknik, kepala_gudang: semua proyek
-- - kepala_proyek: hanya proyek yang dia pegang (lead_id)
-- - admin+: semua
CREATE POLICY "attendance_select" ON attendance_logs FOR SELECT
  USING (
    employee_id = auth.uid()
    OR get_my_role() IN ('superadmin','owner','admin','kepala_teknik','kepala_gudang')
    OR (
      get_my_role() = 'kepala_proyek'
      AND project_id IN (SELECT id FROM projects WHERE lead_id = auth.uid())
    )
  );

-- INSERT: hanya admin+
CREATE POLICY "attendance_insert" ON attendance_logs FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin'));

-- UPDATE (verifikasi):
-- - kepala_teknik: semua proyek
-- - kepala_proyek: hanya proyeknya sendiri
-- - admin+: semua
CREATE POLICY "attendance_update" ON attendance_logs FOR UPDATE
  USING (
    get_my_role() IN ('superadmin','owner','admin')
    OR get_my_role() = 'kepala_teknik'
    OR (
      get_my_role() = 'kepala_proyek'
      AND project_id IN (SELECT id FROM projects WHERE lead_id = auth.uid())
    )
  );

-- DELETE: hanya superadmin & owner
CREATE POLICY "attendance_delete" ON attendance_logs FOR DELETE
  USING (get_my_role() IN ('superadmin','owner'));

-- =============================================
-- UPDATE RLS: profiles
-- =============================================

DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_admin"  ON profiles;

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);

-- INSERT/UPDATE: admin+ (admin tidak bisa delete)
CREATE POLICY "profiles_insert_update" ON profiles FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin'));
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (get_my_role() IN ('superadmin','owner','admin'));

-- DELETE: hanya superadmin & owner
CREATE POLICY "profiles_delete" ON profiles FOR DELETE
  USING (get_my_role() IN ('superadmin','owner'));

-- =============================================
-- UPDATE RLS: projects
-- =============================================

DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_admin"  ON projects;

-- SELECT: semua bisa lihat
-- kepala_teknik: semua proyek
-- kepala_proyek: hanya proyeknya sendiri
CREATE POLICY "projects_select" ON projects FOR SELECT USING (true);

-- INSERT: admin+
CREATE POLICY "projects_insert" ON projects FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin'));

-- UPDATE: admin+ bisa update semua field (termasuk status selesai/finish)
CREATE POLICY "projects_update" ON projects FOR UPDATE
  USING (get_my_role() IN ('superadmin','owner','admin'));

-- DELETE: hanya superadmin & owner
CREATE POLICY "projects_delete" ON projects FOR DELETE
  USING (get_my_role() IN ('superadmin','owner'));

-- =============================================
-- UPDATE RLS: bon_transactions
-- =============================================

DROP POLICY IF EXISTS "bon_select_own" ON bon_transactions;
DROP POLICY IF EXISTS "bon_admin"      ON bon_transactions;

CREATE POLICY "bon_select" ON bon_transactions FOR SELECT
  USING (employee_id = auth.uid() OR get_my_role() IN ('superadmin','owner','admin'));

CREATE POLICY "bon_insert_update" ON bon_transactions FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin'));

CREATE POLICY "bon_delete" ON bon_transactions FOR DELETE
  USING (get_my_role() IN ('superadmin','owner'));
