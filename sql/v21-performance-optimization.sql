-- =============================================
-- V21 — Performance Optimization for Reports
-- =============================================
-- Fitur:
--   1. Add indexes untuk attendance_logs query performance
--   2. Add indexes untuk daily_activities query performance
--   3. Add composite indexes untuk common filter combinations
-- =============================================

-- ── 1. Index untuk attendance_logs ─────────────────────────────
-- Index untuk status filter (verified, pending, absent)
CREATE INDEX IF NOT EXISTS idx_attendance_logs_status ON attendance_logs(status);

-- Index untuk date filtering (created_at)
CREATE INDEX IF NOT EXISTS idx_attendance_logs_created_at ON attendance_logs(created_at);

-- Composite index untuk common query: status + created_at
CREATE INDEX IF NOT EXISTS idx_attendance_logs_status_created_at ON attendance_logs(status, created_at);

-- Index untuk employee_id filter
CREATE INDEX IF NOT EXISTS idx_attendance_logs_employee_id ON attendance_logs(employee_id);

-- Index untuk project_id filter
CREATE INDEX IF NOT EXISTS idx_attendance_logs_project_id ON attendance_logs(project_id);

-- Composite index untuk employee + date queries
CREATE INDEX IF NOT EXISTS idx_attendance_logs_employee_created ON attendance_logs(employee_id, created_at);

-- Composite index untuk project + date queries
CREATE INDEX IF NOT EXISTS idx_attendance_logs_project_created ON attendance_logs(project_id, created_at);

-- ── 2. Index untuk daily_activities ─────────────────────────────
-- Index untuk attendance_id (already exists, ensure it's there)
CREATE INDEX IF NOT EXISTS idx_daily_activities_attendance ON daily_activities(attendance_id);

-- Index untuk created_by
CREATE INDEX IF NOT EXISTS idx_daily_activities_created_by ON daily_activities(created_by);

-- ── 3. Index untuk project_assignments ───────────────────────────
-- Index untuk status filter
CREATE INDEX IF NOT EXISTS idx_project_assignments_status ON project_assignments(status);

-- Composite index untuk employee + status
CREATE INDEX IF NOT EXISTS idx_project_assignments_employee_status ON project_assignments(employee_id, status);

-- ── 4. Index untuk overtime_logs ───────────────────────────────
-- Index untuk status filter
CREATE INDEX IF NOT EXISTS idx_overtime_logs_status ON overtime_logs(status);

-- Index untuk date filtering
CREATE INDEX IF NOT EXISTS idx_overtime_logs_created_at ON overtime_logs(created_at);

-- Composite index untuk employee + date
CREATE INDEX IF NOT EXISTS idx_overtime_logs_employee_created ON overtime_logs(employee_id, created_at);

-- ── 5. Index untuk material_orders ───────────────────────────────
-- Index untuk project_id filter
CREATE INDEX IF NOT EXISTS idx_material_orders_project_id ON material_orders(project_id);

-- Index untuk status filter
CREATE INDEX IF NOT EXISTS idx_material_orders_status ON material_orders(status);

-- Composite index untuk project + date
CREATE INDEX IF NOT EXISTS idx_material_orders_project_created ON material_orders(project_id, created_at);

-- ── 6. Index untuk project_expenses ───────────────────────────────
-- Index untuk project_id filter
CREATE INDEX IF NOT EXISTS idx_project_expenses_project_id ON project_expenses(project_id);

-- Index untuk date filtering
CREATE INDEX IF NOT EXISTS idx_project_expenses_created_at ON project_expenses(created_at);

-- Composite index untuk project + date
CREATE INDEX IF NOT EXISTS idx_project_expenses_project_created ON project_expenses(project_id, created_at);
