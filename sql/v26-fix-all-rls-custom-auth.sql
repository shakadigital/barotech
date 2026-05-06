-- =============================================
-- V26 — Fix SEMUA RLS untuk Custom Auth
-- Ganti auth.uid() → get_my_id() di semua tabel
-- Jalankan di Supabase SQL Editor
-- =============================================
-- Tabel yang difix:
--   1. profiles
--   2. projects
--   3. attendance_logs
--   4. project_updates
--   5. overtime_logs
--   6. project_photos
--   7. bon_transactions
--   8. project_assignments
--   9. material_orders
--  10. material_photos
--  11. project_expenses
-- =============================================

-- ── 0. Pastikan helper functions pakai custom auth ──────────────

CREATE OR REPLACE FUNCTION get_my_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM profiles
  WHERE username = current_setting('request.jwt.claims', true)::json->>'username';
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM profiles
  WHERE username = current_setting('request.jwt.claims', true)::json->>'username';
$$;

-- ── 1. profiles ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_admin"  ON profiles;
DROP POLICY IF EXISTS profiles_select   ON profiles;
DROP POLICY IF EXISTS profiles_admin    ON profiles;

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_admin"  ON profiles FOR ALL
  USING (get_my_role() IN ('superadmin','owner','admin'));

-- ── 2. projects ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_admin"  ON projects;
DROP POLICY IF EXISTS projects_select   ON projects;
DROP POLICY IF EXISTS projects_admin    ON projects;

CREATE POLICY "projects_select" ON projects FOR SELECT USING (true);
CREATE POLICY "projects_admin"  ON projects FOR ALL
  USING (get_my_role() IN ('superadmin','owner','admin'));

-- ── 3. attendance_logs ──────────────────────────────────────────
-- Drop semua policy lama (berbagai versi)
DROP POLICY IF EXISTS "attendance_select_own"       ON attendance_logs;
DROP POLICY IF EXISTS "attendance_insert"            ON attendance_logs;
DROP POLICY IF EXISTS "attendance_admin"             ON attendance_logs;
DROP POLICY IF EXISTS "attendance_select"            ON attendance_logs;
DROP POLICY IF EXISTS "attendance_update"            ON attendance_logs;
DROP POLICY IF EXISTS "attendance_delete"            ON attendance_logs;
DROP POLICY IF EXISTS attendance_karyawan_insert     ON attendance_logs;
DROP POLICY IF EXISTS attendance_karyawan_update     ON attendance_logs;
DROP POLICY IF EXISTS attendance_select              ON attendance_logs;
DROP POLICY IF EXISTS attendance_insert              ON attendance_logs;
DROP POLICY IF EXISTS attendance_update              ON attendance_logs;
DROP POLICY IF EXISTS attendance_delete              ON attendance_logs;

-- SELECT: user lihat milik sendiri, admin lihat semua
CREATE POLICY attendance_select ON attendance_logs FOR SELECT
  USING (
    employee_id = get_my_id()
    OR get_my_role() IN ('superadmin','owner','admin','kepala_proyek','kepala_gudang')
    OR (
      get_my_role() = 'kepala_lapangan'
      AND project_id IN (SELECT id FROM projects WHERE lead_id = get_my_id())
    )
  );

-- INSERT: semua role bisa self check-in
CREATE POLICY attendance_insert ON attendance_logs FOR INSERT
  WITH CHECK (
    employee_id = get_my_id()
    OR get_my_role() IN ('superadmin','owner','admin')
  );

-- UPDATE: user update milik sendiri (check-out), admin update semua
CREATE POLICY attendance_update ON attendance_logs FOR UPDATE
  USING (
    employee_id = get_my_id()
    OR get_my_role() IN ('superadmin','owner','admin')
  )
  WITH CHECK (
    employee_id = get_my_id()
    OR get_my_role() IN ('superadmin','owner','admin')
  );

-- DELETE: admin ke atas
CREATE POLICY attendance_delete ON attendance_logs FOR DELETE
  USING (get_my_role() IN ('superadmin','owner','admin'));

-- ── 4. project_updates ──────────────────────────────────────────
DROP POLICY IF EXISTS "updates_select" ON project_updates;
DROP POLICY IF EXISTS "updates_insert" ON project_updates;
DROP POLICY IF EXISTS "updates_admin"  ON project_updates;
DROP POLICY IF EXISTS updates_select   ON project_updates;
DROP POLICY IF EXISTS updates_insert   ON project_updates;
DROP POLICY IF EXISTS updates_admin    ON project_updates;

CREATE POLICY updates_select ON project_updates FOR SELECT USING (true);
CREATE POLICY updates_insert ON project_updates FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin','kepala_proyek','kepala_lapangan'));
CREATE POLICY updates_admin  ON project_updates FOR ALL
  USING (get_my_role() IN ('superadmin','owner','admin'));

