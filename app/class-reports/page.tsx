'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  FileText,
  Calendar,
  Search,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  Users,
  BookOpen,
  Clock,
  User,
  CheckCircle,
  X as XIcon,
  AlertCircle,
  Filter,
  RotateCcw
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { createClient } from '@/utils/supabase/client';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface ClassReport {
  id: string;
  session_id: string;
  batch_id: string;
  subject_name: string;
  faculty_id: string | null;
  faculty_name: string;
  batch_name: string;
  date: string;
  start_time: string;
  end_time: string;
  present_count: number;
  absent_count: number;
  leave_count: number;
  attendance_percentage: number;
  chapter_covered: string;
  homework_title: string | null;
  homework_description: string | null;
  homework_due_date: string | null;
  absentee_list: string[];
  homework_defaulter_list: string[];
  academic_year_id: string;
  branch_id: string;
  created_at: string;
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function ClassReportsPage() {
  const supabase = createClient();
  const { currentBranch, currentAcademicYear } = useAppStore();

  const [reports, setReports] = useState<ClassReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [filterDate, setFilterDate] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [filterFaculty, setFilterFaculty] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Filter options
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [facultyList, setFacultyList] = useState<{ id: string; name: string }[]>([]);

  const printRef = useRef<HTMLDivElement>(null);

  // Load filter options
  useEffect(() => {
    async function loadOptions() {
      if (!currentBranch || !currentAcademicYear) return;
      const { data: batchesData } = await supabase
        .from('batches')
        .select('id, name')
        .eq('branch_id', currentBranch.id)
        .eq('academic_year_id', currentAcademicYear.id)
        .order('name');
      setBatches(batchesData || []);

      const { data: facultyData } = await supabase
        .from('faculty')
        .select('id, name')
        .order('name');
      setFacultyList(facultyData || []);
    }
    loadOptions();
  }, [currentBranch, currentAcademicYear]);

  // Fetch reports
  const loadReports = useCallback(async () => {
    if (!currentBranch || !currentAcademicYear) return;
    setLoading(true);

    try {
      let query = supabase
        .from('daily_class_reports')
        .select('*')
        .eq('branch_id', currentBranch.id)
        .eq('academic_year_id', currentAcademicYear.id)
        .order('date', { ascending: false })
        .order('start_time', { ascending: false })
        .limit(100);

      if (filterDate) {
        query = query.eq('date', filterDate);
      }
      if (filterBatch) {
        query = query.eq('batch_id', filterBatch);
      }
      if (filterFaculty) {
        query = query.eq('faculty_id', filterFaculty);
      }
      if (filterSubject) {
        query = query.eq('subject_name', filterSubject);
      }

      const { data, error } = await query;
      if (error) throw error;

      setReports(data || []);
    } catch (err) {
      console.error('Error loading reports:', err);
    } finally {
      setLoading(false);
    }
  }, [currentBranch, currentAcademicYear, filterDate, filterBatch, filterFaculty, filterSubject]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const clearFilters = () => {
    setFilterDate('');
    setFilterBatch('');
    setFilterFaculty('');
    setFilterSubject('');
  };

  const hasActiveFilters = filterDate || filterBatch || filterFaculty || filterSubject;

  /* ─── Helpers ─────────────────────────────────────────────────────────── */

  const formatTime = (t: string) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hr = parseInt(h);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const formattedHr = hr % 12 || 12;
    return `${formattedHr}:${m} ${ampm}`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const getDayName = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'long' });
  };

  /* ─── PDF Generation ──────────────────────────────────────────────────── */

  const formatDateDDMMYYYY = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  /* ─── PDF Generation ──────────────────────────────────────────────────── */

  const generatePDF = async (report: ClassReport) => {
    const { default: { Document, Page, Text, View, StyleSheet, pdf, Image } } = await import('@react-pdf/renderer');
    const logoUrl = typeof window !== 'undefined' ? window.location.origin + '/logo.png' : '';

    const styles = StyleSheet.create({
      page: { padding: 30, fontFamily: 'Helvetica', fontSize: 10, color: '#000000' },
      logoContainer: { alignItems: 'center', marginBottom: 12 },
      logo: { width: 160, height: 44, objectFit: 'contain' },
      title: { fontSize: 13, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
      
      metadataSection: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap' },
      metadataCol: { width: '48%', gap: 4 },
      metadataRow: { flexDirection: 'row', marginBottom: 2 },
      metadataLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#374151', width: 80 },
      metadataValue: { fontSize: 9, color: '#000000', flex: 1 },

      table: { width: '100%', borderWidth: 1, borderColor: '#000000', marginBottom: 12 },
      tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000000' },
      tableRowLast: { flexDirection: 'row' },
      tableColHeader2: { width: '50%', backgroundColor: '#FFFF00', padding: 8, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#000000' },
      tableColValue2: { width: '50%', backgroundColor: '#FFFF00', padding: 8, justifyContent: 'center', alignItems: 'center' },
      tableColHeader4: { width: '25%', backgroundColor: '#FFFF00', padding: 8, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#000000' },
      tableColValue4: { width: '25%', backgroundColor: '#FFFF00', padding: 8, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#000000' },
      tableColValue4Last: { width: '25%', backgroundColor: '#FFFF00', padding: 8, justifyContent: 'center', alignItems: 'center' },
      
      tableColHeaderBlue: { width: '25%', backgroundColor: '#8DB4E2', padding: 6, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#000000' },
      tableColHeaderBlueLast: { width: '25%', backgroundColor: '#8DB4E2', padding: 6, justifyContent: 'center', alignItems: 'center' },
      
      tableCellContent: { width: '25%', padding: 8, justifyContent: 'flex-start', alignItems: 'stretch', borderRightWidth: 1, borderRightColor: '#000000', minHeight: 80 },
      tableCellContentLast: { width: '25%', padding: 8, justifyContent: 'flex-start', alignItems: 'stretch', minHeight: 80 },
      
      textBold: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#000000', textAlign: 'center' },
      textNormal: { fontSize: 9, color: '#000000', lineHeight: 1.2 },
      textRedBold: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#FF0000', marginBottom: 3 },
      textBlackBold: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#000000', marginBottom: 3 },
      textMuted: { fontSize: 9, color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center' },
      
      footer: { position: 'absolute', bottom: 20, left: 30, right: 30, textAlign: 'center', fontSize: 8, color: '#9CA3AF' }
    });

    const ReportDoc = (
      <Document>
        <Page size="A4" style={styles.page}>
          {/* Logo */}
          {logoUrl ? (
            <View style={styles.logoContainer}>
              <Image src={logoUrl} style={styles.logo} />
            </View>
          ) : null}
          
          <Text style={styles.title}>Daily Class Report</Text>
          
          {/* Faculty / Time Info */}
          <View style={styles.metadataSection}>
            <View style={styles.metadataCol}>
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Faculty</Text>
                <Text style={styles.metadataValue}>{report.faculty_name}</Text>
              </View>
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Time</Text>
                <Text style={styles.metadataValue}>{formatTime(report.start_time)} – {formatTime(report.end_time)}</Text>
              </View>
            </View>
            <View style={styles.metadataCol}>
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Attendance</Text>
                <Text style={styles.metadataValue}>P: {report.present_count} | A: {report.absent_count} | L: {report.leave_count}</Text>
              </View>
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Percentage</Text>
                <Text style={styles.metadataValue}>{report.attendance_percentage}%</Text>
              </View>
            </View>
          </View>

          {/* Yellow/Blue Table */}
          <View style={styles.table}>
            {/* Row 1 */}
            <View style={styles.tableRow}>
              <View style={styles.tableColHeader2}>
                <Text style={styles.textBold}>Date</Text>
              </View>
              <View style={styles.tableColValue2}>
                <Text style={styles.textBold}>{formatDateDDMMYYYY(report.date)}</Text>
              </View>
            </View>
            
            {/* Row 2 */}
            <View style={styles.tableRow}>
              <View style={styles.tableColHeader4}>
                <Text style={styles.textBold}>Class</Text>
              </View>
              <View style={styles.tableColValue4}>
                <Text style={styles.textBold}>{report.batch_name}</Text>
              </View>
              <View style={styles.tableColHeader4}>
                <Text style={styles.textBold}>Subject</Text>
              </View>
              <View style={styles.tableColValue4Last}>
                <Text style={styles.textBold}>{report.subject_name}</Text>
              </View>
            </View>
            
            {/* Row 3 */}
            <View style={styles.tableRow}>
              <View style={styles.tableColHeaderBlue}>
                <Text style={styles.textBold}>Absentee List</Text>
              </View>
              <View style={styles.tableColHeaderBlue}>
                <Text style={styles.textBold}>Homework Defaulters</Text>
              </View>
              <View style={styles.tableColHeaderBlue}>
                <Text style={styles.textBold}>Chapter Name</Text>
              </View>
              <View style={styles.tableColHeaderBlueLast}>
                <Text style={styles.textBold}>HW</Text>
              </View>
            </View>
            
            {/* Row 4 */}
            <View style={styles.tableRowLast}>
              {/* Absentee Column */}
              <View style={styles.tableCellContent}>
                {report.absentee_list && report.absentee_list.length > 0 ? (
                  report.absentee_list.map((name: string, idx: number) => (
                    <Text key={idx} style={styles.textRedBold}>{name}</Text>
                  ))
                ) : (
                  <Text style={styles.textMuted}>None</Text>
                )}
              </View>
              
              {/* Defaulter Column */}
              <View style={styles.tableCellContent}>
                {report.homework_defaulter_list && report.homework_defaulter_list.length > 0 ? (
                  report.homework_defaulter_list.map((name: string, idx: number) => (
                    <Text key={idx} style={styles.textNormal}>{name}</Text>
                  ))
                ) : (
                  <Text style={styles.textNormal}>NULL</Text>
                )}
              </View>
              
              {/* Chapter Column */}
              <View style={styles.tableCellContent}>
                <Text style={styles.textNormal}>{report.chapter_covered}</Text>
              </View>
              
              {/* Homework Column */}
              <View style={styles.tableCellContentLast}>
                {report.homework_title ? (
                  <View>
                    <Text style={styles.textBlackBold}>{report.homework_title}</Text>
                    {report.homework_description && (
                      <Text style={[styles.textNormal, { marginBottom: 4 }]}>{report.homework_description}</Text>
                    )}
                    {report.homework_due_date && (
                      <Text style={[styles.textNormal, { fontFamily: 'Helvetica-Bold', color: '#1D4ED8' }]}>Due: {formatDateDDMMYYYY(report.homework_due_date)}</Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.textNormal}>Not Assigned</Text>
                )}
              </View>
            </View>
          </View>
          
          <Text style={styles.footer}>
            Generated by Shiksharthi OS • {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </Page>
      </Document>
    );

    const blob = await pdf(ReportDoc).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Class_Report_${report.batch_name}_${report.subject_name}_${report.date}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ─── Print ───────────────────────────────────────────────────────────── */

  const handlePrint = (report: ClassReport) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const absenteesHtml = report.absentee_list && report.absentee_list.length > 0 
      ? report.absentee_list.map((name: string) => `<div style="color: red; font-weight: bold; margin-bottom: 4px;">${name}</div>`).join('')
      : '<div style="color: #9CA3AF; font-style: italic; text-align: center;">None</div>';

    const defaultersHtml = report.homework_defaulter_list && report.homework_defaulter_list.length > 0
      ? report.homework_defaulter_list.map((name: string) => `<div style="margin-bottom: 4px; font-weight: 500;">${name}</div>`).join('')
      : '<span style="font-weight: 500;">NULL</span>';

    const hwHtml = report.homework_title 
      ? `<div>
          <div style="font-weight: bold; margin-bottom: 4px;">${report.homework_title}</div>
          ${report.homework_description ? `<div style="font-size: 12px; color: #374151; white-space: pre-line; margin-bottom: 6px;">${report.homework_description}</div>` : ''}
          ${report.homework_due_date ? `<div style="font-size: 11px; font-weight: bold; color: #1D4ED8;">Due Date: ${formatDateDDMMYYYY(report.homework_due_date)}</div>` : ''}
         </div>`
      : '<div style="text-align: center; font-weight: 500;">Not Assigned</div>';
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Class Report - ${report.batch_name} ${report.subject_name} ${report.date}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          body { font-family: 'Inter', sans-serif; padding: 40px; color: #1F2937; max-width: 800px; margin: 0 auto; }
          .logo-container { text-align: center; margin-bottom: 16px; }
          .logo-container img { max-height: 55px; object-fit: contain; }
          h2 { text-align: center; font-size: 16px; font-weight: 700; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 0.5px; }
          
          .meta-section { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }
          .meta-col { display: flex; flex-direction: column; gap: 4px; }
          .meta-row { display: flex; }
          .meta-label { font-weight: 700; color: #374151; width: 100px; }
          .meta-value { color: #1F2937; }

          table { width: 100%; border-collapse: collapse; border: 1px solid #000; margin: 20px 0; }
          tr { border-bottom: 1px solid #000; }
          th, td { border-right: 1px solid #000; padding: 10px; font-size: 13px; }
          th:last-child, td:last-child { border-right: none; }
          
          .bg-yellow { backgroundColor: #FFFF00; background-color: #FFFF00; }
          .bg-blue { backgroundColor: #8DB4E2; background-color: #8DB4E2; }
          
          .text-bold { font-weight: bold; }
          .text-center { text-align: center; }
          
          .footer { text-align: center; font-size: 10px; color: #9CA3AF; margin-top: 40px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="logo-container">
          <img src="/logo.png" alt="Shiksharthi Logo" />
        </div>
        <h2>Daily Class Report</h2>
        
        <div class="meta-section">
          <div class="meta-col">
            <div class="meta-row"><span class="meta-label">Faculty</span><span class="meta-value">${report.faculty_name}</span></div>
            <div class="meta-row"><span class="meta-label">Time</span><span class="meta-value">${formatTime(report.start_time)} – ${formatTime(report.end_time)}</span></div>
          </div>
          <div class="meta-col">
            <div class="meta-row"><span class="meta-label">Attendance</span><span class="meta-value">P: ${report.present_count} | A: ${report.absent_count} | L: ${report.leave_count}</span></div>
            <div class="meta-row"><span class="meta-label">Percentage</span><span class="meta-value">${report.attendance_percentage}%</span></div>
          </div>
        </div>

        <table>
          <tr class="bg-yellow">
            <th colspan="2" class="text-bold text-center">Date</th>
            <th colspan="2" class="text-bold text-center">${formatDateDDMMYYYY(report.date)}</th>
          </tr>
          <tr class="bg-yellow">
            <th class="text-bold text-center" style="width: 25%;">Class</th>
            <td class="text-bold text-center" style="width: 25%;">${report.batch_name}</td>
            <th class="text-bold text-center" style="width: 25%;">Subject</th>
            <td class="text-bold text-center" style="width: 25%;">${report.subject_name}</td>
          </tr>
          <tr class="bg-blue">
            <th class="text-bold text-center">Absentee List</th>
            <th class="text-bold text-center">Homework Defaulters</th>
            <th class="text-bold text-center">Chapter Name</th>
            <th class="text-bold text-center">HW</th>
          </tr>
          <tr>
            <td style="vertical-align: top;">${absenteesHtml}</td>
            <td style="vertical-align: top; text-align: ${report.homework_defaulter_list && report.homework_defaulter_list.length > 0 ? 'left' : 'center'};">${defaultersHtml}</td>
            <td style="vertical-align: top; text-align: center; font-weight: 500;">${report.chapter_covered}</td>
            <td style="vertical-align: top;">${hwHtml}</td>
          </tr>
        </table>

        <div class="footer">Generated by Shiksharthi OS</div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  /* ─── Render ──────────────────────────────────────────────────────────── */

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header + Filters */}
      <div className="card" style={{ margin: 0, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={20} style={{ color: 'var(--primary-orange)' }} />
            <h3 style={{ fontSize: '16px' }}>Daily Class Reports</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500', padding: '2px 10px', borderRadius: '100px', backgroundColor: 'var(--surface-secondary)' }}>
              {reports.length} report{reports.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {hasActiveFilters && (
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 12px', minHeight: '36px', fontSize: '12px', gap: '4px' }}
                onClick={clearFilters}
              >
                <RotateCcw size={12} /> Clear
              </button>
            )}
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 12px', minHeight: '36px', fontSize: '12px', gap: '4px' }}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={12} />
              Filters
              {hasActiveFilters && (
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-orange)' }} />
              )}
            </button>
          </div>
        </div>

        {showFilters && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', padding: '12px 0 0', borderTop: '1px solid var(--border-color)' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '11px' }}>Date</label>
              <input type="date" className="form-control" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '11px' }}>Batch</label>
              <select className="form-control" value={filterBatch} onChange={e => setFilterBatch(e.target.value)}>
                <option value="">All Batches</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '11px' }}>Faculty</label>
              <select className="form-control" value={filterFaculty} onChange={e => setFilterFaculty(e.target.value)}>
                <option value="">All Faculty</option>
                {facultyList.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '11px' }}>Subject</label>
              <select className="form-control" value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
                <option value="">All Subjects</option>
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Biology">Biology</option>
                <option value="Computer Science">Computer Science</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Reports List */}
      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
          Loading reports...
        </div>
      ) : reports.length === 0 ? (
        <div className="card" style={{ margin: 0, padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <FileText size={40} style={{ color: 'var(--text-secondary)', opacity: 0.3 }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>No class reports found</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
            {hasActiveFilters ? 'Try adjusting your filters.' : 'Reports are generated automatically when a class is completed.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {reports.map(report => {
            const isExpanded = expandedId === report.id;
            const totalStudents = report.present_count + report.absent_count + report.leave_count;
            const attPct = report.attendance_percentage;

            return (
              <div key={report.id} className="card" style={{ margin: 0, overflow: 'hidden', transition: 'all 0.2s' }}>
                {/* Collapsed Summary Row */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : report.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    width: '100%',
                    padding: '16px 20px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  {/* Date Badge */}
                  <div style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--surface-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--primary-orange)', lineHeight: '1.1' }}>
                      {new Date(report.date + 'T00:00:00').getDate()}
                    </span>
                    <span style={{ fontSize: '9px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      {new Date(report.date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short' })}
                    </span>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '100px', backgroundColor: '#E2E8F0', color: 'var(--text-primary)' }}>
                        {report.batch_name}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {report.subject_name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={10} />{formatTime(report.start_time)} – {formatTime(report.end_time)}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <User size={10} />{report.faculty_name}
                      </span>
                    </div>
                  </div>

                  {/* Attendance Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <div style={{ width: '80px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: attPct >= 75 ? '#065F46' : attPct >= 50 ? '#92400E' : '#DC2626' }}>
                          {attPct}%
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{report.present_count}/{totalStudents}</span>
                      </div>
                      <div style={{ height: '4px', borderRadius: '2px', backgroundColor: '#E5E7EB', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${attPct}%`,
                          borderRadius: '2px',
                          backgroundColor: attPct >= 75 ? '#10B981' : attPct >= 50 ? '#F59E0B' : '#EF4444',
                          transition: 'width 0.3s'
                        }} />
                      </div>
                    </div>

                    {/* Homework indicator */}
                    {report.homework_title ? (
                      <span style={{ fontSize: '9px', fontWeight: '600', padding: '2px 6px', borderRadius: '100px', backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>HW</span>
                    ) : (
                      <span style={{ fontSize: '9px', fontWeight: '600', padding: '2px 6px', borderRadius: '100px', backgroundColor: '#F3F4F6', color: '#9CA3AF' }}>—</span>
                    )}

                    {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />}
                  </div>
                </button>

                {/* Expanded Report Detail */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.2s ease' }}>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '6px 14px', minHeight: '36px', fontSize: '12px', gap: '6px' }}
                        onClick={() => generatePDF(report)}
                      >
                        <Download size={14} /> Download PDF
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '6px 14px', minHeight: '36px', fontSize: '12px', gap: '6px' }}
                        onClick={() => handlePrint(report)}
                      >
                        <Printer size={14} /> Print
                      </button>
                    </div>

                    {/* Full Report Content */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Logo Centered */}
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0 0' }}>
                        <img 
                          src="/logo.png" 
                          alt="Shiksharthi Logo" 
                          style={{ maxHeight: '52px', objectFit: 'contain' }} 
                        />
                      </div>
                      
                      <h4 style={{ textAlign: 'center', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '0.05em' }}>Daily Class Report</h4>

                      {/* Class Info Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', padding: '16px', backgroundColor: '#F8FAFC', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Faculty</span>
                          <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginTop: '2px' }}>{report.faculty_name}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Time</span>
                          <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginTop: '2px' }}>{formatTime(report.start_time)} – {formatTime(report.end_time)}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Attendance Breakdown</span>
                          <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginTop: '2px' }}>P: {report.present_count} | A: {report.absent_count} | L: {report.leave_count}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Attendance %</span>
                          <p style={{ fontSize: '14px', fontWeight: '700', color: attPct >= 75 ? '#10B981' : attPct >= 50 ? '#F59E0B' : '#EF4444', marginTop: '2px' }}>{attPct}%</p>
                        </div>
                      </div>

                      {/* Yellow/Blue Grid Table */}
                      <div style={{ overflowX: 'auto', border: '1px solid #000', borderRadius: '4px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'sans-serif' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #000' }}>
                              <th colSpan={2} style={{ backgroundColor: '#FFFF00', borderRight: '1px solid #000', padding: '12px', fontWeight: 'bold', fontSize: '14px', color: '#000', textAlign: 'center' }}>Date</th>
                              <th colSpan={2} style={{ backgroundColor: '#FFFF00', padding: '12px', fontWeight: 'bold', fontSize: '14px', color: '#000', textAlign: 'center' }}>{formatDateDDMMYYYY(report.date)}</th>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #000' }}>
                              <th style={{ backgroundColor: '#FFFF00', borderRight: '1px solid #000', padding: '10px', fontWeight: 'bold', fontSize: '13px', color: '#000', textAlign: 'center', width: '25%' }}>Class</th>
                              <td style={{ backgroundColor: '#FFFF00', borderRight: '1px solid #000', padding: '10px', fontSize: '13px', color: '#000', textAlign: 'center', width: '25%', fontWeight: 'bold' }}>{report.batch_name}</td>
                              <th style={{ backgroundColor: '#FFFF00', borderRight: '1px solid #000', padding: '10px', fontWeight: 'bold', fontSize: '13px', color: '#000', textAlign: 'center', width: '25%' }}>Subject</th>
                              <td style={{ backgroundColor: '#FFFF00', padding: '10px', fontSize: '13px', color: '#000', textAlign: 'center', width: '25%', fontWeight: 'bold' }}>{report.subject_name}</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #000' }}>
                              <th style={{ backgroundColor: '#8DB4E2', borderRight: '1px solid #000', padding: '10px', fontWeight: 'bold', fontSize: '13px', color: '#000', textAlign: 'center', width: '25%' }}>Absentee List</th>
                              <th style={{ backgroundColor: '#8DB4E2', borderRight: '1px solid #000', padding: '10px', fontWeight: 'bold', fontSize: '13px', color: '#000', textAlign: 'center', width: '25%' }}>Homework Defaulters</th>
                              <th style={{ backgroundColor: '#8DB4E2', borderRight: '1px solid #000', padding: '10px', fontWeight: 'bold', fontSize: '13px', color: '#000', textAlign: 'center', width: '25%' }}>Chapter Name</th>
                              <th style={{ backgroundColor: '#8DB4E2', padding: '10px', fontWeight: 'bold', fontSize: '13px', color: '#000', textAlign: 'center', width: '25%' }}>HW</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ backgroundColor: '#FFFFFF' }}>
                              <td style={{ borderRight: '1px solid #000', padding: '12px', fontSize: '13px', verticalAlign: 'top', minHeight: '80px', color: '#000' }}>
                                {report.absentee_list && report.absentee_list.length > 0 ? (
                                  report.absentee_list.map((name, idx) => (
                                    <div key={idx} style={{ color: '#EF4444', fontWeight: 'bold', marginBottom: '4px' }}>{name}</div>
                                  ))
                                ) : (
                                  <div style={{ color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center' }}>None</div>
                                )}
                              </td>
                              <td style={{ borderRight: '1px solid #000', padding: '12px', fontSize: '13px', verticalAlign: 'top', color: '#000', textAlign: report.homework_defaulter_list && report.homework_defaulter_list.length > 0 ? 'left' : 'center' }}>
                                {report.homework_defaulter_list && report.homework_defaulter_list.length > 0 ? (
                                  report.homework_defaulter_list.map((name, idx) => (
                                    <div key={idx} style={{ fontWeight: '500', marginBottom: '4px' }}>{name}</div>
                                  ))
                                ) : (
                                  <span style={{ fontWeight: '500' }}>NULL</span>
                                )}
                              </td>
                              <td style={{ borderRight: '1px solid #000', padding: '12px', fontSize: '13px', verticalAlign: 'top', textAlign: 'center', color: '#000', fontWeight: '500' }}>
                                {report.chapter_covered}
                              </td>
                              <td style={{ padding: '12px', fontSize: '13px', verticalAlign: 'top', color: '#000' }}>
                                {report.homework_title ? (
                                  <div>
                                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{report.homework_title}</div>
                                    {report.homework_description && (
                                      <div style={{ fontSize: '12px', color: '#4B5563', whiteSpace: 'pre-line', marginBottom: '6px' }}>{report.homework_description}</div>
                                    )}
                                    {report.homework_due_date && (
                                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#1D4ED8' }}>Due Date: {formatDateDDMMYYYY(report.homework_due_date)}</div>
                                    )}
                                  </div>
                                ) : (
                                  <div style={{ textAlign: 'center', fontWeight: '500' }}>Not Assigned</div>
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
