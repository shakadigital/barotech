-- =============================================
-- V8 — Attendance Edit: hourly_rate & recalculate
-- ✅ SUDAH DIJALANKAN — Jangan jalankan ulang
-- =============================================

-- 1. Tambah kolom hourly_rate di attendance_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME='attendance_logs' AND COLUMN_NAME='hourly_rate'
  ) THEN
    ALTER TABLE attendance_logs ADD COLUMN hourly_rate NUMERIC DEFAULT 0;
  END IF;
END $$;

-- 2. Isi hourly_rate dari data yang sudah ada (basic_salary / 8)
UPDATE attendance_logs
SET hourly_rate = ROUND(basic_salary / 8, 2)
WHERE hourly_rate = 0 AND basic_salary > 0;

-- 3. Function: hitung durasi jam dari check_in & check_out
CREATE OR REPLACE FUNCTION calc_work_hours(p_in TIME, p_out TIME)
RETURNS NUMERIC AS $$
DECLARE
  v_minutes INTEGER;
BEGIN
  IF p_in IS NULL OR p_out IS NULL THEN RETURN 8; END IF;
  v_minutes := EXTRACT(EPOCH FROM (p_out - p_in)) / 60;
  IF v_minutes <= 0 THEN v_minutes := 480; END IF; -- fallback 8 jam
  RETURN ROUND(v_minutes::NUMERIC / 60, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Function: recalculate basic_salary berdasarkan jam aktual
CREATE OR REPLACE FUNCTION recalc_attendance_salary()
RETURNS TRIGGER AS $$
DECLARE
  v_hours   NUMERIC;
  v_rate    NUMERIC;
BEGIN
  -- Hanya recalculate jika jam berubah
  IF (NEW.check_in IS DISTINCT FROM OLD.check_in)
  OR (NEW.check_out IS DISTINCT FROM OLD.check_out)
  OR (NEW.hourly_rate IS DISTINCT FROM OLD.hourly_rate) THEN

    v_hours := calc_work_hours(NEW.check_in, NEW.check_out);
    v_rate  := COALESCE(NEW.hourly_rate, OLD.hourly_rate, 0);

    -- Jika hourly_rate belum diset, hitung dari basic_salary lama / 8
    IF v_rate = 0 AND OLD.basic_salary > 0 THEN
      v_rate := ROUND(OLD.basic_salary / 8, 2);
      NEW.hourly_rate := v_rate;
    END IF;

    NEW.basic_salary := ROUND(v_hours * v_rate, 0);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_attendance_time_update ON attendance_logs;
CREATE TRIGGER on_attendance_time_update
  BEFORE UPDATE OF check_in, check_out, hourly_rate ON attendance_logs
  FOR EACH ROW EXECUTE FUNCTION recalc_attendance_salary();

-- 5. Update generate_daily_attendance: isi hourly_rate saat generate
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
BEGIN
  FOR v_assign IN
    SELECT pa.id, pa.employee_id, pa.project_id, pa.basic_salary, pa.notes
    FROM project_assignments pa
    JOIN projects p ON p.id = pa.project_id
    WHERE pa.status = 'active'
      AND pa.start_date <= p_date
      AND (pa.end_date IS NULL OR pa.end_date >= p_date)
      AND p.status = 'aktif'
  LOOP
    SELECT id INTO v_att_id
    FROM attendance_logs
    WHERE employee_id = v_assign.employee_id
      AND project_id  = v_assign.project_id
      AND created_at::DATE = p_date
    LIMIT 1;

    IF v_att_id IS NULL THEN
      v_hourly := ROUND(v_assign.basic_salary / 8, 2);

      INSERT INTO attendance_logs (
        employee_id, project_id, basic_salary, hourly_rate,
        status, notes, check_in, check_out
      ) VALUES (
        v_assign.employee_id,
        v_assign.project_id,
        v_assign.basic_salary,
        v_hourly,
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