-- ── 5. overtime_logs ────────────────────────────────────────────
DROP POLICY IF EXISTS "overtime_select"         ON overtime_logs;
DROP POLICY IF EXISTS "overtime_insert"         ON overtime_logs;
DROP POLICY IF EXISTS "overtime_update"         ON overtime_logs;
DROP POLICY IF EXISTS "overtime_delete"         ON overtime_logs;
DROP POLICY IF EXISTS overtime_karyawan_select  ON overtime_logs;
DROP POLICY IF EXISTS overtime_karyawan_insert  ON overtime_logs;
DROP POLICY IF EXISTS overtime_admin_update     ON overtime_logs;
DROP POLICY IF EXISTS overtime_select           ON overtime_logs;
DROP POLICY IF EXISTS overtime_insert           ON overtime_logs;
DROP POLICY IF EXISTS overtime_update           ON overtime_logs;
DROP POLICY IF EXISTS overtime_delete           ON overtime_logs;

CREATE POLICY overtime_select ON overtime_logs FOR SELECT
  USING (
    employee_id = get_my_id()
    OR get_my_role() IN ('superadmin','owner','admin','kepala_proyek')
    OR (
      get_my_role() = 'kepala_lapangan'
      AND project_id IN (SELECT id FROM projects WHERE lead_id = get_my_id())
    )
  );

CREATE POLICY overtime_insert ON overtime_logs FOR INSERT
  WITH CHECK (
    (employee_id = get_my_id() AND status = 'pending')
    OR get_my_role() IN ('superadmin','owner','admin')
  );

CREATE POLICY overtime_update ON overtime_logs FOR UPDATE
  USING (get_my_role() IN ('superadmin','owner','admin'));

CREATE POLICY overtime_delete ON overtime_logs FOR DELETE
  USING (get_my_role() IN ('superadmin','owner'));

-- ── 6. project_photos ───────────────────────────────────────────
DROP POLICY IF EXISTS "photos_select" ON project_photos;
DROP POLICY IF EXISTS "photos_insert" ON project_photos;
DROP POLICY IF EXISTS "photos_delete" ON project_photos;
DROP POLICY IF EXISTS photos_select   ON project_photos;
DROP POLICY IF EXISTS photos_insert   ON project_photos;
DROP POLICY IF EXISTS photos_delete   ON project_photos;

CREATE POLICY photos_select ON project_photos FOR SELECT USING (true);
CREATE POLICY photos_insert ON project_photos FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin','kepala_proyek','kepala_lapangan'));
CREATE POLICY photos_delete ON project_photos FOR DELETE
  USING (get_my_role() IN ('superadmin','owner'));

-- ── 7. bon_transactions ─────────────────────────────────────────
DROP POLICY IF EXISTS "bon_select_own"      ON bon_transactions;
DROP POLICY IF EXISTS "bon_admin"           ON bon_transactions;
DROP POLICY IF EXISTS "bon_select"          ON bon_transactions;
DROP POLICY IF EXISTS "bon_insert_update"   ON bon_transactions;
DROP POLICY IF EXISTS bon_select            ON bon_transactions;
DROP POLICY IF EXISTS bon_insert            ON bon_transactions;
DROP POLICY IF EXISTS bon_update            ON bon_transactions;
DROP POLICY IF EXISTS bon_delete            ON bon_transactions;

CREATE POLICY bon_select ON bon_transactions FOR SELECT
  USING (
    employee_id = get_my_id()
    OR get_my_role() IN ('superadmin','owner','admin')
  );

CREATE POLICY bon_insert ON bon_transactions FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin'));

CREATE POLICY bon_update ON bon_transactions FOR UPDATE
  USING (get_my_role() IN ('superadmin','owner','admin'));

CREATE POLICY bon_delete ON bon_transactions FOR DELETE
  USING (get_my_role() IN ('superadmin','owner'));

-- ── 8. project_assignments ──────────────────────────────────────
DROP POLICY IF EXISTS "assign_select" ON project_assignments;
DROP POLICY IF EXISTS "assign_insert" ON project_assignments;
DROP POLICY IF EXISTS "assign_update" ON project_assignments;
DROP POLICY IF EXISTS "assign_delete" ON project_assignments;
DROP POLICY IF EXISTS assign_select   ON project_assignments;
DROP POLICY IF EXISTS assign_insert   ON project_assignments;
DROP POLICY IF EXISTS assign_update   ON project_assignments;
DROP POLICY IF EXISTS assign_delete   ON project_assignments;

CREATE POLICY assign_select ON project_assignments FOR SELECT
  USING (
    get_my_role() IN ('superadmin','owner','admin','kepala_proyek','kepala_lapangan')
    OR employee_id = get_my_id()
  );

CREATE POLICY assign_insert ON project_assignments FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin'));

CREATE POLICY assign_update ON project_assignments FOR UPDATE
  USING (get_my_role() IN ('superadmin','owner','admin'));

CREATE POLICY assign_delete ON project_assignments FOR DELETE
  USING (get_my_role() IN ('superadmin','owner'));

