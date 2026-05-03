-- =============================================
-- V7 — PROJECT ASSIGNMENTS
-- Sistem assignment karyawan ke proyek (permanen/sementara)
-- ✅ SUDAH DIJALANKAN — Jangan jalankan ulang
-- =============================================

-- 1. Tabel project_assignments
CREATE TABLE IF NOT EXISTS project_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  basic_salary  NUMERIC NOT NULL DEFAULT 0,
  start_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date      DATE,                          -- NULL = sampai proyek selesai
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','paused','ended')),
  notes         TEXT,                          -- keterangan, misal "Pindah Tugas"
  paused_by_id  UUID REFERENCES project_assignments(id), -- assignment baru yang pause ini
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk query cepat
CREATE INDEX IF NOT EXISTS idx_assignments_employee ON project_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_assignments_project  ON project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status   ON project_assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_dates    ON project_assignments(start_date, end_date);

-- 2. RLS
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assign_select" ON project_assignments;
CREATE POLICY "assign_select" ON project_assignments FOR SELECT
  USING (
    get_my_role() IN ('superadmin','owner','admin','kepala_teknik')
    OR (
      get_my_role() = 'kepala_proyek'
      AND project_id IN (SELECT id FROM projects WHERE lead_id = auth.uid())
    )
    OR employee_id = auth.uid()
  );

DROP POLICY IF EXISTS "assign_insert" ON project_assignments;
CREATE POLICY "assign_insert" ON project_assignments FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin'));

DROP POLICY IF EXISTS "assign_update" ON project_assignments;
CREATE POLICY "assign_update" ON project_assignments FOR UPDATE
  USING (get_my_role() IN ('superadmin','owner','admin'));

DROP POLICY IF EXISTS "assign_delete" ON project_assignments;
CREATE POLICY "assign_delete" ON project_assignments FOR DELETE
  USING (get_my_role() IN ('superadmin','owner'));

-- 3. Trigger: auto-pause assignment lama saat ada assignment baru
CREATE OR REPLACE FUNCTION auto_pause_previous_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_old_id UUID;
  v_old_project_name TEXT;
BEGIN
  -- Cari assignment aktif lain untuk karyawan ini
  SELECT pa.id, p.name
  INTO v_old_id, v_old_project_name
  FROM project_assignments pa
  JOIN projects p ON p.id = pa.project_id
  WHERE pa.employee_id = NEW.employee_id
    AND pa.status = 'active'
    AND pa.id != NEW.id
  LIMIT 1;

  IF v_old_id IS NOT NULL THEN
    -- Pause assignment lama
    UPDATE project_assignments
    SET
      status      = 'paused',
      end_date    = CURRENT_DATE,
      paused_by_id = NEW.id,
      updated_at  = NOW()
    WHERE id = v_old_id;

    -- Beri keterangan di assignment baru jika belum ada
    IF NEW.notes IS NULL OR NEW.notes = '' THEN
      NEW.notes := 'Pindah Tugas dari: ' || v_old_project_name;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_assignment_insert ON project_assignments;
CREATE TRIGGER on_assignment_insert
  BEFORE INSERT ON project_assignments
  FOR EACH ROW EXECUTE FUNCTION auto_pause_previous_assignment();

-- 4. Trigger: auto-resume assignment lama saat assignment sementara berakhir
CREATE OR REPLACE FUNCTION auto_resume_paused_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Jika assignment di-ended/paused, cek apakah ada assignment yang di-pause oleh ini
  IF NEW.status IN ('ended','paused') AND OLD.status = 'active' THEN
    UPDATE project_assignments
    SET
      status     = 'active',
      end_date   = NULL,
      updated_at = NOW()
    WHERE paused_by_id = NEW.id
      AND status = 'paused';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_assignment_status_change ON project_assignments;
CREATE TRIGGER on_assignment_status_change
  AFTER UPDATE OF status ON project_assignments
  FOR EACH ROW EXECUTE FUNCTION auto_resume_paused_assignment();

-- 5. Function: generate attendance harian dari assignment aktif
--    Dipanggil dari frontend saat kepala buka halaman absensi
CREATE OR REPLACE FUNCTION generate_daily_attendance(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
  attendance_id UUID,
  employee_id   UUID,
  project_id    UUID,
  is_new        BOOLEAN
) AS $$
DECLARE
  v_assign RECORD;
  v_att_id UUID;
  v_is_new BOOLEAN;
BEGIN
  -- Loop semua assignment aktif yang berlaku hari ini
  FOR v_assign IN
    SELECT pa.id, pa.employee_id, pa.project_id, pa.basic_salary, pa.notes
    FROM project_assignments pa
    JOIN projects p ON p.id = pa.project_id
    WHERE pa.status = 'active'
      AND pa.start_date <= p_date
      AND (pa.end_date IS NULL OR pa.end_date >= p_date)
      AND p.status = 'aktif'
  LOOP
    -- Cek apakah sudah ada attendance hari ini
    SELECT id INTO v_att_id
    FROM attendance_logs
    WHERE employee_id = v_assign.employee_id
      AND project_id  = v_assign.project_id
      AND created_at::DATE = p_date
    LIMIT 1;

    IF v_att_id IS NULL THEN
      -- Belum ada → insert baru
      INSERT INTO attendance_logs (
        employee_id, project_id, basic_salary,
        status, notes, check_in, check_out
      ) VALUES (
        v_assign.employee_id,
        v_assign.project_id,
        v_assign.basic_salary,
        'draft',
        COALESCE(v_assign.notes, 'Pending'),
        '08:00:00',
        '17:00:00'
      )
      RETURNING id INTO v_att_id;
      v_is_new := TRUE;
    ELSE
      v_is_new := FALSE;
    END IF;

    attendance_id := v_att_id;
    employee_id   := v_assign.employee_id;
    project_id    := v_assign.project_id;
    is_new        := v_is_new;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function: end assignment saat proyek selesai
CREATE OR REPLACE FUNCTION end_project_assignments()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'selesai' AND OLD.status != 'selesai' THEN
    UPDATE project_assignments
    SET status = 'ended', end_date = CURRENT_DATE, updated_at = NOW()
    WHERE project_id = NEW.id AND status IN ('active','paused');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_project_finished ON projects;
CREATE TRIGGER on_project_finished
  AFTER UPDATE OF status ON projects
  FOR EACH ROW EXECUTE FUNCTION end_project_assignments();
