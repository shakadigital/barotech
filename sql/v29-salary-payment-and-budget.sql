-- =============================================
-- V29 — SALARY PAYMENT & PROJECT BUDGET
-- ✅ SUDAH DIJALANKAN
-- =============================================
-- Menambahkan:
-- 1. Tabel salary_payments untuk history pembayaran gaji
-- 2. Kolom payment_id di attendance_logs untuk tandai yang sudah dibayar
-- 3. Kolom budget_limit & budget_alert_threshold di projects
-- =============================================

-- 1. Tabel salary_payments (History Pembayaran Gaji)
CREATE TABLE IF NOT EXISTS salary_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  
  -- Breakdown gaji
  total_days_worked integer DEFAULT 0,
  total_salary numeric DEFAULT 0,
  total_overtime numeric DEFAULT 0,
  total_bonus numeric DEFAULT 0,
  total_deductions numeric DEFAULT 0,
  net_salary numeric DEFAULT 0,
  
  -- Payment info
  payment_method text CHECK (payment_method IN ('cash', 'transfer')),
  payment_date date DEFAULT CURRENT_DATE,
  bank_name text,
  account_number text,
  notes text,
  
  -- Audit
  paid_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE salary_payments IS 'History pembayaran gaji karyawan';
COMMENT ON COLUMN salary_payments.total_days_worked IS 'Total hari kerja dalam periode';
COMMENT ON COLUMN salary_payments.total_salary IS 'Total gaji pokok';
COMMENT ON COLUMN salary_payments.total_overtime IS 'Total uang lembur';
COMMENT ON COLUMN salary_payments.total_bonus IS 'Total bonus/tunjangan';
COMMENT ON COLUMN salary_payments.total_deductions IS 'Total potongan (kasbon, dll)';
COMMENT ON COLUMN salary_payments.net_salary IS 'Total yang diterima karyawan';
COMMENT ON COLUMN salary_payments.payment_method IS 'Metode pembayaran: cash atau transfer';
COMMENT ON COLUMN salary_payments.paid_by IS 'Admin yang melakukan pembayaran';

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_salary_payments_employee ON salary_payments(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_period ON salary_payments(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_salary_payments_date ON salary_payments(payment_date);

-- 2. Update attendance_logs (tandai yang sudah dibayar)
ALTER TABLE attendance_logs 
ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES salary_payments(id);

COMMENT ON COLUMN attendance_logs.payment_id IS 'ID pembayaran gaji (jika sudah dibayar)';

CREATE INDEX IF NOT EXISTS idx_attendance_payment ON attendance_logs(payment_id);

-- 3. Update projects (budget limit & alert threshold)
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS budget_limit numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS budget_alert_threshold numeric DEFAULT 0.8;

COMMENT ON COLUMN projects.budget_limit IS 'Budget total proyek (Rp). 0 = tidak ada limit';
COMMENT ON COLUMN projects.budget_alert_threshold IS 'Alert jika pengeluaran mencapai % ini (0.8 = 80%)';

-- 4. RLS Policies untuk salary_payments
ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;

-- Admin/Owner/Superadmin bisa lihat semua
CREATE POLICY "salary_payments_select" ON salary_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('superadmin', 'owner', 'admin')
    )
  );

-- Admin/Owner/Superadmin bisa insert
CREATE POLICY "salary_payments_insert" ON salary_payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('superadmin', 'owner', 'admin')
    )
  );

-- Admin/Owner/Superadmin bisa update & delete
CREATE POLICY "salary_payments_update" ON salary_payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('superadmin', 'owner', 'admin')
    )
  );

CREATE POLICY "salary_payments_delete" ON salary_payments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('superadmin', 'owner', 'admin')
    )
  );

-- =============================================
-- SELESAI V29
-- =============================================
-- Setelah menjalankan file ini:
-- 1. Admin bisa catat pembayaran gaji dengan tombol "Tandai Sudah Dibayar"
-- 2. Attendance yang sudah dibayar tidak dihitung lagi di periode berikutnya
-- 3. History pembayaran tersimpan untuk audit
-- 4. Proyek bisa punya budget limit dengan alert otomatis
-- 5. Slip gaji bisa dicetak dari history pembayaran
-- =============================================
