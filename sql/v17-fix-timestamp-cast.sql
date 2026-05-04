-- =============================================
-- V17 — Fix CAST TEXT → TIMESTAMPTZ pada trigger
-- =============================================
-- CURRENT_DATE || ' 08:00:00' menghasilkan TEXT,
-- sedangkan check_in/check_out sekarang TIMESTAMPTZ.
-- Perlu cast eksplisit.
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
      'draft', v_hourly, NEW.basic_salary, NEW.notes,
      NEW.uang_makan, NEW.transport, NEW.tunjangan_lain
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
      (CURRENT_DATE::TIMESTAMP + '08:00:00'::TIME)::TIMESTAMPTZ,
      (CURRENT_DATE::TIMESTAMP + '17:00:00'::TIME)::TIMESTAMPTZ,
      'draft', v_hourly, NEW.basic_salary, NEW.notes,
      NEW.uang_makan, NEW.transport, NEW.tunjangan_lain
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
      (p_date::TIMESTAMP + '08:00:00'::TIME)::TIMESTAMPTZ,
      (p_date::TIMESTAMP + '17:00:00'::TIME)::TIMESTAMPTZ,
      'draft', v_hourly, v_user.basic_salary, 'Office attendance - Owner verification required',
      0, 0, 0
    ) RETURNING id INTO v_att_id;
    
    RETURN QUERY SELECT v_att_id, v_user.id, NULL::UUID, TRUE;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
