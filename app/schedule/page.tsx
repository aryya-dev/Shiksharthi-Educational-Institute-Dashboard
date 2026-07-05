'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { 
  Calendar, 
  Plus, 
  BookOpen, 
  MapPin, 
  User, 
  X, 
  AlertTriangle,
  BarChart2,
  List
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { createClient } from '@/utils/supabase/client';

// Dynamically import the ScheduleCalendar wrapper with SSR disabled
const ScheduleCalendar = dynamic(
  () => import('@/components/ScheduleCalendar'),
  { ssr: false }
);

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  extendedProps: {
    room: string;
    faculty: string;
    batch: string;
    subject: string;
    isExtra: boolean;
    reason?: string;
  };
}

interface ExtraClassRecord {
  id: string;
  batchName: string;
  subjectName: string;
  facultyName: string;
  roomName: string;
  date: string;
  timeRange: string;
  reason: string;
}

export default function SchedulePage() {
  const supabase = createClient();
  const { currentBranch, currentAcademicYear, userProfile } = useAppStore();

  const [activeTab, setActiveTab] = useState<'calendar' | 'reports'>('calendar');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [extraClasses, setExtraClasses] = useState<ExtraClassRecord[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  
  // Validation Warnings
  const [validationWarning, setValidationWarning] = useState<string | null>(null);

  // Form State for Extra Class
  const [formData, setFormData] = useState({
    batchId: 'b1',
    subject: 'Physics',
    facultyId: 'f1',
    roomId: 'r7',
    date: '',
    startTime: '16:30',
    endTime: '18:30',
    reason: '',
    notes: ''
  });

  const [batches, setBatches] = useState<{ id: string; name: string; strength: number }[]>([]);
  const [rooms, setRooms] = useState<{ id: string; name: string; capacity: number }[]>([]);
  const [facultyList, setFacultyList] = useState<{ id: string; name: string; subject: string }[]>([]);

  // Load Selectors
  useEffect(() => {
    async function loadSelectors() {
      if (!currentBranch || !currentAcademicYear) return;

      const { data: batchesData } = await supabase
        .from('batches')
        .select('id, name')
        .eq('branch_id', currentBranch.id)
        .eq('academic_year_id', currentAcademicYear.id)
        .order('name');

      let mappedBatches: { id: string; name: string; strength: number }[] = [];
      if (batchesData && batchesData.length > 0) {
        const { data: enrollmentsData } = await supabase
          .from('enrollments')
          .select('batch_id')
          .eq('branch_id', currentBranch.id)
          .eq('academic_year_id', currentAcademicYear.id)
          .eq('status', 'Active');

        const counts: { [batchId: string]: number } = {};
        (enrollmentsData || []).forEach(e => {
          if (e.batch_id) {
            counts[e.batch_id] = (counts[e.batch_id] || 0) + 1;
          }
        });

        mappedBatches = batchesData.map(b => ({
          id: b.id,
          name: b.name,
          strength: counts[b.id] || 0
        }));
      }
      setBatches(mappedBatches);

      const { data: roomsData } = await supabase
        .from('rooms')
        .select('id, name, capacity')
        .eq('branch_id', currentBranch.id)
        .order('name');
      const mappedRooms = (roomsData || []).map(r => ({
        id: r.id,
        name: r.name,
        capacity: r.capacity
      }));
      setRooms(mappedRooms);

      const { data: facultyData } = await supabase
        .from('faculty')
        .select('id, name, subjects')
        .order('name');
      const mappedFaculty = (facultyData || []).map(f => ({
        id: f.id,
        name: f.name,
        subject: f.subjects?.[0] || 'Physics'
      }));
      setFacultyList(mappedFaculty);

      setFormData(prev => ({
        ...prev,
        batchId: mappedBatches[0]?.id || '',
        roomId: mappedRooms[0]?.id || '',
        facultyId: mappedFaculty[0]?.id || ''
      }));
    }
    loadSelectors();
  }, [currentBranch, currentAcademicYear]);

  // Helper: Get dates for the current week
  const getISOStringForDay = (dayOffsetFromMonday: number, timeStr: string) => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sun, 1 = Mon, etc.
    const distance = dayOffsetFromMonday - (currentDay === 0 ? 7 : currentDay);
    const targetDate = new Date(today.setDate(today.getDate() + distance));
    return `${targetDate.toISOString().split('T')[0]}T${timeStr}:00`;
  };

  // Load schedule events
  useEffect(() => {
    async function loadSchedule() {
      if (!currentBranch || !currentAcademicYear) return;
      
      try {
        const { data: scheduleData } = await supabase
          .from('schedules')
          .select('*, batches(name), rooms(name), faculty(name)')
          .eq('branch_id', currentBranch.id)
          .eq('academic_year_id', currentAcademicYear.id);

        const regularEvents: CalendarEvent[] = (scheduleData || []).map((s: any) => {
          const startIso = getISOStringForDay(s.day_of_week, s.start_time.slice(0, 5));
          const endIso = getISOStringForDay(s.day_of_week, s.end_time.slice(0, 5));
          
          return {
            id: s.id,
            title: `${s.batches?.name || 'Unknown'} - ${s.subject_name}`,
            start: startIso,
            end: endIso,
            backgroundColor: '#3B82F6',
            borderColor: '#2563EB',
            extendedProps: {
              room: s.rooms?.name || 'Unknown',
              faculty: s.faculty?.name || 'Unknown',
              batch: s.batches?.name || 'Unknown',
              subject: s.subject_name,
              isExtra: false
            }
          };
        });

        const { data: extraSessions } = await supabase
          .from('class_sessions')
          .select('*, batches!inner(name, branch_id, academic_year_id), rooms(name), faculty(name)')
          .eq('is_extra_class', true)
          .eq('batches.branch_id', currentBranch.id)
          .eq('batches.academic_year_id', currentAcademicYear.id);

        const extraEvents: CalendarEvent[] = (extraSessions || []).map((s: any) => {
          const startIso = `${s.date}T${s.start_time.slice(0, 5)}`;
          const endIso = `${s.date}T${s.end_time.slice(0, 5)}`;
          
          return {
            id: s.id,
            title: `[EXTRA] ${s.batches?.name || 'Unknown'} - ${s.subject_name}`,
            start: startIso,
            end: endIso,
            backgroundColor: '#EF4444',
            borderColor: '#DC2626',
            extendedProps: {
              room: s.rooms?.name || 'Unknown',
              faculty: s.faculty?.name || 'Unknown',
              batch: s.batches?.name || 'Unknown',
              subject: s.subject_name,
              isExtra: true,
              reason: s.extra_class_reason || ''
            }
          };
        });

        setEvents([...regularEvents, ...extraEvents]);

        const extraRecords: ExtraClassRecord[] = (extraSessions || []).map((s: any) => {
          const formatTime = (t: string) => {
            const [h, m] = t.split(':');
            const hr = parseInt(h);
            const ampm = hr >= 12 ? 'PM' : 'AM';
            const formattedHr = hr % 12 || 12;
            return `${formattedHr}:${m} ${ampm}`;
          };
          
          return {
            id: s.id,
            batchName: s.batches?.name || 'Unknown',
            subjectName: s.subject_name,
            facultyName: s.faculty?.name || 'Unknown',
            roomName: s.rooms?.name || 'Unknown',
            date: s.date,
            timeRange: `${formatTime(s.start_time)} - ${formatTime(s.end_time)}`,
            reason: s.extra_class_reason || ''
          };
        });
        setExtraClasses(extraRecords);
      } catch (err) {
        console.error(err);
      }
    }

    loadSchedule();
  }, [currentBranch, currentAcademicYear]);

  // Form Validation Logic
  const checkConflicts = (date: string, start: string, end: string, roomId: string, facultyId: string) => {
    setValidationWarning(null);

    // Get batch size & room capacity
    const selectedBatch = batches.find(b => b.id === formData.batchId);
    const selectedRoom = rooms.find(r => r.id === roomId);
    
    if (selectedBatch && selectedRoom && selectedBatch.strength > selectedRoom.capacity) {
      setValidationWarning(`⚠️ Capacity Warning: Batch size (${selectedBatch.strength}) exceeds Room ${selectedRoom.name} capacity (${selectedRoom.capacity}).`);
      return;
    }

    // Check overlap with existing calendar items
    const newStart = new Date(`${date}T${start}:00`).getTime();
    const newEnd = new Date(`${date}T${end}:00`).getTime();

    for (const ev of events) {
      const evStart = new Date(ev.start).getTime();
      const evEnd = new Date(ev.end).getTime();

      // Check date match
      const evDate = ev.start.split('T')[0];
      if (evDate === date) {
        const overlap = Math.max(newStart, evStart) < Math.min(newEnd, evEnd);
        if (overlap) {
          if (ev.extendedProps.room === selectedRoom?.name) {
            setValidationWarning(`❌ Booking Conflict: Room ${selectedRoom.name} is already booked by ${ev.title} during this time.`);
            return;
          }
          if (ev.extendedProps.faculty === facultyList.find(f => f.id === facultyId)?.name) {
            setValidationWarning(`❌ Booking Conflict: Faculty is already assigned to ${ev.title} during this time.`);
            return;
          }
        }
      }
    }
  };

  // Run validation whenever times or assignments change
  useEffect(() => {
    if (formData.date && formData.startTime && formData.endTime) {
      checkConflicts(formData.date, formData.startTime, formData.endTime, formData.roomId, formData.facultyId);
    }
  }, [formData.date, formData.startTime, formData.endTime, formData.roomId, formData.facultyId]);

  // Save Extra Class
  const handleSaveExtraClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBranch || !currentAcademicYear) return;

    const selectedBatch = batches.find(b => b.id === formData.batchId);
    const selectedRoom = rooms.find(r => r.id === formData.roomId);
    const selectedFaculty = facultyList.find(f => f.id === formData.facultyId);

    if (!selectedBatch || !selectedRoom || !selectedFaculty) return;

    try {
      // Save to Supabase
      const { data, error } = await supabase
        .from('class_sessions')
        .insert({
          batch_id: selectedBatch.id,
          subject_name: formData.subject,
          faculty_id: selectedFaculty.id,
          room_id: selectedRoom.id,
          date: formData.date,
          start_time: `${formData.startTime}:00`,
          end_time: `${formData.endTime}:00`,
          is_extra_class: true,
          extra_class_reason: formData.reason,
          extra_class_notes: formData.notes
        })
        .select()
        .single();

      if (error) throw error;

      // Close and update calendar state
      setShowAddModal(false);
      
      const newEv: CalendarEvent = {
        id: data.id,
        title: `[EXTRA] ${selectedBatch.name} - ${formData.subject}`,
        start: `${formData.date}T${formData.startTime}:00`,
        end: `${formData.date}T${formData.endTime}:00`,
        backgroundColor: '#EF4444',
        borderColor: '#DC2626',
        extendedProps: {
          room: selectedRoom.name,
          faculty: selectedFaculty.name,
          batch: selectedBatch.name,
          subject: formData.subject,
          isExtra: true,
          reason: formData.reason
        }
      };

      setEvents([...events, newEv]);
      
      const newReport: ExtraClassRecord = {
        id: data.id,
        batchName: selectedBatch.name,
        subjectName: formData.subject,
        facultyName: selectedFaculty.name,
        roomName: selectedRoom.name,
        date: formData.date,
        timeRange: `${formData.startTime} - ${formData.endTime}`,
        reason: formData.reason
      };

      setExtraClasses([newReport, ...extraClasses]);
    } catch (err) {
      console.error(err);
      // Local fallback
      setShowAddModal(false);
      const newEv: CalendarEvent = {
        id: `ex-temp-${Date.now()}`,
        title: `[EXTRA] ${selectedBatch.name} - ${formData.subject}`,
        start: `${formData.date}T${formData.startTime}:00`,
        end: `${formData.date}T${formData.endTime}:00`,
        backgroundColor: '#EF4444',
        borderColor: '#DC2626',
        extendedProps: {
          room: selectedRoom.name,
          faculty: selectedFaculty.name,
          batch: selectedBatch.name,
          subject: formData.subject,
          isExtra: true,
          reason: formData.reason
        }
      };
      setEvents([...events, newEv]);

      const newReport: ExtraClassRecord = {
        id: `ex-rep-${Date.now()}`,
        batchName: selectedBatch.name,
        subjectName: formData.subject,
        facultyName: selectedFaculty.name,
        roomName: selectedRoom.name,
        date: formData.date,
        timeRange: `${formData.startTime} - ${formData.endTime}`,
        reason: formData.reason
      };
      setExtraClasses([newReport, ...extraClasses]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. Dashboard Tabs toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
          <button 
            className="btn btn-tertiary"
            style={{ 
              borderBottom: activeTab === 'calendar' ? '2px solid var(--primary-orange)' : 'none',
              color: activeTab === 'calendar' ? 'var(--primary-orange)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'calendar' ? '600' : '500',
              borderRadius: 0, paddingBottom: '12px', minHeight: 'unset', gap: '8px'
            }}
            onClick={() => setActiveTab('calendar')}
          >
            <Calendar size={18} />
            <span>Weekly Timetable</span>
          </button>
          <button 
            className="btn btn-tertiary"
            style={{ 
              borderBottom: activeTab === 'reports' ? '2px solid var(--primary-orange)' : 'none',
              color: activeTab === 'reports' ? 'var(--primary-orange)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'reports' ? '600' : '500',
              borderRadius: 0, paddingBottom: '12px', minHeight: 'unset', gap: '8px'
            }}
            onClick={() => setActiveTab('reports')}
          >
            <BarChart2 size={18} />
            <span>Extra Classes Ledger</span>
          </button>
        </div>

        {/* Schedule Extra Class Action */}
        <button 
          className="btn btn-primary"
          style={{ gap: '8px' }}
          onClick={() => {
            // Set date to tomorrow as default
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            setFormData({
              ...formData,
              date: tomorrow.toISOString().split('T')[0]
            });
            setShowAddModal(true);
          }}
        >
          <Plus size={18} />
          <span>Schedule Extra Class</span>
        </button>
      </div>

      {/* 2. Main Tab Area */}
      {activeTab === 'calendar' ? (
        <ScheduleCalendar 
          events={events} 
          onEventClick={(info) => {
            const ev = events.find(e => e.id === info.event.id);
            if (ev) setSelectedEvent(ev);
          }} 
        />
      ) : (
        /* REPORTS / LEDGER PANEL */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ margin: 0, padding: '20px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Extra Class Statistics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span className="caption">Total Extra Classes</span>
                <p style={{ fontSize: '24px', fontWeight: '700' }}>{extraClasses.length}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span className="caption">Top Batch Served</span>
                <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>12 JEE A (1 classes)</p>
              </div>
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Subject</th>
                  <th>Faculty</th>
                  <th>Room</th>
                  <th>Date</th>
                  <th>Timing</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {extraClasses.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: '600' }}>{item.batchName}</td>
                    <td>{item.subjectName}</td>
                    <td>{item.facultyName}</td>
                    <td>Room {item.roomName}</td>
                    <td>{item.date}</td>
                    <td>{item.timeRange}</td>
                    <td className="secondary-text" style={{ fontSize: '13px' }}>{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Schedule Extra Class Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 200,
          padding: '16px'
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: '500px', padding: '32px',
            position: 'relative', margin: 0, boxShadow: 'var(--shadow-hover)'
          }}>
            <button 
              className="btn btn-tertiary" 
              style={{ position: 'absolute', right: '16px', top: '16px', padding: '8px', minHeight: '36px' }}
              onClick={() => {
                setShowAddModal(false);
                setValidationWarning(null);
              }}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Schedule Extra Class</h2>

            {/* Validation Warnings Alert Box */}
            {validationWarning && (
              <div className="badge" style={{
                width: '100%',
                borderRadius: 'var(--radius-sm)',
                padding: '12px var(--space-4)',
                marginBottom: '16px',
                justifyContent: 'flex-start',
                textTransform: 'none',
                backgroundColor: validationWarning.startsWith('❌') ? '#FEE2E2' : '#FEF3C7',
                color: validationWarning.startsWith('❌') ? '#991B1B' : '#92400E'
              }}>
                <span style={{ fontSize: '13px', lineHeight: '18px', fontWeight: '500' }}>{validationWarning}</span>
              </div>
            )}

            <form onSubmit={handleSaveExtraClass} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Target Batch *</label>
                  <select
                    className="form-control"
                    value={formData.batchId}
                    onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
                  >
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Subject *</label>
                  <select
                    className="form-control"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  >
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Biology">Biology</option>
                    <option value="Computer Science">Computer Science</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Faculty *</label>
                  <select
                    className="form-control"
                    value={formData.facultyId}
                    onChange={(e) => setFormData({ ...formData, facultyId: e.target.value })}
                  >
                    {facultyList.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Room Allocation *</label>
                  <select
                    className="form-control"
                    value={formData.roomId}
                    onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                  >
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>Room {r.name} (Cap: {r.capacity})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Date *</label>
                <input
                  type="date"
                  className="form-control"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Start Time *</label>
                  <input
                    type="time"
                    className="form-control"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">End Time *</label>
                  <input
                    type="time"
                    className="form-control"
                    required
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Reason for Extra Class *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Backlog syllabus cover before unit test"
                  required
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '8px' }}
                disabled={!!validationWarning && validationWarning.startsWith('❌')}
              >
                Schedule Class
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. Event View Modal */}
      {selectedEvent && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 200,
          padding: '16px'
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: '400px', padding: '32px',
            position: 'relative', margin: 0, boxShadow: 'var(--shadow-hover)'
          }}>
            <button 
              className="btn btn-tertiary" 
              style={{ position: 'absolute', right: '16px', top: '16px', padding: '8px', minHeight: '36px' }}
              onClick={() => setSelectedEvent(null)}
            >
              <X size={20} />
            </button>

            <span className={`badge ${selectedEvent.extendedProps.isExtra ? 'badge-error' : 'badge-info'}`} style={{ marginBottom: '12px' }}>
              {selectedEvent.extendedProps.isExtra ? 'Extra Class' : 'Regular Class'}
            </span>

            <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>{selectedEvent.extendedProps.batch}</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }} className="body-text">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <BookOpen size={16} style={{ color: 'var(--text-secondary)' }} />
                <span>Subject: <strong>{selectedEvent.extendedProps.subject}</strong></span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <User size={16} style={{ color: 'var(--text-secondary)' }} />
                <span>Faculty: <strong>{selectedEvent.extendedProps.faculty}</strong></span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <MapPin size={16} style={{ color: 'var(--text-secondary)' }} />
                <span>Room: <strong>Room {selectedEvent.extendedProps.room}</strong></span>
              </div>
              
              {selectedEvent.extendedProps.isExtra && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
                  <span className="caption">Reason for Extra Class</span>
                  <p style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '4px' }}>
                    {selectedEvent.extendedProps.reason}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
