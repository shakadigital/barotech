-- =============================================
-- V15 — Auto-Sync Attendance dari Assignment
-- =============================================
-- Trigger: begitu admin simpan/ubah/hapus penugasan,
-- attendance_logs langsung sinkron tanpa perlu Generate manual.
--
-- Rules:
--   INSERT assignment (active + berlaku hari ini) → auto insert attendance draft
--   UPDATE assignment → update attendance hari ini yang belum diverifikasi
--   DELETE assignment → hapus attendance hari ini yang masih draft
-- =============================================

-- 1. Trigger: AFTER INSERT on project_assignments
CREATE OR REPLACE FUNCTION fn_sync_attendance_on_assign_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_hourly NUMERIC;
BEGIN
  -- Hanya jika assignment aktif dan berlaku untuk hari ini
  IF NEW.status = 'active'
     AND NEW.start_date <= CURRENT_DATE
     AND (NEW.end_date IS NULL OR NEW.end_date >= CURRENT_DATE) THEN
    
    v_hourly := COALESCE(NEW.basic_salary / 8, 0);

    -- Insert attendance draft (abaikan kalau sudah ada)
    INSERT INTO attendance_logs (
      employee_id, project_id, check_in, check_out,
      status, hourly_rate, basic_salary, notes
    ) VALUES (
      NEW.employee_id, NEW.project_id,
      CURRENT_DATE || ' 08:00:00', CURRENT_DATE || ' 17:00:00',
      'draft', v_hourly, NEW.basic_salary, NEW.notes
    )
    ON CONFLICT DO NOTHING;  -- mencegah duplikat kalau sudah ada
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_attendance_insert ON project_assignments;
CREATE TRIGGER trg_sync_attendance_insert
  AFTER INSERT ON project_assignments
  FOR EACH ROW EXECUTE FUNCTION fn_sync_attendance_on_assign_insert();


-- 2. Trigger: AFTER UPDATE on project_assignments
CREATE OR REPLACE FUNCTION fn_sync_attendance_on_assign_update()
RETURNS TRIGGER AS $$
DECLARE
  v_hourly NUMERIC;
BEGIN
  -- A. Kalau assignment di-update (gaji, project, notes) dan masih active,
  --    sync ke attendance hari ini yang belum diverifikasi
  IF NEW.status = 'active'
     AND NEW.start_date <= CURRENT_DATE
     AND (NEW.end_date IS NULL OR NEW.end_date >= CURRENT_DATE) THEN
    
    v_hourly := COALESCE(NEW.basic_salary / 8, 0);

    -- Update attendance hari ini yang draft (belum diverifikasi)
    UPDATE attendance_logs
    SET 
      project_id   = NEW.project_id,
      basic_salary = NEW.basic_salary,
      hourly_rate  = v_hourly,
      notes        = NEW.notes
    WHERE employee_id = NEW.employee_id
      AND DATE(check_in) = CURRENT_DATE
      AND status = 'draft';
  END IF;

  -- B. Kalau status berubah dari active → ended/paused,
  --    hapus attendance draft hari ini milik assignment ini
  IF NEW.status IN ('ended','paused') AND OLD.status = 'active' THEN
    DELETE FROM attendance_logs
    WHERE employee_id = NEW.employee_id
      AND project_id  = NEW.project_id
      AND DATE(check_in) = CURRENT_DATE
      AND status = 'draft';
  END IF;

  -- C. Kalau assignment di-aktifkan kembali (paused → active),
  --    re-insert attendance draft untuk hari ini
  IF NEW.status = 'active' AND OLD.status = 'paused' THEN
    v_hourly := COALESCE(NEW.basic_salary / 8, 0);

    INSERT INTO attendance_logs (
      employee_id, project_id, check_in, check_out,
      status, hourly_rate, basic_salary, notes
    ) VALUES (
      NEW.employee_id, NEW.project_id,
      CURRENT_DATE || ' 08:00:00', CURRENT_DATE || ' 17:00:00',
      'draft', v_hourly, NEW.basic_salary, NEW.notes
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


-- 3. Trigger: AFTER DELETE on project_assignments
CREATE OR REPLACE FUNCTION fn_sync_attendance_on_assign_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Hapus attendance_logs draft hari ini milik assignment yang dihapus
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
