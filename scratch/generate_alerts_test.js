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

    console.log('Fetching data for alerts...');
    
    // 1. Fetch Attendance
    const { data: attData } = await supabase
      .from('attendance')
      .select(`
        id,
        status,
        enrollment_id,
        enrollments!inner(
          id,
          branch_id,
          academic_year_id,
          students(name, student_code),
          batches(name)
        ),
        class_sessions!inner(
          subject_name,
          date
        )
      `)
      .eq('enrollments.branch_id', branchId)
      .eq('enrollments.academic_year_id', yearId);

    // 2. Fetch Exam Results
    const { data: resData } = await supabase
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
          batches(name)
        ),
        exams!inner(
          name,
          date,
          max_marks
        )
      `)
      .eq('enrollments.branch_id', branchId)
      .eq('enrollments.academic_year_id', yearId);

    const alerts = [];

    // --- ALGORITHM 1: Back-to-back 2 absents in a single subject ---
    // Group attendance by enrollment_id, then by subject
    const attGrouped = {};
    attData.forEach(rec => {
      const eId = rec.enrollment_id;
      if (!attGrouped[eId]) {
        attGrouped[eId] = {
          name: rec.enrollments.students.name,
          code: rec.enrollments.students.student_code,
          batch: rec.enrollments.batches.name,
          subjects: {}
        };
      }
      const subj = rec.class_sessions.subject_name;
      if (!attGrouped[eId].subjects[subj]) {
        attGrouped[eId].subjects[subj] = [];
      }
      attGrouped[eId].subjects[subj].push({
        status: rec.status,
        date: rec.class_sessions.date
      });
    });

    Object.keys(attGrouped).forEach(eId => {
      const student = attGrouped[eId];
      Object.keys(student.subjects).forEach(subj => {
        const records = student.subjects[subj];
        // Sort chronologically by date
        records.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Find consecutive absents
        for (let i = 0; i < records.length - 1; i++) {
          if (records[i].status === 'Absent' && records[i + 1].status === 'Absent') {
            alerts.push({
              type: 'danger',
              title: `Consecutive Absences: ${student.name}`,
              description: `${student.name} (${student.code}) was absent back-to-back in ${subj} (${student.batch}) on ${records[i].date} and ${records[i + 1].date}.`
            });
            // Break so we don't alert multiple times for the same consecutive chain if we only need one alert
            break; 
          }
        }
      });
    });

    // --- ALGORITHM 2: Scoring below 25% consecutively 2 times in tests ---
    // Group results by enrollment_id
    const resGrouped = {};
    resData.forEach(rec => {
      const eId = rec.enrollment_id;
      if (!resGrouped[eId]) {
        resGrouped[eId] = {
          name: rec.enrollments.students.name,
          code: rec.enrollments.students.student_code,
          batch: rec.enrollments.batches.name,
          scores: []
        };
      }
      resGrouped[eId].scores.push({
        examName: rec.exams.name,
        date: rec.exams.date,
        percentage: parseFloat(rec.percentage),
        marks: parseFloat(rec.marks_obtained),
        maxMarks: parseFloat(rec.exams.max_marks)
      });
    });

    Object.keys(resGrouped).forEach(eId => {
      const student = resGrouped[eId];
      const scores = student.scores;
      // Sort chronologically by date
      scores.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      for (let i = 0; i < scores.length - 1; i++) {
        // Exclude absents (marks_obtained < 0)
        const s1 = scores[i];
        const s2 = scores[i + 1];
        if (s1.marks >= 0 && s1.percentage < 25 && s2.marks >= 0 && s2.percentage < 25) {
          alerts.push({
            type: 'warning',
            title: `Consecutive Low Scores: ${student.name}`,
            description: `${student.name} (${student.code}) scored below 25% consecutively in ${s1.examName} (${s1.percentage}%) on ${s1.date} and ${s2.examName} (${s2.percentage}%) on ${s2.date}.`
          });
          break;
        }
      }
    });

    console.log('--- GENERATED ALERTS ---');
    console.log(alerts);
  } catch (err) {
    console.error(err);
  }
}

run();
