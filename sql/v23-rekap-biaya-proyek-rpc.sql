-- =============================================
-- V23 — RPC: Rekap Biaya Proyek (Hybrid Laporan)
-- Jalankan di Supabase SQL Editor
-- =============================================
-- Fungsi ini menggabungkan 4 tabel sekaligus dalam satu query:
--   1. attendance_logs  → total gaji karyawan (verified)
--   2. overtime_logs    → total lembur (approved)
--   3. material_orders  → total material (approved/completed)
--   4. project_expenses → total pengeluaran operasional
-- =============================================

CREATE OR REPLACE FUNCTION get_rekap_biaya_proyek(
  p_project_id UUID    DEFAULT NULL,
  p_bulan      TEXT    DEFAULT NULL   -- format: 'YYYY-MM', NULL = semua waktu
)
RETURNS TABLE (
  project_id        UUID,
  project_name      TEXT,
  project_status    TEXT,
  total_gaji        NUMERIC,
  total_lembur      NUMERIC,
  total_material    NUMERIC,
  total_pengeluaran NUMERIC,
  grand_total       NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_start DATE;
  v_end   DATE;
BEGIN
  -- Parse bulan jika diberikan
  IF p_bulan IS NOT NULL THEN
    v_start := (p_bulan || '-01')::DATE;
    v_end   := (DATE_TRUNC('MONTH', v_start) + INTERVAL '1 MONTH - 1 day')::DATE;
  END IF;

  RETURN QUERY
  SELECT
    p.id                                          AS project_id,
    p.name                                        AS project_name,
    p.status                                      AS project_status,

    -- Gaji karyawan dari attendance_logs (status verified)
    COALESCE((
      SELECT SUM(
        al.basic_salary + al.uang_makan + al.transport + al.tunjangan_lain
        + al.overtime_pay - al.cash_advance
      )
      FROM attendance_logs al
      WHERE al.project_id = p.id
        AND al.status = 'verified'
        AND (v_start IS NULL OR al.created_at::DATE BETWEEN v_start AND v_end)
    ), 0)                                         AS total_gaji,

    -- Lembur dari overtime_logs (status approved)
    COALESCE((
      SELECT SUM(ol.overtime_pay)
      FROM overtime_logs ol
      WHERE ol.project_id = p.id
        AND ol.status = 'approved'
        AND (v_start IS NULL OR ol.overtime_date BETWEEN v_start AND v_end)
    ), 0)                                         AS total_lembur,

    -- Material dari material_orders (approved/completed)
    COALESCE((
      SELECT SUM(mo.total_price)
      FROM material_orders mo
      WHERE mo.project_id = p.id
        AND mo.status IN ('approved', 'completed')
        AND (v_start IS NULL OR mo.order_date BETWEEN v_start AND v_end)
    ), 0)                                         AS total_material,

    -- Pengeluaran operasional dari project_expenses
    COALESCE((
      SELECT SUM(pe.amount)
      FROM project_expenses pe
      WHERE pe.project_id = p.id
        AND (v_start IS NULL OR pe.expense_date BETWEEN v_start AND v_end)
    ), 0)                                         AS total_pengeluaran,

    -- Grand total (dihitung di sini agar konsisten)
    COALESCE((
      SELECT SUM(al.basic_salary + al.uang_makan + al.transport + al.tunjangan_lain
                 + al.overtime_pay - al.cash_advance)
      FROM attendance_logs al
      WHERE al.project_id = p.id AND al.status = 'verified'
        AND (v_start IS NULL OR al.created_at::DATE BETWEEN v_start AND v_end)
    ), 0)
    + COALESCE((
      SELECT SUM(ol.overtime_pay) FROM overtime_logs ol
      WHERE ol.project_id = p.id AND ol.status = 'approved'
        AND (v_start IS NULL OR ol.overtime_date BETWEEN v_start AND v_end)
    ), 0)
    + COALESCE((
      SELECT SUM(mo.total_price) FROM material_orders mo
      WHERE mo.project_id = p.id AND mo.status IN ('approved','completed')
        AND (v_start IS NULL OR mo.order_date BETWEEN v_start AND v_end)
    ), 0)
    + COALESCE((
      SELECT SUM(pe.amount) FROM project_expenses pe
      WHERE pe.project_id = p.id
        AND (v_start IS NULL OR pe.expense_date BETWEEN v_start AND v_end)
    ), 0)                                         AS grand_total

  FROM projects p
  WHERE (p_project_id IS NULL OR p.id = p_project_id)
  ORDER BY grand_total DESC;
END;
$$;

-- Grant execute ke anon & authenticated (RLS tetap berlaku via SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION get_rekap_biaya_proyek(UUID, TEXT) TO anon, authenticated;
