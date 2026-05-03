import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://entwkvvexvwyngwzxmdc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudHdrdnZleHZ3eW5nd3p4bWRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzcxMTYyOCwiZXhwIjoyMDkzMjg3NjI4fQ.aZTC_3Xcv1kawyP25CvLM0uA5T1P-nXkN7iIB6QYpmY';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function addDraftData() {
  console.log('🔄 Menambahkan data draft untuk verifikasi Kepala Teknik...');

  try {
    // 1. Dapatkan data yang diperlukan
    const { data: users } = await supabase.auth.admin.listUsers();
    const budiId = users.users.find(u => u.email === 'budi@barotech.com')?.id;
    const adiId = users.users.find(u => u.email === 'adi@barotech.com')?.id;
    const iwanId = users.users.find(u => u.email === 'iwan@barotech.com')?.id;

    const { data: prj } = await supabase.from('projects').select('*').eq('name', 'Renovasi Ruko Sudirman').single();

    if (!budiId || !prj) throw new Error('Pastikan seed_data.js sudah dijalankan sebelumnya.');

    // 2. Insert data draft (ceritanya admin baru plotting untuk hari ini)
    const today = new Date().toISOString().split('T')[0];
    
    // Hapus dulu data hari ini jika ada agar tidak double
    await supabase.from('attendance_logs').delete().filter('created_at', 'gte', `${today}T00:00:00Z`);

    const { error } = await supabase.from('attendance_logs').insert([
      {
        employee_id: adiId,
        project_id: prj.id,
        status: 'draft',
        notes: 'Pending',
        basic_salary: 150000,
        check_in: '08:00:00',
        check_out: '17:00:00'
      },
      {
        employee_id: iwanId,
        project_id: prj.id,
        status: 'draft',
        notes: 'Pending',
        basic_salary: 150000,
        check_in: '08:00:00',
        check_out: '17:00:00'
      }
    ]);

    if (error) throw error;
    console.log('✅ Berhasil membuat 2 data draft untuk proyek Sudirman.');
    console.log('Silakan login sebagai budi@barotech.com untuk memverifikasi.');

  } catch (err) {
    console.error('❌ Gagal:', err.message);
  }
}

addDraftData();
