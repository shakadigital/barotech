-- Fix RLS Policies for Custom Auth
-- Since we're no longer using Supabase Auth, policies that check auth.uid() won't work
-- This migration updates policies to allow authenticated users to insert/update

-- Drop existing restrictive policies for project_updates
DROP POLICY IF EXISTS "project_updates_insert_policy" ON project_updates;
DROP POLICY IF EXISTS "project_updates_update_policy" ON project_updates;
DROP POLICY IF EXISTS "project_updates_select_policy" ON project_updates;

-- Create new policies for project_updates (allow authenticated users)
CREATE POLICY "project_updates_insert_policy" ON project_updates
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "project_updates_update_policy" ON project_updates
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "project_updates_select_policy" ON project_updates
  FOR SELECT USING (auth.role() = 'authenticated');

-- Fix project_photos policies
DROP POLICY IF EXISTS "project_photos_insert_policy" ON project_photos;
DROP POLICY IF EXISTS "project_photos_select_policy" ON project_photos;

CREATE POLICY "project_photos_insert_policy" ON project_photos
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "project_photos_select_policy" ON project_photos
  FOR SELECT USING (auth.role() = 'authenticated');

-- Fix overtime_logs policies
DROP POLICY IF EXISTS "overtime_logs_insert_policy" ON overtime_logs;
DROP POLICY IF EXISTS "overtime_logs_select_policy" ON overtime_logs;

CREATE POLICY "overtime_logs_insert_policy" ON overtime_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "overtime_logs_select_policy" ON overtime_logs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Fix attendance_logs policies
DROP POLICY IF EXISTS "attendance_logs_insert_policy" ON attendance_logs;
DROP POLICY IF EXISTS "attendance_logs_select_policy" ON attendance_logs;

CREATE POLICY "attendance_logs_insert_policy" ON attendance_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "attendance_logs_select_policy" ON attendance_logs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Fix profiles policies (allow authenticated users to read)
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;

CREATE POLICY "profiles_select_policy" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Enable RLS on all tables
ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
