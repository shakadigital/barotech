-- =============================================
-- V5 — FASE 2: Overtime Logs & Project Photos
-- ✅ SUDAH DIJALANKAN — Jangan jalankan ulang
-- =============================================

-- 1. Tabel overtime_logs — lembur terpisah
CREATE TABLE IF NOT EXISTS overtime_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id    UUID REFERENCES attendance_logs(id) ON DELETE SET NULL,
  employee_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id       UUID REFERENCES projects(id) ON DELETE SET NULL,
  overtime_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time       TIME,
  end_time         TIME,
  duration_hours   NUMERIC DEFAULT 0,
  overtime_rate    NUMERIC DEFAULT 0,
  overtime_pay     NUMERIC DEFAULT 0,
  location_name    TEXT,
  work_description TEXT,
  photo_url        TEXT,
  created_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RLS overtime_logs
ALTER TABLE overtime_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "overtime_select" ON overtime_logs;
CREATE POLICY "overtime_select" ON overtime_logs FOR SELECT
  USING (
    employee_id = auth.uid()
    OR get_my_role() IN ('superadmin','owner','admin','kepala_teknik')
    OR (
      get_my_role() = 'kepala_proyek'
      AND project_id IN (SELECT id FROM projects WHERE lead_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "overtime_insert" ON overtime_logs;
CREATE POLICY "overtime_insert" ON overtime_logs FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin'));

DROP POLICY IF EXISTS "overtime_update" ON overtime_logs;
CREATE POLICY "overtime_update" ON overtime_logs FOR UPDATE
  USING (get_my_role() IN ('superadmin','owner','admin'));

DROP POLICY IF EXISTS "overtime_delete" ON overtime_logs;
CREATE POLICY "overtime_delete" ON overtime_logs FOR DELETE
  USING (get_my_role() IN ('superadmin','owner'));

-- 3. Tabel project_photos — multiple foto per laporan progress
CREATE TABLE IF NOT EXISTS project_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  update_id   UUID REFERENCES project_updates(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES profiles(id),
  photo_url   TEXT NOT NULL,
  caption     TEXT,
  photo_order INTEGER DEFAULT 1,
  taken_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS project_photos
ALTER TABLE project_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "photos_select" ON project_photos;
CREATE POLICY "photos_select" ON project_photos FOR SELECT USING (true);

DROP POLICY IF EXISTS "photos_insert" ON project_photos;
CREATE POLICY "photos_insert" ON project_photos FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin','kepala_teknik','kepala_proyek'));

DROP POLICY IF EXISTS "photos_delete" ON project_photos;
CREATE POLICY "photos_delete" ON project_photos FOR DELETE
  USING (get_my_role() IN ('superadmin','owner'));

-- 5. Tambah kolom status di attendance_logs (jika belum ada)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME='attendance_logs' AND COLUMN_NAME='status') THEN
    ALTER TABLE attendance_logs ADD COLUMN status TEXT DEFAULT 'draft'
      CHECK (status IN ('draft','verified','absent'));
  END IF;
END $$;
