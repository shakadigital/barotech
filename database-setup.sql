-- =============================================
-- DATABASE SETUP — Absensi Barotech V2
-- INDEX FILE — Lihat folder sql/ untuk detail
-- =============================================
--
-- Jangan jalankan file ini langsung.
-- Jalankan file di folder sql/ secara berurutan,
-- hanya file yang belum dijalankan (⚠️).
--
-- ┌───────────────────────────────────────────────────────┐
-- │  File                             Status              │
-- ├───────────────────────────────────────────────────────┤
-- │  sql/v1-initial-setup.sql         ✅ SUDAH DIJALANKAN │
-- │  sql/v2-kepala-teknik-patch.sql   ✅ SUDAH DIJALANKAN │
-- │  sql/v3-fase1-jabatan-bon.sql     ✅ SUDAH DIJALANKAN │
-- │  sql/v4-role-restructure.sql      ✅ SUDAH DIJALANKAN │
-- │  sql/v4b-fix-trigger-role.sql     ✅ SUDAH DIJALANKAN │
-- │  sql/v4c-seed-test-accounts.sql   ✅ SUDAH DIJALANKAN │
-- │  sql/v5-fase2-overtime-photos.sql ✅ SUDAH DIJALANKAN │
-- │  sql/v6-work-items.sql            ✅ SUDAH DIJALANKAN │
-- │  sql/v7-project-assignments.sql   ✅ SUDAH DIJALANKAN │
-- │  sql/v7b-fix-assignment-trigger.sql ✅ SUDAH DIJALANKAN│
-- │  sql/v8-attendance-edit.sql         ✅ SUDAH DIJALANKAN │
-- │  sql/v8b-fix-generate-function.sql  ✅ SUDAH DIJALANKAN │
-- │  sql/v9-material-expenses.sql       ✅ SUDAH DIJALANKAN │
-- │  sql/v10-role-rename.sql            ✅ SUDAH DIJALANKAN │
-- │  sql/v28-add-leave-status-and-activities.sql ✅ SUDAH DIJALANKAN │
-- │  sql/v29-salary-payment-and-budget.sql ✅ SUDAH DIJALANKAN      │
-- │  sql/v30-fix-rekap-gaji-rpc.sql        ✅ SUDAH DIJALANKAN      │
-- └───────────────────────────────────────────────────────┘
--
-- File berikutnya akan ditambahkan di sini saat ada
-- perubahan database baru (Fase 3, dst).


-- =============================================
-- V32 — FIX GENERATE_DAILY_ATTENDANCE STATUS
-- =============================================

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
        (p_date::TIMESTAMP + '08:00:00'::TIME)::TIMESTAMPTZ,
        (p_date::TIMESTAMP + '17:00:00'::TIME)::TIMESTAMPTZ,
        'pending', v_hourly, v_assign.basic_salary, v_assign.notes,
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
      (p_date::TIMESTAMP + '08:00:00'::TIME)::TIMESTAMPTZ,
      (p_date::TIMESTAMP + '17:00:00'::TIME)::TIMESTAMPTZ,
      'pending', v_hourly, v_user.basic_salary, 'Office attendance - Owner verification required',
      0, 0, 0
    ) RETURNING id INTO v_att_id;
    
    RETURN QUERY SELECT v_att_id, v_user.id, NULL::UUID, TRUE;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================
-- V33 — FIX AUTO-SYNC ATTENDANCE STATUS
-- =============================================

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

CREATE OR REPLACE FUNCTION fn_sync_attendance_on_assign_update()
RETURNS TRIGGER AS $$
DECLARE
  v_hourly NUMERIC;
BEGIN
  IF NEW.status = 'active'
     AND NEW.start_date <= CURRENT_DATE
     AND (NEW.end_date IS NULL OR NEW.end_date >= CURRENT_DATE) THEN
    
    v_hourly := COALESCE(NEW.basic_salary / 8, 0);

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

  IF NEW.status IN ('ended','paused') AND OLD.status = 'active' THEN
    DELETE FROM attendance_logs
    WHERE employee_id = NEW.employee_id
      AND project_id  = NEW.project_id
      AND DATE(check_in) = CURRENT_DATE
      AND status = 'pending';
  END IF;

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

CREATE OR REPLACE FUNCTION fn_sync_attendance_on_assign_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM attendance_logs
  WHERE employee_id = OLD.employee_id
    AND project_id  = OLD.project_id
    AND DATE(check_in) = CURRENT_DATE
    AND status = 'pending';

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
