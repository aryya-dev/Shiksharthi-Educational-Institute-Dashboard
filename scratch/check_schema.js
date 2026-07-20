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

    // Fetch user-defined functions in public schema
    const { data, error } = await supabase
      .from('pg_catalog.pg_proc')
      .select('proname')
      .limit(10);

    if (error) {
      // Let's try calling supabase.rpc with random names to see if we can query functions or information_schema
      console.log('Error selecting pg_proc:', error.message);
      
      // Let's try information_schema.routines
      const { data: routines, error: rErr } = await supabase
        .from('information_schema.routines')
        .select('routine_name')
        .eq('routine_schema', 'public');
      if (rErr) {
        console.log('Error selecting information_schema.routines:', rErr.message);
      } else {
        console.log('Routines in public schema:', routines.map(r => r.routine_name));
      }
    } else {
      console.log('Functions:', data.map(d => d.proname));
    }
  } catch (err) {
    console.error('Err:', err);
  }
}

test();
