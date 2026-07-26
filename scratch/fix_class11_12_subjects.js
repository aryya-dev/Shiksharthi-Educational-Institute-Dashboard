const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://onctfzipwlkfiapechif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY3Rmemlwd2xrZmlhcGVjaGlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzc2NzgsImV4cCI6MjA5Nzk1MzY3OH0.7LH4mJWstf0v9-1oQgbXj06NgZaWHahkl_ksMA1oOCc',
  { auth: { persistSession: false } }
);

function normalizeSubjects(subjects, packageType) {
  let list = Array.isArray(subjects) ? [...subjects] : [];
  let expanded = [];

  list.forEach(s => {
    if (!s) return;
    const clean = s.trim();
    const norm = clean.toLowerCase();

    if (packageType === 'Boards') {
      if (norm === 'pc') {
        expanded.push('Physics (Board)', 'Chemistry (Board)');
      } else if (norm === 'pm') {
        expanded.push('Physics (Board)', 'Mathematics (Board)');
      } else if (norm === 'pb') {
        expanded.push('Physics (Board)', 'Biology (Board)');
      } else if (norm === 'cb') {
        expanded.push('Chemistry (Board)', 'Biology (Board)');
      } else if (norm === 'mb') {
        expanded.push('Mathematics (Board)', 'Biology (Board)');
      } else if (norm === 'pcm') {
        expanded.push('Physics (Board)', 'Chemistry (Board)', 'Mathematics (Board)');
      } else if (norm === 'pcb') {
        expanded.push('Physics (Board)', 'Chemistry (Board)', 'Biology (Board)');
      } else if (norm === 'pcmb') {
        expanded.push('Physics (Board)', 'Chemistry (Board)', 'Mathematics (Board)', 'Biology (Board)');
      } else if (clean === 'Physics' || clean === 'Physics (JEE)') {
        expanded.push('Physics (Board)');
      } else if (clean === 'Chemistry' || clean === 'Chemistry (JEE)') {
        expanded.push('Chemistry (Board)');
      } else if (clean === 'Mathematics' || clean === 'Maths' || clean === 'Mathematics (JEE)') {
        expanded.push('Mathematics (Board)');
      } else if (clean === 'Biology' || clean === 'Biology (NEET)') {
        expanded.push('Biology (Board)');
      } else {
        expanded.push(clean);
      }
    } else if (packageType === 'JEE') {
      if (norm === 'pc') {
        expanded.push('Physics', 'Chemistry');
      } else if (norm === 'pm') {
        expanded.push('Physics', 'Mathematics');
      } else if (norm === 'pcm') {
        expanded.push('Physics', 'Chemistry', 'Mathematics');
      } else if (clean === 'Physics (Board)') {
        expanded.push('Physics');
      } else if (clean === 'Chemistry (Board)') {
        expanded.push('Chemistry');
      } else if (clean === 'Mathematics (Board)' || clean === 'Mathematics (NEET)') {
        expanded.push('Mathematics');
      } else {
        expanded.push(clean);
      }
    } else if (packageType === 'NEET') {
      if (norm === 'pc') {
        expanded.push('Physics', 'Chemistry');
      } else if (norm === 'pb') {
        expanded.push('Physics', 'Biology');
      } else if (norm === 'cb') {
        expanded.push('Chemistry', 'Biology');
      } else if (norm === 'pcb') {
        expanded.push('Physics', 'Chemistry', 'Biology');
      } else if (clean === 'Physics (Board)') {
        expanded.push('Physics');
      } else if (clean === 'Chemistry (Board)') {
        expanded.push('Chemistry');
      } else if (clean === 'Biology (Board)') {
        expanded.push('Biology');
      } else {
        expanded.push(clean);
      }
    } else {
      expanded.push(clean);
    }
  });

  if (packageType === 'JEE') {
    const mandatory = ['Physics', 'Chemistry', 'Mathematics'];
    mandatory.forEach(m => { if (!expanded.includes(m)) expanded.unshift(m); });
  } else if (packageType === 'NEET') {
    const mandatory = ['Physics', 'Chemistry', 'Biology'];
    mandatory.forEach(m => { if (!expanded.includes(m)) expanded.unshift(m); });
  }

  return Array.from(new Set(expanded));
}

async function fixAllSubjects() {
  console.log("Signing in...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'director@shiksharthi.com',
    password: 'Shiksharthi@123'
  });

  if (authErr) {
    console.error("Auth Error:", authErr.message);
    return;
  }
  console.log("Signed in successfully as:", authData.user.email);

  console.log("Fetching all enrollments...");
  const { data: enrollments, error } = await supabase
    .from('enrollments')
    .select('id, class, package_type, subjects_taken, students(student_code, name)');

  if (error) {
    console.error("Error fetching enrollments:", error.message);
    return;
  }

  console.log(`Found ${enrollments.length} total enrollments.`);
  let updatedCount = 0;

  for (const item of enrollments) {
    const clsStr = String(item.class || '').trim();
    // Class 11 & 12
    const is11or12 = clsStr.includes('11') || clsStr.includes('12') || clsStr.includes('XI') || clsStr.includes('XII') || !item.class;

    if (!is11or12) continue;

    const pkg = item.package_type || 'Boards';
    const oldSubjects = item.subjects_taken || [];
    const newSubjects = normalizeSubjects(oldSubjects, pkg);

    const oldStr = JSON.stringify(oldSubjects);
    const newStr = JSON.stringify(newSubjects);

    if (oldStr !== newStr) {
      console.log(`\nUpdating Student: ${item.students?.student_code || ''} - ${item.students?.name || ''} (Class: "${item.class}", Package: "${pkg}")`);
      console.log(`  OLD: ${oldStr}`);
      console.log(`  NEW: ${newStr}`);

      const { error: updateErr } = await supabase
        .from('enrollments')
        .update({ subjects_taken: newSubjects })
        .eq('id', item.id);

      if (updateErr) {
        console.error(`  ERROR updating enrollment ${item.id}:`, updateErr.message);
      } else {
        console.log(`  SUCCESSFULLY updated.`);
        updatedCount++;
      }
    }
  }

  console.log(`\n==============================================`);
  console.log(`Done! Total enrollments updated in database: ${updatedCount}`);
  console.log(`==============================================`);
}

fixAllSubjects();
