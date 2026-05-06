-- =============================================
-- V27 — Fix RLS: Kembalikan ke Custom Auth Tanpa JWT
-- =============================================
--
-- MASALAH YANG DIPERBAIKI:
-- V26 menggunakan get_my_id() dan get_my_role() yang
-- bergantung pada current_setting('request.jwt.claims').
-- Fungsi ini hanya bekerja jika ada JWT token dari
-- Supabase Auth — sedangkan aplikasi ini menggunakan
-- CUSTOM AUTH (login via query ke tabel profiles),
-- sehingga TIDAK ADA JWT token yang dikirim ke Supabase.
--
-- Akibatnya:
--   • get_my_id()   → NULL
--   • get_my_role() → NULL
--   • Semua policy write (INSERT/UPDATE/DELETE) → GAGAL
--   • User tidak bisa check-in, verifikasi, dll.
--
-- SOLUSI (Opsi A — tanpa ubah arsitektur):
-- Kembalikan policy write-ops ke pendekatan v12:
--   • SELECT  → USING (true) atau filter di JS
--   • INSERT  → WITH CHECK (auth.role() IN ('anon','authenticated'))
--   • UPDATE  → USING (auth.role() IN ('anon','authenticated'))
--   • DELETE  → USING (auth.role() IN ('anon','authenticated'))
--
-- Penjelasan auth.role():
--   • Supabase selalu mengenali koneksi sebagai 'anon'
--     (pakai anon key) atau 'authenticated' (pakai service key).
--   • Ini BUKAN Supabase Auth — hanya identifikasi jenis
--     koneksi di level PostgreSQL.
--   • Kontrol akses berbasis role (siapa boleh apa)
--     tetap sepenuhnya di JavaScript (state.user.role).
--
-- Tabel yang difix:
--   1.  profiles
--   2.  projects
--   3.  attendance_logs
--   4.  project_updates
--   5.  overtime_logs
--   6.  project_photos
--   7.  bon_transactions
--   8.  project_assignments
--   9.  material_orders
--  10.  material_photos
--  11.  project_expenses
--  12.  daily_activities
-- =============================================

-- ── 0. Nonaktifkan get_my_id() dan get_my_role() ───────────────
-- Fungsi ini tidak bisa dipakai tanpa JWT, tapi kita biarkan
-- tetap ada (tidak di-drop) agar tidak merusak referensi lain.
-- Cukup override supaya selalu return NULL secara aman.

CREATE OR REPLACE FUNCTION get_my_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  -- Tidak digunakan di custom auth (tidak ada JWT claims).
  -- Selalu return NULL agar tidak menyebabkan error.
  SELECT NULL::UUID;
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  -- Tidak digunakan di custom auth (tidak ada JWT claims).
  -- Selalu return NULL agar tidak menyebabkan error.
  SELECT NULL::TEXT;
$$;

-- ── 1. profiles ─────────────────────────────────────────────────
-- SELECT: semua bisa baca (login butuh baca profiles)
-- WRITE : siapa saja dengan koneksi valid (kontrol di JS)
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_admin"  ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;
DROP POLICY IF EXISTS profiles_select   ON profiles;
DROP POLICY IF EXISTS profiles_admin    ON profiles;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE USING (auth.role() IN ('anon', 'authenticated'));

-- ── 2. projects ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_admin"  ON projects;
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "projects_delete" ON projects;
DROP POLICY IF EXISTS projects_select   ON projects;
DROP POLICY IF EXISTS projects_admin    ON projects;

CREATE POLICY "projects_select" ON projects
  FOR SELECT USING (true);

