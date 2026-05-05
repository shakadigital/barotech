-- =============================================
-- V24 — RPC: Rekap Gaji Lengkap + Rekap Bon
-- Jalankan di Supabase SQL Editor
-- =============================================

-- ── 1. get_rekap_gaji_lengkap ────────────────────────────────
-- Menggabungkan attendance_logs + overtime_logs per karyawan per bulan
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

    -- Hari kerja (jumlah baris attendance verified)
    COUNT(al.id)                            AS hari_kerja,

    -- Komponen gaji dari attendance_logs
    COALESCE(SUM(al.basic_salary), 0)       AS total_gaji_pokok,
    COALESCE(SUM(al.uang_makan), 0)         AS total_uang_makan,
    COALESCE(SUM(al.transport), 0)          AS total_transport,
    COALESCE(SUM(al.tunjangan_lain), 0)     AS total_tunjangan,
    COALESCE(SUM(al.overtime_pay), 0)       AS total_lembur_att,
    COALESCE(SUM(al.cash_advance), 0)       AS total_kasbon,

    -- Lembur dari overtime_logs (approved, bulan sama)
    COALESCE((
      SELECT SUM(ol.overtime_pay)
      FROM overtime_logs ol
      WHERE ol.employee_id = pr.id
        AND ol.status = 'approved'
        AND (v_start IS NULL OR ol.overtime_date BETWEEN v_start AND v_end)
        AND (p_project_id IS NULL OR ol.project_id = p_project_id)
    ), 0)                                   AS total_lembur_ot,

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
    AND al.status = 'verified'
    AND (v_start IS NULL OR al.created_at::DATE BETWEEN v_start AND v_end)
    AND (p_project_id IS NULL OR al.project_id = p_project_id)

  WHERE pr.role = 'karyawan'
    AND (p_employee_id IS NULL OR pr.id = p_employee_id)

  GROUP BY pr.id, pr.full_name, pr.jabatan
  ORDER BY total_bersih DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_rekap_gaji_lengkap(UUID, UUID, TEXT) TO anon, authenticated;


-- ── 2. get_rekap_bon ─────────────────────────────────────────
-- Rekap bon per karyawan: saldo hutang + riwayat transaksi
CREATE OR REPLACE FUNCTION get_rekap_bon(
  p_employee_id UUID  DEFAULT NULL,
  p_bulan       TEXT  DEFAULT NULL  -- format: 'YYYY-MM', NULL = semua waktu
)
RETURNS TABLE (
  employee_id       UUID,
  full_name         TEXT,
  jabatan           TEXT,
  saldo_hutang      NUMERIC,   -- bon_balance saat ini dari profiles
  total_pinjam      NUMERIC,
  total_bayar       NUMERIC,
  jumlah_transaksi  BIGINT,
  transaksi_terakhir TIMESTAMPTZ
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
    pr.id                                                     AS employee_id,
    pr.full_name,
    pr.jabatan,
    pr.bon_balance                                            AS saldo_hutang,

    COALESCE(SUM(CASE WHEN bt.type = 'pinjam' THEN bt.amount ELSE 0 END), 0) AS total_pinjam,
    COALESCE(SUM(CASE WHEN bt.type = 'bayar'  THEN bt.amount ELSE 0 END), 0) AS total_bayar,
    COUNT(bt.id)                                              AS jumlah_transaksi,
    MAX(bt.created_at)                                        AS transaksi_terakhir

  FROM profiles pr
  LEFT JOIN bon_transactions bt ON bt.employee_id = pr.id
    AND (v_start IS NULL OR bt.created_at::DATE BETWEEN v_start AND v_end)

  WHERE pr.role = 'karyawan'
    AND (p_employee_id IS NULL OR pr.id = p_employee_id)

  GROUP BY pr.id, pr.full_name, pr.jabatan, pr.bon_balance
  ORDER BY pr.bon_balance DESC;  -- yang hutang terbesar di atas
END;
$$;

GRANT EXECUTE ON FUNCTION get_rekap_bon(UUID, TEXT) TO anon, authenticated;
