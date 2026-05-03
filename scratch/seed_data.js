import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://entwkvvexvwyngwzxmdc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudHdrdnZleHZ3eW5nd3p4bWRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzcxMTYyOCwiZXhwIjoyMDkzMjg3NjI4fQ.aZTC_3Xcv1kawyP25CvLM0uA5T1P-nXkN7iIB6QYpmY';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const mockUsers = [
  { email: 'owner@barotech.com', password: 'password123', full_name: 'Pak Baro (Owner)', role: 'owner' },
  { email: 'admin_staff@barotech.com', password: 'password123', full_name: 'Siti Aminah', role: 'admin' },
  { email: 'budi@barotech.com', password: 'password123', full_name: 'Budi Teknik', role: 'kepala_teknik' },
  { email: 'adi@barotech.com', password: 'password123', full_name: 'Adi Tukang', role: 'karyawan' },
  { email: 'iwan@barotech.com', password: 'password123', full_name: 'Iwan Kenek', role: 'karyawan' },
];

async function seed() {
  console.log('🚀 Memulai seeding data...');

  try {
    const userMap = { karyawanList: [] };

    // 1. Buat User
    for (const u of mockUsers) {
      console.log(`- Check/Buat user: ${u.email}...`);
      const { data: users } = await supabase.auth.admin.listUsers();
      let userId = users.users.find(x => x.email === u.email)?.id;

      if (!userId) {
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
          email: u.email, password: u.password, email_confirm: true,
          user_metadata: { full_name: u.full_name, role: u.role }
        });
        if (authErr) throw authErr;
        userId = authData.user.id;
      }

      await supabase.from('profiles').upsert({
        id: userId, email: u.email, full_name: u.full_name, role: u.role, whatsapp_number: '08123456789'
      });
      
      userMap[u.role] = userId;
      if (u.role === 'karyawan') userMap.karyawanList.push(userId);
    }

    // 2. Buat Proyek
    console.log('🏗️ Check/Buat proyek...');
    const projectNames = ['Renovasi Ruko Sudirman', 'Pembangunan Gudang Bekasi'];
    const prjList = [];

    for (const name of projectNames) {
      const { data: existing } = await supabase.from('projects').select('*').eq('name', name).single();
      if (!existing) {
        const { data: newPrj, error: prjErr } = await supabase.from('projects').insert({
          name, 
          location_name: name.includes('Ruko') ? 'Jakarta Pusat' : 'Bekasi Timur',
          lead_id: userMap.kepala_teknik,
          progress_pct: name.includes('Ruko') ? 35 : 10
        }).select().single();
        if (prjErr) throw prjErr;
        prjList.push(newPrj);
      } else {
        prjList.push(existing);
      }
    }

    // 3. Buat Absensi
    console.log('📅 Membuat riwayat absensi...');
    // Bersihkan dulu agar tidak duplikat saat re-run seed
    await supabase.from('attendance_logs').delete().in('employee_id', userMap.karyawanList);

    const attendanceLogs = [];
    const today = new Date();
    for (let i = 0; i < 3; i++) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      const dateIso = date.toISOString().split('T')[0];
      for (const empId of userMap.karyawanList) {
        attendanceLogs.push({
          employee_id: empId,
          project_id: prjList[0].id,
          check_in: '08:00:00', check_out: '17:00:00',
          notes: 'Hadir', basic_salary: 150000,
          overtime_hours: i === 0 ? 2 : 0, overtime_rate: 20000,
          overtime_pay: i === 0 ? 40000 : 0,
          created_at: `${dateIso}T08:00:00Z`
        });
      }
    }
    await supabase.from('attendance_logs').insert(attendanceLogs);

    // 4. Laporan Progress
    console.log('📸 Membuat laporan progress...');
    await supabase.from('project_updates').delete().eq('project_id', prjList[0].id);
    await supabase.from('project_updates').insert([
      {
        project_id: prjList[0].id, reported_by: userMap.kepala_teknik,
        percentage: 35, description: 'Pemasangan keramik lantai 1 selesai.',
        created_at: today.toISOString()
      }
    ]);

    console.log('✅ Seeding selesai!');
    console.log('\nAkun Demo (Password: password123):');
    mockUsers.forEach(u => console.log(`- [${u.role.toUpperCase()}] ${u.email}`));

  } catch (err) {
    console.error('❌ Seeding gagal:', err.message);
  }
}

seed();
