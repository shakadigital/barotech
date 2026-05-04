-- =============================================
-- V12 — FIX RLS Policies for Custom Auth
-- =============================================
-- Aplikasi menggunakan custom username/password login
-- (tidak via Supabase Auth session), sehingga:
--   • auth.uid()     = NULL
--   • get_my_role()  = NULL  →  RLS policies gagal
--
-- Fix: gunakan auth.role() IN ('anon','authenticated')
-- untuk write-ops. SELECT di-set ke true karena
-- authorization berbasis role sudah di-handle di
-- aplikasi (JavaScript).
-- =============================================

-- 1. Update get_my_role() supaya tidak return NULL
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RETURN (SELECT role FROM profiles WHERE id = auth.uid());
  END IF;
  RETURN 'anon';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. project_assignments
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "assign_select" ON project_assignments;
DROP POLICY IF EXISTS "assign_insert" ON project_assignments;
DROP POLICY IF EXISTS "assign_update" ON project_assignments;
DROP POLICY IF EXISTS "assign_delete" ON project_assignments;
CREATE POLICY "assign_select" ON project_assignments FOR SELECT USING (true);
CREATE POLICY "assign_insert" ON project_assignments FOR INSERT WITH CHECK (auth.role() IN ('anon','authenticated'));
CREATE POLICY "assign_update" ON project_assignments FOR UPDATE USING (auth.role() IN ('anon','authenticated'));
CREATE POLICY "assign_delete" ON project_assignments FOR DELETE USING (auth.role() IN ('anon','authenticated'));

-- 3. bon_transactions
ALTER TABLE bon_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bon_select" ON bon_transactions;
DROP POLICY IF EXISTS "bon_insert_update" ON bon_transactions;
DROP POLICY IF EXISTS "bon_delete" ON bon_transactions;
CREATE POLICY "bon_select" ON bon_transactions FOR SELECT USING (true);
CREATE POLICY "bon_insert" ON bon_transactions FOR INSERT WITH CHECK (auth.role() IN ('anon','authenticated'));
CREATE POLICY "bon_update" ON bon_transactions FOR UPDATE USING (auth.role() IN ('anon','authenticated'));
CREATE POLICY "bon_delete" ON bon_transactions FOR DELETE USING (auth.role() IN ('anon','authenticated'));

-- 4. material_orders
ALTER TABLE material_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "material_select" ON material_orders;
DROP POLICY IF EXISTS "material_insert" ON material_orders;
DROP POLICY IF EXISTS "material_update" ON material_orders;
DROP POLICY IF EXISTS "material_delete" ON material_orders;
CREATE POLICY "material_select" ON material_orders FOR SELECT USING (true);
CREATE POLICY "material_insert" ON material_orders FOR INSERT WITH CHECK (auth.role() IN ('anon','authenticated'));
CREATE POLICY "material_update" ON material_orders FOR UPDATE USING (auth.role() IN ('anon','authenticated'));
CREATE POLICY "material_delete" ON material_orders FOR DELETE USING (auth.role() IN ('anon','authenticated'));

-- 5. material_photos
ALTER TABLE material_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mphoto_select" ON material_photos;
DROP POLICY IF EXISTS "mphoto_insert" ON material_photos;
DROP POLICY IF EXISTS "mphoto_delete" ON material_photos;
CREATE POLICY "mphoto_select" ON material_photos FOR SELECT USING (true);
CREATE POLICY "mphoto_insert" ON material_photos FOR INSERT WITH CHECK (auth.role() IN ('anon','authenticated'));
CREATE POLICY "mphoto_delete" ON material_photos FOR DELETE USING (auth.role() IN ('anon','authenticated'));

-- 6. project_expenses
ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expense_select" ON project_expenses;
DROP POLICY IF EXISTS "expense_insert" ON project_expenses;
DROP POLICY IF EXISTS "expense_update" ON project_expenses;
DROP POLICY IF EXISTS "expense_delete" ON project_expenses;
CREATE POLICY "expense_select" ON project_expenses FOR SELECT USING (true);
CREATE POLICY "expense_insert" ON project_expenses FOR INSERT WITH CHECK (auth.role() IN ('anon','authenticated'));
CREATE POLICY "expense_update" ON project_expenses FOR UPDATE USING (auth.role() IN ('anon','authenticated'));
CREATE POLICY "expense_delete" ON project_expenses FOR DELETE USING (auth.role() IN ('anon','authenticated'));

