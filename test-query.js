const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://onctfzipwlkfiapechif.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY3Rmemlwd2xrZmlhcGVjaGlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzc2NzgsImV4cCI6MjA5Nzk1MzY3OH0.7LH4mJWstf0v9-1oQgbXj06NgZaWHahkl_ksMA1oOCc';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function test() {
  try {
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: 'director@shiksharthi.com',
      password: 'Shiksharthi@123'
    });

    console.log('Fetching batches...');
    const { data: batches } = await supabase
      .from('batches')
      .select('id, name');
    
    if (batches && batches.length > 0) {
      const batchIds = batches.map(b => b.id);
      
      const { data, error } = await supabase
        .from('batch_subjects')
        .select('*, faculty(name)')
        .in('batch_id', batchIds);

      if (error) {
        console.error('Batch Subjects Query Error:', error);
      } else {
        console.log('Query succeeded! Result length:', data.length);
        console.log('Results:', JSON.stringify(data, null, 2));
      }
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

test();
