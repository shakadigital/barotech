-- =============================================
-- V22 — Check if indexes exist
-- =============================================
-- Run this in Supabase SQL Editor to verify that indexes from v21 were created
-- =============================================

-- Check indexes on attendance_logs
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'attendance_logs'
  AND schemaname = 'public'
ORDER BY indexname;

-- Check indexes on daily_activities
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'daily_activities'
  AND schemaname = 'public'
ORDER BY indexname;

-- Check indexes on project_assignments
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'project_assignments'
  AND schemaname = 'public'
ORDER BY indexname;

-- Check indexes on overtime_logs
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'overtime_logs'
  AND schemaname = 'public'
ORDER BY indexname;

-- Check indexes on material_orders
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'material_orders'
  AND schemaname = 'public'
ORDER BY indexname;

-- Check indexes on project_expenses
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'project_expenses'
  AND schemaname = 'public'
ORDER BY indexname;
