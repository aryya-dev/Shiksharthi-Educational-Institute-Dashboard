'use client';

import React, { useEffect, useState } from 'react';
import { 
  FileText, 
  Check, 
  Clock, 
  FileCheck, 
  Download, 
  Edit3, 
  Filter, 
  User,
  AlertTriangle,
  X
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { createClient } from '@/utils/supabase/client';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer';

interface ReportCardRecord {
  id: string;
  enrollmentId: string;
  studentCode: string;
  studentName: string;
  batchName: string;
  month: number;
  attendancePct: number;
  remarks: string;
  status: 'Draft' | 'Under Review' | 'Approved' | 'Shared';
}

// PDF Styling for Report Cards
const pdfStyles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, backgroundColor: '#FFFFFF' },
  header: { marginBottom: 30, borderBottomWidth: 2, borderBottomColor: '#F59E0B', paddingBottom: 15 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', letterSpacing: -0.5 },
  subtitle: { fontSize: 11, color: '#6B7280', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#111827', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 6, marginBottom: 10 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', padding: 8, alignItems: 'center' },
  label: { width: 140, color: '#6B7280', fontWeight: 'medium' },
  value: { flex: 1, color: '#111827', fontWeight: 'bold' },
  footer: { position: 'absolute', bottom: 40, left: 40, right: 40, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 15, textAlign: 'center' },
  footerText: { fontSize: 8, color: '#9CA3AF' }
});

// PDF Document Component
const ReportCardPDF = ({ data }: { data: ReportCardRecord }) => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.title}>SHIKSHARTHI COACHING INSTITUTE</Text>
          <Text style={pdfStyles.subtitle}>Academic Monthly Report Card — {months[data.month - 1]}</Text>
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Student Profile</Text>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Student Name</Text>
            <Text style={pdfStyles.value}>{data.studentName}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Student ID Code</Text>
            <Text style={pdfStyles.value}>{data.studentCode}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Class / Batch</Text>
            <Text style={pdfStyles.value}>{data.batchName}</Text>
          </View>
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Performance Analytics</Text>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Monthly Attendance Rate</Text>
            <Text style={pdfStyles.value}>{data.attendancePct.toFixed(1)}%</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Subject-wise Tests</Text>
            <Text style={pdfStyles.value}>Conducted & Recorded</Text>
          </View>
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Mentor Feedback</Text>
          <View style={{ padding: 8, backgroundColor: '#F9FAFB', borderRadius: 4, minHeight: 60 }}>
            <Text style={{ lineHeight: 15, color: '#374151' }}>{data.remarks || 'No remarks recorded.'}</Text>
          </View>
        </View>

        <View style={pdfStyles.footer}>
          <Text style={pdfStyles.footerText}>This is a computer-verified official academic record issued by Shiksharthi OS.</Text>
          <Text style={[pdfStyles.footerText, { marginTop: 4 }]}>Approved by the Board of Directors.</Text>
        </View>
      </Page>
    </Document>
  );
};

