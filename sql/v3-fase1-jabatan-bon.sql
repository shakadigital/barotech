-- =============================================
-- V3 — FASE 1: Jabatan, Bon Balance & Bon Transactions
-- ✅ SUDAH DIJALANKAN — Jangan jalankan ulang
-- =============================================

-- 1. Tambah kolom jabatan & bon_balance di profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='profiles' AND COLUMN_NAME='jabatan') THEN
    ALTER TABLE profiles ADD COLUMN jabatan TEXT DEFAULT 'Karyawan';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='profiles' AND COLUMN_NAME='bon_balance') THEN
    ALTER TABLE profiles ADD COLUMN bon_balance NUMERIC DEFAULT 0;
  END IF;
END $$;

-- 2. Tambah kolom jabatan_snapshot di attendance_logs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='attendance_logs' AND COLUMN_NAME='jabatan_snapshot') THEN
    ALTER TABLE attendance_logs ADD COLUMN jabatan_snapshot TEXT;
  END IF;
END $$;

-- 3. Buat tabel bon_transactions
CREATE TABLE IF NOT EXISTS bon_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  type          TEXT NOT NULL CHECK (type IN ('pinjam','bayar')),
  amount        NUMERIC NOT NULL DEFAULT 0,
  balance_after NUMERIC NOT NULL DEFAULT 0,
  description   TEXT,
  attendance_id UUID REFERENCES attendance_logs(id) ON DELETE SET NULL,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS untuk bon_transactions
ALTER TABLE bon_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bon_select_own" ON bon_transactions;
CREATE POLICY "bon_select_own" ON bon_transactions FOR SELECT
  USING (employee_id = auth.uid() OR get_my_role() IN ('superadmin','owner','admin'));

DROP POLICY IF EXISTS "bon_admin" ON bon_transactions;
CREATE POLICY "bon_admin" ON bon_transactions FOR ALL
  USING (get_my_role() IN ('superadmin','owner','admin'));

-- 5. Fungsi & trigger: update bon_balance otomatis setelah insert bon_transactions
CREATE OR REPLACE FUNCTION update_bon_balance()
RETURNS TRIGGER AS $$
DECLARE
  new_balance NUMERIC;
BEGIN
  IF NEW.type = 'pinjam' THEN
    UPDATE profiles SET bon_balance = bon_balance + NEW.amount WHERE id = NEW.employee_id
    RETURNING bon_balance INTO new_balance;
  ELSIF NEW.type = 'bayar' THEN
    UPDATE profiles SET bon_balance = bon_balance - NEW.amount WHERE id = NEW.employee_id
    RETURNING bon_balance INTO new_balance;
  END IF;
  NEW.balance_after := new_balance;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_bon_insert ON bon_transactions;
CREATE TRIGGER on_bon_insert
  BEFORE INSERT ON bon_transactions
  FOR EACH ROW EXECUTE FUNCTION update_bon_balance();
