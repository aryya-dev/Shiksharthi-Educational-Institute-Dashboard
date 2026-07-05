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

    const { data, error } = await supabase
      .from('enrollments')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error fetching enrollments:', error);
    } else {
      console.log('Enrollment fields:', Object.keys(data[0] || {}));
    }
  } catch (err) {
    console.error('Err:', err);
  }
}

test();
