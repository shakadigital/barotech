import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://entwkvvexvwyngwzxmdc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudHdrdnZleHZ3eW5nd3p4bWRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzcxMTYyOCwiZXhwIjoyMDkzMjg3NjI4fQ.aZTC_3Xcv1kawyP25CvLM0uA5T1P-nXkN7iIB6QYpmY';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function bootstrap() {
  const email = 'admin@barotech.com';
  const password = 'password123';
  const full_name = 'Super Admin';
  const role = 'superadmin';

  console.log(`Checking/Creating user: ${email}...`);

  try {
    let userId;

    // 1. Try to create user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role }
    });

    if (authError) {
      if (authError.message.includes('already registered') || authError.code === '23505') {
        console.log('ℹ️ User already exists in Auth. Fetching ID...');
        // Listing users to find the ID by email
        const { data: users, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;
        const existingUser = users.users.find(u => u.email === email);
        if (!existingUser) throw new Error('User supposedly exists but not found in list.');
        userId = existingUser.id;
      } else {
        throw authError;
      }
    } else {
      userId = authData.user.id;
    }

    if (userId) {
      // 2. Upsert into profiles (ensure columns exist)
      console.log(`Upserting profile for ID: ${userId}...`);
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name,
        role,
        whatsapp_number: '08123456789'
      });
      if (profileError) {
        console.error('Profile Error Details:', profileError);
        throw profileError;
      }
      console.log('✅ Default superadmin ready!');
      console.log(`Email: ${email}`);
      console.log(`Password: ${password}`);
    }

  } catch (err) {
    console.error('❌ Bootstrap failed:', err.message);
  }
}

bootstrap();
