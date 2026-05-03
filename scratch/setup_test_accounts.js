/**
 * Setup akun test lengkap untuk semua 7 role
 * - Buat akun baru: kepala_gudang, kepala_proyek
 * - Update jabatan yang salah: Adi → Tukang, Iwan → Kenek
 * - Semua password: barotech123
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://entwkvvexvwyngwzxmdc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudHdrdnZleHZ3eW5nd3p4bWRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzcxMTYyOCwiZXhwIjoyMDkzMjg3NjI4fQ.aZTC_3Xcv1kawyP25CvLM0uA5T1P-nXkN7iIB6QYpmY',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const PASSWORD = 'barotech123';

// Akun baru yang perlu dibuat
const NEW_ACCOUNTS = [
  {
    email:      'gudang@barotech.com',
    full_name:  'Hendra Gudang',
    role:       'kepala_gudang',
    jabatan:    null,
    whatsapp:   '08111000001',
  },
  {
    email:      'proyek@barotech.com',
    full_name:  'Rudi Proyek',
    role:       'kepala_proyek',
    jabatan:    null,
    whatsapp:   '08111000002',
  },
];

// Update jabatan yang salah
const JABATAN_FIXES = [
  { email: 'adi@barotech.com',  jabatan: 'Tukang' },
  { email: 'iwan@barotech.com', jabatan: 'Kenek'  },
];

async function createAccount(acc) {
  console.log(`\n➕ Membuat akun: ${acc.email} (${acc.role})...`);

  // Cek apakah sudah ada
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', acc.email)
    .single();

  if (existing) {
    console.log(`   ⚠️  Sudah ada, skip.`);
    return;
  }

  // Buat auth user — TANPA role di metadata dulu (hindari trigger conflict)
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email:         acc.email,
    password:      PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: acc.full_name },
  });

  if (authErr) {
    console.error(`   ❌ Auth error: ${authErr.message}`);
    return;
  }

  // Langsung upsert profile dengan role yang benar (bypass trigger)
  const { error: profileErr } = await supabase.from('profiles').upsert({
    id:               authData.user.id,
    email:            acc.email,
    full_name:        acc.full_name,
    role:             acc.role,
    jabatan:          acc.jabatan,
    whatsapp_number:  acc.whatsapp,
    bon_balance:      0,
  });

  if (profileErr) {
    console.error(`   ❌ Profile error: ${profileErr.message}`);
    return;
  }

  console.log(`   ✅ Berhasil dibuat!`);
}

async function fixJabatan(fix) {
  console.log(`\n✏️  Update jabatan ${fix.email} → ${fix.jabatan}...`);
  const { error } = await supabase
    .from('profiles')
    .update({ jabatan: fix.jabatan })
    .eq('email', fix.email);

  if (error) console.error(`   ❌ ${error.message}`);
  else console.log(`   ✅ Berhasil diupdate!`);
}

async function main() {
  console.log('=== SETUP AKUN TEST BAROTECH ===');
  console.log(`Password semua akun baru: ${PASSWORD}\n`);

  // Buat akun baru
  for (const acc of NEW_ACCOUNTS) {
    await createAccount(acc);
  }

  // Fix jabatan
  console.log('\n=== UPDATE JABATAN ===');
  for (const fix of JABATAN_FIXES) {
    await fixJabatan(fix);
  }

  // Tampilkan semua akun final
  console.log('\n=== DAFTAR AKUN FINAL ===\n');
  const { data } = await supabase
    .from('profiles')
    .select('full_name, email, role, jabatan')
    .order('role');

  const roleOrder = ['superadmin','owner','admin','kepala_teknik','kepala_gudang','kepala_proyek','karyawan'];
  const sorted = data.sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));

  sorted.forEach(u => {
    const jabStr = u.jabatan ? ` | ${u.jabatan}` : '';
    console.log(`  [${u.role.padEnd(15)}] ${u.full_name.padEnd(20)} ${u.email}${jabStr}`);
  });

  console.log(`\nTotal: ${data.length} akun`);
  console.log('\nPassword akun lama tidak berubah.');
  console.log(`Password akun baru (kepala_gudang, kepala_proyek): ${PASSWORD}`);
}

main();
