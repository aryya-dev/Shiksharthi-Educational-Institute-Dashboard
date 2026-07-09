'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Check, 
  X, 
  UserMinus, 
  Calendar, 
  BookOpen, 
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  RotateCcw,
  User,
  MapPin,
  FileText,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  BookMarked,
  StickyNote,
  AlertTriangle
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { createClient } from '@/utils/supabase/client';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface StudentAttendanceItem {
  enrollmentId: string;
  name: string;
  studentCode: string;
  batchId: string;
  batchName: string;
  status: 'Present' | 'Absent' | 'Leave';
  preExistingLeave?: boolean;
}

interface ScheduledClassItem {
  key: string;
  timeSlot: string;
  startTime: string;
  endTime: string;
  subject: string;
  facultyId: string;
  facultyName: string;
  roomId: string;
  roomName: string;
  batches: { id: string; name: string }[];
  scheduleIds: string[];
  isExtra: boolean;
  extraSessionId?: string;
  attendanceStatus: 'pending' | 'marked';
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function AttendancePage() {
  const supabase = createClient();
  const { currentBranch, currentAcademicYear } = useAppStore();

  // --- Date Selection ---
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // --- Scheduled Classes for the day ---
  const [scheduledClasses, setScheduledClasses] = useState<ScheduledClassItem[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // --- Selected Class context ---
  const [selectedClass, setSelectedClass] = useState<ScheduledClassItem | null>(null);
  const [manualMode, setManualMode] = useState(false);

  // --- Manual mode fields ---
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [facultyList, setFacultyList] = useState<{ id: string; name: string }[]>([]);
  const [rooms, setRooms] = useState<{ id: string; name: string; capacity: number }[]>([]);
  const [manualBatchIds, setManualBatchIds] = useState<string[]>([]);
  const [manualSubject, setManualSubject] = useState('Physics');
  const [manualFacultyId, setManualFacultyId] = useState('');
  const [manualRoomId, setManualRoomId] = useState('');
  const [manualStartTime, setManualStartTime] = useState('16:30');
  const [manualEndTime, setManualEndTime] = useState('18:30');
  const [isExtraClass, setIsExtraClass] = useState(false);

  // --- Chapter Covered (mandatory) ---
  const [chapterCovered, setChapterCovered] = useState('');
  const [chapterError, setChapterError] = useState(false);

  // --- Homework fields (optional) ---
  const [homeworkTitle, setHomeworkTitle] = useState('');
  const [homeworkDescription, setHomeworkDescription] = useState('');
  const [homeworkDueDate, setHomeworkDueDate] = useState('');
  const [homeworkExpanded, setHomeworkExpanded] = useState(false);
  const [homeworkDueDateError, setHomeworkDueDateError] = useState(false);

  // --- Homework Defaulters ---
  const [homeworkDefaulters, setHomeworkDefaulters] = useState<Set<string>>(new Set());
  const [defaultersExpanded, setDefaultersExpanded] = useState(false);

  // --- Faculty Notes ---
  const [facultyNotes, setFacultyNotes] = useState('');

  // --- Student List ---
  const [studentList, setStudentList] = useState<StudentAttendanceItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- Active step tracking ---
  const [activeStep, setActiveStep] = useState<number>(1); // 1=attendance, 2=chapter+homework, 3=defaulters+notes

  // Derived: present students for defaulters list
  const presentStudents = useMemo(() => 
    studentList.filter(s => s.status === 'Present'),
    [studentList]
  );

  // Set today's date as default
  useEffect(() => {
    setDate(new Date().toISOString().split('T')[0]);
  }, []);

  // Load selectors for manual mode
  useEffect(() => {
    async function loadSelectors() {
      if (!currentBranch || !currentAcademicYear) return;
      const { data: batchesData } = await supabase.from('batches').select('id, name').eq('branch_id', currentBranch.id).eq('academic_year_id', currentAcademicYear.id).order('name');
      setBatches(batchesData || []);
      if (batchesData && batchesData.length > 0) setManualBatchIds([batchesData[0].id]);
      const { data: facultyData } = await supabase.from('faculty').select('id, name').order('name');
      setFacultyList(facultyData || []);
      if (facultyData && facultyData.length > 0) setManualFacultyId(facultyData[0].id);
      const { data: roomsData } = await supabase.from('rooms').select('id, name, capacity').eq('branch_id', currentBranch.id).order('name');
      setRooms(roomsData || []);
      if (roomsData && roomsData.length > 0) setManualRoomId(roomsData[0].id);
    }
    loadSelectors();
  }, [currentBranch, currentAcademicYear]);

  // Fetch scheduled classes whenever date changes
  const loadScheduledClasses = useCallback(async () => {
    if (!currentBranch || !currentAcademicYear || !date) return;
    setLoadingSchedule(true);
    setSelectedClass(null);
    setStudentList([]);
    setSuccessMsg(null);
    setErrorMsg(null);
    resetFormFields();

    try {
      const dayOfWeek = (() => {
        const d = new Date(date + 'T00:00:00');
        const jsDay = d.getDay();
        return jsDay === 0 ? 7 : jsDay;
      })();

      const { data: scheduleData } = await supabase
        .from('schedules')
        .select('*, batches(id, name, branch_id, academic_year_id), rooms(id, name), faculty(id, name)')
        .eq('branch_id', currentBranch.id)
        .eq('academic_year_id', currentAcademicYear.id)
        .eq('day_of_week', dayOfWeek);

      const { data: extraData } = await supabase
        .from('class_sessions')
        .select('*, batches!inner(id, name, branch_id, academic_year_id), rooms(id, name), faculty(id, name)')
        .eq('is_extra_class', true)
        .eq('date', date)
        .eq('batches.branch_id', currentBranch.id)
        .eq('batches.academic_year_id', currentAcademicYear.id);

      const { data: markedSessions } = await supabase
        .from('class_sessions')
        .select('id, batch_id, subject_name, start_time, end_time, room_id, faculty_id')
        .eq('date', date);

      const markedKeys = new Set<string>();
      (markedSessions || []).forEach((s: any) => {
        const key = `${s.start_time?.slice(0, 5)}-${s.end_time?.slice(0, 5)}-${s.room_id}-${s.faculty_id}-${s.subject_name}`;
        markedKeys.add(key);
      });

      const groupedMap: { [key: string]: ScheduledClassItem } = {};

      (scheduleData || []).forEach((s: any) => {
        const timeSlotKey = `${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)}-${s.room_id}-${s.faculty_id}-${s.subject_name}`;
        const markedKey = `${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)}-${s.room_id}-${s.faculty_id}-${s.subject_name}`;
        if (!groupedMap[timeSlotKey]) {
          groupedMap[timeSlotKey] = {
            key: timeSlotKey,
            timeSlot: `${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}`,
            startTime: s.start_time.slice(0, 5),
            endTime: s.end_time.slice(0, 5),
            subject: s.subject_name,
            facultyId: s.faculty_id,
            facultyName: s.faculty?.name || 'Unknown',
            roomId: s.room_id,
            roomName: s.rooms?.name || 'Unknown',
            batches: [],
            scheduleIds: [],
            isExtra: false,
            attendanceStatus: markedKeys.has(markedKey) ? 'marked' : 'pending'
          };
        }
        groupedMap[timeSlotKey].batches.push({ id: s.batch_id, name: s.batches?.name || 'Unknown' });
        groupedMap[timeSlotKey].scheduleIds.push(s.id);
      });

      const extraItems: ScheduledClassItem[] = (extraData || []).map((s: any) => {
        const markedKey = `${s.start_time?.slice(0, 5)}-${s.end_time?.slice(0, 5)}-${s.room_id}-${s.faculty_id}-${s.subject_name}`;
        return {
          key: `extra-${s.id}`,
          timeSlot: `${s.start_time?.slice(0, 5)} - ${s.end_time?.slice(0, 5)}`,
          startTime: s.start_time?.slice(0, 5),
          endTime: s.end_time?.slice(0, 5),
          subject: s.subject_name,
          facultyId: s.faculty_id,
          facultyName: s.faculty?.name || 'Unknown',
          roomId: s.room_id,
          roomName: s.rooms?.name || 'Unknown',
          batches: [{ id: s.batch_id, name: s.batches?.name || 'Unknown' }],
          scheduleIds: [],
          isExtra: true,
          extraSessionId: s.id,
          attendanceStatus: markedKeys.has(markedKey) ? 'marked' : 'pending'
        };
      });

      const allItems = [
        ...Object.values(groupedMap),
        ...extraItems
      ].sort((a, b) => a.startTime.localeCompare(b.startTime));

      setScheduledClasses(allItems);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSchedule(false);
    }
  }, [currentBranch, currentAcademicYear, date]);

  useEffect(() => {
    loadScheduledClasses();
  }, [loadScheduledClasses]);

  // Load students when a class is selected
  useEffect(() => {
    async function loadStudents() {
      const batchIds = selectedClass
        ? selectedClass.batches.map(b => b.id)
        : (manualMode ? manualBatchIds : []);

      const effectiveSubject = selectedClass ? selectedClass.subject : manualSubject;

      if (batchIds.length === 0) { setStudentList([]); return; }

      try {
        const { data, error } = await supabase
          .from('enrollments')
          .select('id, batch_id, status, subjects_taken, students(name, student_code)')
          .in('batch_id', batchIds)
          .in('status', ['Active', 'Leave of Absence']);

        if (error) throw error;

        const list: StudentAttendanceItem[] = (data || [])
          .filter((e: any) => {
            const taken: string[] = e.subjects_taken || [];
            if (taken.length === 0) return true;
            const subjectLower = effectiveSubject.toLowerCase();
            return taken.some((t: string) => t.toLowerCase().startsWith(subjectLower));
          })
          .map((e: any) => ({
            enrollmentId: e.id,
            name: e.students?.name || '',
            studentCode: e.students?.student_code || '',
            batchId: e.batch_id,
            batchName: batches.find(b => b.id === e.batch_id)?.name ||
                       selectedClass?.batches.find(b => b.id === e.batch_id)?.name || 'Unknown',
            status: e.status === 'Leave of Absence' ? 'Leave' : 'Present',
            preExistingLeave: e.status === 'Leave of Absence'
          }));

        setStudentList(list);
      } catch (err) {
        console.error(err);
      }
    }
    loadStudents();
  }, [selectedClass, manualMode, manualBatchIds, manualSubject]);

  // Clear defaulters when attendance changes
  useEffect(() => {
    setHomeworkDefaulters(prev => {
      const presentIds = new Set(presentStudents.map(s => s.enrollmentId));
      const newDefaults = new Set<string>();
      prev.forEach(id => {
        if (presentIds.has(id)) newDefaults.add(id);
      });
      return newDefaults;
    });
  }, [presentStudents]);

  const resetFormFields = () => {
    setChapterCovered('');
    setChapterError(false);
    setHomeworkTitle('');
    setHomeworkDescription('');
    setHomeworkDueDate('');
    setHomeworkDueDateError(false);
    setHomeworkExpanded(false);
    setHomeworkDefaulters(new Set());
    setDefaultersExpanded(false);
    setFacultyNotes('');
    setActiveStep(1);
  };

  const handleMarkAll = (status: 'Present' | 'Absent') => {
    setStudentList(studentList.map(st => {
      if (st.preExistingLeave) return st;
      return { ...st, status };
    }));
  };

  const handleToggleStatus = (enrollmentId: string, status: 'Present' | 'Absent' | 'Leave') => {
    setStudentList(studentList.map(st =>
      st.enrollmentId === enrollmentId ? { ...st, status } : st
    ));
  };

  const handleToggleDefaulter = (enrollmentId: string) => {
    setHomeworkDefaulters(prev => {
      const next = new Set(prev);
      if (next.has(enrollmentId)) {
        next.delete(enrollmentId);
      } else {
        next.add(enrollmentId);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (studentList.length === 0) return;

    // Validation
    let hasError = false;

    if (!chapterCovered.trim()) {
      setChapterError(true);
      hasError = true;
    } else {
      setChapterError(false);
    }

    if (homeworkTitle.trim() && !homeworkDueDate) {
      setHomeworkDueDateError(true);
      hasError = true;
    } else {
      setHomeworkDueDateError(false);
    }

    if (hasError) {
      setErrorMsg('Please fix the highlighted errors before submitting.');
      return;
    }

    setSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const effectiveBatchIds = selectedClass
      ? selectedClass.batches.map(b => b.id)
      : manualBatchIds;

    const effectiveSubject = selectedClass ? selectedClass.subject : manualSubject;
    const effectiveFacultyId = selectedClass ? selectedClass.facultyId : (manualFacultyId || null);
    const effectiveRoomId = selectedClass ? selectedClass.roomId : (manualRoomId || null);
    const effectiveStart = selectedClass ? `${selectedClass.startTime}:00` : `${manualStartTime}:00`;
    const effectiveEnd = selectedClass ? `${selectedClass.endTime}:00` : `${manualEndTime}:00`;
    const effectiveIsExtra = selectedClass ? selectedClass.isExtra : isExtraClass;

    // Build attendance array for RPC
    const attendancePayload = studentList.map(st => ({
      enrollment_id: st.enrollmentId,
      status: st.status,
      batch_id: st.batchId,
      student_name: st.name
    }));

    try {
      const { data, error } = await supabase.rpc('complete_class', {
        p_batch_ids: effectiveBatchIds,
        p_subject_name: effectiveSubject,
        p_faculty_id: effectiveFacultyId,
        p_room_id: effectiveRoomId,
        p_date: date,
        p_start_time: effectiveStart,
        p_end_time: effectiveEnd,
        p_is_extra_class: effectiveIsExtra,
        p_chapter_covered: chapterCovered.trim(),
        p_faculty_notes: facultyNotes.trim() || null,
        p_homework_title: homeworkTitle.trim() || null,
        p_homework_description: homeworkDescription.trim() || null,
        p_homework_due_date: homeworkDueDate || null,
        p_attendance: attendancePayload,
        p_defaulter_ids: Array.from(homeworkDefaulters),
        p_academic_year_id: currentAcademicYear!.id,
        p_branch_id: currentBranch!.id
      });

      if (error) throw error;

      const classLabel = selectedClass
        ? selectedClass.batches.map(b => b.name).join(' + ') + ' – ' + selectedClass.subject
        : effectiveBatchIds.map(id => batches.find(b => b.id === id)?.name).join(' + ') + ' – ' + effectiveSubject;

      setSuccessMsg(`✅ Class completed for ${classLabel}. Report generated.`);
      resetFormFields();
      
      await loadScheduledClasses();
      setSelectedClass(null);
      setStudentList([]);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Failed to complete class. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (t: string) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hr = parseInt(h);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const formattedHr = hr % 12 || 12;
    return `${formattedHr}:${m} ${ampm}`;
  };

  const pendingCount = scheduledClasses.filter(c => c.attendanceStatus === 'pending').length;
  const markedCount = scheduledClasses.filter(c => c.attendanceStatus === 'marked').length;

  const presentCount = studentList.filter(s => s.status === 'Present').length;
  const absentCount = studentList.filter(s => s.status === 'Absent').length;
  const leaveCount = studentList.filter(s => s.status === 'Leave').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Success Banner */}
      {successMsg && (
        <div className="badge badge-success" style={{ width: '100%', borderRadius: 'var(--radius-sm)', padding: '16px var(--space-4)', justifyContent: 'flex-start', textTransform: 'none', fontSize: '14px', gap: '8px' }}>
          <CheckCircle size={20} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div style={{ width: '100%', borderRadius: 'var(--radius-sm)', padding: '16px var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2', color: '#DC2626', fontSize: '14px' }}>
          <AlertTriangle size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Top Bar: Date Picker + Summary */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0, minWidth: '200px' }}>
          <label className="form-label">Date</label>
          <input type="date" className="form-control" value={date} onChange={e => { setDate(e.target.value); setSelectedClass(null); setStudentList([]); setSuccessMsg(null); setErrorMsg(null); resetFormFields(); }} />
        </div>
        {scheduledClasses.length > 0 && (
          <div style={{ display: 'flex', gap: '12px', paddingTop: '22px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '6px 12px', borderRadius: 'var(--radius-sm)', backgroundColor: '#FEF3C7', color: '#92400E', fontSize: '13px', fontWeight: '600' }}>
              <Clock size={14} />
              <span>{pendingCount} Pending</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '6px 12px', borderRadius: 'var(--radius-sm)', backgroundColor: '#D1FAE5', color: '#065F46', fontSize: '13px', fontWeight: '600' }}>
              <CheckCircle size={14} />
              <span>{markedCount} Completed</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)', gap: '24px', alignItems: 'start' }}>

        {/* LEFT: Scheduled Classes for the Day */}
        <div className="card" style={{ margin: 0, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '15px' }}>
              {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })} Schedule
            </h3>
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 8px', minHeight: '30px', fontSize: '11px', gap: '4px' }}
              onClick={() => { setManualMode(!manualMode); setSelectedClass(null); setStudentList([]); resetFormFields(); }}
            >
              {manualMode ? <><RotateCcw size={11} /> Show Schedule</> : <><AlertCircle size={11} /> Manual Mode</>}
            </button>
          </div>

          {manualMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '10px 12px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: '#92400E' }}>
                <strong>Manual Mode:</strong> Record an unscheduled class not in the weekly planner.
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Batch(es) *</label>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px', maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {batches.map(b => (
                    <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={manualBatchIds.includes(b.id)} onChange={e => {
                        setManualBatchIds(e.target.checked ? [...manualBatchIds, b.id] : manualBatchIds.filter(id => id !== b.id));
                      }} style={{ accentColor: 'var(--primary-orange)', width: '14px', height: '14px' }} />
                      {b.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Subject *</label>
                <select className="form-control" value={manualSubject} onChange={e => setManualSubject(e.target.value)}>
                  <option value="Physics">Physics</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Biology">Biology</option>
                  <option value="Computer Science">Computer Science</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Faculty</label>
                <select className="form-control" value={manualFacultyId} onChange={e => setManualFacultyId(e.target.value)}>
                  <option value="">— Select Faculty —</option>
                  {facultyList.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Room</label>
                <select className="form-control" value={manualRoomId} onChange={e => setManualRoomId(e.target.value)}>
                  <option value="">— Select Room —</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>Room {r.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Start Time</label>
                  <input type="time" className="form-control" value={manualStartTime} onChange={e => setManualStartTime(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">End Time</label>
                  <input type="time" className="form-control" value={manualEndTime} onChange={e => setManualEndTime(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="isExtraManual" checked={isExtraClass} onChange={e => setIsExtraClass(e.target.checked)} style={{ accentColor: 'var(--primary-orange)', width: '15px', height: '15px' }} />
                <label htmlFor="isExtraManual" style={{ fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>Mark as Extra Class</label>
              </div>
            </div>
          ) : loadingSchedule ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>Loading schedule...</div>
          ) : scheduledClasses.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Calendar size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p style={{ fontSize: '14px' }}>No classes scheduled for this day.</p>
              <p style={{ fontSize: '12px', marginTop: '4px' }}>Use <strong>Manual Mode</strong> or add classes in the Schedule Planner.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {scheduledClasses.map(cls => {
                const isSelected = selectedClass?.key === cls.key;
                const isMarked = cls.attendanceStatus === 'marked';
                return (
                  <button
                    key={cls.key}
                    type="button"
                    onClick={() => {
                      if (isMarked) return;
                      setSelectedClass(isSelected ? null : cls);
                      setStudentList([]);
                      setSuccessMsg(null);
                      setErrorMsg(null);
                      resetFormFields();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${isSelected ? 'var(--primary-orange)' : isMarked ? '#A7F3D0' : 'var(--border-color)'}`,
                      backgroundColor: isSelected ? 'rgba(255, 107, 53, 0.05)' : isMarked ? '#F0FDF4' : 'var(--surface-hover)',
                      cursor: isMarked ? 'default' : 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ marginTop: '2px', flexShrink: 0 }}>
                      {isMarked
                        ? <CheckCircle size={16} style={{ color: '#10B981' }} />
                        : <Clock size={16} style={{ color: '#F59E0B' }} />
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        {cls.batches.map(b => (
                          <span key={b.id} style={{ fontSize: '10px', fontWeight: '700', padding: '1px 7px', borderRadius: '100px', backgroundColor: isSelected ? 'var(--primary-orange)' : '#E2E8F0', color: isSelected ? '#fff' : 'var(--text-primary)' }}>{b.name}</span>
                        ))}
                        {cls.isExtra && <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '100px', backgroundColor: '#FEE2E2', color: '#DC2626', fontWeight: '600' }}>Extra</span>}
                      </div>
                      <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 4px' }}>{cls.subject}</p>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{formatTime(cls.startTime)} – {formatTime(cls.endTime)}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', gap: '3px', alignItems: 'center' }}><User size={10} />{cls.facultyName}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', gap: '3px', alignItems: 'center' }}><MapPin size={10} />Rm {cls.roomName}</span>
                      </div>
                    </div>
                    {!isMarked && <ChevronRight size={14} style={{ color: 'var(--text-secondary)', marginTop: '4px', flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: Complete Class Panel */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {(!selectedClass && !manualMode) ? (
            <div className="card" style={{ margin: 0, padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <ClipboardCheck size={36} style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>Select a class from the left to complete</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Attendance, homework, and report will be saved together</p>
            </div>
          ) : (
            <>
              {/* Class Info Banner */}
              {selectedClass && (
                <div className="card" style={{ margin: 0, padding: '14px 18px', backgroundColor: 'rgba(255, 107, 53, 0.04)', border: '1px solid rgba(255, 107, 53, 0.2)' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)' }}>
                        {selectedClass.batches.map(b => b.name).join(' + ')} — {selectedClass.subject}
                      </p>
                      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '4px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{formatTime(selectedClass.startTime)} – {formatTime(selectedClass.endTime)}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '4px', alignItems: 'center' }}><User size={11} />{selectedClass.facultyName}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '4px', alignItems: 'center' }}><MapPin size={11} />Room {selectedClass.roomName}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ STEP 1: Attendance Marking ═══ */}
              <div className="card" style={{ margin: 0, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--primary-orange)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' }}>1</div>
                      <h3 style={{ fontSize: '16px' }}>Mark Attendance</h3>
                    </div>
                    <span className="caption" style={{ fontSize: '11px', marginLeft: '32px' }}>
                      {studentList.length} students — {presentCount} Present · {absentCount} Absent · {leaveCount} Leave
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', minHeight: '36px', fontSize: '12px' }} onClick={() => handleMarkAll('Present')}>All Present</button>
                    <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', minHeight: '36px', fontSize: '12px' }} onClick={() => handleMarkAll('Absent')}>All Absent</button>
                  </div>
                </div>

                {studentList.length === 0 ? (
                  <p className="secondary-text" style={{ textAlign: 'center', padding: '24px 0' }}>
                    {(selectedClass || manualMode) ? 'Loading students...' : 'No students loaded.'}
                  </p>
                ) : (
                  <>
                    {selectedClass && selectedClass.batches.length > 1 && (
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                        Students are grouped by batch below for clarity.
                      </p>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {studentList.map((student) => (
                        <div key={student.enrollmentId} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: student.status === 'Absent' ? '#FEF2F2' : student.status === 'Leave' ? '#FFFBEB' : '#F8FAFC',
                          border: '1px solid',
                          borderColor: student.status === 'Absent' ? '#FEE2E2' : student.status === 'Leave' ? '#FEF3C7' : 'var(--border-color)',
                          gap: '12px',
                          transition: 'all 0.1s'
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '13px' }}>{student.name}</span>
                            <span className="caption" style={{ fontSize: '10px' }}>
                              {student.studentCode}
                              {selectedClass && selectedClass.batches.length > 1 && ` · ${student.batchName}`}
                              {student.preExistingLeave && ' · Approved Leave'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button type="button" className="btn" style={{ padding: '6px 12px', minHeight: '36px', backgroundColor: student.status === 'Present' ? 'var(--color-success)' : 'transparent', borderColor: student.status === 'Present' ? 'transparent' : 'var(--divider-color)', color: student.status === 'Present' ? '#FFF' : 'var(--text-secondary)' }} disabled={student.preExistingLeave} onClick={() => handleToggleStatus(student.enrollmentId, 'Present')}>
                              <Check size={16} />
                            </button>
                            <button type="button" className="btn" style={{ padding: '6px 12px', minHeight: '36px', backgroundColor: student.status === 'Absent' ? 'var(--color-error)' : 'transparent', borderColor: student.status === 'Absent' ? 'transparent' : 'var(--divider-color)', color: student.status === 'Absent' ? '#FFF' : 'var(--text-secondary)' }} disabled={student.preExistingLeave} onClick={() => handleToggleStatus(student.enrollmentId, 'Absent')}>
                              <X size={16} />
                            </button>
                            <button type="button" className="btn" style={{ padding: '6px 12px', minHeight: '36px', backgroundColor: student.status === 'Leave' ? 'var(--primary-orange)' : 'transparent', borderColor: student.status === 'Leave' ? 'transparent' : 'var(--divider-color)', color: student.status === 'Leave' ? '#FFF' : 'var(--text-secondary)' }} onClick={() => handleToggleStatus(student.enrollmentId, 'Leave')}>
                              <UserMinus size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* ═══ STEP 2: Chapter Covered (mandatory) + Homework (optional) ═══ */}
              <div className="card" style={{ margin: 0, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--primary-orange)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' }}>2</div>
                  <h3 style={{ fontSize: '16px' }}>Chapter & Homework</h3>
                </div>

                {/* Chapter Covered - Mandatory */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <BookOpen size={14} />
                    Chapter / Topic Covered <span style={{ color: 'var(--color-error)' }}>*</span>
                  </label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. Integrals – Lecture 1" 
                    value={chapterCovered} 
                    onChange={e => { setChapterCovered(e.target.value); if (e.target.value.trim()) setChapterError(false); }}
                    style={chapterError ? { borderColor: 'var(--color-error)', boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.1)' } : {}}
                  />
                  {chapterError && (
                    <span style={{ fontSize: '11px', color: 'var(--color-error)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={11} /> Chapter Covered is required
                    </span>
                  )}
                </div>

                {/* Homework Section - Collapsible */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setHomeworkExpanded(!homeworkExpanded)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      backgroundColor: homeworkExpanded ? 'rgba(245, 158, 11, 0.06)' : 'var(--surface-card)',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BookMarked size={16} style={{ color: 'var(--primary-orange)' }} />
                      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        Homework for Next Class
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '400' }}>
                        (Optional)
                      </span>
                      {homeworkTitle.trim() && (
                        <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '100px', backgroundColor: '#D1FAE5', color: '#065F46' }}>
                          Assigned
                        </span>
                      )}
                    </div>
                    {homeworkExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />}
                  </button>

                  {homeworkExpanded && (
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Homework Title</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="e.g. Exercise 6" 
                          value={homeworkTitle} 
                          onChange={e => setHomeworkTitle(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Description</label>
                        <textarea 
                          className="form-control" 
                          placeholder="e.g. Solve Question 1-20" 
                          value={homeworkDescription} 
                          onChange={e => setHomeworkDescription(e.target.value)}
                          rows={2}
                          style={{ resize: 'vertical', minHeight: '60px' }}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          Due Date {homeworkTitle.trim() && <span style={{ color: 'var(--color-error)' }}>*</span>}
                        </label>
                        <input 
                          type="date" 
                          className="form-control" 
                          value={homeworkDueDate} 
                          onChange={e => { setHomeworkDueDate(e.target.value); if (e.target.value) setHomeworkDueDateError(false); }}
                          style={homeworkDueDateError ? { borderColor: 'var(--color-error)', boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.1)' } : {}}
                        />
                        {homeworkDueDateError && (
                          <span style={{ fontSize: '11px', color: 'var(--color-error)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={11} /> Due Date is required when homework is assigned
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ═══ STEP 3: Homework Defaulters + Faculty Notes ═══ */}
              <div className="card" style={{ margin: 0, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--primary-orange)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' }}>3</div>
                  <h3 style={{ fontSize: '16px' }}>Defaulters & Notes</h3>
                </div>

                {/* Homework Defaulters */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setDefaultersExpanded(!defaultersExpanded)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      backgroundColor: defaultersExpanded ? 'rgba(239, 68, 68, 0.04)' : 'var(--surface-card)',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={16} style={{ color: '#EF4444' }} />
                      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        Homework Defaulters
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '400' }}>
                        (from Present students)
                      </span>
                      {homeworkDefaulters.size > 0 && (
                        <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '100px', backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                          {homeworkDefaulters.size} defaulter{homeworkDefaulters.size > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {defaultersExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />}
                  </button>

                  {defaultersExpanded && (
                    <div style={{ borderTop: '1px solid var(--border-color)', padding: '12px 16px' }}>
                      {presentStudents.length === 0 ? (
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', padding: '12px 0' }}>
                          No present students. Mark attendance first.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                          {presentStudents.map(student => (
                            <label
                              key={student.enrollmentId}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 10px',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                backgroundColor: homeworkDefaulters.has(student.enrollmentId) ? '#FEF2F2' : 'transparent',
                                border: '1px solid',
                                borderColor: homeworkDefaulters.has(student.enrollmentId) ? '#FEE2E2' : 'transparent',
                                transition: 'all 0.1s'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={homeworkDefaulters.has(student.enrollmentId)}
                                onChange={() => handleToggleDefaulter(student.enrollmentId)}
                                style={{ accentColor: '#EF4444', width: '15px', height: '15px' }}
                              />
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '13px', fontWeight: homeworkDefaulters.has(student.enrollmentId) ? '600' : '500', color: homeworkDefaulters.has(student.enrollmentId) ? '#DC2626' : 'var(--text-primary)' }}>
                                  {student.name}
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{student.studentCode}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Faculty Notes */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <StickyNote size={14} />
                    Faculty Notes <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '400' }}>(Optional)</span>
                  </label>
                  <textarea
                    className="form-control"
                    placeholder="e.g. Students need revision in Differentiation"
                    value={facultyNotes}
                    onChange={e => setFacultyNotes(e.target.value)}
                    rows={2}
                    style={{ resize: 'vertical', minHeight: '60px' }}
                  />
                </div>
              </div>

              {/* ═══ SUBMIT: Complete Class ═══ */}
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ 
                  width: '100%', 
                  gap: '8px', 
                  padding: '14px 24px', 
                  fontSize: '15px', 
                  fontWeight: '700',
                  minHeight: '52px',
                  background: 'linear-gradient(135deg, var(--primary-orange) 0%, #F97316 100%)',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                  transition: 'all 0.2s'
                }} 
                disabled={submitting || studentList.length === 0}
              >
                <CheckCircle size={20} />
                <span>{submitting ? 'Completing Class...' : 'Complete Class'}</span>
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
