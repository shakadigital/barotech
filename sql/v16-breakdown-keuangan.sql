-- =============================================
-- V16 — Breakdown Komponen Keuangan
-- =============================================
-- Tambah kolom: uang_makan, transport, tunjangan_lain
-- di project_assignments dan attendance_logs.
-- basic_salary = uang_makan + transport + tunjangan_lain (auto-hitung)
--
-- JUGA termasuk fix v14: check_in/check_out TIME → TIMESTAMPTZ
-- =============================================

-- 0. Fix v14: Alter check_in/check_out dari TIME → TIMESTAMPTZ
-- Harus drop trigger dulu karena bergantung pada kolom check_in/check_out
DROP TRIGGER IF EXISTS on_attendance_time_update ON attendance_logs;

DO $$
BEGIN
  -- check_in
  IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME='attendance_logs' AND COLUMN_NAME='check_in'
      AND DATA_TYPE = 'time without time zone'
  ) THEN
    ALTER TABLE attendance_logs
      ALTER COLUMN check_in TYPE TIMESTAMPTZ
        USING (COALESCE(created_at::DATE + check_in, created_at::DATE + '08:00:00'::TIME));
  END IF;
  -- check_out
  IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME='attendance_logs' AND COLUMN_NAME='check_out'
      AND DATA_TYPE = 'time without time zone'
  ) THEN
    ALTER TABLE attendance_logs
      ALTER COLUMN check_out TYPE TIMESTAMPTZ
        USING (CASE
                 WHEN check_out IS NULL THEN NULL
                 ELSE COALESCE(created_at::DATE + check_out, created_at::DATE + '17:00:00'::TIME)
               END);
  END IF;
END $$;

-- Re-create trigger recalc dengan tipe baru (TIMESTAMPTZ)
CREATE OR REPLACE FUNCTION calc_work_hours(p_in TIMESTAMPTZ, p_out TIMESTAMPTZ)
RETURNS NUMERIC AS $$
DECLARE
  v_minutes INTEGER;
