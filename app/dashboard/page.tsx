'use client';

import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Calendar, 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  MapPin, 
  User, 
  FileWarning,
  BookOpen
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { useAppStore } from '@/store/useAppStore';
import { createClient } from '@/utils/supabase/client';

interface ClassItem {
  id: string;
  time: string;
  batch: string;
  subject: string;
  faculty: string;
  room: string;
  status: 'Upcoming' | 'Ongoing' | 'Completed' | 'Cancelled';
  strength: number;
}

interface AlertItem {
  type: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
}

export default function DashboardPage() {
  const supabase = createClient();
  const { currentBranch, currentAcademicYear, userProfile } = useAppStore();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [stats, setStats] = useState({
    totalStudents: 0,
    classesToday: 0,
    feesDue: '$0',
    pendingAttendance: 0,
    upcomingExams: 0,
    lowAttendance: 0
  });
  const [loading, setLoading] = useState(true);
  const [batchesList, setBatchesList] = useState<{ id: string; name: string }[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [syllabusProgress, setSyllabusProgress] = useState<{ subject: string; completed: number; total: number; percentage: number; completedList: string[] }[]>([]);
  const [loadingSyllabus, setLoadingSyllabus] = useState(false);

  const isMentor = userProfile?.role === 'Mentor';

  // Load Dashboard Data
  useEffect(() => {
    async function loadData() {
      if (!currentBranch || !currentAcademicYear) return;
      setLoading(true);
      
      try {
        const { count: studentCount } = await supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('branch_id', currentBranch.id)
          .eq('academic_year_id', currentAcademicYear.id)
          .eq('status', 'Active');

        const { data: bData } = await supabase
          .from('batches')
          .select('id, name')
          .eq('branch_id', currentBranch.id)
          .eq('academic_year_id', currentAcademicYear.id)
          .order('name');
        setBatchesList(bData || []);
        if (bData && bData.length > 0) {
          setSelectedBatchId(bData[0].id);
        } else {
          setSelectedBatchId('');
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const { data: sessions } = await supabase
          .from('class_sessions')
          .select('*, batches(name, branch_id), rooms(name), faculty(name)')
          .eq('date', todayStr);

        // Map branch sessions
        const branchSessions = (sessions || []).filter((s: any) => s.batches?.branch_id === currentBranch.id);

        const activeClasses: ClassItem[] = branchSessions.map((s: any) => {
          const formatTime = (t: string) => {
            if (!t) return '';
            const [h, m] = t.split(':');
            const hr = parseInt(h);
            const ampm = hr >= 12 ? 'PM' : 'AM';
            const formattedHr = hr % 12 || 12;
            return `${formattedHr}:${m} ${ampm}`;
          };
          const timeRange = `${formatTime(s.start_time)} - ${formatTime(s.end_time)}`;
          
          let status: 'Upcoming' | 'Ongoing' | 'Completed' | 'Cancelled' = 'Upcoming';
          const now = new Date();
          const startStr = `${todayStr}T${s.start_time}`;
          const endStr = `${todayStr}T${s.end_time}`;
          const startTime = new Date(startStr);
          const endTime = new Date(endStr);
          if (now > endTime) {
            status = 'Completed';
          } else if (now >= startTime && now <= endTime) {
            status = 'Ongoing';
          }
          
          return {
            id: s.id,
            time: timeRange,
            batch: s.batches?.name || 'Unknown',
            subject: s.subject_name,
            faculty: s.faculty?.name || 'TBD',
            room: s.rooms?.name || 'TBD',
            status,
            strength: 0
          };
        });

        // Query outstanding dues
        let feesDueStr = '₹0';
        if (!isMentor) {
          const { data: unpaidInstallments } = await supabase
            .from('fee_installments')
            .select(`
              due_amount,
              student_fees (
                enrollments (
                  branch_id,
                  academic_year_id
                )
              )
            `)
            .in('status', ['Due', 'Overdue']);

          const filteredDues = (unpaidInstallments || []).filter((inst: any) => {
            const enrollment = inst.student_fees?.enrollments;
            return enrollment && 
              enrollment.branch_id === currentBranch.id && 
              enrollment.academic_year_id === currentAcademicYear.id;
          });
          const totalDue = filteredDues.reduce((sum, inst) => sum + parseFloat(inst.due_amount), 0);
          feesDueStr = `₹${totalDue.toLocaleString('en-IN')}`;
        }

        // Query low attendance student count (<75%)
        const { data: lowAttendanceData } = await supabase
          .from('report_cards')
          .select(`
            attendance_percentage,
            enrollments (
              branch_id
            )
          `)
          .eq('academic_year_id', currentAcademicYear.id)
          .lt('attendance_percentage', 75);

        const filteredLowAttendance = (lowAttendanceData || []).filter((rc: any) => {
          return rc.enrollments && rc.enrollments.branch_id === currentBranch.id;
        });
        const lowAttendanceCount = filteredLowAttendance.length;

        // Query upcoming exams count
        const todayDateStr = new Date().toISOString().split('T')[0];
        const { count: examCount } = await supabase
          .from('exams')
          .select('*', { count: 'exact', head: true })
          .eq('branch_id', currentBranch.id)
          .eq('academic_year_id', currentAcademicYear.id)
          .gte('date', todayDateStr);

        setClasses(activeClasses);
        setAlerts([]); // Alerts are empty as there is no alerts table or active alerts seeded in db
        setStats({
          totalStudents: studentCount || 0,
          classesToday: activeClasses.length,
          feesDue: feesDueStr,
          pendingAttendance: activeClasses.filter(c => c.status === 'Completed').length,
          upcomingExams: examCount || 0,
          lowAttendance: lowAttendanceCount
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [currentBranch, currentAcademicYear]);

  // Load Syllabus progress dynamically for selected batch
  useEffect(() => {
    async function loadSyllabusProgress() {
      if (!selectedBatchId) {
        setSyllabusProgress([]);
        return;
      }
      setLoadingSyllabus(true);
      try {
        const { data: bSubjects } = await supabase
          .from('batch_subjects')
          .select('id, subject_name')
          .eq('batch_id', selectedBatchId);

        if (!bSubjects || bSubjects.length === 0) {
          setSyllabusProgress([]);
          return;
        }

        const subjectIds = bSubjects.map(bs => bs.id);

        const { data: chaptersData } = await supabase
          .from('subject_chapters')
          .select('batch_subject_id, chapter_name, status')
          .in('batch_subject_id', subjectIds);

        const progressList = bSubjects.map(sub => {
          const subChapters = (chaptersData || []).filter(c => c.batch_subject_id === sub.id);
          const total = subChapters.length;
          const completedChapters = subChapters.filter(c => c.status === 'Completed').map(c => c.chapter_name);
          const completedCount = completedChapters.length;
          const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;

          return {
            subject: sub.subject_name,
            completed: completedCount,
            total,
            percentage,
            completedList: completedChapters
          };
        });

        setSyllabusProgress(progressList);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSyllabus(false);
      }
    }
    loadSyllabusProgress();
  }, [selectedBatchId]);

  if (loading) {
    return (
      <div className="page-column">
        <div className="skeleton" style={{ height: '40px', width: '200px' }} />
        <div className="grid-stats">
          <div className="skeleton" style={{ height: '100px' }} />
          <div className="skeleton" style={{ height: '100px' }} />
          <div className="skeleton" style={{ height: '100px' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="page-column-32">
      
      {/* 1. Quick Stats Grid */}
      <section className="grid-stats">
        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#EEF2F6', color: 'var(--text-secondary)' }}>
            <Users size={24} />
          </div>
          <div>
            <span className="caption">Total Students</span>
            <p className="stat-value">{stats.totalStudents}</p>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--primary-orange)' }}>
            <Calendar size={24} />
          </div>
          <div>
            <span className="caption">Classes Scheduled</span>
            <p className="stat-value">{stats.classesToday}</p>
          </div>
        </div>

        {!isMentor && (
          <div className="card stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#ECFDF5', color: 'var(--color-success)' }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <span className="caption">Overdue/Pending Fees</span>
              <p className="stat-value">{stats.feesDue}</p>
            </div>
          </div>
        )}

        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#FEF2F2', color: 'var(--color-error)' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <span className="caption">Low Attendance (&lt;75%)</span>
            <p className="stat-value">{stats.lowAttendance}</p>
          </div>
        </div>
      </section>

      {/* 2. Main Dashboard Layout splits */}
      <div className="grid-2col">
        {/* Left Column: Today's Classes */}
        <section className="page-column" style={{ gap: '16px' }}>
          <h3 className="section-title" style={{ margin: 0, fontSize: '18px' }}>Today&apos;s Classes</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {classes.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
                <Clock size={40} style={{ color: 'var(--text-disabled)', marginBottom: '12px' }} />
                <p className="secondary-text">No classes scheduled for today.</p>
              </div>
            ) : (
              classes.map((cls) => (
                <div key={cls.id} className="card class-card" style={{ 
                  borderLeft: cls.status === 'Ongoing' ? '4px solid var(--primary-orange)' : undefined
                }}>
                  <div className="class-card-info">
                    <div className="class-card-title">
                      <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {cls.batch} — {cls.subject}
                      </span>
                      <span className={`badge ${
                        cls.status === 'Completed' ? 'badge-success' : 
                        cls.status === 'Ongoing' ? 'badge-warning' : 
                        cls.status === 'Cancelled' ? 'badge-error' : 'badge-info'
                      }`}>
                        {cls.status}
                      </span>
                    </div>

                    <div className="class-card-meta caption">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={16} />
                        {cls.time}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={16} />
                        {cls.faculty}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={16} />
                        Room {cls.room}
                      </span>
                    </div>
                  </div>

                  <div>
                    <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                      Details
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Right Column: Alerts Panel */}
        <section className="page-column" style={{ gap: '16px' }}>
          <h3 className="section-title" style={{ margin: 0, fontSize: '18px' }}>Active Alerts</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {alerts.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
                <FileWarning size={32} style={{ color: 'var(--text-disabled)', marginBottom: '8px' }} />
                <p className="secondary-text">All systems operating normally.</p>
              </div>
            ) : (
              alerts.map((alert, index) => (
                <div key={index} className="card" style={{ 
                  margin: 0, 
                  backgroundColor: alert.type === 'danger' ? '#FEF2F2' : alert.type === 'warning' ? '#FFFBEB' : '#EFF6FF',
                  borderColor: alert.type === 'danger' ? '#FEE2E2' : alert.type === 'warning' ? '#FEF3C7' : '#DBEAFE',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start'
                }}>
                  <AlertTriangle 
                    size={20} 
                    style={{ 
                      color: alert.type === 'danger' ? 'var(--color-error)' : alert.type === 'warning' ? 'var(--primary-orange)' : 'var(--color-info)',
                      marginTop: '2px',
                      flexShrink: 0
                    }} 
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ 
                      fontWeight: '600', 
                      color: alert.type === 'danger' ? '#991B1B' : alert.type === 'warning' ? '#92400E' : '#1E40AF',
                      fontSize: '14px'
                    }}>
                      {alert.title}
                    </span>
                    <p style={{ 
                      fontSize: '12px', 
                      lineHeight: '16px',
                      color: alert.type === 'danger' ? '#7F1D1D' : alert.type === 'warning' ? '#78350F' : '#1E3A8A'
                    }}>
                      {alert.description}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* 3. Syllabus Tracker graphical progress */}
      <section className="card" style={{ margin: 0, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', margin: 0 }}>Syllabus Completion Tracker</h3>
            <p className="caption" style={{ marginTop: '4px' }}>Visual overview of completed chapters per subject</p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="caption">Select Batch:</span>
            <select
              className="form-control"
              style={{ minHeight: '34px', fontSize: '13px', width: '180px' }}
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
            >
              {batchesList.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        {loadingSyllabus ? (
          <div className="skeleton" style={{ height: '240px', width: '100%' }} />
        ) : syllabusProgress.length === 0 ? (
          <p className="secondary-text" style={{ textAlign: 'center', padding: '32px' }}>
            No subjects or chapters registered for this batch yet.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '32px', flexWrap: 'wrap' }}>
            
            {/* Chart Column */}
            <div style={{ minHeight: '240px' }}>
              <span className="caption" style={{ display: 'block', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completion Rate (%)</span>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={syllabusProgress} layout="vertical" margin={{ left: 20, right: 20, top: 0, bottom: 0 }}>
                  <XAxis type="number" domain={[0, 100]} stroke="var(--text-disabled)" style={{ fontSize: '11px' }} />
                  <YAxis type="category" dataKey="subject" stroke="var(--text-disabled)" style={{ fontSize: '11px' }} />
                  <Tooltip 
                    formatter={(value) => [`${value}%`, 'Completed']} 
                    contentStyle={{ backgroundColor: 'var(--surface-card)', borderColor: 'var(--border-color)', borderRadius: '6px' }}
                  />
                  <Bar dataKey="percentage" radius={[0, 4, 4, 0]} barSize={16}>
                    {syllabusProgress.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.percentage === 100 ? 'var(--color-success)' : 'var(--primary-orange)'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Completed Chapters List Panel */}
            <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <span className="caption" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completed Chapters List</span>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '220px', overflowY: 'auto', paddingRight: '8px' }}>
                {syllabusProgress.map((sub, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13px' }}>{sub.subject}</strong>
                      <span className="caption" style={{ fontWeight: '600' }}>
                        {sub.completed}/{sub.total} Chapters
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                      {sub.completedList.length === 0 ? (
                        <span className="secondary-text" style={{ fontSize: '11px' }}>None completed yet</span>
                      ) : (
                        sub.completedList.map((cName, cIdx) => (
                          <span 
                            key={cIdx} 
                            style={{ 
                              fontSize: '11px', 
                              backgroundColor: '#ECFDF5', 
                              color: 'var(--color-success)', 
                              padding: '2px 8px', 
                              borderRadius: '4px',
                              fontWeight: '500'
                            }}
                          >
                            {cName}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </section>

    </div>
  );
}
