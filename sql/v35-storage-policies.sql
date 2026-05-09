-- =============================================
-- V35 — Storage RLS Policies: project-photos
-- ✅ SUDAH DIJALANKAN
-- =============================================
-- Masalah: upload foto gagal 403 karena tidak ada
-- storage policy yang mengizinkan authenticated user
-- untuk INSERT ke bucket project-photos
-- =============================================

-- SELECT: semua orang bisa lihat foto (bucket public)
DROP POLICY IF EXISTS "storage_select_project_photos" ON storage.objects;
CREATE POLICY "storage_select_project_photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-photos');

-- INSERT: authenticated user bisa upload foto
DROP POLICY IF EXISTS "storage_insert_project_photos" ON storage.objects;
CREATE POLICY "storage_insert_project_photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-photos'
    AND auth.role() IN ('anon', 'authenticated')
  );

-- UPDATE: authenticated user bisa update foto milik sendiri
DROP POLICY IF EXISTS "storage_update_project_photos" ON storage.objects;
CREATE POLICY "storage_update_project_photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'project-photos'
    AND auth.role() IN ('anon', 'authenticated')
  );

-- DELETE: authenticated user bisa hapus foto milik sendiri
DROP POLICY IF EXISTS "storage_delete_project_photos" ON storage.objects;
CREATE POLICY "storage_delete_project_photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-photos'
    AND auth.role() IN ('anon', 'authenticated')
  );

-- =============================================
-- SELESAI V35
-- =============================================
-- Setelah menjalankan file ini:
-- - Upload foto laporan progress akan berhasil
-- - Upload foto lembur akan berhasil
-- - Foto tetap bisa dilihat publik (bucket public)
-- =============================================
