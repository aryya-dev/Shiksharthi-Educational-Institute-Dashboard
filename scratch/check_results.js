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

    const exam_id = '16f4ad58-c405-4dac-91ce-c7b9e45f128b';
    const enrollment_id = '2a34922f-aef9-47d9-9aab-0f3c923bc008'; // Aishika Sikdar

    console.log('1. Cleaning up existing result...');
    await supabase.from('results').delete().eq('exam_id', exam_id).eq('enrollment_id', enrollment_id);

    console.log('2. Inserting first time (without ID)...');
    const { data: d1, error: e1 } = await supabase
      .from('results')
      .upsert({
        exam_id,
        enrollment_id,
        marks_obtained: 45,
        percentage: 75,
        rank_in_batch: 1
      }, { onConflict: 'exam_id,enrollment_id' })
      .select();

    if (e1) {
      console.error('Insert 1 failed:', e1);
      return;
    }
    console.log('Insert 1 succeeded:', d1);

    const insertedId = d1[0].id;

    console.log('3. Upserting second time (with ID)...');
    const { data: d2, error: e2 } = await supabase
      .from('results')
      .upsert({
        id: insertedId,
        exam_id,
        enrollment_id,
        marks_obtained: 48,
        percentage: 80,
        rank_in_batch: 1
      }, { onConflict: 'exam_id,enrollment_id' })
      .select();

    if (e2) {
      console.error('Upsert 2 (with ID) failed:', e2);
    } else {
      console.log('Upsert 2 (with ID) succeeded:', d2);
    }

    console.log('4. Upserting third time (without ID)...');
    const { data: d3, error: e3 } = await supabase
      .from('results')
      .upsert({
        exam_id,
        enrollment_id,
        marks_obtained: 50,
        percentage: 83.33,
        rank_in_batch: 1
      }, { onConflict: 'exam_id,enrollment_id' })
      .select();

    if (e3) {
      console.error('Upsert 3 (without ID) failed:', e3);
    } else {
      console.log('Upsert 3 (without ID) succeeded:', d3);
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

test();
