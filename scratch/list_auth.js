import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://entwkvvexvwyngwzxmdc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudHdrdnZleHZ3eW5nd3p4bWRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzcxMTYyOCwiZXhwIjoyMDkzMjg3NjI4fQ.aZTC_3Xcv1kawyP25CvLM0uA5T1P-nXkN7iIB6QYpmY';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function list() {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) console.error(error);
  else {
    console.log('Auth users count:', data.users.length);
    const admin = data.users.find(u => u.email === 'admin@barotech.com');
    if (admin) console.log('Admin found in Auth. ID:', admin.id);
    else console.log('Admin NOT found in Auth.');
  }
}

list();
