'use client';

import React, { useEffect, useState } from 'react';
import {
  FileText,
  Plus,
  Calendar,
  Layers,
  Trophy,
  TrendingUp,
  Save,
  X,
  Edit,
  TrendingDown,
  Minus
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { createClient } from '@/utils/supabase/client';

interface ExamRecord {
  id: string;
  name: string;
  type: 'Subject Test' | 'Periodic Test' | 'Mock Test' | 'Full Syllabus Test';
  batchName: string;
  batchId: string;
  subjectName: string;
  date: string;
  maxMarks: number;
  chaptersCovered: string;
}

interface ResultRecord {
  id: string;
  enrollmentId: string;
  studentCode: string;
  studentName: string;
  marksObtained: number | null;
  percentage: number | null;
  rank: number | null;
}

export default function ExamsPage() {
  const supabase = createClient();
  const { currentBranch, currentAcademicYear } = useAppStore();

  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [selectedExam, setSelectedExam] = useState<ExamRecord | null>(null);
  const [results, setResults] = useState<ResultRecord[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditingMarks, setIsEditingMarks] = useState(false);
  const [editableResults, setEditableResults] = useState<{ [enrollmentId: string]: string }>({});

  const [loading, setLoading] = useState(true);

  // New Exam Form State
  const [newExam, setNewExam] = useState({
    name: '',
    type: 'Subject Test' as ExamRecord['type'],
    batchId: '',
    subjectName: 'Physics',
    date: '',
    maxMarks: '50',
    chaptersCovered: ''
  });

  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);

  // Fetch batches dynamically
  useEffect(() => {
    async function fetchBatches() {
      if (!currentBranch || !currentAcademicYear) return;
      try {
        const { data } = await supabase
          .from('batches')
          .select('id, name')
          .eq('branch_id', currentBranch.id)
          .eq('academic_year_id', currentAcademicYear.id)
          .order('name');
        
        const list = data || [];
        setBatches(list);
        if (list.length > 0) {
          setNewExam(prev => ({ ...prev, batchId: list[0].id }));
        } else {
          setNewExam(prev => ({ ...prev, batchId: '' }));
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchBatches();
  }, [currentBranch, currentAcademicYear]);

  // Load Exams
  useEffect(() => {
    async function loadExams() {
      if (!currentBranch || !currentAcademicYear) return;
      setLoading(true);

      try {
        const { data } = await supabase
          .from('exams')
          .select('*, batches(name)')
          .eq('branch_id', currentBranch.id)
          .eq('academic_year_id', currentAcademicYear.id);

        let mappedExams: ExamRecord[] = (data || []).map((e: any) => ({
          id: e.id,
          name: e.name,
          type: e.type,
          batchName: e.batches?.name || 'Unassigned',
          batchId: e.batch_id,
          subjectName: e.subject_name,
          date: e.date,
          maxMarks: e.max_marks,
          chaptersCovered: e.chapters_covered || ''
        }));



        setExams(mappedExams);
        if (mappedExams.length > 0) {
          setSelectedExam(mappedExams[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadExams();
  }, [currentBranch, currentAcademicYear]);

  // Load Results for selected exam
  useEffect(() => {
    async function loadResults() {
      if (!selectedExam) return;

      try {
        // 1. Fetch existing results
        const { data: dbResults, error: resultsError } = await supabase
          .from('results')
          .select(`
            id,
            marks_obtained,
            percentage,
            rank_in_batch,
            enrollment_id
          `)
          .eq('exam_id', selectedExam.id);

        if (resultsError) throw resultsError;

        // 2. Fetch all active/on-leave enrollments for this batch
        const { data: dbEnrollments, error: enrollmentsError } = await supabase
          .from('enrollments')
          .select(`
            id,
            subjects_taken,
            students (
              name,
              student_code
            )
          `)
          .eq('batch_id', selectedExam.batchId)
          .in('status', ['Active', 'Leave of Absence']);

        if (enrollmentsError) throw enrollmentsError;

        // 3. Filter enrollments by subject name (case-insensitive substring check)
        const enrolledStudents = (dbEnrollments || []).filter((e: any) => {
          const subjects = e.subjects_taken || [];
          return subjects.some((s: string) => 
            s.toLowerCase().includes(selectedExam.subjectName.toLowerCase())
          );
        });

        // 4. Merge results with enrollments
        const mergedResults: ResultRecord[] = enrolledStudents.map((e: any) => {
          const existingResult = (dbResults || []).find((r: any) => r.enrollment_id === e.id);
          
          return {
            id: existingResult?.id || `temp-${e.id}`,
            enrollmentId: e.id,
            studentCode: e.students?.student_code || '',
            studentName: e.students?.name || '',
            marksObtained: existingResult ? parseFloat(existingResult.marks_obtained) : null,
            percentage: existingResult ? parseFloat(existingResult.percentage) : null,
            rank: existingResult ? existingResult.rank_in_batch : null
          };
        });

        // Sort results: present students ranked desc, then absent, then empty/new
        mergedResults.sort((a, b) => {
          if (a.marksObtained !== null && b.marksObtained !== null) {
            if (a.marksObtained >= 0 && b.marksObtained >= 0) {
              return b.marksObtained - a.marksObtained;
            }
            if (a.marksObtained >= 0) return -1;
            if (b.marksObtained >= 0) return 1;
            return a.studentName.localeCompare(b.studentName);
          }
          if (a.marksObtained !== null) return -1;
          if (b.marksObtained !== null) return 1;
          return a.studentName.localeCompare(b.studentName);
        });

        setResults(mergedResults);

        // Initialize editable fields
        const editingObj: { [id: string]: string } = {};
        mergedResults.forEach(r => {
          if (r.marksObtained === null) {
            editingObj[r.enrollmentId] = '';
          } else if (r.marksObtained === -1) {
            editingObj[r.enrollmentId] = 'Absent';
          } else {
            editingObj[r.enrollmentId] = r.marksObtained.toString();
          }
        });
        setEditableResults(editingObj);
      } catch (err) {
        console.error(err);
      }
    }

    loadResults();
  }, [selectedExam]);

  // Handle Save Exam Schedule
  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBranch || !currentAcademicYear) return;

    const selectedBatch = batches.find(b => b.id === newExam.batchId);
    if (!selectedBatch) return;

    try {
      const { data, error } = await supabase
        .from('exams')
        .insert({
          name: newExam.name,
          type: newExam.type,
          batch_id: selectedBatch.id,
          subject_name: newExam.subjectName,
          date: newExam.date,
          max_marks: parseInt(newExam.maxMarks),
          chapters_covered: newExam.chaptersCovered,
          branch_id: currentBranch.id,
          academic_year_id: currentAcademicYear.id
        })
        .select()
        .single();

      if (error) throw error;

      setShowAddModal(false);
      const createdItem: ExamRecord = {
        id: data.id,
        name: data.name,
        type: data.type,
        batchName: selectedBatch.name,
        batchId: selectedBatch.id,
        subjectName: data.subject_name,
        date: data.date,
        maxMarks: data.max_marks,
        chaptersCovered: data.chapters_covered || ''
      };

      setExams([createdItem, ...exams]);
      setSelectedExam(createdItem);
    } catch (err) {
      console.error(err);
      // Local fallback
      setShowAddModal(false);
      const fallbackItem: ExamRecord = {
        id: `ex-temp-${Date.now()}`,
        name: newExam.name,
        type: newExam.type,
        batchName: selectedBatch.name,
        batchId: selectedBatch.id,
        subjectName: newExam.subjectName,
        date: newExam.date || new Date().toISOString().split('T')[0],
        maxMarks: parseInt(newExam.maxMarks),
        chaptersCovered: newExam.chaptersCovered
      };
      setExams([fallbackItem, ...exams]);
      setSelectedExam(fallbackItem);
    }
  };

  const isInputInvalid = (valStr: string | undefined, maxMarks: number) => {
    if (!valStr) return false;
    const trimmed = valStr.trim().toLowerCase();
    if (['absent', 'a', 'ab', 'abs', '-1'].includes(trimmed)) return false;
    const num = parseFloat(trimmed);
    if (isNaN(num) || num < 0 || num > maxMarks) return true;
    return false;
  };

  // Handle Save Student Marks spreadsheet
  const handleSaveMarks = async () => {
    if (!selectedExam) return;

    // Validation check before saving
    const invalidEntries = Object.keys(editableResults).filter(enrollmentId => {
      return isInputInvalid(editableResults[enrollmentId], selectedExam.maxMarks);
    });

    if (invalidEntries.length > 0) {
      alert(`Please correct the invalid marks before saving. Marks must be between 0 and ${selectedExam.maxMarks}, or "Absent".`);
      return;
    }

    try {
      // Formulate inserts / updates
      const recordsToUpdate = results.map(student => {
        const inputStr = editableResults[student.enrollmentId]?.trim();
        if (!inputStr) {
          return {
            ...student,
            marksObtained: null,
            percentage: null
          };
        }

        const lowerInput = inputStr.toLowerCase();
        if (['absent', 'a', 'ab', 'abs', '-1'].includes(lowerInput)) {
          return {
            ...student,
            marksObtained: -1,
            percentage: 0
          };
        }

        const marks = parseFloat(inputStr);
        const pct = (marks / selectedExam.maxMarks) * 100;
        return {
          ...student,
          marksObtained: marks,
          percentage: pct
        };
      });

      // Recalculate ranks in batch for present students only
      const presentStudents = recordsToUpdate.filter(r => r.marksObtained !== null && r.marksObtained >= 0);
      presentStudents.sort((a, b) => (b.marksObtained as number) - (a.marksObtained as number));
      const rankedPresent = presentStudents.map((rec, index) => ({
        ...rec,
        rank: index + 1
      }));

      const otherStudents = recordsToUpdate.filter(r => r.marksObtained === null || r.marksObtained < 0);
      const rankedOthers = otherStudents.map(rec => ({
        ...rec,
        rank: null
      }));

      const finalRanked = [...rankedPresent, ...rankedOthers];

      // Identify records to delete (those that were cleared from the input, but exist in DB)
      const idsToDelete = finalRanked
        .filter(r => r.marksObtained === null && r.id && !r.id.startsWith('temp-'))
        .map(r => r.id);

      if (idsToDelete.length > 0) {
        const { error: delErr } = await supabase
          .from('results')
          .delete()
          .in('id', idsToDelete);
        
        if (delErr) throw delErr;
      }

      // Identify records to upsert (any record that has non-null marksObtained)
      const dbUpsertData = finalRanked
        .filter(r => r.marksObtained !== null)
        .map(r => {
          const item: any = {
            exam_id: selectedExam.id,
            enrollment_id: r.enrollmentId,
            marks_obtained: r.marksObtained,
            percentage: r.percentage,
            rank_in_batch: r.rank
          };
          if (r.id && !r.id.startsWith('temp-')) {
            item.id = r.id;
          }
          return item;
        });

      if (dbUpsertData.length > 0) {
        const { data, error } = await supabase
          .from('results')
          .upsert(dbUpsertData, { onConflict: 'exam_id,enrollment_id' })
          .select();

        if (error) throw error;

        // Map database IDs back to our state
        const updatedWithIds = finalRanked.map(r => {
          const dbItem = data?.find((d: any) => d.enrollment_id === r.enrollmentId);
          return {
            ...r,
            id: dbItem ? dbItem.id : r.id
          };
        });

        // Re-sort results for local state
        updatedWithIds.sort((a, b) => {
          if (a.marksObtained !== null && b.marksObtained !== null) {
            if (a.marksObtained >= 0 && b.marksObtained >= 0) return b.marksObtained - a.marksObtained;
            if (a.marksObtained >= 0) return -1;
            if (b.marksObtained >= 0) return 1;
            return a.studentName.localeCompare(b.studentName);
          }
          if (a.marksObtained !== null) return -1;
          if (b.marksObtained !== null) return 1;
          return a.studentName.localeCompare(b.studentName);
        });

        setResults(updatedWithIds);
      } else {
        // If everything was deleted or none was upserted
        const clearedResults = finalRanked.map(r => {
          if (r.id && !r.id.startsWith('temp-') && r.marksObtained === null) {
            return {
              ...r,
              id: `temp-${r.enrollmentId}`
            };
          }
          return r;
        });
        setResults(clearedResults);
      }

      setIsEditingMarks(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* 1. Header Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="section-title" style={{ margin: 0, fontSize: '18px' }}>Tests & Examinations</h3>

        {/* Create Exam */}
        <button
          className="btn btn-primary"
          style={{ gap: '8px' }}
          onClick={() => {
            setNewExam({
              ...newExam,
              date: new Date().toISOString().split('T')[0]
            });
            setShowAddModal(true);
          }}
        >
          <Plus size={18} />
          <span>Schedule Exam</span>
        </button>
      </div>

      {/* 2. Page layout splits: Left Exam Catalog list, Right Marks Ledger */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)',
        gap: '32px',
        alignItems: 'start'
      }}>

        {/* Left Column: Exams catalog */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <span className="caption" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scheduled Tests</span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {exams.length === 0 ? (
              <p className="secondary-text">No exams scheduled.</p>
            ) : (
              exams.map((ex) => (
                <div
                  key={ex.id}
                  className="card"
                  style={{
                    margin: 0,
                    padding: '16px 20px',
                    cursor: 'pointer',
                    borderColor: selectedExam?.id === ex.id ? 'var(--primary-orange)' : 'var(--border-color)',
                    backgroundColor: selectedExam?.id === ex.id ? 'var(--surface-secondary)' : 'var(--surface-card)',
                    borderLeft: selectedExam?.id === ex.id ? '4px solid var(--primary-orange)' : '1px solid var(--border-color)'
                  }}
                  onClick={() => {
                    setSelectedExam(ex);
                    setIsEditingMarks(false);
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{ex.name}</span>
                    <span className="badge badge-info" style={{ fontSize: '11px', flexShrink: 0 }}>{ex.type}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }} className="caption">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Layers size={13} />
                      {ex.batchName}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={13} />
                      {ex.date}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Student Marks Spreadsheet */}
        {selectedExam ? (
          <div className="card" style={{ margin: 0, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Header info */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '16px',
              gap: '16px',
              flexWrap: 'wrap'
            }}>
              <div>
                <h3 style={{ fontSize: '18px' }}>{selectedExam.name}</h3>
                <span className="caption">
                  Subject: <strong>{selectedExam.subjectName}</strong> | Max Marks: <strong>{selectedExam.maxMarks}</strong>
                </span>
                {selectedExam.chaptersCovered && (
                  <p className="caption" style={{ marginTop: '4px' }}>
                    Chapters: {selectedExam.chaptersCovered}
                  </p>
                )}
              </div>

              {/* Edit Marks Actions */}
              <div>
                {isEditingMarks ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', minHeight: '36px', fontSize: '13px' }}
                      onClick={() => setIsEditingMarks(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', minHeight: '36px', fontSize: '13px', gap: '6px' }}
                      onClick={handleSaveMarks}
                    >
                      <Save size={14} />
                      <span>Save Changes</span>
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-secondary"
                    style={{ gap: '6px', minHeight: '38px', padding: '6px 14px' }}
                    onClick={() => setIsEditingMarks(true)}
                  >
                    <Edit size={16} />
                    <span>Enter Student Marks</span>
                  </button>
                )}
              </div>
            </div>

            {/* Test Average metrics cards */}
            {!isEditingMarks && results.filter(r => r.marksObtained !== null && r.marksObtained >= 0).length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div className="card" style={{ margin: 0, padding: '12px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Trophy size={16} style={{ color: 'var(--primary-orange)' }} />
                  <div>
                    <span className="caption">Class High</span>
                    <p style={{ fontWeight: '700', fontSize: '15px' }}>
                      {Math.max(...results.filter(r => r.marksObtained !== null && r.marksObtained >= 0).map(r => r.marksObtained as number))}/{selectedExam.maxMarks}
                    </p>
                  </div>
                </div>
                <div className="card" style={{ margin: 0, padding: '12px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <TrendingUp size={16} style={{ color: 'var(--color-success)' }} />
                  <div>
                    <span className="caption">Class Average</span>
                    <p style={{ fontWeight: '700', fontSize: '15px' }}>
                      {(results.filter(r => r.marksObtained !== null && r.marksObtained >= 0).reduce((acc, curr) => acc + (curr.marksObtained as number), 0) / results.filter(r => r.marksObtained !== null && r.marksObtained >= 0).length).toFixed(1)}/{selectedExam.maxMarks}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Marks Table */}
            <div className="table-container">
              <table className="table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Score / {selectedExam.maxMarks}</th>
                    <th>Percentage (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {results.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '24px' }} className="secondary-text">
                        No students enrolled in this batch for {selectedExam.subjectName}.
                      </td>
                    </tr>
                  ) : (
                    results.map((item) => (
                      <tr key={item.enrollmentId}>
                        <td style={{ fontWeight: '700' }}>{item.rank && item.rank > 0 ? `#${item.rank}` : '—'}</td>
                        <td style={{ fontWeight: '600', color: 'var(--primary-orange)' }}>{item.studentCode}</td>
                        <td style={{ fontWeight: '500' }}>{item.studentName}</td>
                        <td>
                          {isEditingMarks ? (
                            <input
                              type="text"
                              className="form-control"
                              style={{
                                width: '110px',
                                padding: '4px 8px',
                                minHeight: '30px',
                                borderColor: isInputInvalid(editableResults[item.enrollmentId], selectedExam.maxMarks) ? 'red' : 'var(--border-color)'
                              }}
                              value={editableResults[item.enrollmentId] ?? ''}
                              placeholder="Marks or Absent"
                              onChange={(e) => setEditableResults({
                                ...editableResults,
                                [item.enrollmentId]: e.target.value
                              })}
                            />
                          ) : (
                            <span style={{
                              fontWeight: '600',
                              color: item.marksObtained === null ? 'var(--text-disabled)' : item.marksObtained < 0 ? 'red' : 'var(--text-primary)'
                            }}>
                              {item.marksObtained === null ? '—' : item.marksObtained < 0 ? 'Absent' : item.marksObtained}
                            </span>
                          )}
                        </td>
                        <td style={{ fontWeight: '600' }}>
                          {item.percentage === null || item.marksObtained === -1 ? '—' : `${item.percentage.toFixed(1)}%`}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {isEditingMarks && (
                <div className="caption" style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>
                  * Enter numerical marks (e.g. <code>45</code>), leave blank to un-submit, or enter <code>Absent</code>, <code>A</code>, or <code>ab</code> to mark the student as absent.
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '64px' }}>
            <FileText size={48} style={{ color: 'var(--text-disabled)', marginBottom: '16px' }} />
            <h3>Select a test</h3>
            <p className="secondary-text">Select a test from the scheduled tests ledger on the left to see results.</p>
          </div>
        )}
      </div>

      {/* 3. Schedule Exam Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 200,
          padding: '16px'
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: '450px', padding: '32px',
            position: 'relative', margin: 0, boxShadow: 'var(--shadow-hover)'
          }}>
            <button
              className="btn btn-tertiary"
              style={{ position: 'absolute', right: '16px', top: '16px', padding: '8px', minHeight: '36px' }}
              onClick={() => setShowAddModal(false)}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Schedule Academic Exam</h2>

            <form onSubmit={handleSaveExam} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Exam Title *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Unit Test 1 (Electrostatics)"
                  required
                  value={newExam.name}
                  onChange={(e) => setNewExam({ ...newExam, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Exam Type</label>
                  <select
                    className="form-control"
                    value={newExam.type}
                    onChange={(e) => setNewExam({ ...newExam, type: e.target.value as ExamRecord['type'] })}
                  >
                    <option value="Subject Test">Subject Test</option>
                    <option value="Unit Test">Unit Test</option>
                    <option value="Mock Test">Mock Test</option>
                    <option value="Full Syllabus Test">Full Syllabus Test</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Target Batch *</label>
                  <select
                    className="form-control"
                    value={newExam.batchId}
                    onChange={(e) => setNewExam({ ...newExam, batchId: e.target.value })}
                  >
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Subject</label>
                  <select
                    className="form-control"
                    value={newExam.subjectName}
                    onChange={(e) => setNewExam({ ...newExam, subjectName: e.target.value })}
                  >
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Biology">Biology</option>
                    <option value="Computer Science">Computer Science</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Max Marks *</label>
                  <input
                    type="number"
                    className="form-control"
                    required
                    value={newExam.maxMarks}
                    onChange={(e) => setNewExam({ ...newExam, maxMarks: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Exam Date *</label>
                <input
                  type="date"
                  className="form-control"
                  required
                  value={newExam.date}
                  onChange={(e) => setNewExam({ ...newExam, date: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Syllabus Chapters Covered</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Electric Potentials, Capacitance"
                  value={newExam.chaptersCovered}
                  onChange={(e) => setNewExam({ ...newExam, chaptersCovered: e.target.value })}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                Save Exam Schedule
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
