-- Disable RLS for Custom Auth
-- Since we're not using Supabase Auth, RLS policies won't work (no JWT token)
-- Disable RLS for tables that need insert/update access

ALTER TABLE project_updates DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_photos DISABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
