-- =============================================
-- V4b — FIX: Update trigger handle_new_user
-- ✅ SUDAH DIJALANKAN — Jangan jalankan ulang
-- =============================================

-- Update fungsi trigger agar tidak hardcode role default
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Ambil role dari metadata, validasi, fallback ke 'karyawan'
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'karyawan');
  IF v_role NOT IN ('superadmin','owner','admin','kepala_teknik','kepala_gudang','kepala_proyek','karyawan') THEN
    v_role := 'karyawan';
  END IF;

  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    v_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