-- 7. projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "projects_delete" ON projects;
CREATE POLICY "projects_insert" ON projects FOR INSERT WITH CHECK (auth.role() IN ('anon','authenticated'));
CREATE POLICY "projects_update" ON projects FOR UPDATE USING (auth.role() IN ('anon','authenticated'));
CREATE POLICY "projects_delete" ON projects FOR DELETE USING (auth.role() IN ('anon','authenticated'));

-- 8. profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_update" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.role() IN ('anon','authenticated'));
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.role() IN ('anon','authenticated'));
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (auth.role() IN ('anon','authenticated'));

-- 9. attendance_logs
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attendance_select" ON attendance_logs;
DROP POLICY IF EXISTS "attendance_insert" ON attendance_logs;
DROP POLICY IF EXISTS "attendance_update" ON attendance_logs;
DROP POLICY IF EXISTS "attendance_delete" ON attendance_logs;
DROP POLICY IF EXISTS "attendance_logs_select_policy" ON attendance_logs;
DROP POLICY IF EXISTS "attendance_logs_insert_policy" ON attendance_logs;
CREATE POLICY "attendance_select" ON attendance_logs FOR SELECT USING (true);
CREATE POLICY "attendance_insert" ON attendance_logs FOR INSERT WITH CHECK (auth.role() IN ('anon','authenticated'));
CREATE POLICY "attendance_update" ON attendance_logs FOR UPDATE USING (auth.role() IN ('anon','authenticated'));
CREATE POLICY "attendance_delete" ON attendance_logs FOR DELETE USING (auth.role() IN ('anon','authenticated'));

-- 10. overtime_logs
ALTER TABLE overtime_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "overtime_select" ON overtime_logs;
DROP POLICY IF EXISTS "overtime_insert" ON overtime_logs;
DROP POLICY IF EXISTS "overtime_update" ON overtime_logs;
DROP POLICY IF EXISTS "overtime_delete" ON overtime_logs;
DROP POLICY IF EXISTS "overtime_logs_select_policy" ON overtime_logs;
DROP POLICY IF EXISTS "overtime_logs_insert_policy" ON overtime_logs;
CREATE POLICY "overtime_select" ON overtime_logs FOR SELECT USING (true);
CREATE POLICY "overtime_insert" ON overtime_logs FOR INSERT WITH CHECK (auth.role() IN ('anon','authenticated'));
CREATE POLICY "overtime_update" ON overtime_logs FOR UPDATE USING (auth.role() IN ('anon','authenticated'));
CREATE POLICY "overtime_delete" ON overtime_logs FOR DELETE USING (auth.role() IN ('anon','authenticated'));

-- 11. project_photos
ALTER TABLE project_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "photos_select" ON project_photos;
DROP POLICY IF EXISTS "photos_insert" ON project_photos;
DROP POLICY IF EXISTS "photos_delete" ON project_photos;
DROP POLICY IF EXISTS "project_photos_select_policy" ON project_photos;
DROP POLICY IF EXISTS "project_photos_insert_policy" ON project_photos;
CREATE POLICY "photos_select" ON project_photos FOR SELECT USING (true);
CREATE POLICY "photos_insert" ON project_photos FOR INSERT WITH CHECK (auth.role() IN ('anon','authenticated'));
CREATE POLICY "photos_delete" ON project_photos FOR DELETE USING (auth.role() IN ('anon','authenticated'));

-- 12. project_updates
ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_updates_select_policy" ON project_updates;
DROP POLICY IF EXISTS "project_updates_insert_policy" ON project_updates;
DROP POLICY IF EXISTS "project_updates_update_policy" ON project_updates;
CREATE POLICY "project_updates_select" ON project_updates FOR SELECT USING (true);
CREATE POLICY "project_updates_insert" ON project_updates FOR INSERT WITH CHECK (auth.role() IN ('anon','authenticated'));
CREATE POLICY "project_updates_update" ON project_updates FOR UPDATE USING (auth.role() IN ('anon','authenticated'));
