const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://onctfzipwlkfiapechif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY3Rmemlwd2xrZmlhcGVjaGlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzc2NzgsImV4cCI6MjA5Nzk1MzY3OH0.7LH4mJWstf0v9-1oQgbXj06NgZaWHahkl_ksMA1oOCc',
  { auth: { persistSession: false } }
);

async function testAdmission(email, password, branchCode, branchId) {
  console.log(`\n=== Testing Admission for ${email} ===`);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error('Sign in failed:', authErr.message);
    return;
  }
  console.log('Logged in successfully. ID:', authData.user.id);

  try {
    // 1. Count enrollments
    const { count, error: countErr } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branchId);
    
    if (countErr) {
      console.error('Count query error:', countErr.message);
      return;
    }
    
    const sequenceNum = String((count || 0) + 1).padStart(4, '0');
    const code = `SHK-${branchCode}-${sequenceNum}`;
    console.log(`Generated student code: ${code}`);

    // 2. Insert student
    const { data: student, error: sErr } = await supabase
      .from('students')
      .insert({
        student_code: code,
        name: 'Test Pubali Student ' + Date.now(),
        parent_name: 'Test Parent',
        date_of_birth: '2010-01-01',
        gender: 'Male',
        address: 'Test Pubali Road',
        school: 'Test School',
        admission_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (sErr) {
      console.error('Student insertion error:', sErr.message, sErr);
      return;
    }
    console.log('Student inserted successfully. Student ID:', student.id);

    // 3. Create enrollment
    const academicYearId = '9bbf9777-61b5-4a89-bc2f-0b391940e7dc'; // Let's find real academic year ID if this fails, or query it
    const { data: years } = await supabase.from('academic_years').select('id').eq('is_current', true).limit(1);
    const yearId = years && years[0] ? years[0].id : null;
    console.log('Academic year ID used:', yearId);

    const { data: enrollment, error: eErr } = await supabase
      .from('enrollments')
      .insert({
        student_id: student.id,
        academic_year_id: yearId,
        branch_id: branchId,
        class: '8', // Pubali class 8
        board: 'ICSE',
        batch_id: null, // Let's try null first
        package_type: 'Boards',
        subjects_taken: ['Physics', 'Chemistry'],
        status: 'Active',
        status_effective_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (eErr) {
      console.error('Enrollment insertion error:', eErr.message, eErr);
      return;
    }
    console.log('Enrollment created successfully. Enrollment ID:', enrollment.id);

  } catch (err) {
    console.error('Catch error:', err);
  }
}

async function run() {
  const pubaliBranchId = '7e8829db-256c-4fab-9b9d-167f1d4efbcb';
  
  // Test as Admin
  await testAdmission('admin@shiksharthi.com', 'Shiksharthi@123', 'PUB', pubaliBranchId);
  
  // Test as Director
  await testAdmission('director@shiksharthi.com', 'Shiksharthi@123', 'PUB', pubaliBranchId);
}

run();
