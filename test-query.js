const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://onctfzipwlkfiapechif.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY3Rmemlwd2xrZmlhcGVjaGlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzc2NzgsImV4cCI6MjA5Nzk1MzY3OH0.7LH4mJWstf0v9-1oQgbXj06NgZaWHahkl_ksMA1oOCc';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function test() {
  try {
    await supabase.auth.signInWithPassword({
      email: 'director@shiksharthi.com',
      password: 'Shiksharthi@123'
    });

    const PUBALI_ID = '7e8829db-256c-4fab-9b9d-167f1d4efbcb';

    // 1. Check enrollments for Pubali
    const { data: enrollments, error: eErr, count } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact' })
      .eq('branch_id', PUBALI_ID);

    console.log('--- PUBALI ENROLLMENTS ---');
    console.log('Error:', eErr);
    console.log('Count:', count);
    console.log('Data:', JSON.stringify(enrollments, null, 2));

    // 2. Check academic years
    const { data: years } = await supabase.from('academic_years').select('*');
    console.log('\n--- ACADEMIC YEARS ---');
    console.log(JSON.stringify(years, null, 2));

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

test();

