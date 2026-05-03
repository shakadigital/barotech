-- =============================================
-- V1 — INITIAL SETUP (SUDAH DIJALANKAN ✅)
-- Jangan jalankan ulang file ini.
-- =============================================

-- 1. Tabel profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'karyawan'
    CHECK (role IN ('superadmin','owner','admin','kepala_teknik','karyawan')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='profiles' AND COLUMN_NAME='email') THEN
    ALTER TABLE profiles ADD COLUMN email TEXT UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='profiles' AND COLUMN_NAME='whatsapp_number') THEN
    ALTER TABLE profiles ADD COLUMN whatsapp_number TEXT;
  END IF;
END $$;

-- 2. Tabel projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location_name TEXT,
  lead_id UUID REFERENCES profiles(id),
  progress_pct INTEGER DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabel attendance_logs
CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES profiles(id),
  project_id UUID REFERENCES projects(id),
  check_in TIME,
  check_out TIME,
  notes TEXT DEFAULT 'Hadir',
  basic_salary NUMERIC DEFAULT 0,
  overtime_hours NUMERIC DEFAULT 0,
  overtime_rate NUMERIC DEFAULT 0,
  overtime_pay NUMERIC DEFAULT 0,
  misc_amount NUMERIC DEFAULT 0,
  misc_description TEXT,
  cash_advance NUMERIC DEFAULT 0,
  cash_payout NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='attendance_logs' AND COLUMN_NAME='employee_id') THEN
    ALTER TABLE attendance_logs ADD COLUMN employee_id UUID REFERENCES profiles(id);
  END IF;
END $$;

-- 4. Tabel project_updates
CREATE TABLE IF NOT EXISTS project_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  reported_by UUID REFERENCES profiles(id),
  percentage INTEGER DEFAULT 0 CHECK (percentage BETWEEN 0 AND 100),
  description TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_updates' AND COLUMN_NAME='reported_by') THEN
    ALTER TABLE project_updates ADD COLUMN reported_by UUID REFERENCES profiles(id);
  END IF;
END $$;

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_admin"  ON profiles FOR ALL
  USING (get_my_role() IN ('superadmin','owner','admin'));

CREATE POLICY "projects_select" ON projects FOR SELECT USING (true);
CREATE POLICY "projects_admin"  ON projects FOR ALL
  USING (get_my_role() IN ('superadmin','owner','admin'));

CREATE POLICY "attendance_select_own" ON attendance_logs FOR SELECT
  USING (employee_id = auth.uid() OR get_my_role() IN ('superadmin','owner','admin','kepala_teknik'));
CREATE POLICY "attendance_insert" ON attendance_logs FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin','kepala_teknik'));
CREATE POLICY "attendance_admin" ON attendance_logs FOR ALL
  USING (get_my_role() IN ('superadmin','owner','admin'));

CREATE POLICY "updates_select" ON project_updates FOR SELECT USING (true);
CREATE POLICY "updates_insert" ON project_updates FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin','kepala_teknik'));
CREATE POLICY "updates_admin"  ON project_updates FOR ALL
  USING (get_my_role() IN ('superadmin','owner','admin'));

-- =============================================
-- TRIGGER: auto-create profile saat user register
-- =============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'karyawan')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
