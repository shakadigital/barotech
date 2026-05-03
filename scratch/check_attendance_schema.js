import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://entwkvvexvwyngwzxmdc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudHdrdnZleHZ3eW5nd3p4bWRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzcxMTYyOCwiZXhwIjoyMDkzMjg3NjI4fQ.aZTC_3Xcv1kawyP25CvLM0uA5T1P-nXkN7iIB6QYpmY';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAttendanceSchema() {
  console.log('Checking attendance_logs schema...');
  const { data, error } = await supabase.from('attendance_logs').select('*').limit(1);
  if (error) {
    if (error.code === '42P01') console.log('attendance_logs table does not exist.');
    else console.error(error);
  } else {
    console.log('Columns in attendance_logs:', Object.keys(data[0] || {}));
  }
}

checkAttendanceSchema();
