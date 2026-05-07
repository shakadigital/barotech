-- =============================================
-- V32 — FIX GENERATE_DAILY_ATTENDANCE STATUS
-- =============================================
-- Masalah: Fungsi generate_daily_attendance masih menggunakan
-- status 'draft' yang tidak valid setelah V28
-- Fix: Update status menjadi 'pending' (valid status)
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

  -- Non-karyawan (admin, kepala_gudang, kepala_proyek, kepala_lapangan)
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

COMMENT ON FUNCTION generate_daily_attendance IS 'Generate attendance logs harian dari assignment aktif. Status: pending (menunggu verifikasi admin)';

-- =============================================
-- SELESAI V32
-- =============================================
-- Perubahan:
-- - Status 'draft' → 'pending' (line 52 & 85)
-- - Sesuai dengan constraint V28: ('hadir', 'tidak_hadir', 'pending', 'libur', 'izin', 'sakit')
-- =============================================