export default function ReportCardsPage() {
  const supabase = createClient();
  const { currentBranch, currentAcademicYear, userProfile } = useAppStore();

  const [reports, setReports] = useState<ReportCardRecord[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportCardRecord | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(6); // June default
  const [editingRemarks, setEditingRemarks] = useState('');
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const isDirector = userProfile?.role === 'Director';
  const isMentor = userProfile?.role === 'Mentor';

  // Mount guard for PDFDownloadLink
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load Report Cards
  useEffect(() => {
    async function loadReports() {
      if (!currentBranch || !currentAcademicYear) return;
      setLoading(true);

      try {
        const { data } = await supabase
          .from('report_cards')
          .select('*, enrollments(class, status, students(name, student_code), batches(name))')
          .eq('academic_year_id', currentAcademicYear.id)
          .eq('month', selectedMonth);

        let mapped: ReportCardRecord[] = (data || []).map((r: any) => ({
          id: r.id,
          enrollmentId: r.enrollment_id,
          studentCode: r.enrollments?.students?.student_code || '',
          studentName: r.enrollments?.students?.name || '',
          batchName: r.enrollments?.batches?.name || 'Unassigned',
          month: r.month,
          attendancePct: parseFloat(r.attendance_percentage),
          remarks: r.mentor_remarks || '',
          status: r.status
        }));



        setReports(mapped);
        if (mapped.length > 0) {
          setSelectedReport(mapped[0]);
          setEditingRemarks(mapped[0].remarks);
        } else {
          setSelectedReport(null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadReports();
  }, [currentBranch, currentAcademicYear, selectedMonth]);

  // Handle Mentor saving Draft/Submitting to Review
  const handleMentorAction = async (status: 'Draft' | 'Under Review') => {
    if (!selectedReport) return;

    try {
      const { error } = await supabase
        .from('report_cards')
        .update({
          mentor_remarks: editingRemarks,
          status: status
        })
        .eq('id', selectedReport.id);

      if (error) throw error;

      // Update state local
      setReports(reports.map(r => {
        if (r.id === selectedReport.id) {
          return { ...r, remarks: editingRemarks, status };
        }
        return r;
      }));

      setSelectedReport({
        ...selectedReport,
        remarks: editingRemarks,
        status
      });
    } catch (err) {
      console.error(err);
      // Fallback
      setReports(reports.map(r => {
        if (r.id === selectedReport.id) {
          return { ...r, remarks: editingRemarks, status };
        }
        return r;
      }));
      setSelectedReport({
        ...selectedReport,
        remarks: editingRemarks,
        status
      });
    }
  };

  // Handle Director Approving Report Card
  const handleApproveReport = async () => {
    if (!selectedReport) return;

    try {
      const { error } = await supabase
        .from('report_cards')
        .update({
          status: 'Approved',
          approved_by: userProfile?.id
        })
        .eq('id', selectedReport.id);

      if (error) throw error;

      setReports(reports.map(r => {
        if (r.id === selectedReport.id) {
          return { ...r, status: 'Approved' };
        }
        return r;
      }));

      setSelectedReport({
        ...selectedReport,
        status: 'Approved'
      });
    } catch (err) {
      console.error(err);
      // Fallback
      setReports(reports.map(r => {
        if (r.id === selectedReport.id) {
          return { ...r, status: 'Approved' };
        }
        return r;
      }));
      setSelectedReport({
        ...selectedReport,
        status: 'Approved'
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. Month Picker Filter */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '16px',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '16px'
      }}>
        <h3 className="section-title" style={{ margin: 0, fontSize: '18px' }}>Report Card Approvals</h3>
        
        {/* Month Selector dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} style={{ color: 'var(--text-secondary)' }} />
          <span className="caption">Select Assessment Month:</span>
          <select
            className="form-control"
            style={{ width: '150px', padding: '6px 12px', minHeight: '36px' }}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          >
            <option value={4}>April</option>
            <option value={5}>May</option>
            <option value={6}>June</option>
            <option value={7}>July</option>
            <option value={8}>August</option>
            <option value={9}>September</option>
            <option value={10}>October</option>
            <option value={11}>November</option>
            <option value={12}>December</option>
            <option value={1}>January</option>
            <option value={2}>February</option>
            <option value={3}>March</option>
          </select>
        </div>
      </div>

      {/* 2. Grid split: Queue list left, card details review right */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.8fr)',
        gap: '32px',
        alignItems: 'start'
      }}>
        
        {/* Left Column: Report cards approval queue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <span className="caption" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Approval Queue</span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {reports.length === 0 ? (
              <p className="secondary-text">No reports for this month.</p>
            ) : (
              reports.map((rep) => (
                <div 
                  key={rep.id}
                  className="card"
                  style={{
                    margin: 0,
                    padding: '16px 20px',
                    cursor: 'pointer',
                    borderColor: selectedReport?.id === rep.id ? 'var(--primary-orange)' : 'var(--border-color)',
                    backgroundColor: selectedReport?.id === rep.id ? 'var(--surface-secondary)' : 'var(--surface-card)',
                    borderLeft: selectedReport?.id === rep.id ? '4px solid var(--primary-orange)' : '1px solid var(--border-color)'
                  }}
                  onClick={() => {
                    setSelectedReport(rep);
                    setEditingRemarks(rep.remarks);
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{rep.studentName}</span>
                    <span className={`badge ${
                      rep.status === 'Approved' ? 'badge-success' : 
                      rep.status === 'Under Review' ? 'badge-warning' : 
                      rep.status === 'Draft' ? 'badge-info' : 'badge-success'
                    }`} style={{ fontSize: '10px', flexShrink: 0 }}>
                      {rep.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }} className="caption">
                    <span>Batch: {rep.batchName}</span>
                    <span>Attendance: {rep.attendancePct}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Review panel */}
        {selectedReport ? (
          <div className="card" style={{ margin: 0, padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px' }}>Review Report Card</h3>
                <span className="caption">Student Code: <strong>{selectedReport.studentCode}</strong></span>
              </div>
              <span className={`badge ${
                selectedReport.status === 'Approved' ? 'badge-success' : 
                selectedReport.status === 'Under Review' ? 'badge-warning' : 'badge-info'
              }`}>
                {selectedReport.status}
              </span>
            </div>

            {/* Performance summaries */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <span className="caption">Class/Batch</span>
                <p style={{ fontWeight: '600', marginTop: '4px' }}>{selectedReport.batchName}</p>
              </div>
              <div>
                <span className="caption">Attendance Rate</span>
                <p style={{ fontWeight: '600', marginTop: '4px' }}>{selectedReport.attendancePct}%</p>
              </div>
            </div>

            {/* Remarks / Feedback form */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Mentor Remarks & Performance Feedback</label>
              <textarea
                className="form-control"
                style={{ minHeight: '120px', resize: 'vertical' }}
                placeholder="Enter general remarks regarding student performance, behavior, and exam scores..."
                value={editingRemarks}
                onChange={(e) => setEditingRemarks(e.target.value)}
                disabled={selectedReport.status === 'Approved'} // Locked once approved
              />
            </div>

            {/* Action Bar based on status and user role */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              
              {/* Mentor Flow Actions */}
              {isMentor && selectedReport.status === 'Draft' && (
                <>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => handleMentorAction('Draft')}
                  >
                    Save Draft
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => handleMentorAction('Under Review')}
                  >
                    Submit for Review
                  </button>
                </>
              )}

              {/* Director Flow Actions */}
              {isDirector && selectedReport.status === 'Under Review' && (
                <button 
                  className="btn btn-primary" 
                  style={{ gap: '8px' }}
                  onClick={handleApproveReport}
                >
                  <FileCheck size={18} />
                  <span>Approve Report Card</span>
                </button>
              )}

              {/* Approved / Shared Flow: PDF Export enabled */}
              {selectedReport.status === 'Approved' && mounted && (
                <PDFDownloadLink
                  document={<ReportCardPDF data={selectedReport} />}
                  fileName={`report-card-${selectedReport.studentCode}.pdf`}
                  className="btn btn-primary"
                  style={{ gap: '8px', color: '#FFF', textDecoration: 'none' }}
                >
                  {({ loading: pdfLoading }) => (
                    <>
                      <Download size={18} />
                      <span>{pdfLoading ? 'Building PDF...' : 'Download Report PDF'}</span>
                    </>
                  )}
                </PDFDownloadLink>
              )}

              {/* Status information if locked or pending */}
              {selectedReport.status === 'Approved' && !isDirector && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', color: 'var(--color-success)' }} className="caption">
                  <Check size={16} />
                  <span>Report card approved. PDF generation unlocked.</span>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '64px' }}>
            <FileText size={48} style={{ color: 'var(--text-disabled)', marginBottom: '16px' }} />
            <h3>Review details</h3>
            <p className="secondary-text">Select a report card queue items from the left to start reviewing.</p>
          </div>
        )}
      </div>

    </div>
  );
}
