import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://entwkvvexvwyngwzxmdc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudHdrdnZleHZ3eW5nd3p4bWRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzcxMTYyOCwiZXhwIjoyMDkzMjg3NjI4fQ.aZTC_3Xcv1kawyP25CvLM0uA5T1P-nXkN7iIB6QYpmY'
);

const { data, error } = await supabase
  .from('profiles')
  .select('full_name, email, role, jabatan, bon_balance')
  .order('role');

if (error) { console.error(error); process.exit(1); }

console.log('\n=== AKUN TERDAFTAR ===\n');
data.forEach(u => {
  console.log(`👤 ${u.full_name}`);
  console.log(`   Email   : ${u.email}`);
  console.log(`   Role    : ${u.role}`);
  console.log(`   Jabatan : ${u.jabatan || '-'}`);
  console.log(`   Bon     : Rp ${(u.bon_balance||0).toLocaleString('id-ID')}`);
  console.log('');
});
console.log(`Total: ${data.length} akun`);
