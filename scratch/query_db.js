const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://onctfzipwlkfiapechif.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY3Rmemlwd2xrZmlhcGVjaGlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzc2NzgsImV4cCI6MjA5Nzk1MzY3OH0.7LH4mJWstf0v9-1oQgbXj06NgZaWHahkl_ksMA1oOCc';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function main() {
  try {
    await supabase.auth.signInWithPassword({
      email: 'director@shiksharthi.com',
      password: 'Shiksharthi@123'
    });

    console.log('--- Batches ---');
    const { data: batches } = await supabase.from('batches').select('id, name');
    console.log(batches);

    console.log('--- Rooms ---');
    const { data: rooms } = await supabase.from('rooms').select('id, name');
    console.log(rooms);

    console.log('--- Faculty ---');
    const { data: faculty } = await supabase.from('faculty').select('id, name, subjects');
    console.log(faculty);

    console.log('--- Schedules ---');
    const { data: schedules } = await supabase.from('schedules').select('*, batches(name), rooms(name), faculty(name)');
    console.log(JSON.stringify(schedules, null, 2));

  } catch (err) {
    console.error('Err:', err);
  }
}

main();
