-- Extend attendance for non-karyawan roles (Admin, Kepala Gudang, Kepala Proyek, Kepala Lapangan)
-- This allows them to have self-attendance and appear in Owner's verification list

-- 1. Update generate_daily_attendance to include non-karyawan roles
DROP FUNCTION IF EXISTS generate_daily_attendance(DATE);

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
  -- Generate attendance for karyawan from assignments
  FOR v_assign IN
    SELECT pa.id, pa.employee_id AS emp_id, pa.project_id AS prj_id,
           pa.basic_salary, pa.notes
    FROM project_assignments pa
    JOIN projects p ON p.id = pa.project_id
    WHERE pa.status = 'active'
      AND pa.start_date <= p_date
      AND (pa.end_date IS NULL OR pa.end_date >= p_date)
      AND p.status = 'aktif'
  LOOP
    -- Cek apakah attendance sudah ada untuk tanggal ini
    SELECT id INTO v_att_id
    FROM attendance_logs
    WHERE employee_id = v_assign.emp_id
      AND DATE(check_in) = p_date;

    IF v_att_id IS NULL THEN
      -- Insert attendance baru
      v_hourly := COALESCE(v_assign.basic_salary / 8, 0);
      
      INSERT INTO attendance_logs (
        employee_id, project_id, check_in, check_out,
        status, hourly_rate, basic_salary, notes
      ) VALUES (
        v_assign.emp_id, v_assign.prj_id,
        p_date || ' 08:00:00', p_date || ' 17:00:00',
        'draft', v_hourly, v_assign.basic_salary, v_assign.notes
      ) RETURNING id INTO v_att_id;
      
      v_is_new := TRUE;
    ELSE
      v_is_new := FALSE;
    END IF;

    RETURN QUERY SELECT v_att_id, v_assign.emp_id, v_assign.prj_id, v_is_new;
  END LOOP;

  -- Generate attendance for non-karyawan roles (Admin, Kepala Gudang, Kepala Proyek, Kepala Lapangan)
  -- These users don't have assignments, but should have attendance records for Owner to verify
  FOR v_user IN
    SELECT id, basic_salary
    FROM profiles
    WHERE role IN ('admin', 'kepala_gudang', 'kepala_proyek', 'kepala_lapangan')
      AND id NOT IN (
        SELECT employee_id FROM attendance_logs WHERE DATE(check_in) = p_date
      )
  LOOP
    -- Insert attendance baru for non-karyawan
    v_hourly := COALESCE(v_user.basic_salary / 8, 0);
    
    INSERT INTO attendance_logs (
      employee_id, project_id, check_in, check_out,
      status, hourly_rate, basic_salary, notes
    ) VALUES (
      v_user.id, NULL, -- No specific project for office staff
      p_date || ' 08:00:00', p_date || ' 17:00:00',
      'draft', v_hourly, v_user.basic_salary, 'Office attendance - Owner verification required'
    ) RETURNING id INTO v_att_id;
    
    RETURN QUERY SELECT v_att_id, v_user.id, NULL::UUID, TRUE;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
