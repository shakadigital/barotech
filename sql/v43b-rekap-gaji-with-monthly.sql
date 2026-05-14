-- =============================================
-- V43b — Update RPC get_rekap_gaji_lengkap
-- Gabungkan gaji harian (attendance) + gaji bulanan (monthly_salaries)
-- Role superadmin & admin: pakai monthly_salaries (fallback ke basic_salary)
-- Role lain: pakai attendance_logs seperti biasa
-- Tambah kolom tipe_gaji: 'bulanan' atau 'harian'
-- =============================================

DROP FUNCTION IF EXISTS get_rekap_gaji_lengkap(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS get_rekap_gaji_lengkap(uuid, uuid, text);

CREATE FUNCTION get_rekap_gaji_lengkap(
  p_employee_id UUID   DEFAULT NULL,
  p_project_id  UUID   DEFAULT NULL,
  p_bulan       TEXT   DEFAULT NULL,
  p_role        TEXT   DEFAULT NULL
)
RETURNS TABLE (
  employee_id       UUID,
  full_name         TEXT,
  jabatan           TEXT,
  role              TEXT,
  tipe_gaji         TEXT,
  hari_kerja        BIGINT,
  total_gaji_pokok  NUMERIC,
  total_uang_makan  NUMERIC,
  total_transport   NUMERIC,
  total_tunjangan   NUMERIC,
  total_lembur_att  NUMERIC,
  total_lembur_ot   NUMERIC,
  total_kasbon      NUMERIC,
  total_bersih      NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_start DATE;
  v_end   DATE;
BEGIN
  IF p_bulan IS NOT NULL THEN
    v_start := (p_bulan || '-01')::DATE;
    v_end   := (DATE_TRUNC('MONTH', v_start) + INTERVAL '1 MONTH - 1 day')::DATE;
  END IF;

  -- Gaji BULANAN (superadmin, admin)
  RETURN QUERY
  SELECT
    pr.id, pr.full_name, COALESCE(pr.jabatan, pr.role), pr.role,
    'bulanan'::TEXT, 0::BIGINT,
    COALESCE(ms.gaji_pokok, pr.basic_salary, 0),
    0::NUMERIC, 0::NUMERIC,
    COALESCE(ms.tunjangan, 0),
    0::NUMERIC,
    COALESCE((SELECT SUM(ol.overtime_pay) FROM overtime_logs ol
      WHERE ol.employee_id = pr.id AND ol.status = 'approved'
        AND (v_start IS NULL OR ol.overtime_date BETWEEN v_start AND v_end)), 0),
    COALESCE(ms.potongan, 0),
    COALESCE(ms.gaji_pokok, pr.basic_salary, 0) + COALESCE(ms.tunjangan, 0)
      + COALESCE((SELECT SUM(ol.overtime_pay) FROM overtime_logs ol
          WHERE ol.employee_id = pr.id AND ol.status = 'approved'
            AND (v_start IS NULL OR ol.overtime_date BETWEEN v_start AND v_end)), 0)
      - COALESCE(ms.potongan, 0)
  FROM profiles pr
  LEFT JOIN monthly_salaries ms ON ms.employee_id = pr.id
    AND (p_bulan IS NULL OR ms.bulan = p_bulan)
  WHERE pr.is_active = true AND pr.role IN ('superadmin', 'admin')
    AND (p_role IS NULL OR pr.role = p_role)
    AND (p_employee_id IS NULL OR pr.id = p_employee_id)

  UNION ALL

  -- Gaji HARIAN (semua role selain superadmin & admin)
  SELECT
    pr.id, pr.full_name, COALESCE(pr.jabatan, pr.role), pr.role,
    'harian'::TEXT, COUNT(al.id),
    COALESCE(SUM(al.basic_salary), 0), COALESCE(SUM(al.uang_makan), 0),
    COALESCE(SUM(al.transport), 0), COALESCE(SUM(al.tunjangan_lain), 0),
    COALESCE(SUM(al.overtime_pay), 0),
    COALESCE((SELECT SUM(ol.overtime_pay) FROM overtime_logs ol
      WHERE ol.employee_id = pr.id AND ol.status = 'approved'
        AND (v_start IS NULL OR ol.overtime_date BETWEEN v_start AND v_end)
        AND (p_project_id IS NULL OR ol.project_id = p_project_id)), 0),
    COALESCE(SUM(al.cash_advance), 0),
    COALESCE(SUM(al.basic_salary + al.uang_makan + al.transport + al.tunjangan_lain + al.overtime_pay), 0)
      + COALESCE((SELECT SUM(ol.overtime_pay) FROM overtime_logs ol
          WHERE ol.employee_id = pr.id AND ol.status = 'approved'
            AND (v_start IS NULL OR ol.overtime_date BETWEEN v_start AND v_end)
            AND (p_project_id IS NULL OR ol.project_id = p_project_id)), 0)
      - COALESCE(SUM(al.cash_advance), 0)
  FROM profiles pr
  LEFT JOIN attendance_logs al ON al.employee_id = pr.id
    AND al.status IN ('hadir', 'verified')
    AND (v_start IS NULL OR al.created_at::DATE BETWEEN v_start AND v_end)
    AND (p_project_id IS NULL OR al.project_id = p_project_id)
  WHERE pr.is_active = true AND pr.role NOT IN ('superadmin', 'admin')
    AND (p_role IS NULL OR pr.role = p_role)
    AND (p_employee_id IS NULL OR pr.id = p_employee_id)
  GROUP BY pr.id, pr.full_name, pr.jabatan, pr.role

  ORDER BY role, total_bersih DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_rekap_gaji_lengkap(UUID, UUID, TEXT, TEXT) TO anon, authenticated;
