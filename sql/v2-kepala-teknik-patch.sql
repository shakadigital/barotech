-- =============================================
-- V2 — PATCH: Kepala Teknik hanya UPDATE (SUDAH DIJALANKAN ✅)
-- Jangan jalankan ulang file ini.
-- =============================================

-- Hapus policy lama yang memberi kepala_teknik akses INSERT
DROP POLICY IF EXISTS "attendance_insert" ON attendance_logs;

-- Buat ulang: hanya admin+ yang bisa INSERT (plotting)
CREATE POLICY "attendance_insert" ON attendance_logs FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin','owner','admin'));

-- Kepala teknik hanya bisa UPDATE (verifikasi status)
DROP POLICY IF EXISTS "attendance_update_kepala" ON attendance_logs;
CREATE POLICY "attendance_update_kepala" ON attendance_logs FOR UPDATE
  USING (
    get_my_role() IN ('superadmin','owner','admin')
    OR (
      get_my_role() = 'kepala_teknik'
      AND project_id IN (
        SELECT id FROM projects WHERE lead_id = auth.uid()
      )
    )
  );
