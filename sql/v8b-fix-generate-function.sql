-- =============================================
-- V8b — FIX: generate_daily_attendance ambiguous column
-- ✅ SUDAH DIJALANKAN — Jangan jalankan ulang
-- =============================================

-- Drop dulu karena return type berubah
DROP FUNCTION IF EXISTS generate_daily_attendance(DATE);

CREATE OR REPLACE FUNCTION generate_daily_attendance(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
  attendance_id UUID,
  out_employee_id   UUID,
  out_project_id    UUID,
  is_new        BOOLEAN
) AS $$
DECLARE
  v_assign     RECORD;
  v_att_id     UUID;
  v_is_new     BOOLEAN;
  v_hourly     NUMERIC;
BEGIN
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
    -- Cek apakah sudah ada attendance hari ini untuk karyawan + proyek ini
    SELECT al.id INTO v_att_id
    FROM attendance_logs al
    WHERE al.employee_id = v_assign.emp_id
      AND al.project_id  = v_assign.prj_id
      AND al.created_at::DATE = p_date
    LIMIT 1;

    IF v_att_id IS NULL THEN
      v_hourly := ROUND(v_assign.basic_salary / 8, 2);

      INSERT INTO attendance_logs (
        employee_id, project_id, basic_salary, hourly_rate,
        status, notes, check_in, check_out
      ) VALUES (
        v_assign.emp_id,
        v_assign.prj_id,
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

    attendance_id     := v_att_id;
    out_employee_id   := v_assign.emp_id;
    out_project_id    := v_assign.prj_id;
    is_new            := v_is_new;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
