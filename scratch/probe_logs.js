const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://onctfzipwlkfiapechif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY3Rmemlwd2xrZmlhcGVjaGlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzc2NzgsImV4cCI6MjA5Nzk1MzY3OH0.7LH4mJWstf0v9-1oQgbXj06NgZaWHahkl_ksMA1oOCc',
  { auth: { persistSession: false } }
);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'director@shiksharthi.com',
    password: 'Shiksharthi@123'
  });

  const userId = (await supabase.auth.getUser()).data.user?.id;
  console.log('User ID:', userId);

  // Try columns one by one to discover the schema
  const candidates = ['actor_id', 'performed_by', 'user_id', 'profile_id', 'created_by'];
  for (const col of candidates) {
    const obj = { action: 'PROBE', details: { test: true }, [col]: userId };
    const { error } = await supabase.from('activity_logs').insert(obj);
    if (error && error.message.includes('Could not find')) {
      console.log(`  ✗ Column "${col}" does not exist`);
    } else if (error) {
      console.log(`  ⚠ Column "${col}" exists but insert failed: ${error.message}`);
    } else {
      console.log(`  ✓ Column "${col}" works!`);
    }
  }

  // Also try the page's join hint: .select('*, profiles(name, role)')
  // That means there must be an FK to profiles. Let's try actor_id again with correct value format
  // And check if branch_id is needed
  const fullAttempts = [
    { action: 'PROBE', details: {}, actor_id: userId, branch_id: '46f641ae-88bf-46d4-b95d-66b0389220c2' },
    { action: 'PROBE', details: {}, performed_by: userId, branch_id: '46f641ae-88bf-46d4-b95d-66b0389220c2' },
  ];
  for (const obj of fullAttempts) {
    const { data, error } = await supabase.from('activity_logs').insert(obj).select();
    if (error) {
      console.log(`\nFull attempt failed: ${JSON.stringify(Object.keys(obj))} → ${error.message}`);
    } else {
      console.log(`\nFull attempt OK! Columns: ${Object.keys(data[0])}`);
      console.log(JSON.stringify(data[0], null, 2));
      await supabase.from('activity_logs').delete().eq('id', data[0].id);
    }
  }
}
run();