BEGIN
  IF p_in IS NULL OR p_out IS NULL THEN RETURN 8; END IF;
  v_minutes := EXTRACT(EPOCH FROM (p_out - p_in)) / 60;
  IF v_minutes <= 0 THEN v_minutes := 480; END IF;
  RETURN ROUND(v_minutes::NUMERIC / 60, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION recalc_attendance_salary()
RETURNS TRIGGER AS $$
DECLARE
  v_hours   NUMERIC;
  v_rate    NUMERIC;
BEGIN
  IF (NEW.check_in IS DISTINCT FROM OLD.check_in)
  OR (NEW.check_out IS DISTINCT FROM OLD.check_out)
  OR (NEW.hourly_rate IS DISTINCT FROM OLD.hourly_rate) THEN

    v_hours := calc_work_hours(NEW.check_in, NEW.check_out);
    v_rate  := COALESCE(NEW.hourly_rate, OLD.hourly_rate, 0);

    IF v_rate = 0 AND OLD.basic_salary > 0 THEN
      v_rate := ROUND(OLD.basic_salary / 8, 2);
      NEW.hourly_rate := v_rate;
    END IF;

    NEW.basic_salary := ROUND(v_hours * v_rate, 0);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_attendance_time_update
  BEFORE UPDATE OF check_in, check_out, hourly_rate ON attendance_logs
  FOR EACH ROW EXECUTE FUNCTION recalc_attendance_salary();

-- 1. Tambah kolom di project_assignments
ALTER TABLE project_assignments ADD COLUMN IF NOT EXISTS uang_makan      NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE project_assignments ADD COLUMN IF NOT EXISTS transport       NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE project_assignments ADD COLUMN IF NOT EXISTS tunjangan_lain  NUMERIC NOT NULL DEFAULT 0;

-- 2. Tambah kolom di attendance_logs
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS uang_makan      NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS transport       NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS tunjangan_lain  NUMERIC NOT NULL DEFAULT 0;

-- 3. Backfill data lama: basic_salary yang sudah ada → masuk ke uang_makan
UPDATE project_assignments
SET uang_makan = basic_salary
WHERE uang_makan = 0 AND basic_salary > 0;

UPDATE attendance_logs
SET uang_makan = basic_salary
WHERE uang_makan = 0 AND basic_salary > 0;

-- 4. Trigger: auto-hitung basic_salary dari komponen di project_assignments
CREATE OR REPLACE FUNCTION fn_calc_assignment_salary()
RETURNS TRIGGER AS $$
BEGIN
  NEW.basic_salary := COALESCE(NEW.uang_makan, 0)
                    + COALESCE(NEW.transport, 0)
                    + COALESCE(NEW.tunjangan_lain, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calc_assignment_salary ON project_assignments;
CREATE TRIGGER trg_calc_assignment_salary
  BEFORE INSERT OR UPDATE OF uang_makan, transport, tunjangan_lain
  ON project_assignments
  FOR EACH ROW EXECUTE FUNCTION fn_calc_assignment_salary();

-- 5. Trigger INSERT: sync breakdown ke attendance_logs
CREATE OR REPLACE FUNCTION fn_sync_attendance_on_assign_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_hourly NUMERIC;
BEGIN
  IF NEW.status = 'active'
     AND NEW.start_date <= CURRENT_DATE
     AND (NEW.end_date IS NULL OR NEW.end_date >= CURRENT_DATE) THEN
    
    v_hourly := COALESCE(NEW.basic_salary / 8, 0);

    INSERT INTO attendance_logs (
      employee_id, project_id, check_in, check_out,
      status, hourly_rate, basic_salary, notes,
      uang_makan, transport, tunjangan_lain
    ) VALUES (
      NEW.employee_id, NEW.project_id,
      CURRENT_DATE || ' 08:00:00', CURRENT_DATE || ' 17:00:00',
      'draft', v_hourly, NEW.basic_salary, NEW.notes,
      NEW.uang_makan, NEW.transport, NEW.tunjangan_lain
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_attendance_insert ON project_assignments;
CREATE TRIGGER trg_sync_attendance_insert
  AFTER INSERT ON project_assignments
  FOR EACH ROW EXECUTE FUNCTION fn_sync_attendance_on_assign_insert();

-- 6. Trigger UPDATE: sync breakdown ke attendance_logs
CREATE OR REPLACE FUNCTION fn_sync_attendance_on_assign_update()
RETURNS TRIGGER AS $$
DECLARE
  v_hourly NUMERIC;
BEGIN
  -- A. Assignment aktif → update attendance draft hari ini
  IF NEW.status = 'active'
     AND NEW.start_date <= CURRENT_DATE
     AND (NEW.end_date IS NULL OR NEW.end_date >= CURRENT_DATE) THEN
    
    v_hourly := COALESCE(NEW.basic_salary / 8, 0);

    UPDATE attendance_logs
    SET 
      project_id      = NEW.project_id,
      basic_salary    = NEW.basic_salary,
      hourly_rate     = v_hourly,
      notes           = NEW.notes,
      uang_makan      = NEW.uang_makan,
      transport       = NEW.transport,
      tunjangan_lain  = NEW.tunjangan_lain
    WHERE employee_id = NEW.employee_id
      AND DATE(check_in) = CURRENT_DATE
      AND status = 'draft';
  END IF;

  -- B. active → ended/paused: hapus attendance draft hari ini
  IF NEW.status IN ('ended','paused') AND OLD.status = 'active' THEN
    DELETE FROM attendance_logs
    WHERE employee_id = NEW.employee_id
      AND project_id  = NEW.project_id
      AND DATE(check_in) = CURRENT_DATE
      AND status = 'draft';
  END IF;

  -- C. paused → active: re-insert attendance draft
  IF NEW.status = 'active' AND OLD.status = 'paused' THEN
    v_hourly := COALESCE(NEW.basic_salary / 8, 0);

    INSERT INTO attendance_logs (
      employee_id, project_id, check_in, check_out,
      status, hourly_rate, basic_salary, notes,
      uang_makan, transport, tunjangan_lain
    ) VALUES (
      NEW.employee_id, NEW.project_id,
      CURRENT_DATE || ' 08:00:00', CURRENT_DATE || ' 17:00:00',
      'draft', v_hourly, NEW.basic_salary, NEW.notes,
      NEW.uang_makan, NEW.transport, NEW.tunjangan_lain
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_attendance_update ON project_assignments;
CREATE TRIGGER trg_sync_attendance_update
  AFTER UPDATE ON project_assignments
  FOR EACH ROW EXECUTE FUNCTION fn_sync_attendance_on_assign_update();

-- 7. Trigger DELETE
CREATE OR REPLACE FUNCTION fn_sync_attendance_on_assign_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM attendance_logs
  WHERE employee_id = OLD.employee_id
    AND project_id  = OLD.project_id
    AND DATE(check_in) = CURRENT_DATE
    AND status = 'draft';
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_attendance_delete ON project_assignments;
CREATE TRIGGER trg_sync_attendance_delete
  AFTER DELETE ON project_assignments
  FOR EACH ROW EXECUTE FUNCTION fn_sync_attendance_on_assign_delete();

-- 8. Update generate_daily_attendance: include breakdown
CREATE OR REPLACE FUNCTION generate_daily_attendance(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
  attendance_id UUID,
  employee_id   UUID,
  project_id    UUID,
  is_new        BOOLEAN
) AS $$
DECLARE
  v_assign     RECORD;
  v_att_id     UUID;
  v_is_new     BOOLEAN;
  v_hourly     NUMERIC;
  v_user       RECORD;
BEGIN
  -- Karyawan dari assignment
  FOR v_assign IN
    SELECT pa.id, pa.employee_id AS emp_id, pa.project_id AS prj_id,
           pa.basic_salary, pa.notes,
           pa.uang_makan, pa.transport, pa.tunjangan_lain
    FROM project_assignments pa
    JOIN projects p ON p.id = pa.project_id
    WHERE pa.status = 'active'
      AND pa.start_date <= p_date
      AND (pa.end_date IS NULL OR pa.end_date >= p_date)
      AND p.status = 'aktif'
  LOOP
    SELECT id INTO v_att_id
    FROM attendance_logs
    WHERE employee_id = v_assign.emp_id
      AND DATE(check_in) = p_date;

    IF v_att_id IS NULL THEN
      v_hourly := COALESCE(v_assign.basic_salary / 8, 0);
      
      INSERT INTO attendance_logs (
        employee_id, project_id, check_in, check_out,
        status, hourly_rate, basic_salary, notes,
        uang_makan, transport, tunjangan_lain
      ) VALUES (
        v_assign.emp_id, v_assign.prj_id,
        p_date || ' 08:00:00', p_date || ' 17:00:00',
        'draft', v_hourly, v_assign.basic_salary, v_assign.notes,
        v_assign.uang_makan, v_assign.transport, v_assign.tunjangan_lain
      ) RETURNING id INTO v_att_id;
      
      v_is_new := TRUE;
    ELSE
      v_is_new := FALSE;
    END IF;

    RETURN QUERY SELECT v_att_id, v_assign.emp_id, v_assign.prj_id, v_is_new;
  END LOOP;

  -- Non-karyawan
  FOR v_user IN
    SELECT id, basic_salary
    FROM profiles
    WHERE role IN ('admin', 'kepala_gudang', 'kepala_proyek', 'kepala_lapangan')
      AND id NOT IN (
        SELECT employee_id FROM attendance_logs WHERE DATE(check_in) = p_date
      )
  LOOP
    v_hourly := COALESCE(v_user.basic_salary / 8, 0);
    
    INSERT INTO attendance_logs (
      employee_id, project_id, check_in, check_out,
      status, hourly_rate, basic_salary, notes,
      uang_makan, transport, tunjangan_lain
    ) VALUES (
      v_user.id, NULL,
      p_date || ' 08:00:00', p_date || ' 17:00:00',
      'draft', v_hourly, v_user.basic_salary, 'Office attendance - Owner verification required',
      0, 0, 0
    ) RETURNING id INTO v_att_id;
    
    RETURN QUERY SELECT v_att_id, v_user.id, NULL::UUID, TRUE;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
