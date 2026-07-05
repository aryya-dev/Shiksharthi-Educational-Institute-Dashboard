'use client';

import React, { useEffect, useState } from 'react';
import { 
  BookOpen, 
  Plus, 
  Layers, 
  User, 
  Check, 
  X, 
  AlertTriangle,
  PlayCircle,
  CheckCircle,
  HelpCircle,
  Sliders
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { createClient } from '@/utils/supabase/client';

interface ChapterRecord {
  id: string;
  chapter_name: string;
  max_allotted_lectures: number;
  status: 'Not Started' | 'In Progress' | 'Completed';
  conductedCount: number;
}

export default function SyllabusPage() {
  const supabase = createClient();
  const { currentBranch, currentAcademicYear, userProfile } = useAppStore();

  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  
  const [subjects, setSubjects] = useState<{ id: string; subject_name: string; faculty_names: string[] }[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  
  const [chapters, setChapters] = useState<ChapterRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingChapters, setLoadingChapters] = useState(false);

  // Add Chapter Form State
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterName, setNewChapterName] = useState('');
  const [newMaxLectures, setNewMaxLectures] = useState('10');
  
  const isMentor = userProfile?.role === 'Mentor';

  // Find the selected subject details
  const activeSubject = subjects.find(s => s.id === selectedSubjectId);

  // 1. Fetch batches
  useEffect(() => {
    async function fetchBatches() {
      if (!currentBranch || !currentAcademicYear) return;
      setLoading(true);
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
          setSelectedBatchId(list[0].id);
        } else {
          setSelectedBatchId('');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchBatches();
  }, [currentBranch, currentAcademicYear]);

  // 2. Fetch subjects for the selected batch
  useEffect(() => {
    async function fetchSubjects() {
      if (!selectedBatchId) {
        setSubjects([]);
        setSelectedSubjectId('');
        return;
      }
      try {
        let data: any[] = [];
        const { data: m2mData, error: m2mErr } = await supabase
          .from('batch_subjects')
          .select('id, subject_name, batch_subject_faculty(faculty_id, faculty(name))')
          .eq('batch_id', selectedBatchId)
          .order('subject_name');
        
        if (m2mErr) {
          console.warn('Junction query failed, falling back to legacy faculty column:', m2mErr);
          const { data: legacyData, error: legacyErr } = await supabase
            .from('batch_subjects')
            .select('id, subject_name, faculty(name)')
            .eq('batch_id', selectedBatchId)
            .order('subject_name');
          
          if (legacyErr) throw legacyErr;
          data = legacyData || [];
        } else {
          data = m2mData || [];
        }
        
        const list = (data || []).map((s: any) => {
          const names: string[] = (s.batch_subject_faculty || []).map((bsf: any) => bsf.faculty?.name).filter(Boolean);
          if (names.length === 0 && s.faculty?.name) {
            names.push(s.faculty.name);
          }
          return {
            id: s.id,
            subject_name: s.subject_name,
            faculty_names: names.length > 0 ? names : ['TBD']
          };
        });
        setSubjects(list);
        if (list.length > 0) {
          setSelectedSubjectId(list[0].id);
        } else {
          setSelectedSubjectId('');
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchSubjects();
  }, [selectedBatchId]);

  // 3. Fetch chapters and dynamic conducted session counts
  useEffect(() => {
    async function fetchChapters() {
      if (!selectedSubjectId || !selectedBatchId || !activeSubject) {
        setChapters([]);
        return;
      }
      setLoadingChapters(true);
      try {
        // Fetch chapters from DB
        const { data: chaptersData } = await supabase
          .from('subject_chapters')
          .select('*')
          .eq('batch_subject_id', selectedSubjectId)
          .order('chapter_name');

        // Fetch completed class sessions for this batch and subject
        const { data: sessionsData } = await supabase
          .from('class_sessions')
          .select('chapter_covered')
          .eq('batch_id', selectedBatchId)
          .eq('subject_name', activeSubject.subject_name);

        const conductedCounts: { [chapterName: string]: number } = {};
        (sessionsData || []).forEach(s => {
          if (s.chapter_covered) {
            conductedCounts[s.chapter_covered] = (conductedCounts[s.chapter_covered] || 0) + 1;
          }
        });

        const list: ChapterRecord[] = (chaptersData || []).map((c: any) => ({
          id: c.id,
          chapter_name: c.chapter_name,
          max_allotted_lectures: c.max_allotted_lectures,
          status: c.status,
          conductedCount: conductedCounts[c.chapter_name] || 0
        }));

        setChapters(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingChapters(false);
      }
    }
    fetchChapters();
  }, [selectedSubjectId, selectedBatchId, activeSubject]);

  // Handle Add Chapter Submit
  const handleAddChapterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId || !newChapterName.trim()) return;

    try {
      const maxLec = parseInt(newMaxLectures) || 10;
      const { data, error } = await supabase
        .from('subject_chapters')
        .insert({
          batch_subject_id: selectedSubjectId,
          chapter_name: newChapterName.trim(),
          max_allotted_lectures: maxLec,
          status: 'Not Started'
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase
        .from('activity_logs')
        .insert({
          action: 'Chapter Registered',
          details: { subject: activeSubject?.subject_name, chapterName: newChapterName.trim(), limit: maxLec },
          branch_id: currentBranch?.id
        });

      setChapters([...chapters, {
        id: data.id,
        chapter_name: data.chapter_name,
        max_allotted_lectures: data.max_allotted_lectures,
        status: data.status,
        conductedCount: 0
      }]);
      setNewChapterName('');
      setNewMaxLectures('10');
      setShowAddChapter(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Status Update
  const handleStatusUpdate = async (chapterId: string, newStatus: ChapterRecord['status']) => {
    try {
      const { error } = await supabase
        .from('subject_chapters')
        .update({ status: newStatus })
        .eq('id', chapterId);

      if (error) throw error;

      setChapters(chapters.map(c => c.id === chapterId ? { ...c, status: newStatus } : c));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="page-column-32">
      
      {/* Selector Toolbar */}
      <div className="toolbar" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', flex: 1, minWidth: '300px' }}>
          
          {/* Batch Selector */}
          <div className="form-group" style={{ margin: 0, flex: 1 }}>
            <label className="form-label">Select Batch</label>
            <select
              className="form-control"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              disabled={loading}
            >
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Subject Selector */}
          <div className="form-group" style={{ margin: 0, flex: 1 }}>
            <label className="form-label">Select Subject</label>
            <select
              className="form-control"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              disabled={subjects.length === 0}
            >
              {subjects.length === 0 ? (
                <option value="">No subjects mapped</option>
              ) : (
                subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.subject_name}</option>
                ))
              )}
            </select>
          </div>

        </div>

        {/* Add Chapter (Admins/Directors only) */}
        {!isMentor && selectedSubjectId && (
          <button 
            className="btn btn-primary"
            style={{ gap: '8px', alignSelf: 'flex-end', minHeight: '38px' }}
            onClick={() => setShowAddChapter(true)}
          >
            <Plus size={18} />
            <span>Add Chapter</span>
          </button>
        )}
      </div>

      {/* Main Chapter Tracker list */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '18px', margin: 0 }}>
              {activeSubject ? activeSubject.subject_name : 'Subject'} Chapters List
            </h3>
            <span className="caption" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <User size={14} />
              Assigned Faculty: <strong style={{ color: 'var(--text-primary)' }}>{activeSubject?.faculty_names?.join(', ') || 'TBD'}</strong>
            </span>
          </div>
          <span className="badge badge-info">{chapters.length} Total Chapters</span>
        </div>

        {loadingChapters ? (
          <div className="skeleton" style={{ height: '200px', width: '100%' }} />
        ) : chapters.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <BookOpen size={48} style={{ color: 'var(--text-disabled)', marginBottom: '16px' }} />
            <h4>No chapters configured</h4>
            <p className="secondary-text">Configure the chapters index for this batch subject.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {chapters.map((chapter) => {
              const isExceeded = chapter.conductedCount > chapter.max_allotted_lectures;
              const ratio = chapter.max_allotted_lectures > 0 ? (chapter.conductedCount / chapter.max_allotted_lectures) * 100 : 0;
              const progressWidth = Math.min(100, ratio);

              return (
                <div 
                  key={chapter.id} 
                  className="card"
                  style={{
                    margin: 0,
                    padding: '20px',
                    borderColor: isExceeded ? 'var(--color-error)' : 'var(--border-color)',
                    backgroundColor: isExceeded ? '#FEF2F2' : 'var(--surface-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <h4 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: isExceeded ? '#991B1B' : 'var(--text-primary)' }}>
                        {chapter.chapter_name}
                      </h4>
                      <div style={{ display: 'flex', gap: '16px', marginTop: '6px', alignItems: 'center' }} className="caption">
                        <span>Lectures: <strong>{chapter.conductedCount} conducted</strong> / {chapter.max_allotted_lectures} allotted</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {/* Red Alert warning badge */}
                      {isExceeded && (
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          backgroundColor: '#FEE2E2', 
                          color: 'var(--color-error)', 
                          padding: '6px 12px', 
                          borderRadius: '6px', 
                          fontWeight: '700',
                          fontSize: '12px'
                        }}>
                          <AlertTriangle size={14} />
                          <span>Lecture Limit Exceeded!</span>
                        </div>
                      )}

                      {/* Status Dropdown/Selector */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="caption">Status:</span>
                        <select
                          className="form-control"
                          style={{ minHeight: '34px', fontSize: '12px', width: '130px' }}
                          value={chapter.status}
                          onChange={(e) => handleStatusUpdate(chapter.id, e.target.value as any)}
                        >
                          <option value="Not Started">Not Started</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${progressWidth}%`, 
                        height: '100%', 
                        backgroundColor: isExceeded ? 'var(--color-error)' : 'var(--primary-orange)',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }} className="caption">
                      <span>{Math.round(ratio)}% allotted capacity used</span>
                      <span className={`badge ${
                        chapter.status === 'Completed' ? 'badge-success' :
                        chapter.status === 'In Progress' ? 'badge-warning' : 'badge-info'
                      }`} style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                        {chapter.status}
                      </span>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Chapter Modal */}
      {showAddChapter && (
        <div className="modal-overlay">
          <div className="card modal-card" style={{ maxWidth: '400px' }}>
            <button 
              className="btn btn-tertiary" 
              style={{ position: 'absolute', right: '16px', top: '16px', padding: '8px', minHeight: '36px' }}
              onClick={() => setShowAddChapter(false)}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '18px', marginBottom: '4px' }}>Add Subject Chapter</h2>
            <p className="secondary-text" style={{ marginBottom: '20px' }}>Register curriculum index details.</p>

            <form onSubmit={handleAddChapterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Chapter Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Chemical Bonding, Electrostatics"
                  required
                  value={newChapterName}
                  onChange={(e) => setNewChapterName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Allotted Lectures Limit *</label>
                <input
                  type="number"
                  className="form-control"
                  required
                  min="1"
                  value={newMaxLectures}
                  onChange={(e) => setNewMaxLectures(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                Save Chapter
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
