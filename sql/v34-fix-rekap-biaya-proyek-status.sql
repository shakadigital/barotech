-- =============================================
-- V34 — FIX RPC: get_rekap_biaya_proyek
-- ✅ SUDAH DIJALANKAN (rev2 — fix nama tabel)
-- =============================================
-- Perbaikan:
-- 1. Filter status attendance: tambah 'hadir' (v28+), tetap support 'verified' (lama)
-- 2. Tabel material: gunakan 'materials' (bukan material_orders) sesuai schema aktual
-- 3. Tabel pengeluaran: gunakan 'expenses' (bukan project_expenses) sesuai schema aktual
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
  IF p_bulan IS NOT NULL THEN
    v_start := (p_bulan || '-01')::DATE;
    v_end   := (DATE_TRUNC('MONTH', v_start) + INTERVAL '1 MONTH - 1 day')::DATE;
  END IF;

  RETURN QUERY
  SELECT
    p.id            AS project_id,
    p.name          AS project_name,
    p.status        AS project_status,

    -- Gaji dari attendance_logs — support status 'hadir' (baru) dan 'verified' (lama)
    COALESCE((
      SELECT SUM(
        al.basic_salary + al.uang_makan + al.transport + al.tunjangan_lain
        + al.overtime_pay - al.cash_advance
      )
      FROM attendance_logs al
      WHERE al.project_id = p.id
        AND al.status IN ('hadir', 'verified')
        AND (v_start IS NULL OR al.created_at::DATE BETWEEN v_start AND v_end)
    ), 0) AS total_gaji,

    -- Lembur dari overtime_logs (approved)
    COALESCE((
      SELECT SUM(ol.overtime_pay)
      FROM overtime_logs ol
      WHERE ol.project_id = p.id
        AND ol.status = 'approved'
        AND (v_start IS NULL OR ol.overtime_date BETWEEN v_start AND v_end)
    ), 0) AS total_lembur,

    -- Material dari material_orders (approved/completed)
    COALESCE((
      SELECT SUM(m.total_price)
      FROM material_orders m
      WHERE m.project_id = p.id
        AND m.status IN ('approved', 'completed')
        AND (v_start IS NULL OR m.created_at::DATE BETWEEN v_start AND v_end)
    ), 0) AS total_material,

    -- Pengeluaran dari project_expenses
    COALESCE((
      SELECT SUM(e.amount)
      FROM project_expenses e
      WHERE e.project_id = p.id
        AND (v_start IS NULL OR e.expense_date BETWEEN v_start AND v_end)
    ), 0) AS total_pengeluaran,

    -- Grand total
    COALESCE((
      SELECT SUM(al.basic_salary + al.uang_makan + al.transport + al.tunjangan_lain
                 + al.overtime_pay - al.cash_advance)
      FROM attendance_logs al
      WHERE al.project_id = p.id
        AND al.status IN ('hadir', 'verified')
        AND (v_start IS NULL OR al.created_at::DATE BETWEEN v_start AND v_end)
    ), 0)
    + COALESCE((
      SELECT SUM(ol.overtime_pay) FROM overtime_logs ol
      WHERE ol.project_id = p.id AND ol.status = 'approved'
        AND (v_start IS NULL OR ol.overtime_date BETWEEN v_start AND v_end)
    ), 0)
    + COALESCE((
      SELECT SUM(m.total_price) FROM material_orders m
      WHERE m.project_id = p.id
        AND m.status IN ('approved', 'completed')
        AND (v_start IS NULL OR m.created_at::DATE BETWEEN v_start AND v_end)
    ), 0)
    + COALESCE((
      SELECT SUM(e.amount) FROM project_expenses e
      WHERE e.project_id = p.id
        AND (v_start IS NULL OR e.expense_date BETWEEN v_start AND v_end)
    ), 0) AS grand_total

  FROM projects p
  WHERE (p_project_id IS NULL OR p.id = p_project_id)
  ORDER BY grand_total DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_rekap_biaya_proyek(UUID, TEXT) TO anon, authenticated;

-- =============================================
-- SELESAI V34
-- =============================================
-- Setelah menjalankan file ini:
-- - Rekap Biaya Proyek akan menampilkan data dengan benar
-- - Support status 'hadir' (baru v28+) dan 'verified' (lama)
-- - Tabel material dan pengeluaran sudah sesuai schema aktual
-- =============================================
