-- =============================================
-- V33 — FIX AUTO-SYNC ATTENDANCE STATUS
-- =============================================
-- Masalah: Trigger auto-sync attendance masih menggunakan
-- status 'draft' yang tidak valid setelah V28
-- Fix: Update semua 'draft' menjadi 'pending'
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

    -- Insert attendance pending (abaikan kalau sudah ada)
    INSERT INTO attendance_logs (
      employee_id, project_id, check_in, check_out,
      status, hourly_rate, basic_salary, notes,
      uang_makan, transport, tunjangan_lain
    ) VALUES (
      NEW.employee_id, NEW.project_id,
      (CURRENT_DATE::TIMESTAMP + '08:00:00'::TIME)::TIMESTAMPTZ,
      (CURRENT_DATE::TIMESTAMP + '17:00:00'::TIME)::TIMESTAMPTZ,
      'pending', v_hourly, NEW.basic_salary, NEW.notes,
      COALESCE(NEW.uang_makan, 0), COALESCE(NEW.transport, 0), COALESCE(NEW.tunjangan_lain, 0)
    )
    ON CONFLICT DO NOTHING;  -- mencegah duplikat kalau sudah ada
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

    -- Update attendance hari ini yang pending (belum diverifikasi)
    UPDATE attendance_logs
    SET 
      project_id     = NEW.project_id,
      basic_salary   = NEW.basic_salary,
      hourly_rate    = v_hourly,
      notes          = NEW.notes,
      uang_makan     = COALESCE(NEW.uang_makan, 0),
      transport      = COALESCE(NEW.transport, 0),
      tunjangan_lain = COALESCE(NEW.tunjangan_lain, 0)
    WHERE employee_id = NEW.employee_id
      AND DATE(check_in) = CURRENT_DATE
      AND status = 'pending';
  END IF;

  -- B. Kalau status berubah dari active → ended/paused,
  --    hapus attendance pending hari ini milik assignment ini
  IF NEW.status IN ('ended','paused') AND OLD.status = 'active' THEN
    DELETE FROM attendance_logs
    WHERE employee_id = NEW.employee_id
      AND project_id  = NEW.project_id
      AND DATE(check_in) = CURRENT_DATE
      AND status = 'pending';
  END IF;

  -- C. Kalau assignment di-aktifkan kembali (paused → active),
  --    re-insert attendance pending untuk hari ini
  IF NEW.status = 'active' AND OLD.status = 'paused' THEN
    v_hourly := COALESCE(NEW.basic_salary / 8, 0);

    INSERT INTO attendance_logs (
      employee_id, project_id, check_in, check_out,
      status, hourly_rate, basic_salary, notes,
      uang_makan, transport, tunjangan_lain
    ) VALUES (
      NEW.employee_id, NEW.project_id,
      (CURRENT_DATE::TIMESTAMP + '08:00:00'::TIME)::TIMESTAMPTZ,
      (CURRENT_DATE::TIMESTAMP + '17:00:00'::TIME)::TIMESTAMPTZ,
      'pending', v_hourly, NEW.basic_salary, NEW.notes,
      COALESCE(NEW.uang_makan, 0), COALESCE(NEW.transport, 0), COALESCE(NEW.tunjangan_lain, 0)
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger: AFTER DELETE on project_assignments
CREATE OR REPLACE FUNCTION fn_sync_attendance_on_assign_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Hapus attendance pending hari ini milik assignment yang dihapus
  DELETE FROM attendance_logs
  WHERE employee_id = OLD.employee_id
    AND project_id  = OLD.project_id
    AND DATE(check_in) = CURRENT_DATE
    AND status = 'pending';

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pastikan trigger terpasang
DROP TRIGGER IF EXISTS trg_sync_attendance_insert ON project_assignments;
CREATE TRIGGER trg_sync_attendance_insert
  AFTER INSERT ON project_assignments
  FOR EACH ROW EXECUTE FUNCTION fn_sync_attendance_on_assign_insert();

DROP TRIGGER IF EXISTS trg_sync_attendance_update ON project_assignments;
CREATE TRIGGER trg_sync_attendance_update
  AFTER UPDATE ON project_assignments
  FOR EACH ROW EXECUTE FUNCTION fn_sync_attendance_on_assign_update();

DROP TRIGGER IF EXISTS trg_sync_attendance_delete ON project_assignments;
CREATE TRIGGER trg_sync_attendance_delete
  AFTER DELETE ON project_assignments
  FOR EACH ROW EXECUTE FUNCTION fn_sync_attendance_on_assign_delete();

-- =============================================
-- SELESAI V33
-- =============================================
-- Perubahan:
-- - Status 'draft' → 'pending' di semua trigger
-- - Tambah breakdown (uang_makan, transport, tunjangan_lain)
-- - Sesuai dengan constraint V28
-- =============================================
