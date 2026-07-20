const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://onctfzipwlkfiapechif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY3Rmemlwd2xrZmlhcGVjaGlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzc2NzgsImV4cCI6MjA5Nzk1MzY3OH0.7LH4mJWstf0v9-1oQgbXj06NgZaWHahkl_ksMA1oOCc',
  { auth: { persistSession: false } }
);

async function main() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'director@shiksharthi.com',
    password: 'Shiksharthi@123'
  });
  if (authErr) {
    console.error('Sign in failed:', authErr.message);
    return;
  }
  console.log('Logged in successfully. ID:', authData.user.id);

  const pubaliBranchId = '7e8829db-256c-4fab-9b9d-167f1d4efbcb';
  const code = 'SHK-PUB-' + Math.floor(1000 + Math.random() * 9000);

  // 1. Insert student
  const { data: student, error: sErr } = await supabase
    .from('students')
    .insert({
      student_code: code,
      name: 'Test Pubali Student',
      parent_name: 'Test Parent',
      date_of_birth: '2012-05-05',
      gender: 'Male',
      address: 'Pubali St',
      school: 'Pubali School',
      admission_date: new Date().toISOString().split('T')[0]
    })
    .select()
    .single();

  if (sErr) {
    console.error('Student insertion error:', sErr.message, sErr);
    return;
  }
  console.log('Student inserted successfully. Student ID:', student.id);

  // Get active academic year
  const { data: years } = await supabase.from('academic_years').select('id').eq('is_current', true).limit(1);
  const yearId = years && years[0] ? years[0].id : null;
  console.log('Academic year ID:', yearId);

  // 2. Insert enrollment
  const { data: enrollment, error: eErr } = await supabase
    .from('enrollments')
    .insert({
      student_id: student.id,
      academic_year_id: yearId,
      branch_id: pubaliBranchId,
      class: '8', // Pubali class 8
      board: 'ICSE',
      batch_id: null,
      package_type: 'Boards',
      subjects_taken: ['Physics', 'Chemistry'],
      status: 'Active',
      status_effective_date: new Date().toISOString().split('T')[0]
    })
    .select()
    .single();

  if (eErr) {
    console.error('Enrollment insertion error:', eErr.message, eErr);
  } else {
    console.log('Enrollment inserted successfully. Enrollment ID:', enrollment.id);
  }

  process.exit(0);
}

main();