-- ── 9. material_orders ──────────────────────────────────────────
DROP POLICY IF EXISTS material_select ON material_orders;
DROP POLICY IF EXISTS material_insert ON material_orders;
DROP POLICY IF EXISTS material_update ON material_orders;
DROP POLICY IF EXISTS material_delete ON material_orders;
DROP POLICY IF EXISTS "material_select" ON material_orders;
DROP POLICY IF EXISTS "material_insert" ON material_orders;
DROP POLICY IF EXISTS "material_update" ON material_orders;
DROP POLICY IF EXISTS "material_delete" ON material_orders;

CREATE POLICY material_select ON material_orders FOR SELECT
  USING (get_my_role() IN ('superadmin','owner','admin','kepala_proyek','kepala_gudang','kepala_lapangan'));

CREATE POLICY material_insert ON material_orders FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin','kepala_gudang'));

CREATE POLICY material_update ON material_orders FOR UPDATE
  USING (get_my_role() IN ('superadmin','owner','admin','kepala_gudang'));

CREATE POLICY material_delete ON material_orders FOR DELETE
  USING (get_my_role() IN ('superadmin','owner'));

-- ── 10. material_photos ─────────────────────────────────────────
DROP POLICY IF EXISTS mphoto_select   ON material_photos;
DROP POLICY IF EXISTS mphoto_insert   ON material_photos;
DROP POLICY IF EXISTS mphoto_delete   ON material_photos;
DROP POLICY IF EXISTS "mphoto_select" ON material_photos;
DROP POLICY IF EXISTS "mphoto_insert" ON material_photos;
DROP POLICY IF EXISTS "mphoto_delete" ON material_photos;

CREATE POLICY mphoto_select ON material_photos FOR SELECT
  USING (get_my_role() IN ('superadmin','owner','admin','kepala_proyek','kepala_gudang','kepala_lapangan'));

CREATE POLICY mphoto_insert ON material_photos FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin','kepala_gudang'));

CREATE POLICY mphoto_delete ON material_photos FOR DELETE
  USING (get_my_role() IN ('superadmin','owner','admin'));

-- ── 11. project_expenses ────────────────────────────────────────
DROP POLICY IF EXISTS expense_select   ON project_expenses;
DROP POLICY IF EXISTS expense_insert   ON project_expenses;
DROP POLICY IF EXISTS expense_update   ON project_expenses;
DROP POLICY IF EXISTS expense_delete   ON project_expenses;
DROP POLICY IF EXISTS "expense_select" ON project_expenses;
DROP POLICY IF EXISTS "expense_insert" ON project_expenses;
DROP POLICY IF EXISTS "expense_update" ON project_expenses;
DROP POLICY IF EXISTS "expense_delete" ON project_expenses;

CREATE POLICY expense_select ON project_expenses FOR SELECT
  USING (get_my_role() IN ('superadmin','owner','admin','kepala_proyek','kepala_lapangan'));

CREATE POLICY expense_insert ON project_expenses FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin'));

CREATE POLICY expense_update ON project_expenses FOR UPDATE
  USING (get_my_role() IN ('superadmin','owner','admin'));

CREATE POLICY expense_delete ON project_expenses FOR DELETE
  USING (get_my_role() IN ('superadmin','owner'));

-- ── 12. daily_activities (sudah di v25, pastikan konsisten) ─────
DROP POLICY IF EXISTS daily_activities_karyawan_select ON daily_activities;
DROP POLICY IF EXISTS daily_activities_admin_select    ON daily_activities;
DROP POLICY IF EXISTS daily_activities_karyawan_insert ON daily_activities;
DROP POLICY IF EXISTS daily_activities_admin_insert    ON daily_activities;
DROP POLICY IF EXISTS daily_activities_karyawan_update ON daily_activities;
DROP POLICY IF EXISTS daily_activities_karyawan_delete ON daily_activities;
DROP POLICY IF EXISTS daily_activities_admin_all       ON daily_activities;

CREATE POLICY daily_activities_select ON daily_activities FOR SELECT
  USING (
    attendance_id IN (SELECT id FROM attendance_logs WHERE employee_id = get_my_id())
    OR get_my_role() IN ('superadmin','owner','admin')
  );

CREATE POLICY daily_activities_insert ON daily_activities FOR INSERT
  WITH CHECK (
    attendance_id IN (SELECT id FROM attendance_logs WHERE employee_id = get_my_id())
    OR get_my_role() IN ('superadmin','owner','admin')
  );

CREATE POLICY daily_activities_update ON daily_activities FOR UPDATE
  USING (
    attendance_id IN (SELECT id FROM attendance_logs WHERE employee_id = get_my_id())
    OR get_my_role() IN ('superadmin','owner','admin')
  );

CREATE POLICY daily_activities_delete ON daily_activities FOR DELETE
  USING (
    attendance_id IN (SELECT id FROM attendance_logs WHERE employee_id = get_my_id())
    OR get_my_role() IN ('superadmin','owner','admin')
  );
