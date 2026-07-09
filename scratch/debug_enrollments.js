const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://onctfzipwlkfiapechif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY3Rmemlwd2xrZmlhcGVjaGlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzc2NzgsImV4cCI6MjA5Nzk1MzY3OH0.7LH4mJWstf0v9-1oQgbXj06NgZaWHahkl_ksMA1oOCc',
  { auth: { persistSession: false } }
);

async function main() {
  await supabase.auth.signInWithPassword({ email: 'director@shiksharthi.com', password: 'Shiksharthi@123' });

  // Check enrollments with subjects_taken and students
  const { data, error } = await supabase
    .from('enrollments')
    .select('id, batch_id, status, subjects_taken, add_on_subjects, students(name, student_code)')
    .in('status', ['Active', 'Leave of Absence'])
    .limit(10);

  if (error) {
    console.error('Enrollment query error:', error);
  } else {
    console.log('Total enrollments found:', data.length);
    data.forEach(e => {
      console.log({
        student: e.students?.name,
        code: e.students?.student_code,
        batch_id: e.batch_id,
        status: e.status,
        subjects_taken: e.subjects_taken,
        add_on_subjects: e.add_on_subjects,
      });
    });
  }

  // Check batches
  const { data: batches } = await supabase.from('batches').select('id, name');
  console.log('\nBatches:', batches);
}

main();
