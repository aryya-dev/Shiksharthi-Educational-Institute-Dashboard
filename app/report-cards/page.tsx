'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  FileText,
  Search,
  Printer,
  Download,
  Award,
  TrendingUp,
  Users,
  CheckSquare,
  Square,
  Sparkles,
  ChevronRight,
  AlertCircle,
  Medal,
  Layers,
  Calendar,
  BookOpen,
  RefreshCw,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { createClient } from '@/utils/supabase/client';

/* ─── Interfaces ─────────────────────────────────────────────────────────── */

interface BatchItem {
  id: string;
  name: string;
  class: string;
}

interface ExamItem {
  id: string;
  name: string;
  type: string;
  subject_name: string;
  date: string;
  max_marks: number;
  chapters_covered?: string;
}

interface StudentExamResult {
  examId: string;
  examName: string;
  subjectName: string;
  maxMarks: number;
  marksObtained: number | null; // null = missing/not recorded, -1 = absent, >= 0 = score
  percentage: number | null;
}

interface StudentConsolidatedRow {
  enrollmentId: string;
  studentCode: string;
  studentName: string;
  examResults: { [examId: string]: StudentExamResult };
  totalMarksObtained: number;
  totalMaxMarks: number;
  overallPercentage: number;
  absentCount: number;
  rank: number;
}