CREATE POLICY "projects_insert" ON projects
  FOR INSERT WITH CHECK (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "projects_update" ON projects
  FOR UPDATE USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "projects_delete" ON projects
  FOR DELETE USING (auth.role() IN ('anon', 'authenticated'));

-- ── 3. attendance_logs ──────────────────────────────────────────
-- Ini tabel utama yang menyebabkan check-in gagal di v26.
DROP POLICY IF EXISTS "attendance_select_own"   ON attendance_logs;
DROP POLICY IF EXISTS "attendance_insert"        ON attendance_logs;
DROP POLICY IF EXISTS "attendance_admin"         ON attendance_logs;
DROP POLICY IF EXISTS "attendance_select"        ON attendance_logs;
DROP POLICY IF EXISTS "attendance_update"        ON attendance_logs;
DROP POLICY IF EXISTS "attendance_delete"        ON attendance_logs;
DROP POLICY IF EXISTS attendance_karyawan_insert ON attendance_logs;
DROP POLICY IF EXISTS attendance_karyawan_update ON attendance_logs;
DROP POLICY IF EXISTS attendance_select          ON attendance_logs;
DROP POLICY IF EXISTS attendance_insert          ON attendance_logs;
DROP POLICY IF EXISTS attendance_update          ON attendance_logs;
DROP POLICY IF EXISTS attendance_delete          ON attendance_logs;

CREATE POLICY "attendance_select" ON attendance_logs
  FOR SELECT USING (true);

CREATE POLICY "attendance_insert" ON attendance_logs
  FOR INSERT WITH CHECK (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "attendance_update" ON attendance_logs
  FOR UPDATE USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "attendance_delete" ON attendance_logs
  FOR DELETE USING (auth.role() IN ('anon', 'authenticated'));

-- ── 4. project_updates ──────────────────────────────────────────
DROP POLICY IF EXISTS "updates_select" ON project_updates;
DROP POLICY IF EXISTS "updates_insert" ON project_updates;
DROP POLICY IF EXISTS "updates_admin"  ON project_updates;
DROP POLICY IF EXISTS updates_select   ON project_updates;
DROP POLICY IF EXISTS updates_insert   ON project_updates;
DROP POLICY IF EXISTS updates_admin    ON project_updates;

CREATE POLICY "updates_select" ON project_updates
  FOR SELECT USING (true);

CREATE POLICY "updates_insert" ON project_updates
  FOR INSERT WITH CHECK (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "updates_update" ON project_updates
  FOR UPDATE USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "updates_delete" ON project_updates
  FOR DELETE USING (auth.role() IN ('anon', 'authenticated'));

-- ── 5. overtime_logs ────────────────────────────────────────────
DROP POLICY IF EXISTS "overtime_select"        ON overtime_logs;
DROP POLICY IF EXISTS "overtime_insert"        ON overtime_logs;
DROP POLICY IF EXISTS "overtime_update"        ON overtime_logs;
DROP POLICY IF EXISTS "overtime_delete"        ON overtime_logs;
DROP POLICY IF EXISTS overtime_karyawan_select ON overtime_logs;
DROP POLICY IF EXISTS overtime_karyawan_insert ON overtime_logs;
DROP POLICY IF EXISTS overtime_admin_update    ON overtime_logs;
DROP POLICY IF EXISTS overtime_select          ON overtime_logs;
DROP POLICY IF EXISTS overtime_insert          ON overtime_logs;
DROP POLICY IF EXISTS overtime_update          ON overtime_logs;
DROP POLICY IF EXISTS overtime_delete          ON overtime_logs;

CREATE POLICY "overtime_select" ON overtime_logs
  FOR SELECT USING (true);

CREATE POLICY "overtime_insert" ON overtime_logs
  FOR INSERT WITH CHECK (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "overtime_update" ON overtime_logs
  FOR UPDATE USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "overtime_delete" ON overtime_logs
  FOR DELETE USING (auth.role() IN ('anon', 'authenticated'));

-- ── 6. project_photos ───────────────────────────────────────────
DROP POLICY IF EXISTS "photos_select" ON project_photos;
DROP POLICY IF EXISTS "photos_insert" ON project_photos;
DROP POLICY IF EXISTS "photos_delete" ON project_photos;
DROP POLICY IF EXISTS photos_select   ON project_photos;
DROP POLICY IF EXISTS photos_insert   ON project_photos;
DROP POLICY IF EXISTS photos_delete   ON project_photos;

CREATE POLICY "photos_select" ON project_photos
  FOR SELECT USING (true);

CREATE POLICY "photos_insert" ON project_photos
  FOR INSERT WITH CHECK (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "photos_delete" ON project_photos
  FOR DELETE USING (auth.role() IN ('anon', 'authenticated'));

-- ── 7. bon_transactions ─────────────────────────────────────────
DROP POLICY IF EXISTS "bon_select_own"    ON bon_transactions;
DROP POLICY IF EXISTS "bon_admin"         ON bon_transactions;
DROP POLICY IF EXISTS "bon_select"        ON bon_transactions;
DROP POLICY IF EXISTS "bon_insert_update" ON bon_transactions;
DROP POLICY IF EXISTS bon_select          ON bon_transactions;
DROP POLICY IF EXISTS bon_insert          ON bon_transactions;
DROP POLICY IF EXISTS bon_update          ON bon_transactions;
DROP POLICY IF EXISTS bon_delete          ON bon_transactions;

CREATE POLICY "bon_select" ON bon_transactions
  FOR SELECT USING (true);

CREATE POLICY "bon_insert" ON bon_transactions
  FOR INSERT WITH CHECK (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "bon_update" ON bon_transactions
  FOR UPDATE USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "bon_delete" ON bon_transactions
  FOR DELETE USING (auth.role() IN ('anon', 'authenticated'));

-- ── 8. project_assignments ──────────────────────────────────────
DROP POLICY IF EXISTS "assign_select" ON project_assignments;
DROP POLICY IF EXISTS "assign_insert" ON project_assignments;
DROP POLICY IF EXISTS "assign_update" ON project_assignments;
DROP POLICY IF EXISTS "assign_delete" ON project_assignments;
DROP POLICY IF EXISTS assign_select   ON project_assignments;
DROP POLICY IF EXISTS assign_insert   ON project_assignments;
DROP POLICY IF EXISTS assign_update   ON project_assignments;
DROP POLICY IF EXISTS assign_delete   ON project_assignments;

CREATE POLICY "assign_select" ON project_assignments
  FOR SELECT USING (true);

CREATE POLICY "assign_insert" ON project_assignments
  FOR INSERT WITH CHECK (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "assign_update" ON project_assignments
  FOR UPDATE USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "assign_delete" ON project_assignments
  FOR DELETE USING (auth.role() IN ('anon', 'authenticated'));

-- ── 9. material_orders ──────────────────────────────────────────
DROP POLICY IF EXISTS "material_select" ON material_orders;
DROP POLICY IF EXISTS "material_insert" ON material_orders;
DROP POLICY IF EXISTS "material_update" ON material_orders;
DROP POLICY IF EXISTS "material_delete" ON material_orders;
DROP POLICY IF EXISTS material_select   ON material_orders;
DROP POLICY IF EXISTS material_insert   ON material_orders;
DROP POLICY IF EXISTS material_update   ON material_orders;
DROP POLICY IF EXISTS material_delete   ON material_orders;

CREATE POLICY "material_select" ON material_orders
  FOR SELECT USING (true);

CREATE POLICY "material_insert" ON material_orders
  FOR INSERT WITH CHECK (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "material_update" ON material_orders
  FOR UPDATE USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "material_delete" ON material_orders
  FOR DELETE USING (auth.role() IN ('anon', 'authenticated'));

-- ── 10. material_photos ─────────────────────────────────────────
DROP POLICY IF EXISTS "mphoto_select" ON material_photos;
DROP POLICY IF EXISTS "mphoto_insert" ON material_photos;
DROP POLICY IF EXISTS "mphoto_delete" ON material_photos;
DROP POLICY IF EXISTS mphoto_select   ON material_photos;
DROP POLICY IF EXISTS mphoto_insert   ON material_photos;
DROP POLICY IF EXISTS mphoto_delete   ON material_photos;

CREATE POLICY "mphoto_select" ON material_photos
  FOR SELECT USING (true);

CREATE POLICY "mphoto_insert" ON material_photos
  FOR INSERT WITH CHECK (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "mphoto_delete" ON material_photos
  FOR DELETE USING (auth.role() IN ('anon', 'authenticated'));

-- ── 11. project_expenses ────────────────────────────────────────
DROP POLICY IF EXISTS "expense_select" ON project_expenses;
DROP POLICY IF EXISTS "expense_insert" ON project_expenses;
DROP POLICY IF EXISTS "expense_update" ON project_expenses;
DROP POLICY IF EXISTS "expense_delete" ON project_expenses;
DROP POLICY IF EXISTS expense_select   ON project_expenses;
DROP POLICY IF EXISTS expense_insert   ON project_expenses;
DROP POLICY IF EXISTS expense_update   ON project_expenses;
DROP POLICY IF EXISTS expense_delete   ON project_expenses;

CREATE POLICY "expense_select" ON project_expenses
  FOR SELECT USING (true);

CREATE POLICY "expense_insert" ON project_expenses
  FOR INSERT WITH CHECK (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "expense_update" ON project_expenses
  FOR UPDATE USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "expense_delete" ON project_expenses
  FOR DELETE USING (auth.role() IN ('anon', 'authenticated'));

-- ── 12. daily_activities ────────────────────────────────────────
DROP POLICY IF EXISTS daily_activities_select          ON daily_activities;
DROP POLICY IF EXISTS daily_activities_insert          ON daily_activities;
DROP POLICY IF EXISTS daily_activities_update          ON daily_activities;
DROP POLICY IF EXISTS daily_activities_delete          ON daily_activities;
DROP POLICY IF EXISTS daily_activities_karyawan_select ON daily_activities;
DROP POLICY IF EXISTS daily_activities_admin_select    ON daily_activities;
DROP POLICY IF EXISTS daily_activities_karyawan_insert ON daily_activities;
DROP POLICY IF EXISTS daily_activities_admin_insert    ON daily_activities;
DROP POLICY IF EXISTS daily_activities_karyawan_update ON daily_activities;
DROP POLICY IF EXISTS daily_activities_karyawan_delete ON daily_activities;
DROP POLICY IF EXISTS daily_activities_admin_all       ON daily_activities;

CREATE POLICY "daily_activities_select" ON daily_activities
  FOR SELECT USING (true);

CREATE POLICY "daily_activities_insert" ON daily_activities
  FOR INSERT WITH CHECK (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "daily_activities_update" ON daily_activities
  FOR UPDATE USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "daily_activities_delete" ON daily_activities
  FOR DELETE USING (auth.role() IN ('anon', 'authenticated'));

-- =============================================
-- SELESAI
-- Jalankan script ini di Supabase SQL Editor.
-- Setelah dijalankan, coba check-in kembali —
-- seharusnya sudah berhasil.
-- =============================================
