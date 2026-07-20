const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://onctfzipwlkfiapechif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY3Rmemlwd2xrZmlhcGVjaGlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzc2NzgsImV4cCI6MjA5Nzk1MzY3OH0.7LH4mJWstf0v9-1oQgbXj06NgZaWHahkl_ksMA1oOCc',
  { auth: { persistSession: false } }
);

async function main() {
  await supabase.auth.signInWithPassword({ email: 'director@shiksharthi.com', password: 'Shiksharthi@123' });

  console.log('--- Search for SHK-PUB-0001 ---');
  const { data: student, error: sErr } = await supabase
    .from('students')
    .select('*')
    .eq('student_code', 'SHK-PUB-0001');

  if (sErr) {
    console.error(sErr);
  } else {
    console.log(student);
  }

  process.exit(0);
}

main();
