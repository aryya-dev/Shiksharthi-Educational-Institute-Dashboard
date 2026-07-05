'use client';

import React, { useEffect, useState } from 'react';
import { 
  Layers, 
  Plus, 
  BookOpen, 
  Calendar, 
  Edit3, 
  Check, 
  X, 
  TrendingUp, 
  Users,
  Link2
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { createClient } from '@/utils/supabase/client';

interface BatchSubjectItem {
  id: string;
  subject_name: string;
  faculty_names: string[];
  current_chapter: string;
  progress_percentage: number;
  last_exam_date: string;
}

interface BatchItem {
  id: string;
  name: string;
  class: string;
  studentCount: number;
  subjects: BatchSubjectItem[];
}

export default function BatchesPage() {
  const supabase = createClient();
  const { currentBranch, currentAcademicYear, userProfile } = useAppStore();

  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<{
    batchId: string;
    subjectId: string;
    subjectName: string;
    chapter: string;
    progress: number;
  } | null>(null);

  // Add Subject modal state
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [addSubjectBatchId, setAddSubjectBatchId] = useState<string>('');
  const [addSubjectBatchName, setAddSubjectBatchName] = useState<string>('');
  const [newSubject, setNewSubject] = useState({ subjectName: '', facultyIds: [] as string[] });
  const [facultyList, setFacultyList] = useState<{ id: string; name: string }[]>([]);

  const [loading, setLoading] = useState(true);

  // New Batch Form State
  const [newBatch, setNewBatch] = useState({
    name: '',
    classVal: '11'
  });

  const isDirector = userProfile?.role === 'Director';
  const isAdmin = userProfile?.role === 'Admin';
  const isMentor = userProfile?.role === 'Mentor';
  const canManageBatches = isDirector || isAdmin;

  // Fetch faculty list for the Add Subject dropdown
  useEffect(() => {
    async function fetchFaculty() {
      if (!currentBranch) return;
      try {
        const { data } = await supabase
          .from('faculty_branches')
          .select('faculty_id, faculty(id, name)')
          .eq('branch_id', currentBranch.id);
        
        const list = (data || []).map((fb: any) => ({
          id: fb.faculty?.id || fb.faculty_id,
          name: fb.faculty?.name || 'Unknown'
        }));
        setFacultyList(list);
      } catch (err) {
        console.error(err);
      }
    }
    fetchFaculty();
  }, [currentBranch]);

  // Load Batches
  useEffect(() => {
    async function loadBatches() {
      if (!currentBranch || !currentAcademicYear) return;
      setLoading(true);
      
      try {
        // Query batches from Supabase
        const { data: batchesData } = await supabase
          .from('batches')
          .select(`
            id,
            name,
            class
          `)
          .eq('branch_id', currentBranch.id)
          .eq('academic_year_id', currentAcademicYear.id);

        if (!batchesData) {
          setBatches([]);
          return;
        }

        // Fetch subject progress details for these batches
        let progressData: any[] = [];
        const { data: m2mData, error: m2mErr } = await supabase
          .from('batch_subjects')
          .select('*, batch_subject_faculty(faculty_id, faculty(name))')
          .in('batch_id', batchesData.map(b => b.id));
        
        if (m2mErr) {
          console.warn('Junction query failed, falling back to legacy faculty column:', m2mErr);
          const { data: legacyData, error: legacyErr } = await supabase
            .from('batch_subjects')
            .select('*, faculty(name)')
            .in('batch_id', batchesData.map(b => b.id));
          
          if (legacyErr) throw legacyErr;
          progressData = legacyData || [];
        } else {
          progressData = m2mData || [];
        }

        // Fetch active student enrollments to count students per batch
        const { data: enrollmentsData } = await supabase
          .from('enrollments')
          .select('batch_id')
          .eq('branch_id', currentBranch.id)
          .eq('academic_year_id', currentAcademicYear.id)
          .eq('status', 'Active');

        // Count enrollments per batch
        const studentCounts: { [batchId: string]: number } = {};
        (enrollmentsData || []).forEach(e => {
          if (e.batch_id) {
            studentCounts[e.batch_id] = (studentCounts[e.batch_id] || 0) + 1;
          }
        });

        // Group subject progresses by batch ID
        const subjectsByBatch: { [batchId: string]: BatchSubjectItem[] } = {};
        (progressData || []).forEach((p: any) => {
          if (!subjectsByBatch[p.batch_id]) {
            subjectsByBatch[p.batch_id] = [];
          }
          // Get faculty names from junction table, fall back to legacy faculty_id
          const facultyNames: string[] = (p.batch_subject_faculty || []).map((bsf: any) => bsf.faculty?.name).filter(Boolean);
          if (facultyNames.length === 0 && p.faculty_id) {
            // Legacy fallback: use the old single faculty column
            facultyNames.push(p.faculty?.name || 'TBD');
          }
          subjectsByBatch[p.batch_id].push({
            id: p.id,
            subject_name: p.subject_name,
            faculty_names: facultyNames.length > 0 ? facultyNames : ['TBD'],
            current_chapter: p.current_chapter || '',
            progress_percentage: p.progress_percentage || 0,
            last_exam_date: p.last_exam_date || ''
          });
        });

        // Map to BatchItem[]
        const mappedBatches: BatchItem[] = batchesData.map(b => ({
          id: b.id,
          name: b.name,
          class: b.class,
          studentCount: studentCounts[b.id] || 0,
          subjects: subjectsByBatch[b.id] || []
        }));

        setBatches(mappedBatches);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadBatches();
  }, [currentBranch, currentAcademicYear]);

  // Handle Add Batch
  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBranch || !currentAcademicYear) return;

    try {
      const { data, error } = await supabase
        .from('batches')
        .insert({
          name: newBatch.name,
          class: newBatch.classVal,
          branch_id: currentBranch.id,
          academic_year_id: currentAcademicYear.id
        })
        .select()
        .single();
      
      if (error) throw error;

      setShowAddModal(false);
      const newlyCreated: BatchItem = {
        id: data.id,
        name: data.name,
        class: data.class,
        studentCount: 0,
        subjects: []
      };
      setBatches([...batches, newlyCreated]);
    } catch (err) {
      console.error(err);
      // Local fallback
      setShowAddModal(false);
      const fallbackBatch: BatchItem = {
        id: `b-temp-${Date.now()}`,
        name: newBatch.name,
        class: newBatch.classVal,
        studentCount: 0,
        subjects: []
      };
      setBatches([...batches, fallbackBatch]);
    }
  };

  // Handle Save Chapter/Progress
  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject) return;

    try {
      // Update in Supabase
      const { error } = await supabase
        .from('batch_subjects')
        .update({
          current_chapter: editingSubject.chapter,
          progress_percentage: editingSubject.progress
        })
        .eq('id', editingSubject.subjectId);

      if (error) throw error;

      // Update state locally
      setBatches(batches.map(b => {
        if (b.id === editingSubject.batchId) {
          return {
            ...b,
            subjects: b.subjects.map(s => {
              if (s.id === editingSubject.subjectId) {
                return {
                  ...s,
                  current_chapter: editingSubject.chapter,
                  progress_percentage: editingSubject.progress
                };
              }
              return s;
            })
          };
        }
        return b;
      }));

      setEditingSubject(null);
    } catch (err) {
      console.error(err);
      // Offline fallback state update
      setBatches(batches.map(b => {
        if (b.id === editingSubject.batchId) {
          return {
            ...b,
            subjects: b.subjects.map(s => {
              if (s.id === editingSubject.subjectId) {
                return {
                  ...s,
                  current_chapter: editingSubject.chapter,
                  progress_percentage: editingSubject.progress
                };
              }
              return s;
            })
          };
        }
        return b;
      }));
      setEditingSubject(null);
    }
  };

  // Handle Add Subject to Batch
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addSubjectBatchId || !newSubject.subjectName.trim()) return;

    try {
      const insertPayload: any = {
        batch_id: addSubjectBatchId,
        subject_name: newSubject.subjectName.trim(),
        current_chapter: '',
        progress_percentage: 0
      };
      // Set legacy faculty_id to first selected faculty for backward compat
      if (newSubject.facultyIds.length > 0) {
        insertPayload.faculty_id = newSubject.facultyIds[0];
      }

      const { data, error } = await supabase
        .from('batch_subjects')
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;

      // Insert into junction table for all selected faculty
      if (newSubject.facultyIds.length > 0) {
        const junctionInserts = newSubject.facultyIds.map(fId => ({
          batch_subject_id: data.id,
          faculty_id: fId
        }));
        await supabase.from('batch_subject_faculty').insert(junctionInserts);
      }

      const selectedNames = facultyList
        .filter(f => newSubject.facultyIds.includes(f.id))
        .map(f => f.name);

      const newSub: BatchSubjectItem = {
        id: data.id,
        subject_name: data.subject_name,
        faculty_names: selectedNames.length > 0 ? selectedNames : ['TBD'],
        current_chapter: data.current_chapter || '',
        progress_percentage: data.progress_percentage || 0,
        last_exam_date: data.last_exam_date || ''
      };

      setBatches(batches.map(b => {
        if (b.id === addSubjectBatchId) {
          return { ...b, subjects: [...b.subjects, newSub] };
        }
        return b;
      }));

      setShowAddSubjectModal(false);
      setNewSubject({ subjectName: '', facultyIds: [] });
    } catch (err) {
      console.error('Failed to add subject:', err);
    }
  };

  const openAddSubjectModal = (batchId: string, batchName: string) => {
    setAddSubjectBatchId(batchId);
    setAddSubjectBatchName(batchName);
    setNewSubject({ subjectName: '', facultyIds: [] });
    setShowAddSubjectModal(true);
  };

  return (
    <div className="page-column">
      
      {/* 1. Header Toolbar */}
      <div className="toolbar">
        <h3 className="section-title" style={{ margin: 0, fontSize: '18px' }}>Active Batches</h3>
        
        {/* Create Batch (Directors only) */}
        {isDirector && (
          <button 
            className="btn btn-primary"
            style={{ gap: '8px' }}
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={18} />
            <span>Create Batch</span>
          </button>
        )}
      </div>

      {/* 2. Batch Lists Grid */}
      {loading ? (
        <div className="skeleton" style={{ height: '300px', width: '100%' }} />
      ) : batches.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '64px' }}>
          <Layers size={48} style={{ color: 'var(--text-disabled)', marginBottom: '16px' }} />
          <h3>No batches configured</h3>
          <p className="secondary-text">Ask Director to register academic batches.</p>
        </div>
      ) : (
        <div className="grid-cards">
          {batches.map((batch) => (
            <div key={batch.id} className="card" style={{ margin: 0, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Batch Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '18px' }}>{batch.name}</h3>
                  <span className="caption">Class {batch.class}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }} className="caption">
                  <Users size={16} />
                  <span style={{ fontWeight: '600' }}>{batch.studentCount} Students</span>
                </div>
              </div>

              {/* Subject Chapter Progress Lists */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="caption" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Syllabus Tracker</span>
                  {canManageBatches && (
                    <button 
                      className="btn btn-tertiary"
                      style={{ padding: '4px 10px', minHeight: '28px', fontSize: '12px', gap: '4px' }}
                      onClick={() => openAddSubjectModal(batch.id, batch.name)}
                    >
                      <Link2 size={14} />
                      <span>Add Subject</span>
                    </button>
                  )}
                </div>
                
                {batch.subjects.length === 0 ? (
                  <p className="secondary-text" style={{ fontSize: '13px' }}>No subjects mapped yet.</p>
                ) : (
                  batch.subjects.map((sub) => (
                    <div key={sub.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-primary)' }}>{sub.subject_name}</span>
                          <p className="caption" style={{ fontSize: '11px', marginTop: '2px' }}>
                            Chapter: <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{sub.current_chapter || 'Not Started'}</span>
                          </p>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary-orange)' }}>{sub.progress_percentage}%</span>
                          {/* Edit progress (Mentors & Directors only) */}
                          {(!isMentor || userProfile?.role === 'Mentor') && (
                            <button 
                              className="btn btn-tertiary"
                              style={{ padding: '4px', minHeight: '24px', minWidth: '24px' }}
                              onClick={() => setEditingSubject({
                                batchId: batch.id,
                                subjectId: sub.id,
                                subjectName: sub.subject_name,
                                chapter: sub.current_chapter,
                                progress: sub.progress_percentage
                              })}
                            >
                              <Edit3 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${sub.progress_percentage}%`, 
                          height: '100%', 
                          backgroundColor: 'var(--primary-orange)', 
                          borderRadius: '3px',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>

                      {/* Last Exam Tracker */}
                      {sub.last_exam_date && (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', color: 'var(--text-secondary)', marginTop: '2px' }} className="caption">
                          <BookOpen size={12} />
                          <span>Last Test: {sub.last_exam_date}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. New Batch Creator Modal (Director only) */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="card modal-card" style={{ maxWidth: '400px' }}>
            <button 
              className="btn btn-tertiary" 
              style={{ position: 'absolute', right: '16px', top: '16px', padding: '8px', minHeight: '36px' }}
              onClick={() => setShowAddModal(false)}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Create New Batch</h2>

            <form onSubmit={handleAddBatch} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Batch Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 12 JEE B"
                  required
                  value={newBatch.name}
                  onChange={(e) => setNewBatch({ ...newBatch, name: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Class Year</label>
                <select
                  className="form-control"
                  value={newBatch.classVal}
                  onChange={(e) => setNewBatch({ ...newBatch, classVal: e.target.value })}
                >
                  <option value="11">Class 11</option>
                  <option value="12">Class 12</option>
                  <option value="7">Class 7</option>
                  <option value="8">Class 8</option>
                  <option value="9">Class 9</option>
                  <option value="10">Class 10</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                Save Batch
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. Edit Syllabus Tracker Progress Modal */}
      {editingSubject && (
        <div className="modal-overlay">
          <div className="card modal-card" style={{ maxWidth: '400px' }}>
            <button 
              className="btn btn-tertiary" 
              style={{ position: 'absolute', right: '16px', top: '16px', padding: '8px', minHeight: '36px' }}
              onClick={() => setEditingSubject(null)}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Update progress</h2>
            <p className="secondary-text" style={{ marginBottom: '20px' }}>Subject: {editingSubject.subjectName}</p>

            <form onSubmit={handleSaveProgress} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Current Chapter Cover *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={editingSubject.chapter}
                  onChange={(e) => setEditingSubject({ ...editingSubject, chapter: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Completion Progress (%)</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    style={{ flex: 1, accentColor: 'var(--primary-orange)' }}
                    value={editingSubject.progress}
                    onChange={(e) => setEditingSubject({ ...editingSubject, progress: parseInt(e.target.value) })}
                  />
                  <span style={{ fontWeight: '700', width: '38px', textAlign: 'right' }}>{editingSubject.progress}%</span>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                Save Progress
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. Add Subject to Batch Modal */}
      {showAddSubjectModal && (
        <div className="modal-overlay">
          <div className="card modal-card" style={{ maxWidth: '420px' }}>
            <button 
              className="btn btn-tertiary" 
              style={{ position: 'absolute', right: '16px', top: '16px', padding: '8px', minHeight: '36px' }}
              onClick={() => setShowAddSubjectModal(false)}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>Link Subject</h2>
            <p className="secondary-text" style={{ marginBottom: '20px' }}>Batch: <strong>{addSubjectBatchName}</strong></p>

            <form onSubmit={handleAddSubject} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Subject Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Physics, Mathematics, Chemistry"
                  required
                  value={newSubject.subjectName}
                  onChange={(e) => setNewSubject({ ...newSubject, subjectName: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Assign Faculty</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', maxHeight: '150px', overflowY: 'auto' }} className="caption">
                  {facultyList.length === 0 ? (
                    <span className="secondary-text" style={{ fontSize: '12px' }}>No faculty registered for this branch. Add faculty in Settings → Faculty Directory.</span>
                  ) : (
                    facultyList.map(f => (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          id={`sub-fac-${f.id}`}
                          checked={newSubject.facultyIds.includes(f.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewSubject({ ...newSubject, facultyIds: [...newSubject.facultyIds, f.id] });
                            } else {
                              setNewSubject({ ...newSubject, facultyIds: newSubject.facultyIds.filter(id => id !== f.id) });
                            }
                          }}
                        />
                        <label htmlFor={`sub-fac-${f.id}`}>{f.name}</label>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                Link Subject
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
