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

  const [activeTab, setActiveTab] = useState<'calendar' | 'planner' | 'reports'>('calendar');
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

  // Weekly Planner Form and Grid State
  const [schedulesList, setSchedulesList] = useState<any[]>([]);
  const [plannerDay, setPlannerDay] = useState<number>(5); // Default to Friday
  const [plannerStartTime, setPlannerStartTime] = useState<string>('17:00');
  const [plannerEndTime, setPlannerEndTime] = useState<string>('19:00');
  const [plannerClasses, setPlannerClasses] = useState<Array<{
    batchIds: string[];
    subject: string;
    facultyId: string;
    roomId: string;
  }>>([
    { batchIds: [], subject: 'Chemistry', facultyId: '', roomId: '' }
  ]);
  const [plannerErrors, setPlannerErrors] = useState<string[]>([]);
  const [selectedGridDay, setSelectedGridDay] = useState<number>(5); // Default to Friday

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

      // Initialize planner classes structure
      setPlannerClasses([
        {
          batchIds: [],
          subject: 'Chemistry',
          facultyId: mappedFaculty[0]?.id || '',
          roomId: mappedRooms[0]?.id || ''
        }
      ]);
    }
    loadSelectors();
  }, [currentBranch, currentAcademicYear]);

  // Helper: Get dates for the current week
  const getISOStringForDay = (dayOffsetFromMonday: number, timeStr: string) => {
    const today = new Date();

    const currentDay = today.getDay(); // 0=Sun, 1=Mon...
    const mondayBasedToday = currentDay === 0 ? 7 : currentDay;

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + (dayOffsetFromMonday - mondayBasedToday));

    // LOCAL date (don't use toISOString)
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}T${timeStr}:00`;
  };

  // Load schedule events
  const loadSchedule = async () => {
    if (!currentBranch || !currentAcademicYear) return;

    try {
      const { data: scheduleData } = await supabase
        .from('schedules')
        .select('*, batches(name), rooms(name), faculty(name)')
        .eq('branch_id', currentBranch.id)
        .eq('academic_year_id', currentAcademicYear.id);

      setSchedulesList(scheduleData || []);

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
  };

  useEffect(() => {
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

  // Weekly Planner dynamic form helpers
  const addPlannerClassRow = () => {
    setPlannerClasses([
      ...plannerClasses,
      {
        batchIds: [],
        subject: 'Physics',
        facultyId: facultyList[0]?.id || '',
        roomId: rooms[0]?.id || ''
      }
    ]);
  };

  const removePlannerClassRow = (index: number) => {
    const updated = [...plannerClasses];
    updated.splice(index, 1);
    setPlannerClasses(updated);
  };

  const updatePlannerClass = (index: number, key: string, value: any) => {
    const updated = [...plannerClasses];
    updated[index] = { ...updated[index], [key]: value };
    setPlannerClasses(updated);
  };

  // Live planner conflict checking
  const checkPlannerConflicts = () => {
    const errors: string[] = [];

    if (plannerStartTime >= plannerEndTime) {
      errors.push('Start Time must be before End Time.');
      setPlannerErrors(errors);
      return false;
    }

    const toMins = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };
    const newStart = toMins(plannerStartTime);
    const newEnd = toMins(plannerEndTime);

    plannerClasses.forEach((c, idx) => {
      if (c.batchIds.length === 0) {
        errors.push(`Class Row ${idx + 1}: Please select at least one batch.`);
        return;
      }
      if (!c.facultyId) {
        errors.push(`Class Row ${idx + 1}: Please select a faculty member.`);
      }
      if (!c.roomId) {
        errors.push(`Class Row ${idx + 1}: Please select a room.`);
      }

      const roomName = rooms.find(r => r.id === c.roomId)?.name || 'Unknown';
      const facultyName = facultyList.find(f => f.id === c.facultyId)?.name || 'Unknown';

      // Check database schedules
      schedulesList.forEach(existing => {
        if (existing.day_of_week !== plannerDay) return;

        const extStart = toMins(existing.start_time);
        const extEnd = toMins(existing.end_time);

        const overlap = Math.max(newStart, extStart) < Math.min(newEnd, extEnd);
        if (overlap) {
          if (existing.room_id === c.roomId) {
            errors.push(`Class Row ${idx + 1}: Room conflict! Room ${roomName} is already booked for Batch ${existing.batches?.name} (${existing.subject_name}) at ${existing.start_time.slice(0, 5)} - ${existing.end_time.slice(0, 5)} on this day.`);
          }
          if (existing.faculty_id === c.facultyId) {
            errors.push(`Class Row ${idx + 1}: Faculty conflict! ${facultyName} is already scheduled to teach Batch ${existing.batches?.name} (${existing.subject_name}) at ${existing.start_time.slice(0, 5)} - ${existing.end_time.slice(0, 5)} on this day.`);
          }
          c.batchIds.forEach(bId => {
            if (existing.batch_id === bId) {
              errors.push(`Class Row ${idx + 1}: Batch conflict! Batch ${batches.find(b => b.id === bId)?.name} already has a scheduled class (${existing.subject_name}) at ${existing.start_time.slice(0, 5)} - ${existing.end_time.slice(0, 5)} on this day.`);
            }
          });
        }
      });

      // Check conflicts inside the form
      for (let j = 0; j < idx; j++) {
        const other = plannerClasses[j];
        if (other.roomId === c.roomId) {
          errors.push(`Row ${j + 1} & Row ${idx + 1} are both booked in Room ${roomName}.`);
        }
        if (other.facultyId === c.facultyId) {
          errors.push(`Row ${j + 1} & Row ${idx + 1} are both assigned to Faculty ${facultyName}.`);
        }
        const sharedBatches = c.batchIds.filter(bId => other.batchIds.includes(bId));
        if (sharedBatches.length > 0) {
          errors.push(`Row ${j + 1} & Row ${idx + 1} share batch(es): ${sharedBatches.map(id => batches.find(b => b.id === id)?.name).join(', ')}.`);
        }
      }
    });

    setPlannerErrors(errors);
    return errors.length === 0;
  };

  useEffect(() => {
    if (activeTab === 'planner') {
      checkPlannerConflicts();
    }
  }, [plannerDay, plannerStartTime, plannerEndTime, plannerClasses, schedulesList, activeTab]);

  const handleSavePlannerSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBranch || !currentAcademicYear) return;

    if (!checkPlannerConflicts()) {
      alert('Cannot save. Please resolve the schedule conflicts first.');
      return;
    }

    const inserts: any[] = [];
    plannerClasses.forEach(c => {
      c.batchIds.forEach(batchId => {
        inserts.push({
          batch_id: batchId,
          subject_name: c.subject,
          faculty_id: c.facultyId,
          room_id: c.roomId,
          day_of_week: plannerDay,
          start_time: `${plannerStartTime}:00`,
          end_time: `${plannerEndTime}:00`,
          branch_id: currentBranch.id,
          academic_year_id: currentAcademicYear.id
        });
      });
    });

    try {
      const { error } = await supabase
        .from('schedules')
        .insert(inserts);

      if (error) throw error;

      // Reset classes form
      setPlannerClasses([
        {
          batchIds: [],
          subject: 'Chemistry',
          facultyId: facultyList[0]?.id || '',
          roomId: rooms[0]?.id || ''
        }
      ]);
      setPlannerErrors([]);

      // Refresh list
      await loadSchedule();
      alert('Schedules saved successfully!');
    } catch (err) {
      console.error('Save schedule failed:', err);
      alert('Failed to save schedules. Please check database connectivity.');
    }
  };

  const handleDeleteGroupedClass = async (scheduleIds: string[]) => {
    if (!confirm('Are you sure you want to delete this scheduled class?')) return;
    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .in('id', scheduleIds);

      if (error) throw error;
      await loadSchedule();
    } catch (err) {
      console.error('Delete schedule failed:', err);
      alert('Failed to delete schedule.');
    }
  };

  const getTimeSlotsForDay = (day: number) => {
    const daySchedules = schedulesList.filter(s => s.day_of_week === day);
    const timeGroups: { [timeKey: string]: any } = {};

    daySchedules.forEach(s => {
      const timeKey = `${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}`;
      if (!timeGroups[timeKey]) {
        timeGroups[timeKey] = {
          timeKey,
          startTime: s.start_time,
          endTime: s.end_time,
          classes: []
        };
      }

      // Check if this class is already in the list (same room, faculty, subject) for grouping mixed batches
      const existingClass = timeGroups[timeKey].classes.find((c: any) =>
        c.roomName === (s.rooms?.name || 'Unknown') &&
        c.facultyName === (s.faculty?.name || 'Unknown') &&
        c.subjectName === s.subject_name
      );

      if (existingClass) {
        existingClass.batches.push({ id: s.batch_id, name: s.batches?.name || 'Unknown' });
        existingClass.scheduleIds.push(s.id);
      } else {
        timeGroups[timeKey].classes.push({
          subjectName: s.subject_name,
          roomName: s.rooms?.name || 'Unknown',
          facultyName: s.faculty?.name || 'Unknown',
          batches: [{ id: s.batch_id, name: s.batches?.name || 'Unknown' }],
          scheduleIds: [s.id]
        });
      }
    });

    return Object.values(timeGroups).sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
  };

  const DAYS_OF_WEEK = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 7, label: 'Sunday' }
  ];

  return (

    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* 1. Dashboard Tabs toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '4px' }}>
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
              borderBottom: activeTab === 'planner' ? '2px solid var(--primary-orange)' : 'none',
              color: activeTab === 'planner' ? 'var(--primary-orange)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'planner' ? '600' : '500',
              borderRadius: 0, paddingBottom: '12px', minHeight: 'unset', gap: '8px'
            }}
            onClick={() => setActiveTab('planner')}
          >
            <List size={18} />
            <span>Schedule Planner</span>
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
        {activeTab !== 'planner' && (
          <button
            className="btn btn-primary"
            style={{ gap: '8px' }}
            onClick={() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              setFormData({ ...formData, date: tomorrow.toISOString().split('T')[0] });
              setShowAddModal(true);
            }}
          >
            <Plus size={18} />
            <span>Schedule Extra Class</span>
          </button>
        )}
      </div>

      {/* 2. Main Tab Area */}
      {activeTab === 'calendar' && (
        <ScheduleCalendar
          events={events}
          onEventClick={(info) => {
            const ev = events.find(e => e.id === info.event.id);
            if (ev) setSelectedEvent(ev);
          }}
        />
      )}

      {activeTab === 'planner' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: '24px', alignItems: 'start' }}>

          {/* LEFT: Schedule Creator Form */}
          <div className="card" style={{ margin: 0, padding: '24px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              Add Recurring Schedule
            </h3>

            <form onSubmit={handleSavePlannerSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Day + Time Row */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Day of Week *</label>
                  <select className="form-control" value={plannerDay} onChange={e => setPlannerDay(Number(e.target.value))}>
                    {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Start Time *</label>
                    <input type="time" className="form-control" value={plannerStartTime} onChange={e => setPlannerStartTime(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">End Time *</label>
                    <input type="time" className="form-control" value={plannerEndTime} onChange={e => setPlannerEndTime(e.target.value)} required />
                  </div>
                </div>
              </div>

              {/* Class Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ margin: 0 }}>Classes in this Slot</label>
                  <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', minHeight: '32px', fontSize: '12px', gap: '4px' }} onClick={addPlannerClassRow}>
                    <Plus size={13} /> Add Class
                  </button>
                </div>

                {plannerClasses.map((cls, idx) => (
                  <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'var(--surface-hover)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Class {idx + 1}
                      </span>
                      {plannerClasses.length > 1 && (
                        <button type="button" onClick={() => removePlannerClassRow(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', padding: '4px' }}>
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    {/* Batch Multi-Select */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Batch(es) * <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(select multiple for mixed batch)</span></label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px', maxHeight: '140px', overflowY: 'auto', backgroundColor: 'var(--surface-card)' }}>
                        {batches.map(b => (
                          <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                            <input
                              type="checkbox"
                              checked={cls.batchIds.includes(b.id)}
                              onChange={e => {
                                const updated = e.target.checked
                                  ? [...cls.batchIds, b.id]
                                  : cls.batchIds.filter(id => id !== b.id);
                                updatePlannerClass(idx, 'batchIds', updated);
                              }}
                              style={{ accentColor: 'var(--primary-orange)', width: '15px', height: '15px' }}
                            />
                            <span>{b.name}</span>
                            {b.strength > 0 && <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>({b.strength} students)</span>}
                          </label>
                        ))}
                      </div>
                      {cls.batchIds.length > 0 && (
                        <p style={{ fontSize: '11px', color: 'var(--primary-orange)', marginTop: '4px', fontWeight: '600' }}>
                          Selected: {cls.batchIds.map(id => batches.find(b => b.id === id)?.name).join(' + ')}
                        </p>
                      )}
                    </div>

                    {/* Subject */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Subject *</label>
                      <select className="form-control" value={cls.subject} onChange={e => updatePlannerClass(idx, 'subject', e.target.value)}>
                        <option value="Physics">Physics</option>
                        <option value="Chemistry">Chemistry</option>
                        <option value="Mathematics">Mathematics</option>
                        <option value="Biology">Biology</option>
                        <option value="Computer Science">Computer Science</option>
                      </select>
                    </div>

                    {/* Faculty Dropdown (from DB) */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Faculty *</label>
                      <select className="form-control" value={cls.facultyId} onChange={e => updatePlannerClass(idx, 'facultyId', e.target.value)}>
                        <option value="">— Select Faculty —</option>
                        {facultyList.map(f => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Room Dropdown */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Room Allocation *</label>
                      <select className="form-control" value={cls.roomId} onChange={e => updatePlannerClass(idx, 'roomId', e.target.value)}>
                        <option value="">— Select Room —</option>
                        {rooms.map(r => (
                          <option key={r.id} value={r.id}>Room {r.name} (Cap: {r.capacity})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              {/* Conflict Errors */}
              {plannerErrors.length > 0 && (
                <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: 'var(--radius-sm)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', color: '#991B1B', fontWeight: '600', fontSize: '13px' }}>
                    <AlertTriangle size={14} />
                    <span>Conflicts Detected</span>
                  </div>
                  {plannerErrors.map((err, i) => (
                    <p key={i} style={{ fontSize: '12px', color: '#B91C1C', margin: 0 }}>• {err}</p>
                  ))}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', gap: '8px' }}
                disabled={plannerErrors.length > 0}
              >
                <Plus size={18} />
                Save Schedule Slot
              </button>
            </form>
          </div>

          {/* RIGHT: Weekly Timetable Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card" style={{ margin: 0, padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px' }}>Scheduled Timetable</h3>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {DAYS_OF_WEEK.map(d => (
                    <button
                      key={d.value}
                      className={`btn ${selectedGridDay === d.value ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '4px 10px', minHeight: '32px', fontSize: '12px', fontWeight: selectedGridDay === d.value ? '700' : '500' }}
                      onClick={() => setSelectedGridDay(d.value)}
                    >
                      {d.label.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timetable for selected day */}
              {(() => {
                const slots = getTimeSlotsForDay(selectedGridDay);
                if (slots.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                      <BookOpen size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                      <p style={{ fontSize: '14px' }}>No classes scheduled for {DAYS_OF_WEEK.find(d => d.value === selectedGridDay)?.label}.</p>
                      <p style={{ fontSize: '12px', marginTop: '4px' }}>Use the form to add classes.</p>
                    </div>
                  );
                }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {slots.map((slot: any) => (
                      <div key={slot.timeKey} style={{ borderLeft: '3px solid var(--primary-orange)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* Time Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary-orange)', fontVariantNumeric: 'tabular-nums' }}>
                            {slot.timeKey}
                          </span>
                        </div>

                        {/* Classes in this slot */}
                        {slot.classes.map((cls: any, ci: number) => (
                          <div key={ci} style={{
                            backgroundColor: 'var(--surface-hover)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '12px 14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '12px'
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                              {/* Batch Tag(s) */}
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                                {cls.batches.map((b: any) => (
                                  <span key={b.id} style={{
                                    fontSize: '11px', fontWeight: '700', padding: '2px 8px',
                                    borderRadius: '100px', backgroundColor: 'var(--primary-orange)',
                                    color: '#fff', letterSpacing: '0.02em'
                                  }}>{b.name}</span>
                                ))}
                                {cls.batches.length > 1 && (
                                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', alignSelf: 'center' }}>Mixed</span>
                                )}
                              </div>
                              <p style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)', margin: 0 }}>{cls.subjectName}</p>
                              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <User size={12} /> {cls.facultyName}
                                </span>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <MapPin size={12} /> Room {cls.roomName}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteGroupedClass(cls.scheduleIds)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', flexShrink: 0 }}
                              title="Delete this class"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        /* REPORTS / LEDGER PANEL */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ margin: 0, padding: '20px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Extra Class Statistics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span className="caption">Total Extra Classes</span>
                <p style={{ fontSize: '24px', fontWeight: '700' }}>{extraClasses.length}</p>
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
                {extraClasses.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '32px' }}>No extra classes recorded yet.</td></tr>
                ) : extraClasses.map((item) => (
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
