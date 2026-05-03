import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://entwkvvexvwyngwzxmdc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudHdrdnZleHZ3eW5nd3p4bWRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzcxMTYyOCwiZXhwIjoyMDkzMjg3NjI4fQ.aZTC_3Xcv1kawyP25CvLM0uA5T1P-nXkN7iIB6QYpmY';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDb() {
  console.log('Checking database tables...');
  try {
    const { data, error } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    if (error) {
      if (error.code === '42P01') {
        console.error('❌ Table "profiles" does not exist. Please run database-setup.sql in Supabase SQL Editor.');
      } else {
        console.error('❌ Database error:', error.message);
      }
      return;
    }
    console.log('✅ Table "profiles" exists. Count:', data);
    
    // Check if any user exists
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    console.log('User count:', count);
    if (count === 0) {
      console.log('ℹ️ No users found in "profiles".');
    }
  } catch (err) {
    console.error('❌ Connection error:', err.message);
  }
}

checkDb();
