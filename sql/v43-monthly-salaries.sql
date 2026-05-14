-- =============================================
-- V43 — Tabel monthly_salaries untuk gaji bulanan tetap
-- Digunakan oleh role: superadmin, admin
-- Opsi C: default dari basic_salary, bisa di-override per bulan
-- =============================================

CREATE TABLE IF NOT EXISTS monthly_salaries (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID        NOT NULL REFERENCES profiles(id),
  bulan         TEXT        NOT NULL,  -- format: 'YYYY-MM'
  gaji_pokok    NUMERIC     NOT NULL DEFAULT 0,
  tunjangan     NUMERIC     NOT NULL DEFAULT 0,
  potongan      NUMERIC     NOT NULL DEFAULT 0,
  keterangan    TEXT,
  created_by    UUID        REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (employee_id, bulan)
);

CREATE INDEX IF NOT EXISTS idx_monthly_salaries_bulan       ON monthly_salaries(bulan);
CREATE INDEX IF NOT EXISTS idx_monthly_salaries_employee_id ON monthly_salaries(employee_id);

CREATE OR REPLACE FUNCTION update_monthly_salaries_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_monthly_salaries_updated_at ON monthly_salaries;
CREATE TRIGGER trg_monthly_salaries_updated_at
  BEFORE UPDATE ON monthly_salaries
  FOR EACH ROW EXECUTE FUNCTION update_monthly_salaries_updated_at();

ALTER TABLE monthly_salaries DISABLE ROW LEVEL SECURITY;
