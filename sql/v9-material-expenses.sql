-- =============================================
-- V9 — Material Orders & Project Expenses
-- ⚠️ BELUM DIJALANKAN — Jalankan di Supabase SQL Editor
-- =============================================

-- 1. material_orders
CREATE TABLE IF NOT EXISTS material_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  order_type TEXT NOT NULL DEFAULT 'gudang' CHECK (order_type IN ('gudang','customer','beli_lokasi')),
  material_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'unit',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  supplier_name TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed')),
  ordered_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_material_orders_project ON material_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_material_orders_status ON material_orders(status);

-- 2. material_photos
CREATE TABLE IF NOT EXISTS material_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_order_id UUID NOT NULL REFERENCES material_orders(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  photo_type TEXT NOT NULL DEFAULT 'nota' CHECK (photo_type IN ('nota','barang','lainnya')),
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_material_photos_order ON material_photos(material_order_id);

-- 3. project_expenses
CREATE TABLE IF NOT EXISTS project_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL DEFAULT 'lainnya' CHECK (category IN ('material','operasional','jasa','lainnya')),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  prev_total NUMERIC NOT NULL DEFAULT 0,
  running_total NUMERIC NOT NULL DEFAULT 0,
  photo_url TEXT,
  recorded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_expenses_project ON project_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_project_expenses_date ON project_expenses(expense_date);

-- 4. Trigger: auto-calc total_price material_orders
CREATE OR REPLACE FUNCTION calc_material_total() RETURNS TRIGGER AS $$
BEGIN
  NEW.total_price := COALESCE(NEW.quantity,0) * COALESCE(NEW.unit_price,0);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS on_material_order_calc ON material_orders;
CREATE TRIGGER on_material_order_calc
  BEFORE INSERT OR UPDATE OF quantity, unit_price ON material_orders
  FOR EACH ROW EXECUTE FUNCTION calc_material_total();

-- 5. Trigger: auto-update running_total project_expenses
CREATE OR REPLACE FUNCTION calc_expense_running_total() RETURNS TRIGGER AS $$
DECLARE v_last NUMERIC;
BEGIN
  SELECT COALESCE(MAX(running_total),0) INTO v_last
  FROM project_expenses WHERE project_id = NEW.project_id AND id != NEW.id;
  NEW.prev_total := v_last;
  NEW.running_total := v_last + COALESCE(NEW.amount,0);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS on_expense_running_total ON project_expenses;
CREATE TRIGGER on_expense_running_total
  BEFORE INSERT OR UPDATE OF amount ON project_expenses
  FOR EACH ROW EXECUTE FUNCTION calc_expense_running_total();

-- 6. Function: total pengeluaran proyek
CREATE OR REPLACE FUNCTION get_project_total_expense(p_project_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(amount),0) FROM project_expenses WHERE project_id = p_project_id;
$$ LANGUAGE sql STABLE;

-- 7. RLS material_orders
ALTER TABLE material_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS material_select ON material_orders;
CREATE POLICY material_select ON material_orders FOR SELECT
  USING (get_my_role() IN ('superadmin','owner','admin','kepala_teknik','kepala_gudang','kepala_proyek'));
DROP POLICY IF EXISTS material_insert ON material_orders;
CREATE POLICY material_insert ON material_orders FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin','kepala_gudang'));
DROP POLICY IF EXISTS material_update ON material_orders;
CREATE POLICY material_update ON material_orders FOR UPDATE
  USING (get_my_role() IN ('superadmin','owner','admin','kepala_gudang'));
DROP POLICY IF EXISTS material_delete ON material_orders;
CREATE POLICY material_delete ON material_orders FOR DELETE
  USING (get_my_role() IN ('superadmin','owner'));

-- 8. RLS material_photos
ALTER TABLE material_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mphoto_select ON material_photos;
CREATE POLICY mphoto_select ON material_photos FOR SELECT
  USING (get_my_role() IN ('superadmin','owner','admin','kepala_teknik','kepala_gudang','kepala_proyek'));
DROP POLICY IF EXISTS mphoto_insert ON material_photos;
CREATE POLICY mphoto_insert ON material_photos FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin','kepala_gudang'));
DROP POLICY IF EXISTS mphoto_delete ON material_photos;
CREATE POLICY mphoto_delete ON material_photos FOR DELETE
  USING (get_my_role() IN ('superadmin','owner','admin'));

-- 9. RLS project_expenses
ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS expense_select ON project_expenses;
CREATE POLICY expense_select ON project_expenses FOR SELECT
  USING (get_my_role() IN ('superadmin','owner','admin','kepala_teknik','kepala_proyek'));
DROP POLICY IF EXISTS expense_insert ON project_expenses;
CREATE POLICY expense_insert ON project_expenses FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin'));
DROP POLICY IF EXISTS expense_update ON project_expenses;
CREATE POLICY expense_update ON project_expenses FOR UPDATE
  USING (get_my_role() IN ('superadmin','owner','admin'));
DROP POLICY IF EXISTS expense_delete ON project_expenses;
CREATE POLICY expense_delete ON project_expenses FOR DELETE
  USING (get_my_role() IN ('superadmin','owner'));
