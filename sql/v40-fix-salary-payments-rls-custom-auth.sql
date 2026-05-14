-- =============================================
-- V40 — FIX RLS salary_payments untuk custom auth
-- auth.uid() selalu NULL karena pakai custom auth (persistSession: false)
-- Ganti semua policy ke allow anon, sama seperti tabel lain di app ini
-- =============================================

DROP POLICY IF EXISTS salary_payments_select ON salary_payments;
DROP POLICY IF EXISTS salary_payments_insert ON salary_payments;
DROP POLICY IF EXISTS salary_payments_update ON salary_payments;
DROP POLICY IF EXISTS salary_payments_delete ON salary_payments;

CREATE POLICY salary_payments_select ON salary_payments
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY salary_payments_insert ON salary_payments
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY salary_payments_update ON salary_payments
  FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY salary_payments_delete ON salary_payments
  FOR DELETE TO anon, authenticated USING (true);
