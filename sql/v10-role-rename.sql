-- =============================================
-- V10 — RENAME ROLES: kepala_teknik → kepala_proyek, kepala_proyek → kepala_lapangan
-- ✅ SUDAH DIJALANKAN — Jangan jalankan ulang
-- =============================================

-- 1. Drop old CHECK constraint first (so data migration can proceed)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Migrate existing data BEFORE adding new constraint
UPDATE profiles SET role = 'kepala_proyek'     WHERE role = 'kepala_teknik';
UPDATE profiles SET role = 'kepala_lapangan'   WHERE role = 'kepala_proyek';

-- 3. Add new CHECK constraint AFTER data is clean
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('superadmin','owner','admin','kepala_proyek','kepala_gudang','kepala_lapangan','karyawan'));

-- 4. Update helper function get_my_role() role validation (if any inline)
-- Note: get_my_role() just reads profiles.role, so it's already fine.

-- 5. Recreate RLS policies with new role names

-- attendance_logs SELECT
DROP POLICY IF EXISTS "attendance_select" ON attendance_logs;
CREATE POLICY "attendance_select" ON attendance_logs FOR SELECT
  USING (
    employee_id = auth.uid()
    OR get_my_role() IN ('superadmin','owner','admin','kepala_proyek','kepala_gudang')
    OR (
      get_my_role() = 'kepala_lapangan'
      AND project_id IN (SELECT id FROM projects WHERE lead_id = auth.uid())
    )
  );

-- attendance_logs UPDATE
DROP POLICY IF EXISTS "attendance_update" ON attendance_logs;
CREATE POLICY "attendance_update" ON attendance_logs FOR UPDATE
  USING (
    get_my_role() IN ('superadmin','owner','admin')
    OR get_my_role() = 'kepala_proyek'
    OR (
      get_my_role() = 'kepala_lapangan'
      AND project_id IN (SELECT id FROM projects WHERE lead_id = auth.uid())
    )
  );

-- overtime_logs SELECT
DROP POLICY IF EXISTS "overtime_select" ON overtime_logs;
CREATE POLICY "overtime_select" ON overtime_logs FOR SELECT
  USING (
    employee_id = auth.uid()
    OR get_my_role() IN ('superadmin','owner','admin','kepala_proyek')
    OR (
      get_my_role() = 'kepala_lapangan'
      AND project_id IN (SELECT id FROM projects WHERE lead_id = auth.uid())
    )
  );

-- project_photos INSERT
DROP POLICY IF EXISTS "photos_insert" ON project_photos;
CREATE POLICY "photos_insert" ON project_photos FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin','kepala_proyek','kepala_lapangan'));

-- project_assignments SELECT
DROP POLICY IF EXISTS "assign_select" ON project_assignments;
CREATE POLICY "assign_select" ON project_assignments FOR SELECT
  USING (
    get_my_role() IN ('superadmin','owner','admin','kepala_proyek')
    OR (
      get_my_role() = 'kepala_lapangan'
      AND project_id IN (SELECT id FROM projects WHERE lead_id = auth.uid())
    )
    OR employee_id = auth.uid()
  );

-- material_orders SELECT
DROP POLICY IF EXISTS material_select ON material_orders;
CREATE POLICY material_select ON material_orders FOR SELECT
  USING (get_my_role() IN ('superadmin','owner','admin','kepala_proyek','kepala_gudang','kepala_lapangan'));

-- material_photos SELECT
DROP POLICY IF EXISTS mphoto_select ON material_photos;
CREATE POLICY mphoto_select ON material_photos FOR SELECT
  USING (get_my_role() IN ('superadmin','owner','admin','kepala_proyek','kepala_gudang','kepala_lapangan'));

-- project_expenses SELECT
DROP POLICY IF EXISTS expense_select ON project_expenses;
CREATE POLICY expense_select ON project_expenses FOR SELECT
  USING (get_my_role() IN ('superadmin','owner','admin','kepala_proyek','kepala_lapangan'));

-- project_updates INSERT
DROP POLICY IF EXISTS "updates_insert" ON project_updates;
CREATE POLICY "updates_insert" ON project_updates FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin','kepala_proyek'));