interface SavedReportCard {
  id: string;
  batchId: string;
  batchName: string;
  title: string;
  monthYear: string;
  dateSaved: string;
  exams: ExamItem[];
  rows: StudentConsolidatedRow[];
  metrics: {
    totalStudents: number;
    classAvg: number;
    topScorerName: string;
    totalAbsentees: number;
    examsCount: number;
  };
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function ReportCardsPage() {
  const supabase = createClient();
  const { currentBranch, currentAcademicYear } = useAppStore();

  // Navigation Tab
  const [activeTab, setActiveTab] = useState<'generate' | 'saved'>('generate');

  // Saved Reports State
  const [savedReports, setSavedReports] = useState<SavedReportCard[]>([]);

  // Batches & Exams State
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [availableExams, setAvailableExams] = useState<ExamItem[]>([]);
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const [reportTitle, setReportTitle] = useState<string>('');

  // UI State
  const [loadingExams, setLoadingExams] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<{
    batchName: string;
    title: string;
    dateGenerated: string;
    exams: ExamItem[];
    rows: StudentConsolidatedRow[];
  } | null>(null);

  // Search & Filter State inside generated report
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'top3' | 'absentees'>('all');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Load saved report cards from localStorage (with initial samples if empty)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('shiksharthi_saved_report_cards');
      if (stored) {
        setSavedReports(JSON.parse(stored));
      } else {
        const defaultSaved: SavedReportCard[] = [
          {
            id: 'saved_11_jee',
            batchId: 'mock_1',
            batchName: '11 JEE',
            title: '11 JEE Report Card — July 2026',
            monthYear: 'July 2026',
            dateSaved: '31 Jul 2026',
            exams: [
              { id: 'e1', name: 'Physics Test 1', type: 'Subject Test', subject_name: 'Physics', date: '2026-07-10', max_marks: 100 },
              { id: 'e2', name: 'Chemistry Test 1', type: 'Subject Test', subject_name: 'Chemistry', date: '2026-07-18', max_marks: 100 },
              { id: 'e3', name: 'Maths Test 1', type: 'Subject Test', subject_name: 'Mathematics', date: '2026-07-25', max_marks: 100 }
            ],
            rows: [
              { enrollmentId: 's1', studentCode: 'JEE-101', studentName: 'Aarav Sharma', totalMarksObtained: 275, totalMaxMarks: 300, overallPercentage: 91.7, absentCount: 0, rank: 1, examResults: { e1: { examId: 'e1', examName: 'Physics Test 1', subjectName: 'Physics', maxMarks: 100, marksObtained: 92, percentage: 92 }, e2: { examId: 'e2', examName: 'Chemistry Test 1', subjectName: 'Chemistry', maxMarks: 100, marksObtained: 90, percentage: 90 }, e3: { examId: 'e3', examName: 'Maths Test 1', subjectName: 'Mathematics', maxMarks: 100, marksObtained: 93, percentage: 93 } } },
              { enrollmentId: 's2', studentCode: 'JEE-102', studentName: 'Ananya Verma', totalMarksObtained: 252, totalMaxMarks: 300, overallPercentage: 84.0, absentCount: 0, rank: 2, examResults: { e1: { examId: 'e1', examName: 'Physics Test 1', subjectName: 'Physics', maxMarks: 100, marksObtained: 85, percentage: 85 }, e2: { examId: 'e2', examName: 'Chemistry Test 1', subjectName: 'Chemistry', maxMarks: 100, marksObtained: 82, percentage: 82 }, e3: { examId: 'e3', examName: 'Maths Test 1', subjectName: 'Mathematics', maxMarks: 100, marksObtained: 85, percentage: 85 } } },
              { enrollmentId: 's3', studentCode: 'JEE-103', studentName: 'Rohan Gupta', totalMarksObtained: 231, totalMaxMarks: 300, overallPercentage: 77.0, absentCount: 0, rank: 3, examResults: { e1: { examId: 'e1', examName: 'Physics Test 1', subjectName: 'Physics', maxMarks: 100, marksObtained: 78, percentage: 78 }, e2: { examId: 'e2', examName: 'Chemistry Test 1', subjectName: 'Chemistry', maxMarks: 100, marksObtained: 75, percentage: 75 }, e3: { examId: 'e3', examName: 'Maths Test 1', subjectName: 'Mathematics', maxMarks: 100, marksObtained: 78, percentage: 78 } } }
            ],
            metrics: { totalStudents: 3, classAvg: 84.2, topScorerName: 'Aarav Sharma', totalAbsentees: 0, examsCount: 3 }
          },
          {
            id: 'saved_11_neet',
            batchId: 'mock_2',
            batchName: '11 NEET',
            title: '11 NEET Report Card — July 2026',
            monthYear: 'July 2026',
            dateSaved: '31 Jul 2026',
            exams: [
              { id: 'n1', name: 'Biology Test 1', type: 'Subject Test', subject_name: 'Biology', date: '2026-07-12', max_marks: 100 },
              { id: 'n2', name: 'Chemistry Test 1', type: 'Subject Test', subject_name: 'Chemistry', date: '2026-07-20', max_marks: 100 }
            ],
            rows: [
              { enrollmentId: 's4', studentCode: 'NEET-201', studentName: 'Diya Patel', totalMarksObtained: 188, totalMaxMarks: 200, overallPercentage: 94.0, absentCount: 0, rank: 1, examResults: { n1: { examId: 'n1', examName: 'Biology Test 1', subjectName: 'Biology', maxMarks: 100, marksObtained: 96, percentage: 96 }, n2: { examId: 'n2', examName: 'Chemistry Test 1', subjectName: 'Chemistry', maxMarks: 100, marksObtained: 92, percentage: 92 } } },
              { enrollmentId: 's5', studentCode: 'NEET-202', studentName: 'Ishaan Singh', totalMarksObtained: 165, totalMaxMarks: 200, overallPercentage: 82.5, absentCount: 0, rank: 2, examResults: { n1: { examId: 'n1', examName: 'Biology Test 1', subjectName: 'Biology', maxMarks: 100, marksObtained: 84, percentage: 84 }, n2: { examId: 'n2', examName: 'Chemistry Test 1', subjectName: 'Chemistry', maxMarks: 100, marksObtained: 81, percentage: 81 } } }
            ],
            metrics: { totalStudents: 2, classAvg: 88.3, topScorerName: 'Diya Patel', totalAbsentees: 0, examsCount: 2 }
          },
          {
            id: 'saved_12_jee_b',
            batchId: 'mock_3',
            batchName: '12 JEE B',
            title: '12 JEE B Report Card — July 2026',
            monthYear: 'July 2026',
            dateSaved: '31 Jul 2026',
            exams: [
              { id: 'j1', name: 'Mock Test 1', type: 'Mock Test', subject_name: 'Full Syllabus', date: '2026-07-15', max_marks: 300 }
            ],
            rows: [
              { enrollmentId: 's6', studentCode: 'JEEB-301', studentName: 'Kabir Mehta', totalMarksObtained: 245, totalMaxMarks: 300, overallPercentage: 81.7, absentCount: 0, rank: 1, examResults: { j1: { examId: 'j1', examName: 'Mock Test 1', subjectName: 'Full Syllabus', maxMarks: 300, marksObtained: 245, percentage: 81.7 } } },
              { enrollmentId: 's7', studentCode: 'JEEB-302', studentName: 'Sneha Roy', totalMarksObtained: 210, totalMaxMarks: 300, overallPercentage: 70.0, absentCount: 0, rank: 2, examResults: { j1: { examId: 'j1', examName: 'Mock Test 1', subjectName: 'Full Syllabus', maxMarks: 300, marksObtained: 210, percentage: 70.0 } } }
            ],
            metrics: { totalStudents: 2, classAvg: 75.9, topScorerName: 'Kabir Mehta', totalAbsentees: 0, examsCount: 1 }
          }
        ];
        setSavedReports(defaultSaved);
        localStorage.setItem('shiksharthi_saved_report_cards', JSON.stringify(defaultSaved));
      }
    } catch (e) {
      console.error('Failed to load saved report cards from storage', e);
    }
  }, []);

  // Save current report to stored list
  const handleSaveCurrentReport = () => {
    if (!generatedReport) return;
    const now = new Date();
    const monthYear = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    const newSavedItem: SavedReportCard = {
      id: 'saved_' + Date.now(),
      batchId: selectedBatchId,
      batchName: generatedReport.batchName,
      title: generatedReport.title,
      monthYear,
      dateSaved: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      exams: generatedReport.exams,
      rows: generatedReport.rows,
      metrics: {
        totalStudents: generatedReport.rows.length,
        classAvg: metrics?.classAvg || 0,
        topScorerName: metrics?.topScorer?.studentName || 'N/A',
        totalAbsentees: metrics?.totalAbsentees || 0,
        examsCount: generatedReport.exams.length
      }
    };

    const updated = [newSavedItem, ...savedReports.filter(r => r.id !== newSavedItem.id)];
    setSavedReports(updated);
    try {
      localStorage.setItem('shiksharthi_saved_report_cards', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
    alert(`"${generatedReport.title}" saved successfully! You can view or download it under Saved Report Cards.`);
  };

  // Delete saved report
  const handleDeleteSavedReport = (id: string) => {
    if (!confirm('Are you sure you want to delete this saved report card?')) return;
    const updated = savedReports.filter(r => r.id !== id);
    setSavedReports(updated);
    try {
      localStorage.setItem('shiksharthi_saved_report_cards', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to update localStorage', e);
    }
  };

  // Group saved reports monthwise
  const groupedSavedReports = useMemo(() => {
    const groups: { monthYear: string; reports: SavedReportCard[] }[] = [];
    const map = new Map<string, SavedReportCard[]>();

    savedReports.forEach(r => {
      const key = r.monthYear || 'Other';
      if (map.has(key)) {
        map.get(key)!.push(r);
      } else {
        const newList = [r];
        map.set(key, newList);
        groups.push({ monthYear: key, reports: newList });
      }
    });

    return groups;
  }, [savedReports]);

  // 1. Fetch batches for current branch & academic year
  useEffect(() => {
    async function loadBatches() {
      if (!currentBranch || !currentAcademicYear) return;
      try {
        const { data, error } = await supabase
          .from('batches')
          .select('id, name, class')
          .eq('branch_id', currentBranch.id)
          .eq('academic_year_id', currentAcademicYear.id)
          .order('name');

        if (error) throw error;
        setBatches(data || []);
        if (data && data.length > 0) {
          setSelectedBatchId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to load batches:', err);
      }
    }
    loadBatches();
  }, [currentBranch, currentAcademicYear]);

  // 2. Fetch exams when selected batch changes
  useEffect(() => {
    async function loadExams() {
      if (!selectedBatchId) {
        setAvailableExams([]);
        setSelectedExamIds([]);
        return;
      }

      setLoadingExams(true);
      try {
        const { data, error } = await supabase
          .from('exams')
          .select('id, name, type, subject_name, date, max_marks, chapters_covered')
          .eq('batch_id', selectedBatchId)
          .order('date', { ascending: true });

        if (error) throw error;

        const examsList: ExamItem[] = data || [];
        setAvailableExams(examsList);
        // By default select all available exams for this batch
        const allIds = examsList.map(e => e.id);
        setSelectedExamIds(allIds);

        const selectedBatch = batches.find(b => b.id === selectedBatchId);
        const bName = selectedBatch ? selectedBatch.name : 'Batch';
        setReportTitle(`${bName} - Consolidated Exam Performance Report`);
      } catch (err) {
        console.error('Failed to load exams for batch:', err);
      } finally {
        setLoadingExams(false);
      }
    }
    loadExams();
  }, [selectedBatchId, batches]);

  // 3. Toggle single exam selection
  const toggleExamSelection = (examId: string) => {
    setSelectedExamIds(prev =>
      prev.includes(examId) ? prev.filter(id => id !== examId) : [...prev, examId]
    );
  };

  // 4. Select / Deselect All Exams
  const toggleSelectAllExams = () => {
    if (selectedExamIds.length === availableExams.length) {
      setSelectedExamIds([]);
    } else {
      setSelectedExamIds(availableExams.map(e => e.id));
    }
  };

  // 5. Generate Consolidated Report Card
  const handleGenerateReport = async () => {
    if (!selectedBatchId) {
      alert('Please select a batch.');
      return;
    }
    if (selectedExamIds.length === 0) {
      alert('Please select at least one exam to include in the report card.');
      return;
    }

    setGenerating(true);
    try {
      const selectedBatch = batches.find(b => b.id === selectedBatchId);
      const batchName = selectedBatch ? selectedBatch.name : 'Batch';

      // Selected Exams details
      const chosenExams = availableExams.filter(e => selectedExamIds.includes(e.id));

      // Fetch all enrollments for this batch
      const { data: enrollmentsData, error: eErr } = await supabase
        .from('enrollments')
        .select(`
          id,
          subjects_taken,
          students (
            id,
            student_code,
            name
          )
        `)
        .eq('batch_id', selectedBatchId)
        .in('status', ['Active', 'Leave of Absence']);

      if (eErr) throw eErr;

      // Fetch all results for selected exams
      const { data: resultsData, error: rErr } = await supabase
        .from('results')
        .select('id, exam_id, enrollment_id, marks_obtained, percentage, rank_in_batch')
        .in('exam_id', selectedExamIds);

      if (rErr) throw rErr;

      const enrollments = enrollmentsData || [];
      const results = resultsData || [];

      // Process rows per student
      const rows: StudentConsolidatedRow[] = enrollments.map((enr: any) => {
        const studentCode = enr.students?.student_code || '';
        const studentName = enr.students?.name || 'Unknown';
        const examResultsObj: { [examId: string]: StudentExamResult } = {};

        let sumObtained = 0;
        let sumMax = 0;
        let absentCount = 0;

        chosenExams.forEach(ex => {
          const matchedRes = results.find((r: any) => r.exam_id === ex.id && r.enrollment_id === enr.id);

          let marks: number | null = null;
          let pct: number | null = null;

          if (matchedRes) {
            const rawVal = parseFloat(matchedRes.marks_obtained);
            if (rawVal === -1) {
              marks = -1; // Absent
              pct = 0;
              absentCount++;
            } else if (!isNaN(rawVal)) {
              marks = rawVal;
              pct = ex.max_marks > 0 ? (rawVal / ex.max_marks) * 100 : 0;
              sumObtained += rawVal;
            }
          }

          sumMax += ex.max_marks;

          examResultsObj[ex.id] = {
            examId: ex.id,
            examName: ex.name,
            subjectName: ex.subject_name,
            maxMarks: ex.max_marks,
            marksObtained: marks,
            percentage: pct
          };
        });

        const overallPct = sumMax > 0 ? Math.round((sumObtained / sumMax) * 1000) / 10 : 0;

        return {
          enrollmentId: enr.id,
          studentCode,
          studentName,
          examResults: examResultsObj,
          totalMarksObtained: Math.round(sumObtained * 10) / 10,
          totalMaxMarks: sumMax,
          overallPercentage: overallPct,
          absentCount,
          rank: 0
        };
      });

      // Sort students: highest overall percentage first, then total marks obtained desc, then name asc
      rows.sort((a, b) => {
        if (b.overallPercentage !== a.overallPercentage) {
          return b.overallPercentage - a.overallPercentage;
        }
        if (b.totalMarksObtained !== a.totalMarksObtained) {
          return b.totalMarksObtained - a.totalMarksObtained;
        }
        return a.studentName.localeCompare(b.studentName);
      });

      // Assign ranks (1st, 2nd, 3rd...)
      rows.forEach((r, idx) => {
        r.rank = idx + 1;
      });

      setGeneratedReport({
        batchName,
        title: reportTitle || `${batchName} Report Card`,
        dateGenerated: new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }),
        exams: chosenExams,
        rows
      });
    } catch (err: any) {
      console.error('Failed to generate report card:', err);
      alert(`Error generating report card: ${err?.message || 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  };

  // Filtered rows inside generated report
  const filteredRows = useMemo(() => {
    if (!generatedReport) return [];
    return generatedReport.rows.filter(r => {
      const matchesSearch =
        r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.studentCode.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterType === 'top3') {
        return r.rank <= 3;
      }
      if (filterType === 'absentees') {
        return r.absentCount > 0;
      }
      return true;
    });
  }, [generatedReport, searchQuery, filterType]);

  // Overall Class Performance Metrics
  const metrics = useMemo(() => {
    if (!generatedReport || generatedReport.rows.length === 0) return null;
    const totalStudents = generatedReport.rows.length;
    const totalPctSum = generatedReport.rows.reduce((acc, r) => acc + r.overallPercentage, 0);
    const classAvg = Math.round((totalPctSum / totalStudents) * 10) / 10;
    const topScorer = generatedReport.rows[0];
    const totalAbsentees = generatedReport.rows.filter(r => r.absentCount > 0).length;

    return {
      totalStudents,
      classAvg,
      topScorer,
      totalAbsentees,
      examsCount: generatedReport.exams.length
    };
  }, [generatedReport]);

  // Render Medal Badge for Top 3 Ranks
  const renderRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          color: '#D97706',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 700
        }}>
          🥇 1st
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: 'rgba(107, 114, 128, 0.15)',
          color: '#4B5563',
          border: '1px solid rgba(107, 114, 128, 0.4)',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 700
        }}>
          🥈 2nd
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: 'rgba(180, 83, 9, 0.15)',
          color: '#B45309',
          border: '1px solid rgba(180, 83, 9, 0.4)',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 700
        }}>
          🥉 3rd
        </span>
      );
    }
    return <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>#{rank}</span>;
  };

  // PDF Export Generator
  const handleDownloadPDF = async (customReport?: any) => {
    const reportToUse = customReport || generatedReport;
    if (!reportToUse) return;
    setDownloadingPdf(true);
    try {
      const { default: { Document, Page, Text, View, StyleSheet, pdf, Image } } = await import('@react-pdf/renderer');
      const logoUrl = typeof window !== 'undefined' ? window.location.origin + '/logo.png' : '';

      const pdfStyles = StyleSheet.create({
        page: { padding: 24, fontFamily: 'Helvetica', fontSize: 9, color: '#111827' },
        header: { alignItems: 'center', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 10 },
        logo: { width: 140, height: 38, objectFit: 'contain', marginBottom: 4 },
        title: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#1E293B', textAlign: 'center', uppercase: true, letterSpacing: 0.5 },
        subtitle: { fontSize: 9, color: '#64748B', marginTop: 2, textAlign: 'center' },
        metaRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 8, borderRadius: 4, marginBottom: 12 },
        metaText: { fontSize: 8.5, color: '#334155' },
        metaBold: { fontFamily: 'Helvetica-Bold' },

        table: { width: '100%', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 4, overflow: 'hidden' },
        tableHeaderRow: { flexDirection: 'row', backgroundColor: '#0F172A', paddingVertical: 6, paddingHorizontal: 4 },
        tableHeaderCell: { color: '#FFFFFF', fontFamily: 'Helvetica-Bold', fontSize: 8, textAlign: 'center' },
        tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: 5, paddingHorizontal: 4, alignItems: 'center' },
        tableRowAlt: { backgroundColor: '#F8FAFC' },
        tableCell: { fontSize: 8, textAlign: 'center', color: '#1E293B' },
        tableCellBold: { fontFamily: 'Helvetica-Bold' },

        rankCell1: { color: '#D97706', fontFamily: 'Helvetica-Bold' },
        rankCell2: { color: '#475569', fontFamily: 'Helvetica-Bold' },
        rankCell3: { color: '#B45309', fontFamily: 'Helvetica-Bold' },
        absentCell: { color: '#EF4444', fontFamily: 'Helvetica-Bold' },

        footer: { position: 'absolute', bottom: 16, left: 24, right: 24, textAlign: 'center', fontSize: 7.5, color: '#94A3B8' }
      });

      const examColsCount = reportToUse.exams.length;
      const rankW = 35;
      const codeW = 60;
      const nameW = 110;
      const totalW = 60;
      const pctW = 50;

      // Available width for exam columns
      const totalPageW = 547; // 595 - 48 margins
      const remainingW = totalPageW - (rankW + codeW + nameW + totalW + pctW);
      const examColW = Math.max(45, Math.floor(remainingW / (examColsCount || 1)));

      const totalStudents = reportToUse.rows.length;
      const totalPctSum = reportToUse.rows.reduce((acc: number, r: any) => acc + r.overallPercentage, 0);
      const classAvg = totalStudents > 0 ? Math.round((totalPctSum / totalStudents) * 10) / 10 : 0;
      const topScorer = reportToUse.rows[0];

      const ReportDoc = (
        <Document>
          <Page size="A4" orientation={examColsCount > 4 ? 'landscape' : 'portrait'} style={pdfStyles.page}>
            {/* Header */}
            <View style={pdfStyles.header}>
              {logoUrl ? <Image src={logoUrl} style={pdfStyles.logo} /> : null}
              <Text style={pdfStyles.title}>{reportToUse.title}</Text>
              <Text style={pdfStyles.subtitle}>Batch: {reportToUse.batchName} | Saved/Generated: {reportToUse.dateGenerated || reportToUse.dateSaved}</Text>
            </View>

            {/* Meta Row */}
            <View style={pdfStyles.metaRow}>
              <Text style={pdfStyles.metaText}><Text style={pdfStyles.metaBold}>Exams Included:</Text> {reportToUse.exams.length}</Text>
              <Text style={pdfStyles.metaText}><Text style={pdfStyles.metaBold}>Total Students:</Text> {reportToUse.rows.length}</Text>
              <Text style={pdfStyles.metaText}><Text style={pdfStyles.metaBold}>Class Average:</Text> {reportToUse.metrics?.classAvg ?? classAvg}%</Text>
              <Text style={pdfStyles.metaText}><Text style={pdfStyles.metaBold}>Top Scorer:</Text> {reportToUse.metrics?.topScorerName || topScorer?.studentName || 'N/A'}</Text>
            </View>

            {/* Table */}
            <View style={pdfStyles.table}>
              {/* Header */}
              <View style={pdfStyles.tableHeaderRow}>
                <Text style={[pdfStyles.tableHeaderCell, { width: rankW }]}>Rank</Text>
                <Text style={[pdfStyles.tableHeaderCell, { width: codeW }]}>Code</Text>
                <Text style={[pdfStyles.tableHeaderCell, { width: nameW, textAlign: 'left' }]}>Student Name</Text>

                {reportToUse.exams.map((ex: any) => (
                  <Text key={ex.id} style={[pdfStyles.tableHeaderCell, { width: examColW }]}>
                    {ex.subject_name} ({ex.max_marks})
                  </Text>
                ))}

                <Text style={[pdfStyles.tableHeaderCell, { width: totalW }]}>Total</Text>
                <Text style={[pdfStyles.tableHeaderCell, { width: pctW }]}>Overall %</Text>
              </View>

              {/* Rows */}
              {reportToUse.rows.map((row: any, idx: number) => {
                const isAlt = idx % 2 === 1;
                return (
                  <View key={row.enrollmentId} style={[pdfStyles.tableRow, isAlt ? pdfStyles.tableRowAlt : {}]}>
                    <Text style={[
                      pdfStyles.tableCell,
                      { width: rankW },
                      row.rank === 1 ? pdfStyles.rankCell1 : row.rank === 2 ? pdfStyles.rankCell2 : row.rank === 3 ? pdfStyles.rankCell3 : {}
                    ]}>
                      {row.rank === 1 ? '1 (Gold)' : row.rank === 2 ? '2 (Silver)' : row.rank === 3 ? '3 (Bronze)' : `#${row.rank}`}
                    </Text>

                    <Text style={[pdfStyles.tableCell, { width: codeW, color: '#64748B' }]}>{row.studentCode}</Text>
                    <Text style={[pdfStyles.tableCell, pdfStyles.tableCellBold, { width: nameW, textAlign: 'left' }]}>{row.studentName}</Text>

                    {reportToUse.exams.map((ex: any) => {
                      const res = row.examResults[ex.id];
                      const val = res?.marksObtained;
                      return (
                        <Text key={ex.id} style={[
                          pdfStyles.tableCell,
                          { width: examColW },
                          val === -1 ? pdfStyles.absentCell : {}
                        ]}>
                          {val === -1 ? 'Absent' : val === null ? '-' : `${val} / ${ex.max_marks}`}
                        </Text>
                      );
                    })}

                    <Text style={[pdfStyles.tableCell, pdfStyles.tableCellBold, { width: totalW }]}>
                      {row.totalMarksObtained} / {row.totalMaxMarks}
                    </Text>

                    <Text style={[pdfStyles.tableCell, pdfStyles.tableCellBold, { width: pctW, color: row.overallPercentage >= 75 ? '#059669' : row.overallPercentage >= 50 ? '#D97706' : '#DC2626' }]}>
                      {row.overallPercentage}%
                    </Text>
                  </View>
                );
              })}
            </View>

            <Text style={pdfStyles.footer}>
              This is an official computer-generated consolidated report issued by Shiksharthi Educational Institute.
            </Text>
          </Page>
        </Document>
      );

      const blob = await pdf(ReportDoc).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportToUse.title.replace(/[^a-zA-Z0-9]/g, '_')}_Report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF Generation failed:', err);
      alert('Failed to generate PDF. Please use the Print option.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Web Browser Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      {/* Scoped CSS for Print & Animations */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-report-area, #printable-report-area * {
            visibility: visible;
          }
          #printable-report-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 20px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Page Header */}
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Report Cards</h1>
          <p className="page-subtitle">
            Generate consolidated multi-exam performance report cards & student rank lists for any batch
          </p>
        </div>
      </div>

      {/* ─── Step 1: Configurator Bar / Panel ───────────────────────────── */}
      <div className="card no-print" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            backgroundColor: 'rgba(249, 115, 22, 0.1)', color: 'var(--primary-orange)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <FileText size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Report Card Configurator</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              Select a batch, title, and choose which scheduled exam marks to consolidate
            </p>
          </div>
        </div>

        <div className="grid-form-2col" style={{ gap: '16px', marginBottom: '16px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Select Class & Batch *</label>
            <select
              className="form-control"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
            >
              {batches.length === 0 ? (
                <option value="">No batches available</option>
              ) : (
                batches.map(b => (
                  <option key={b.id} value={b.id}>
                    Class {b.class} — {b.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Report Card Title *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Class 11 JEE - Periodic Test 1 Consolidated Report"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
            />
          </div>
        </div>

        {/* Exams Selection List */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <label className="form-label" style={{ margin: 0 }}>
              Select Exams to Include ({selectedExamIds.length} of {availableExams.length} selected) *
            </label>
            {availableExams.length > 0 && (
              <button
                type="button"
                className="btn btn-tertiary"
                style={{ fontSize: '12px', padding: '2px 8px', minHeight: 'unset' }}
                onClick={toggleSelectAllExams}
              >
                {selectedExamIds.length === availableExams.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          {loadingExams ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <RefreshCw size={18} className="spin" style={{ display: 'inline-block', marginRight: '8px' }} />
              Loading recorded exams...
            </div>
          ) : availableExams.length === 0 ? (
            <div style={{
              padding: '20px',
              backgroundColor: 'var(--surface-secondary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: '13px'
            }}>
              <AlertCircle size={18} style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }} />
              No exams recorded for this batch yet. Create exams in the <strong>Exams</strong> section first.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '10px',
              backgroundColor: 'var(--surface-secondary)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              maxHeight: '220px',
              overflowY: 'auto'
            }}>
              {availableExams.map(ex => {
                const checked = selectedExamIds.includes(ex.id);
                return (
                  <label
                    key={ex.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '8px 10px',
                      backgroundColor: checked ? 'var(--surface-card)' : 'transparent',
                      border: `1px solid ${checked ? 'var(--primary-orange)' : 'var(--border-color)'}`,
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleExamSelection(ex.id)}
                      style={{ marginTop: '2px', cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                        {ex.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        <span style={{ fontWeight: 500, color: 'var(--primary-orange)' }}>{ex.subject_name}</span> | Max: {ex.max_marks} marks | {ex.date}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Generate Action Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={generating || availableExams.length === 0 || selectedExamIds.length === 0}
            onClick={handleGenerateReport}
          >
            {generating ? (
              <>
                <RefreshCw size={16} className="spin" /> Generating...
              </>
            ) : (
              <>
                <Sparkles size={16} /> Generate Report Card
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── Step 2: Generated Report View ─────────────────────────────── */}
      {generatedReport ? (
        <div id="printable-report-area">

          {/* Report Title & Metadata Header */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '16px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <img
                  src="/logo.png"
                  alt="Shiksharthi Logo"
                  style={{ height: '42px', objectFit: 'contain' }}
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    {generatedReport.title}
                  </h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    Batch: <strong>{generatedReport.batchName}</strong> | Issued: {generatedReport.dateGenerated}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handlePrint}
                >
                  <Printer size={16} /> Print
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={downloadingPdf}
                  onClick={handleDownloadPDF}
                >
                  {downloadingPdf ? (
                    <>
                      <RefreshCw size={16} className="spin" /> Preparing PDF...
                    </>
                  ) : (
                    <>
                      <Download size={16} /> Download PDF
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Metrics Dashboard */}
            {metrics && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px'
              }}>
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--surface-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Class Average
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--primary-orange)', marginTop: '2px' }}>
                    {metrics.classAvg}%
                  </div>
                </div>

                <div style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--surface-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Top Scorer (Rank 1 🥇)
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {metrics.topScorer ? `${metrics.topScorer.studentName} (${metrics.topScorer.overallPercentage}%)` : '—'}
                  </div>
                </div>

                <div style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--surface-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Exams Included
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {metrics.examsCount}
                  </div>
                </div>

                <div style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--surface-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Total Enrolled
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {metrics.totalStudents}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Table Filters & Toolbar */}
          <div className="card no-print" style={{ marginBottom: '16px', padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '32px', fontSize: '13px' }}
                  placeholder="Search student code or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="caption" style={{ margin: 0 }}>Filter:</span>
                <button
                  type="button"
                  className={`btn ${filterType === 'all' ? 'btn-primary' : 'btn-tertiary'}`}
                  style={{ fontSize: '12px', padding: '4px 10px', minHeight: 'unset' }}
                  onClick={() => setFilterType('all')}
                >
                  All ({generatedReport.rows.length})
                </button>
                <button
                  type="button"
                  className={`btn ${filterType === 'top3' ? 'btn-primary' : 'btn-tertiary'}`}
                  style={{ fontSize: '12px', padding: '4px 10px', minHeight: 'unset' }}
                  onClick={() => setFilterType('top3')}
                >
                  Top 3 Medals 🥇
                </button>
                <button
                  type="button"
                  className={`btn ${filterType === 'absentees' ? 'btn-primary' : 'btn-tertiary'}`}
                  style={{ fontSize: '12px', padding: '4px 10px', minHeight: 'unset' }}
                  onClick={() => setFilterType('absentees')}
                >
                  Absentees 🔴
                </button>
              </div>
            </div>
          </div>

          {/* Performance Data Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '12px 14px', textAlign: 'center', width: '80px', fontWeight: 600 }}>Rank</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', width: '110px', fontWeight: 600 }}>Code</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', minWidth: '160px', fontWeight: 600 }}>Student Name</th>

                    {generatedReport.exams.map(ex => (
                      <th key={ex.id} style={{ padding: '12px 14px', textAlign: 'center', minWidth: '130px', fontWeight: 600 }}>
                        <div style={{ color: 'var(--text-primary)' }}>{ex.subject_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 400, marginTop: '2px' }}>
                          {ex.name} (Max: {ex.max_marks})
                        </div>
                      </th>
                    ))}

                    <th style={{ padding: '12px 14px', textAlign: 'center', width: '120px', fontWeight: 600 }}>Total Marks</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center', width: '100px', fontWeight: 600 }}>Overall %</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4 + generatedReport.exams.length}
                        style={{ padding: '30px', textAlign: 'center', color: 'var(--text-tertiary)' }}
                      >
                        No student performance records found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      return (
                        <tr
                          key={row.enrollmentId}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: row.rank === 1 ? 'rgba(245, 158, 11, 0.04)' : 'transparent'
                          }}
                        >
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            {renderRankBadge(row.rank)}
                          </td>
                          <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '12px' }}>
                            {row.studentCode}
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {row.studentName}
                          </td>

                          {generatedReport.exams.map(ex => {
                            const res = row.examResults[ex.id];
                            const score = res?.marksObtained;
                            const isAbsent = score === -1;

                            return (
                              <td key={ex.id} style={{ padding: '12px 14px', textAlign: 'center' }}>
                                {isAbsent ? (
                                  <span style={{
                                    display: 'inline-block',
                                    color: '#EF4444',
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    fontSize: '12px',
                                    fontWeight: 700
                                  }}>
                                    Absent
                                  </span>
                                ) : score === null ? (
                                  <span style={{ color: 'var(--text-disabled)' }}>—</span>
                                ) : (
                                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {score} <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 400 }}>/ {ex.max_marks}</span>
                                  </span>
                                )}
                              </td>
                            );
                          })}

                          <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {row.totalMarksObtained} <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 400 }}>/ {row.totalMaxMarks}</span>
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span style={{
                              fontWeight: 700,
                              fontSize: '14px',
                              color: row.overallPercentage >= 75 ? 'var(--color-success)' : row.overallPercentage >= 50 ? 'var(--primary-orange)' : '#EF4444'
                            }}>
                              {row.overallPercentage}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        <div style={{
          padding: '60px 20px',
          textAlign: 'center',
          backgroundColor: 'var(--surface-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-secondary)'
        }}>
          <FileText size={48} style={{ color: 'var(--text-tertiary)', marginBottom: '12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Select Batch & Exams to Preview Report Card
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '420px', margin: '6px auto 0' }}>
            Choose your target class batch above, select the exam scores you wish to include, and click <strong>Generate Report Card</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
