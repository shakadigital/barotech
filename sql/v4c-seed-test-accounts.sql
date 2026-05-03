-- =============================================
-- V4c — SEED: Akun Test kepala_gudang & kepala_proyek
-- ✅ SUDAH DIJALANKAN — Jangan jalankan ulang
-- =============================================

-- Buat user di auth.users langsung, lalu insert profile
-- Password: barotech123 (bcrypt hash)

DO $$
DECLARE
  v_gudang_id  UUID := gen_random_uuid();
  v_proyek_id  UUID := gen_random_uuid();
BEGIN

  -- ── Kepala Gudang ──────────────────────────────
  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    is_super_admin, is_sso_user, deleted_at
  ) VALUES (
    v_gudang_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'gudang@barotech.com',
    crypt('barotech123', gen_salt('bf')),
    NOW(),
    '{"full_name":"Hendra Gudang"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    NOW(), NOW(),
    '', '', false, false, NULL
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO profiles (id, email, full_name, role, whatsapp_number, bon_balance)
  VALUES (v_gudang_id, 'gudang@barotech.com', 'Hendra Gudang', 'kepala_gudang', '08111000001', 0)
  ON CONFLICT (id) DO UPDATE SET role = 'kepala_gudang', full_name = 'Hendra Gudang';

  -- ── Kepala Proyek ──────────────────────────────
  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    is_super_admin, is_sso_user, deleted_at
  ) VALUES (
    v_proyek_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'proyek@barotech.com',
    crypt('barotech123', gen_salt('bf')),
    NOW(),
    '{"full_name":"Rudi Proyek"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    NOW(), NOW(),
    '', '', false, false, NULL
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO profiles (id, email, full_name, role, whatsapp_number, bon_balance)
  VALUES (v_proyek_id, 'proyek@barotech.com', 'Rudi Proyek', 'kepala_proyek', '08111000002', 0)
  ON CONFLICT (id) DO UPDATE SET role = 'kepala_proyek', full_name = 'Rudi Proyek';

  RAISE NOTICE 'Akun kepala_gudang dan kepala_proyek berhasil dibuat';
END $$;

-- Verifikasi
SELECT full_name, email, role FROM profiles ORDER BY role;
