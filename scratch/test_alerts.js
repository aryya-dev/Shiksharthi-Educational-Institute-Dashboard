const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://onctfzipwlkfiapechif.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY3Rmemlwd2xrZmlhcGVjaGlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzc2NzgsImV4cCI6MjA5Nzk1MzY3OH0.7LH4mJWstf0v9-1oQgbXj06NgZaWHahkl_ksMA1oOCc';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function run() {
  try {
    await supabase.auth.signInWithPassword({
      email: 'director@shiksharthi.com',
      password: 'Shiksharthi@123'
    });

    const branchId = '46f641ae-88bf-46d4-b95d-66b0389220c2';
    const yearId = '7199a07e-a131-49d9-9495-29d510997f66';

    console.log('Querying exam results...');
    const { data: resData, error: resError } = await supabase
      .from('results')
      .select(`
        id,
        marks_obtained,
        percentage,
        enrollment_id,
        enrollments!inner(
          id,
          branch_id,
          academic_year_id,
          students(name, student_code),
          batches(id, name)
        ),
        exams!inner(
          id,
          name,
          date,
          subject_name,
          max_marks
        )
      `)
      .eq('enrollments.branch_id', branchId)
      .eq('enrollments.academic_year_id', yearId);

    if (resError) {
      console.error('Results Query Error:', resError);
    } else {
      console.log('Query succeeded! Total records:', resData.length);
      if (resData.length > 0) {
        console.log('Sample record:', JSON.stringify(resData[0], null, 2));
      }
    }
  } catch (err) {
    console.error(err);
  }
}

run();
