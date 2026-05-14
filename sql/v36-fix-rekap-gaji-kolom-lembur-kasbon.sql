-- =============================================
-- V36 — FIX: Urutan kolom total_lembur_ot dan total_kasbon tertukar
-- di fungsi get_rekap_gaji_lengkap
-- =============================================
-- Root cause:
-- Di RETURNS TABLE, urutan kolom adalah:
--   ..., total_lembur_att, total_lembur_ot, total_kasbon, total_bersih
-- Tapi di SELECT (v30), urutan SELECT-nya adalah:
--   ..., total_lembur_att, total_kasbon, total_lembur_ot, total_bersih
-- Akibatnya nilai lembur dari overtime_logs masuk ke kolom kasbon,
-- dan nilai cash_advance masuk ke kolom lembur_ot.
-- =============================================

CREATE OR REPLACE FUNCTION get_rekap_gaji_lengkap(
  p_employee_id UUID   DEFAULT NULL,
  p_project_id  UUID   DEFAULT NULL,
  p_bulan       TEXT   DEFAULT NULL  -- format: 'YYYY-MM'
)
RETURNS TABLE (
  employee_id       UUID,
  full_name         TEXT,
  jabatan           TEXT,
  hari_kerja        BIGINT,
  total_gaji_pokok  NUMERIC,
  total_uang_makan  NUMERIC,
  total_transport   NUMERIC,
  total_tunjangan   NUMERIC,
  total_lembur_att  NUMERIC,   -- lembur dari kolom overtime_pay di attendance_logs
  total_lembur_ot   NUMERIC,   -- lembur dari tabel overtime_logs (approved)
  total_kasbon      NUMERIC,
  total_bersih      NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_start DATE;
  v_end   DATE;
BEGIN
  IF p_bulan IS NOT NULL THEN
    v_start := (p_bulan || '-01')::DATE;
    v_end   := (DATE_TRUNC('MONTH', v_start) + INTERVAL '1 MONTH - 1 day')::DATE;
  END IF;

  RETURN QUERY
  SELECT
    pr.id                                   AS employee_id,
    pr.full_name,
    pr.jabatan,

    -- Hari kerja
    COUNT(al.id)                            AS hari_kerja,

    -- Komponen gaji dari attendance_logs
    COALESCE(SUM(al.basic_salary), 0)       AS total_gaji_pokok,
    COALESCE(SUM(al.uang_makan), 0)         AS total_uang_makan,
    COALESCE(SUM(al.transport), 0)          AS total_transport,
    COALESCE(SUM(al.tunjangan_lain), 0)     AS total_tunjangan,
    COALESCE(SUM(al.overtime_pay), 0)       AS total_lembur_att,

    -- FIX: total_lembur_ot HARUS sebelum total_kasbon
    -- agar urutan SELECT cocok dengan RETURNS TABLE
    COALESCE((
      SELECT SUM(ol.overtime_pay)
      FROM overtime_logs ol
      WHERE ol.employee_id = pr.id
        AND ol.status = 'approved'
        AND (v_start IS NULL OR ol.overtime_date BETWEEN v_start AND v_end)
        AND (p_project_id IS NULL OR ol.project_id = p_project_id)
    ), 0)                                   AS total_lembur_ot,

    COALESCE(SUM(al.cash_advance), 0)       AS total_kasbon,

    -- Total bersih
    COALESCE(SUM(
      al.basic_salary + al.uang_makan + al.transport + al.tunjangan_lain + al.overtime_pay
    ), 0)
    + COALESCE((
      SELECT SUM(ol.overtime_pay)
      FROM overtime_logs ol
      WHERE ol.employee_id = pr.id
        AND ol.status = 'approved'
        AND (v_start IS NULL OR ol.overtime_date BETWEEN v_start AND v_end)
        AND (p_project_id IS NULL OR ol.project_id = p_project_id)
    ), 0)
    - COALESCE(SUM(al.cash_advance), 0)     AS total_bersih

  FROM profiles pr
  JOIN attendance_logs al ON al.employee_id = pr.id
    AND al.status IN ('hadir', 'verified')
    AND (v_start IS NULL OR al.created_at::DATE BETWEEN v_start AND v_end)
    AND (p_project_id IS NULL OR al.project_id = p_project_id)

  WHERE pr.role = 'karyawan'
    AND (p_employee_id IS NULL OR pr.id = p_employee_id)

  GROUP BY pr.id, pr.full_name, pr.jabatan
  ORDER BY total_bersih DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_rekap_gaji_lengkap(UUID, UUID, TEXT) TO anon, authenticated;
