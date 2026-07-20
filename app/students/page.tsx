'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Search,
  UserPlus,
  Grid,
  List,
  Filter,
  ChevronRight,
  User,
  Check,
  TrendingUp,
  X,
  Plus,
  Layers,
  Repeat,
  ArrowRightLeft,
  AlertCircle,
  Printer,
  Download,
  Upload,
  FileSpreadsheet
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import { Document, Page as PdfPage, Text, View, StyleSheet, PDFDownloadLink, Image } from '@react-pdf/renderer';
import { useAppStore } from '@/store/useAppStore';
import { createClient } from '@/utils/supabase/client';
const getPackageTypeFromBatchName = (batchName: string, fallback: string) => {
  const lower = batchName.toLowerCase();
  if (lower.includes('jee')) return 'JEE';
  if (lower.includes('neet')) return 'NEET';
  if (lower.includes('board')) return 'Boards';
  return fallback;
};

interface StudentListItem {
  id: string; // enrollment id
  studentId: string;
  student_code: string;
  name: string;
  parent_name: string;
  class: string;
  board?: string;
  batch_id: string;
  batch_name: string;
  package_type: string;
  subjects_taken?: string[];
  status: string;
  admission_date: string;
  school: string;
  address: string;
  dob: string;
  gender?: string;
}

interface SubjectAttendance {
  subject: string;
  totalClasses: number;
  present: number;
  absent: number;
  leave: number;
  percentage: number;
}

interface AttendanceTrendPoint {
  date: string;
  label: string;
  present: number;
  total: number;
  percentage: number;
}

const toTitleCase = (str: string) => {
  if (!str) return '';
  if (str === str.toUpperCase()) {
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  return str;
};

// PDF Styling for Academic History Report
const academicPdfStyles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#F59E0B', paddingBottom: 10, gap: 10 },
  logo: { width: 80, height: 28, objectFit: 'contain' },
  headerTextWrap: { flex: 1 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#111827', letterSpacing: -0.3 },
  subtitle: { fontSize: 9, color: '#6B7280', marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#111827', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 6, marginBottom: 10 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', padding: 6, alignItems: 'center' },
  headerRow: { flexDirection: 'row', backgroundColor: '#F9FAFB', padding: 6, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  label: { width: 140, color: '#6B7280', fontWeight: 'medium' },
  value: { flex: 1, color: '#111827', fontWeight: 'bold' },
  cellSubject: { width: 100, fontSize: 10 },
  cellNumber: { width: 50, fontSize: 10, textAlign: 'center' },
  cellPct: { width: 60, fontSize: 10, textAlign: 'center', fontWeight: 'bold' },
  cellMarks: { width: 90, fontSize: 10, textAlign: 'center', fontWeight: 'bold' },
  overallRow: { flexDirection: 'row', padding: 8, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 4, marginTop: 8 },
  footer: { position: 'absolute', bottom: 40, left: 40, right: 40, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 12, textAlign: 'center' },
  footerText: { fontSize: 8, color: '#9CA3AF' }
});

// PDF Document Component for Academic History
const AcademicHistoryPDF = ({
  studentName, studentCode, batchName, className, board, school,
  subjectAttendance, overallAttendance,
  examScores
}: {
  studentName: string; studentCode: string; batchName: string; className: string; board: string; school: string;
  subjectAttendance: SubjectAttendance[]; overallAttendance: number | null;
  examScores: any[];
}) => {
  const getBarColor = (pct: number) => pct >= 75 ? '#16A34A' : pct >= 60 ? '#D97706' : '#DC2626';
  return (
    <Document>
      <PdfPage size="A4" style={academicPdfStyles.page}>
        <View style={academicPdfStyles.header}>
          <Image src="/logo.png" style={academicPdfStyles.logo} />
          <View style={academicPdfStyles.headerTextWrap}>
            <Text style={academicPdfStyles.title}>SHIKSHARTHI EDUCATIONAL INSTITUTE</Text>
            <Text style={academicPdfStyles.subtitle}>Academic History Report</Text>
          </View>
        </View>

        {/* Student Profile */}
        <View style={academicPdfStyles.section}>
          <Text style={academicPdfStyles.sectionTitle}>Student Profile</Text>
          <View style={academicPdfStyles.row}>
            <Text style={academicPdfStyles.label}>Student Name</Text>
            <Text style={academicPdfStyles.value}>{studentName}</Text>
          </View>
          <View style={academicPdfStyles.row}>
            <Text style={academicPdfStyles.label}>Student Code</Text>
            <Text style={academicPdfStyles.value}>{studentCode}</Text>
          </View>
          {school ? (
            <View style={academicPdfStyles.row}>
              <Text style={academicPdfStyles.label}>School</Text>
              <Text style={academicPdfStyles.value}>{school}</Text>
            </View>
          ) : null}
          {board ? (
            <View style={academicPdfStyles.row}>
              <Text style={academicPdfStyles.label}>Board</Text>
              <Text style={academicPdfStyles.value}>{board}</Text>
            </View>
          ) : null}
          <View style={academicPdfStyles.row}>
            <Text style={academicPdfStyles.label}>Class</Text>
            <Text style={academicPdfStyles.value}>Class {className}</Text>
          </View>
          <View style={academicPdfStyles.row}>
            <Text style={academicPdfStyles.label}>Batch</Text>
            <Text style={academicPdfStyles.value}>{batchName}</Text>
          </View>
        </View>

        {/* Subject-wise Attendance Table */}
        <View style={academicPdfStyles.section}>
          <Text style={academicPdfStyles.sectionTitle}>Subject-wise Attendance</Text>
          <View style={academicPdfStyles.headerRow}>
            <Text style={[academicPdfStyles.cellSubject, { fontWeight: 'bold', color: '#374151' }]}>Subject</Text>
            <Text style={[academicPdfStyles.cellNumber, { fontWeight: 'bold', color: '#374151' }]}>Total</Text>
            <Text style={[academicPdfStyles.cellNumber, { fontWeight: 'bold', color: '#374151' }]}>Present</Text>
            <Text style={[academicPdfStyles.cellNumber, { fontWeight: 'bold', color: '#374151' }]}>Absent</Text>
            <Text style={[academicPdfStyles.cellNumber, { fontWeight: 'bold', color: '#374151' }]}>Leave</Text>
            <Text style={[academicPdfStyles.cellPct, { fontWeight: 'bold', color: '#374151' }]}>%</Text>
          </View>
          {subjectAttendance.length === 0 ? (
            <View style={academicPdfStyles.row}>
              <Text style={{ color: '#9CA3AF', textAlign: 'center', flex: 1 }}>No attendance data recorded yet.</Text>
            </View>
          ) : (
            subjectAttendance.map((sa, i) => (
              <View key={i} style={academicPdfStyles.row}>
                <Text style={academicPdfStyles.cellSubject}>{sa.subject}</Text>
                <Text style={academicPdfStyles.cellNumber}>{sa.totalClasses}</Text>
                <Text style={academicPdfStyles.cellNumber}>{sa.present}</Text>
                <Text style={academicPdfStyles.cellNumber}>{sa.absent}</Text>
                <Text style={academicPdfStyles.cellNumber}>{sa.leave}</Text>
                <Text style={[academicPdfStyles.cellPct, { color: getBarColor(sa.percentage) }]}>{sa.percentage.toFixed(1)}%</Text>
              </View>
            ))
          )}
          {overallAttendance !== null && (
            <View style={academicPdfStyles.overallRow}>
              <Text style={[academicPdfStyles.cellSubject, { fontWeight: 'bold' }]}>Overall Average</Text>
              <Text style={academicPdfStyles.cellNumber}>{subjectAttendance.reduce((a, s) => a + s.totalClasses, 0)}</Text>
              <Text style={academicPdfStyles.cellNumber}>{subjectAttendance.reduce((a, s) => a + s.present, 0)}</Text>
              <Text style={academicPdfStyles.cellNumber}>{subjectAttendance.reduce((a, s) => a + s.absent, 0)}</Text>
              <Text style={academicPdfStyles.cellNumber}>{subjectAttendance.reduce((a, s) => a + s.leave, 0)}</Text>
              <Text style={[academicPdfStyles.cellPct, { color: '#D97706', fontWeight: 'bold' }]}>{overallAttendance.toFixed(1)}%</Text>
            </View>
          )}
        </View>



        {/* Examination Record - always shown */}
        <View style={academicPdfStyles.section}>
          <Text style={academicPdfStyles.sectionTitle}>Examination Record</Text>
          {examScores.length === 0 ? (
            <View style={academicPdfStyles.row}>
              <Text style={{ color: '#9CA3AF', textAlign: 'center', flex: 1 }}>No exam scores recorded yet.</Text>
            </View>
          ) : (
            <>
              <View style={academicPdfStyles.headerRow}>
                <Text style={[academicPdfStyles.cellSubject, { fontWeight: 'bold', color: '#374151' }]}>Date</Text>
                <Text style={[academicPdfStyles.cellSubject, { fontWeight: 'bold', color: '#374151' }]}>Subject</Text>
                <Text style={[academicPdfStyles.cellSubject, { fontWeight: 'bold', color: '#374151' }]}>Exam Name</Text>
                <Text style={[academicPdfStyles.cellMarks, { fontWeight: 'bold', color: '#374151' }]}>Marks</Text>
                <Text style={[academicPdfStyles.cellNumber, { fontWeight: 'bold', color: '#374151' }]}>Rank</Text>
              </View>
              {examScores.map((score, i) => (
                <View key={i} style={academicPdfStyles.row}>
                  <Text style={academicPdfStyles.cellSubject}>{score.date}</Text>
                  <Text style={academicPdfStyles.cellSubject}>{score.subject}</Text>
                  <Text style={academicPdfStyles.cellSubject}>{score.name}</Text>
                  <Text style={academicPdfStyles.cellMarks}>{score.score}</Text>
                  <Text style={academicPdfStyles.cellNumber}>{score.rank}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={academicPdfStyles.footer}>
          <Text style={academicPdfStyles.footerText}>This is a computer-generated academic report issued by Shiksharthi Educational Institute.</Text>
          <Text style={[academicPdfStyles.footerText, { marginTop: 4 }]}>Generated on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}.</Text>
        </View>
      </PdfPage>
    </Document>
  );
};

// Helper to match subject name from attendance/exams with enrolled subject name, ignoring (Board)/(JEE)/(NEET) suffixes
function getEnrolledSubjectName(subjectName: string, enrolledSubjects: string[]): string {
  if (!subjectName) return '';
  if (!enrolledSubjects || enrolledSubjects.length === 0) return subjectName;

  // 1. Try exact match
  if (enrolledSubjects.includes(subjectName)) {
    return subjectName;
  }

  // 2. Try match after removing suffixes from both sides
  const clean = (name: string) => name.replace(/\s*\((Board|JEE|NEET)\)/i, '').trim().toLowerCase();
  const cleanSubject = clean(subjectName);

  const matched = enrolledSubjects.find(s => clean(s) === cleanSubject);
  return matched || subjectName;
}

export default function StudentsPage() {
  const supabase = createClient();
  const { currentBranch, currentAcademicYear, userProfile } = useAppStore();

  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('All');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [batchFilter, setBatchFilter] = useState('All');
  const [allBatches, setAllBatches] = useState<{ id: string; name: string; class: string }[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [selectedStudent, setSelectedStudent] = useState<StudentListItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Excel Import/Export State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importPreviewRows, setImportPreviewRows] = useState<any[]>([]);
  const [showImportResults, setShowImportResults] = useState(false);
  const [importResults, setImportResults] = useState<{ imported: number; skipped: { row: number; reason: string }[] }>({ imported: 0, skipped: [] });


  // Admission Form State
  const [newStudent, setNewStudent] = useState({
    name: '',
    parentName: '',
    dob: '',
    gender: 'Male',
    school: '',
    address: '',
    classVal: '11',
    board: '',
    batchId: '',
    packageType: 'JEE',
    addOns: [] as string[],
    subjects: ['Physics', 'Chemistry', 'Mathematics'] as string[]
  });

  // Available batches for the selected class
  const [availableBatches, setAvailableBatches] = useState<{ id: string; name: string }[]>([]);

  // Transfer Form State
  const [transferState, setTransferState] = useState({
    newBatchId: '',
    remarks: ''
  });

  const isMentor = userProfile?.role === 'Mentor';
  const isDirector = userProfile?.role === 'Director';
  const isAdmin = userProfile?.role === 'Admin';

  // Fetch all batches for filtering
  useEffect(() => {
    async function loadAllBatches() {
      if (!currentBranch || !currentAcademicYear) return;
      const { data } = await supabase
        .from('batches')
        .select('id, name, class')
        .eq('branch_id', currentBranch.id)
        .eq('academic_year_id', currentAcademicYear.id)
        .order('name');
      setAllBatches(data || []);
    }
    loadAllBatches();
  }, [currentBranch, currentAcademicYear]);

  // Automatically adjust the form class default and subjects based on current branch class range
  useEffect(() => {
    if (!currentBranch) return;
    const minClass = currentBranch.class_range_min ? String(currentBranch.class_range_min) : '11';
    setNewStudent(prev => ({
      ...prev,
      classVal: minClass,
      board: '',
      batchId: '',
      subjects: ['11', '12'].includes(minClass)
        ? ['Physics', 'Chemistry', 'Mathematics']
        : ['Science', 'Mathematics', 'Social Science', 'English']
    }));
  }, [currentBranch]);

  // Fetch batches when class selection changes
  useEffect(() => {
    async function loadBatches() {
      if (!currentBranch || !currentAcademicYear) return;
      const { data } = await supabase
        .from('batches')
        .select('id, name')
        .eq('class', newStudent.classVal)
        .eq('branch_id', currentBranch.id)
        .eq('academic_year_id', currentAcademicYear.id)
        .order('name');
      const batchList = data || [];
      setAvailableBatches(batchList);
      // Auto-select the first batch if current selection is invalid
      if (batchList.length > 0 && !batchList.find(b => b.id === newStudent.batchId)) {
        setNewStudent(prev => ({ ...prev, batchId: batchList[0].id }));
      } else if (batchList.length === 0) {
        setNewStudent(prev => ({ ...prev, batchId: '' }));
      }
    }
    loadBatches();
  }, [newStudent.classVal, currentBranch, currentAcademicYear]);

  // Automatically update package type and default subjects when batchId changes
  useEffect(() => {
    if (!newStudent.batchId || availableBatches.length === 0) return;
    const selectedBatch = availableBatches.find(b => b.id === newStudent.batchId);
    if (!selectedBatch) return;

    const nameLower = selectedBatch.name.toLowerCase();
    let updatedPackage = newStudent.packageType;
    let updatedSubjects = newStudent.subjects;

    if (nameLower.includes('jee')) {
      updatedPackage = 'JEE';
      updatedSubjects = ['Physics', 'Chemistry', 'Mathematics'];
    } else if (nameLower.includes('neet')) {
      updatedPackage = 'NEET';
      updatedSubjects = ['Physics', 'Chemistry', 'Biology'];
    } else if (nameLower.includes('board')) {
      updatedPackage = 'Boards';
      updatedSubjects = [];
    }

    setNewStudent(prev => {
      // Only update if it actually changed to prevent render loops
      if (prev.packageType === updatedPackage && JSON.stringify(prev.subjects) === JSON.stringify(updatedSubjects)) {
        return prev;
      }
      return {
        ...prev,
        packageType: updatedPackage,
        subjects: updatedSubjects
      };
    });
  }, [newStudent.batchId, availableBatches]);

  // Load Students
  useEffect(() => {
    async function loadStudents() {
      if (!currentBranch || !currentAcademicYear) return;
      setLoading(true);
      try {
        // Try query with 'board' column first, fallback without it if column doesn't exist yet
        let data: any[] | null = null;
        const selectWithBoard = `
            id,
            class,
            board,
            batch_id,
            package_type,
            status,
            subjects_taken,
            students (
              id,
              student_code,
              name,
              parent_name,
              admission_date,
              school,
              address,
              date_of_birth,
              gender,
              branch_id,
              board
            ),
            batches (
              id,
              name
            )
          `;
        const selectWithoutBoard = `
            id,
            class,
            batch_id,
            package_type,
            status,
            subjects_taken,
            students (
              id,
              student_code,
              name,
              parent_name,
              admission_date,
              school,
              address,
              date_of_birth,
              gender,
              branch_id
            ),
            batches (
              id,
              name
            )
          `;

        const res1 = await supabase
          .from('enrollments')
          .select(selectWithBoard)
          .eq('branch_id', currentBranch.id)
          .eq('academic_year_id', currentAcademicYear.id);

        if (res1.error) {
          // Fallback: board column may not exist yet
          console.warn('Query with board column failed, retrying without:', res1.error.message);
          const res2 = await supabase
            .from('enrollments')
            .select(selectWithoutBoard)
            .eq('branch_id', currentBranch.id)
            .eq('academic_year_id', currentAcademicYear.id);
          if (res2.error) throw res2.error;
          data = res2.data;
        } else {
          data = res1.data;
        }

        // Map data from query
        let mapped: StudentListItem[] = (data || []).map((item: any) => ({
          id: item.id,
          studentId: item.students?.id,
          student_code: item.students?.student_code || '',
          name: item.students?.name || '',
          parent_name: item.students?.parent_name || '',
          class: item.class,
          board: item.students?.board || item.board || '',
          batch_id: item.batch_id || item.batches?.id || '',
          batch_name: item.batches?.name || 'Unassigned',
          package_type: item.package_type || 'Boards',
          subjects_taken: item.subjects_taken || [],
          status: item.status,
          admission_date: item.students?.admission_date || '',
          school: item.students?.school || '',
          address: item.students?.address || '',
          dob: item.students?.date_of_birth || '',
          gender: item.students?.gender || 'Male'
        }));



        setStudents(mapped);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadStudents();
  }, [currentBranch, currentAcademicYear]);

  // Handle Admission Submission
  const handleAdmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBranch || !currentAcademicYear) return;

    // Validate Board
    const classVal = newStudent.classVal;
    const board = newStudent.board;
    if (['7', '8', '9', '10'].includes(classVal)) {
      if (!board) {
        alert('Board is required for Class 7-10.');
        return;
      }
      if (!['ICSE', 'CBSE'].includes(board)) {
        alert('Board must be "ICSE" or "CBSE" for Class 7-10.');
        return;
      }
    } else if (['11', '12'].includes(classVal)) {
      if (board && !['ISC', 'CBSE'].includes(board)) {
        alert('Board must be "ISC" or "CBSE" for Class 11-12.');
        return;
      }
    }

    if (!newStudent.batchId) {
      alert('A batch assignment is required to admit a student. Please configure batches for this class/branch in settings if none exist.');
      return;
    }

    try {
      // 1. Fetch exact enrollment count to generate unique sequential code e.g. SHK-BGP-0001
      const { count } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', currentBranch.id);

      const sequenceNum = String((count || 0) + 1).padStart(4, '0');
      const code = `SHK-${currentBranch.code}-${sequenceNum}`;

      // Try to insert student with branch_id and board, fallback if columns do not exist
      let student;
      let sErr;

      const { data: sDataWithBranch, error: sErrWithBranch } = await supabase
        .from('students')
        .insert({
          student_code: code,
          name: newStudent.name,
          parent_name: newStudent.parentName,
          date_of_birth: newStudent.dob || null,
          gender: newStudent.gender,
          address: newStudent.address,
          school: newStudent.school,
          admission_date: new Date().toISOString().split('T')[0],
          branch_id: currentBranch.id,
          board: newStudent.board || null
        })
        .select()
        .single();

      if (sErrWithBranch) {
        console.warn('Student insert with branch_id/board failed, retrying without:', sErrWithBranch.message);
        const { data: sDataWithoutBranch, error: sErrWithoutBranch } = await supabase
          .from('students')
          .insert({
            student_code: code,
            name: newStudent.name,
            parent_name: newStudent.parentName,
            date_of_birth: newStudent.dob || null,
            gender: newStudent.gender,
            address: newStudent.address,
            school: newStudent.school,
            admission_date: new Date().toISOString().split('T')[0]
          })
          .select()
          .single();

        if (sErrWithoutBranch) {
          sErr = sErrWithoutBranch;
        } else {
          student = sDataWithoutBranch;
        }
      } else {
        student = sDataWithBranch;
      }

      if (sErr) throw sErr;

      // 2. Use the batch selected by the user in the form
      const selectedBatchId = newStudent.batchId || null;

      // 3. Create enrollment (try with board column, fallback if not available)
      let enrollment;
      let eErr;

      const { data: eDataWithBoard, error: eErrWithBoard } = await supabase
        .from('enrollments')
        .insert({
          student_id: student.id,
          academic_year_id: currentAcademicYear.id,
          branch_id: currentBranch.id,
          class: newStudent.classVal,
          board: newStudent.board || null,
          batch_id: selectedBatchId,
          package_type: newStudent.packageType,
          subjects_taken: newStudent.subjects,
          status: 'Active',
          status_effective_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      if (eErrWithBoard) {
        console.warn('Enrollment insert with board failed, retrying without board:', eErrWithBoard.message);
        const { data: eDataWithoutBoard, error: eErrWithoutBoard } = await supabase
          .from('enrollments')
          .insert({
            student_id: student.id,
            academic_year_id: currentAcademicYear.id,
            branch_id: currentBranch.id,
            class: newStudent.classVal,
            batch_id: selectedBatchId,
            package_type: newStudent.packageType,
            subjects_taken: newStudent.subjects,
            status: 'Active',
            status_effective_date: new Date().toISOString().split('T')[0]
          })
          .select()
          .single();

        if (eErrWithoutBoard) {
          eErr = eErrWithoutBoard;
        } else {
          enrollment = eDataWithoutBoard;
        }
      } else {
        enrollment = eDataWithBoard;
      }

      if (eErr) {
        // Rollback: delete the orphaned student record since enrollment failed
        console.error('Enrollment insert failed, rolling back student:', eErr.message);
        await supabase.from('students').delete().eq('id', student.id);
        throw eErr;
      }

      // Close and refresh
      setShowAddModal(false);
      // Reload lists locally for speed
      const newStudentItem: StudentListItem = {
        id: enrollment.id,
        studentId: student.id,
        student_code: code,
        name: newStudent.name,
        parent_name: newStudent.parentName,
        class: newStudent.classVal,
        board: enrollment.board || '',
        batch_id: newStudent.batchId || '',
        batch_name: availableBatches.find(b => b.id === newStudent.batchId)?.name || 'Unassigned',
        package_type: newStudent.packageType,
        status: 'Active',
        admission_date: student.admission_date,
        school: student.school || '',
        address: student.address || '',
        dob: student.date_of_birth || ''
      };
      setStudents([newStudentItem, ...students]);

      // Reset Form
      setNewStudent({
        name: '',
        parentName: '',
        dob: '',
        gender: 'Male',
        school: '',
        address: '',
        classVal: '11',
        board: '',
        batchId: '',
        packageType: 'JEE',
        addOns: [],
        subjects: ['Physics', 'Chemistry', 'Mathematics']
      });
    } catch (err: any) {
      console.error('Student admission failed:', err);
      alert(`Failed to admit student: ${err?.message || 'Unknown error. Please check console for details.'}`);
    }
  };

  // Filter Logic
  const filteredStudents = students.filter((st) => {
    const matchesSearch =
      st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.student_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.parent_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesClass = classFilter === 'All' || st.class === classFilter;
    const matchesStatus = statusFilters.length === 0 || statusFilters.includes(st.status);
    const matchesBatch = batchFilter === 'All' || st.batch_id === batchFilter;

    return matchesSearch && matchesClass && matchesStatus && matchesBatch;
  }).sort((a, b) => a.student_code.localeCompare(b.student_code, undefined, { numeric: true }));

  // Helper to parse subject strings intelligently
  const parseSubjects = (subjectStr: string, packageType: string): string[] => {
    const norm = subjectStr.trim().toLowerCase();
    
    if (packageType === 'JEE') {
      const subjects = new Set<string>(['Physics', 'Chemistry', 'Mathematics']);
      if (!norm) return Array.from(subjects);

      const parts = norm.split(/[+,]/).map(p => p.trim()).filter(Boolean);
      parts.forEach(part => {
        if (part.includes('bio') || part === 'b') {
          if (part.includes('neet')) {
            subjects.add('Biology (NEET)');
          } else {
            subjects.add('Biology (Board)');
          }
        } else if (part.includes('comp') || part.includes('cs') || part === 'com') {
          subjects.add('Computer Science');
        }
      });
      return Array.from(subjects);
    }
    
    if (packageType === 'NEET') {
      const subjects = new Set<string>(['Physics', 'Chemistry', 'Biology']);
      if (!norm) return Array.from(subjects);

      const parts = norm.split(/[+,]/).map(p => p.trim()).filter(Boolean);
      parts.forEach(part => {
        if (part.includes('math') || part === 'm') {
          if (part.includes('jee')) {
            subjects.add('Mathematics (JEE)');
          } else if (part.includes('neet')) {
            subjects.add('Mathematics (NEET)');
          } else {
            subjects.add('Mathematics (Board)');
          }
        } else if (part.includes('comp') || part.includes('cs') || part === 'com') {
          subjects.add('Computer Science');
        }
      });
      return Array.from(subjects);
    }
    
    // Boards package
    const subjects = new Set<string>();
    if (!norm) return []; // For boards, no default subjects, each is independent

    const parts = norm.split(/[+,]/).map(p => p.trim()).filter(Boolean);
    
    // Check if they used shorthand like PCM / PCB / PCMB
    if (norm === 'pcm') {
      return ['Physics (Board)', 'Chemistry (Board)', 'Mathematics (Board)'];
    }
    if (norm === 'pcb') {
      return ['Physics (Board)', 'Chemistry (Board)', 'Biology (Board)'];
    }
    if (norm === 'pcmb') {
      return ['Physics (Board)', 'Chemistry (Board)', 'Mathematics (Board)', 'Biology (Board)'];
    }

    parts.forEach(part => {
      if (part.startsWith('phy') || part === 'p') {
        subjects.add('Physics (Board)');
      } else if (part.startsWith('chem') || part === 'c') {
        subjects.add('Chemistry (Board)');
      } else if (part.startsWith('math') || part === 'm') {
        subjects.add('Mathematics (Board)');
      } else if (part.startsWith('bio') || part === 'b') {
        subjects.add('Biology (Board)');
      } else if (part.includes('comp') || part.includes('cs') || part === 'com') {
        subjects.add('Computer Science');
      } else if (part === 'ai' || part === 'artificial intelligence') {
        subjects.add('AI');
      } else if (part === 'it' || part === 'information technology') {
        subjects.add('IT');
      } else {
        // Fallback for custom subject names
        subjects.add(part.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
      }
    });
    return Array.from(subjects);
  };

  // ── Excel Import Handler (Generates Preview) ──
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('handleExcelImport triggered! File:', file, 'currentBranch:', currentBranch, 'currentAcademicYear:', currentAcademicYear);
    
    if (!file) {
      alert('Import failed: No file selected.');
      return;
    }
    if (!currentBranch || !currentAcademicYear) {
      alert(`Import failed: Missing context. Branch: ${currentBranch ? 'Selected' : 'NOT Selected'}, Academic Year: ${currentAcademicYear ? 'Selected' : 'NOT Selected'}. Please select them in the header first.`);
      return;
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';

    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rows.length === 0) {
        setImportResults({ imported: 0, skipped: [{ row: 0, reason: 'Excel file is empty or has no data rows.' }] });
        setShowImportResults(true);
        setImporting(false);
        return;
      }

      // Load all batches to match batch names
      const { data: batchesData } = await supabase
        .from('batches')
        .select('id, name, class')
        .eq('branch_id', currentBranch.id)
        .eq('academic_year_id', currentAcademicYear.id);
      const batchesList = batchesData || [];
      const batchMap = new Map(batchesList.map(b => [b.name.toLowerCase().trim(), b]));

      const previewRows = rows.map((row, index) => {
        const rowNum = index + 2;

        // Support exact column header names from the user's screenshot
        const name = (row['Name'] || row['name'] || '').toString().trim();
        const school = (row['School Name'] || row['school_name'] || row['School'] || row['school'] || '').toString().trim();
        const classVal = (row['Class'] || row['class'] || '').toString().trim();
        const board = (row['Board'] || row['board'] || '').toString().trim().toUpperCase();
        const batchName = (row['Batch'] || row['batch'] || row['Batch Name'] || row['batch_name'] || '').toString().trim();
        const subjectsRaw = (row['Subject'] || row['subject'] || row['Subjects'] || row['subjects'] || '').toString().trim();
        const statusRaw = (row['Status'] || row['status'] || '').toString().trim();
        const remarks = (row['Remarks'] || row['remarks'] || '').toString().trim();

        // Optional columns (with defaults if missing)
        const parentName = (row['Parent Name'] || row['parent_name'] || '').toString().trim();
        const dobRaw = row['Date of Birth'] || row['date_of_birth'] || row['DOB'] || row['dob'] || '';
        const gender = (row['Gender'] || row['gender'] || 'Male').toString().trim();
        const address = (row['Address'] || row['address'] || '').toString().trim();

        // 1. Validate required Name
        if (!name) {
          return { rowNum, isValid: false, errorReason: 'Missing Name', name, school, classVal, board, batchName, subjectsRaw, statusRaw };
        }

        // 2. Validate Class
        if (!classVal || !['7', '8', '9', '10', '11', '12'].includes(classVal)) {
          return { rowNum, isValid: false, errorReason: `Class must be between 7 and 12 (got "${classVal}")`, name, school, classVal, board, batchName, subjectsRaw, statusRaw };
        }

        // 3. Validate Board based on class
        if (['7', '8', '9', '10'].includes(classVal)) {
          if (!board) {
            return { rowNum, isValid: false, errorReason: 'Missing Board (Mandatory for Class 7-10)', name, school, classVal, board, batchName, subjectsRaw, statusRaw };
          }
          if (!['ICSE', 'CBSE'].includes(board)) {
            return { rowNum, isValid: false, errorReason: `Board must be "ICSE" or "CBSE" for Class 7-10 (got "${board}")`, name, school, classVal, board, batchName, subjectsRaw, statusRaw };
          }
        } else if (['11', '12'].includes(classVal)) {
          if (board && !['ISC', 'CBSE'].includes(board)) {
            return { rowNum, isValid: false, errorReason: `Board must be "ISC" or "CBSE" for Class 11-12 (got "${board}")`, name, school, classVal, board, batchName, subjectsRaw, statusRaw };
          }
        }

        // 4. Resolve Batch Name
        if (!batchName) {
          return { rowNum, isValid: false, errorReason: 'Missing Batch Name', name, school, classVal, board, batchName, subjectsRaw, statusRaw };
        }
        const matchedBatch = batchMap.get(batchName.toLowerCase().trim());
        if (!matchedBatch) {
          return { rowNum, isValid: false, errorReason: `Batch "${batchName}" not found in branch`, name, school, classVal, board, batchName, subjectsRaw, statusRaw };
        }

        // Validate batch class matches student class
        if (matchedBatch.class !== classVal) {
          return { rowNum, isValid: false, errorReason: `Batch class (${matchedBatch.class}) mismatch with student class (${classVal})`, name, school, classVal, board, batchName, subjectsRaw, statusRaw };
        }

        // 5. Resolve Subjects & Package
        const explicitPackage = (row['Package Type'] || row['package_type'] || '').toString().trim();
        const resolvedPackageType = explicitPackage || getPackageTypeFromBatchName(matchedBatch.name, 'Boards');
        const resolvedSubjects = parseSubjects(subjectsRaw, resolvedPackageType);

        // 6. Parse DOB
        let dob: string | null = null;
        if (dobRaw) {
          if (typeof dobRaw === 'number') {
            const excelDate = XLSX.SSF.parse_date_code(dobRaw);
            if (excelDate) {
              dob = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
            }
          } else {
            const parsed = new Date(dobRaw);
            if (!isNaN(parsed.getTime())) {
              dob = parsed.toISOString().split('T')[0];
            }
          }
        }

        // 7. Map Status
        let resolvedStatus: 'Active' | 'Dropped Out' = 'Active';
        if (statusRaw.toLowerCase().includes('discontinue') || statusRaw.toLowerCase().includes('inactive')) {
          resolvedStatus = 'Dropped Out';
        }

        return {
          rowNum,
          isValid: true,
          name: toTitleCase(name),
          parentName: parentName ? toTitleCase(parentName) : '',
          dob: dob || '',
          gender: gender || 'Male',
          school: school || '',
          address: address || '',
          classVal,
          board: board || '',
          batchName: matchedBatch.name,
          resolvedBatchId: matchedBatch.id,
          resolvedPackageType,
          resolvedSubjects,
          resolvedStatus,
          remarks
        };
      });

      console.log('Excel file parsed successfully. Preview rows count:', previewRows.length);
      setImportPreviewRows(previewRows);
      setShowImportPreview(true);
    } catch (err: any) {
      console.error('Excel import failed during reading/parsing:', err);
      alert(`Failed to read/parse Excel file: ${err.message || err}`);
      setImportResults({ imported: 0, skipped: [{ row: 0, reason: `Failed to read Excel file: ${err.message || err}` }] });
      setShowImportResults(true);
    } finally {
      setImporting(false);
    }
  };

  // ── Confirm Excel Import (Performs Supabase Inserts) ──
  const handleConfirmImport = async () => {
    if (!currentBranch || !currentAcademicYear) return;
    setImporting(true);

    const validRows = importPreviewRows.filter(r => r.isValid);
    const skipped: { row: number; reason: string }[] = importPreviewRows
      .filter(r => !r.isValid)
      .map(r => ({ row: r.rowNum, reason: r.errorReason || 'Invalid fields' }));

    let importedCount = 0;
    const newStudentItems: StudentListItem[] = [];

    try {
      // Fetch sequence start count
      const { count: existingCount } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', currentBranch.id);
      let nextSeq = (existingCount || 0) + 1;

      for (const row of validRows) {
        const code = `SHK-${currentBranch.code}-${String(nextSeq).padStart(4, '0')}`;

        // 1. Insert Student profile (try with branch_id and board column, fallback if not available)
        let studentData;
        let sErr;

        const { data: sDataWithBranch, error: sErrWithBranch } = await supabase
          .from('students')
          .insert({
            student_code: code,
            name: row.name,
            parent_name: row.parentName || null,
            date_of_birth: row.dob || null,
            gender: row.gender || 'Male',
            address: row.address || null,
            school: row.school || null,
            admission_date: new Date().toISOString().split('T')[0],
            branch_id: currentBranch.id,
            board: row.board || null
          })
          .select()
          .single();

        if (sErrWithBranch) {
          console.warn('Bulk student insert with branch/board failed, retrying without:', sErrWithBranch.message);
          const { data: sDataWithoutBranch, error: sErrWithoutBranch } = await supabase
            .from('students')
            .insert({
              student_code: code,
              name: row.name,
              parent_name: row.parentName || null,
              date_of_birth: row.dob || null,
              gender: row.gender || 'Male',
              address: row.address || null,
              school: row.school || null,
              admission_date: new Date().toISOString().split('T')[0]
            })
            .select()
            .single();

          if (sErrWithoutBranch) {
            sErr = sErrWithoutBranch;
          } else {
            studentData = sDataWithoutBranch;
          }
        } else {
          studentData = sDataWithBranch;
        }

        if (sErr) {
          skipped.push({ row: row.rowNum, reason: `Database Student error: ${sErr.message}` });
          continue;
        }

        // 2. Insert Enrollment record (try with board column, fallback if not available)
        let enrollData;
        let eErr;

        const { data: eDataWithBoard, error: eErrWithBoard } = await supabase
          .from('enrollments')
          .insert({
            student_id: studentData.id,
            academic_year_id: currentAcademicYear.id,
            branch_id: currentBranch.id,
            class: row.classVal,
            board: row.board || null,
            batch_id: row.resolvedBatchId,
            package_type: row.resolvedPackageType,
            subjects_taken: row.resolvedSubjects,
            status: row.resolvedStatus,
            status_effective_date: new Date().toISOString().split('T')[0]
          })
          .select()
          .single();

        if (eErrWithBoard) {
          console.warn('Bulk enrollment insert with board failed, retrying without board:', eErrWithBoard.message);
          const { data: eDataWithoutBoard, error: eErrWithoutBoard } = await supabase
            .from('enrollments')
            .insert({
              student_id: studentData.id,
              academic_year_id: currentAcademicYear.id,
              branch_id: currentBranch.id,
              class: row.classVal,
              batch_id: row.resolvedBatchId,
              package_type: row.resolvedPackageType,
              subjects_taken: row.resolvedSubjects,
              status: row.resolvedStatus,
              status_effective_date: new Date().toISOString().split('T')[0]
            })
            .select()
            .single();

          if (eErrWithoutBoard) {
            eErr = eErrWithoutBoard;
          } else {
            enrollData = eDataWithoutBoard;
          }
        } else {
          enrollData = eDataWithBoard;
        }

        if (eErr) {
          // Attempt rollback student if enrollment fails
          await supabase.from('students').delete().eq('id', studentData.id);
          skipped.push({ row: row.rowNum, reason: `Database Enrollment error: ${eErr.message}` });
          continue;
        }

        newStudentItems.push({
          id: enrollData.id,
          studentId: studentData.id,
          student_code: code,
          name: row.name,
          parent_name: row.parentName,
          class: row.classVal,
          board: enrollData.board || '',
          batch_id: row.resolvedBatchId || '',
          batch_name: row.batchName,
          package_type: row.resolvedPackageType,
          subjects_taken: row.resolvedSubjects,
          status: row.resolvedStatus,
          admission_date: studentData.admission_date,
          school: row.school,
          address: row.address,
          dob: row.dob || ''
        });

        nextSeq++;
        importedCount++;
      }

      // Add successfully imported items to local state
      if (newStudentItems.length > 0) {
        setStudents(prev => [...newStudentItems, ...prev]);
      }
    } catch (err: any) {
      skipped.push({ row: 0, reason: `Import operation interrupted: ${err.message || err}` });
    } finally {
      // Sort skipped list by row number
      skipped.sort((a, b) => a.row - b.row);
      setImportResults({ imported: importedCount, skipped });
      setShowImportPreview(false);
      setShowImportResults(true);
      setImporting(false);
    }
  };

    // ── Excel Export Handler ──
    const handleExcelExport = () => {
      const exportData = filteredStudents.map(st => ({
        'Student Code': st.student_code,
        'Name': st.name,
        'Parent Name': st.parent_name || '',
        'Date of Birth': st.dob || '',
        'Gender': st.gender || '',
        'School': st.school || '',
        'Address': st.address || '',
        'Class': st.class,
        'Board': st.board || '',
        'Batch': st.batch_name,
        'Package': st.package_type,
        'Subjects': (st.subjects_taken || []).join(', '),
        'Status': st.status
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      // Auto-size columns
      const colWidths = Object.keys(exportData[0] || {}).map(key => ({
        wch: Math.max(key.length + 2, ...exportData.map(row => String((row as any)[key] || '').length + 2))
      }));
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Students');
      XLSX.writeFile(wb, `Students_Export_${new Date().toLocaleDateString('en-CA')}.xlsx`);
    };

    // ── Download Template ──
    const handleDownloadTemplate = () => {
      const templateData = [
        {
          'Name': 'Rahul Sharma',
          'Parent Name': 'Suresh Sharma',
          'Date of Birth': '2008-05-14',
          'Gender': 'Male',
          'School': 'DPS Bokaro',
          'Address': 'Sector 4, Bokaro',
          'Class': '11',
          'Board': 'ISC',
          'Batch Name': '11th JEE Batch A',
          'Package Type': 'JEE',
          'Subjects': 'Physics, Chemistry, Mathematics'
        }
      ];
      const ws = XLSX.utils.json_to_sheet(templateData);
      ws['!cols'] = [
        { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 8 },
        { wch: 18 }, { wch: 24 }, { wch: 6 }, { wch: 10 }, { wch: 22 },
        { wch: 14 }, { wch: 40 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Students');
      XLSX.writeFile(wb, 'Student_Import_Template.xlsx');
    };

    return (
      <div className="page-column">

        {/* 1. Header Toolbar */}
        <div className="toolbar">
          {/* Search Input */}
          <div className="search-input-wrap" style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '400px' }}>
            <Search size={18} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-disabled)'
            }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search students, codes, parent names..."
              style={{ paddingLeft: '38px', minHeight: '40px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Buttons and Switchers */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {!isMentor && (
              <button
                className="btn btn-primary"
                style={{ gap: '8px' }}
                onClick={() => setShowAddModal(true)}
              >
                <UserPlus size={18} />
                <span>Admit Student</span>
              </button>
            )}

            {/* Excel Import/Export Buttons */}
            {!isMentor && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={handleExcelImport}
                />
                <button
                  className="btn btn-secondary"
                  style={{ gap: '6px', padding: '8px 14px', minHeight: '38px', fontSize: '13px' }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                >
                  <Upload size={16} />
                  <span>{importing ? 'Importing...' : 'Import'}</span>
                </button>
              </>
            )}
            <button
              className="btn btn-secondary"
              style={{ gap: '6px', padding: '8px 14px', minHeight: '38px', fontSize: '13px' }}
              onClick={handleExcelExport}
              disabled={filteredStudents.length === 0}
            >
              <Download size={16} />
              <span>Export</span>
            </button>

            <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              <button
                className="btn btn-secondary"
                style={{
                  border: 'none', borderRadius: 0, padding: '8px 12px', minHeight: '38px',
                  backgroundColor: viewMode === 'list' ? 'var(--surface-secondary)' : 'transparent',
                  color: viewMode === 'list' ? 'var(--primary-orange)' : 'var(--text-secondary)'
                }}
                onClick={() => setViewMode('list')}
              >
                <List size={18} />
              </button>
              <button
                className="btn btn-secondary"
                style={{
                  border: 'none', borderRadius: 0, padding: '8px 12px', minHeight: '38px',
                  backgroundColor: viewMode === 'card' ? 'var(--surface-secondary)' : 'transparent',
                  color: viewMode === 'card' ? 'var(--primary-orange)' : 'var(--text-secondary)'
                }}
                onClick={() => setViewMode('card')}
              >
                <Grid size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* 2. Filters Row */}
        <div style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: '16px 20px',
          backgroundColor: 'var(--surface-card)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
            <Filter size={16} />
            <span style={{ fontWeight: '600', fontSize: '13px' }}>Filters:</span>
          </div>

          {/* Class Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="caption">Class</span>
            <select
              className="form-control"
              style={{ width: '100px', padding: '4px 8px', minHeight: '32px', fontSize: '13px' }}
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setBatchFilter('All');
              }}
            >
              <option value="All">All</option>
              <option value="11">Class 11</option>
              <option value="12">Class 12</option>
              <option value="7">Class 7</option>
              <option value="8">Class 8</option>
              <option value="9">Class 9</option>
              <option value="10">Class 10</option>
            </select>
          </div>

          {/* Batch Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="caption">Batch</span>
            <select
              className="form-control"
              style={{ width: '150px', padding: '4px 8px', minHeight: '32px', fontSize: '13px' }}
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
            >
              <option value="All">All Batches</option>
              {allBatches
                .filter(b => classFilter === 'All' || b.class === classFilter)
                .map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))
              }
            </select>
          </div>

          {/* Status Filter (multi-select pills) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span className="caption" style={{ marginRight: '2px' }}>Status</span>
            {['Active', 'Leave of Absence', 'Batch Transfer', 'Completed', 'Dropped Out'].map(s => {
              const isActive = statusFilters.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setStatusFilters(prev =>
                      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                    );
                  }}
                  style={{
                    padding: '3px 10px',
                    fontSize: '12px',
                    fontWeight: '600',
                    borderRadius: '14px',
                    border: isActive ? '1.5px solid var(--primary-orange)' : '1px solid var(--border-color)',
                    backgroundColor: isActive ? 'rgba(255, 152, 0, 0.1)' : 'transparent',
                    color: isActive ? 'var(--primary-orange)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {s}
                </button>
              );
            })}
            {statusFilters.length > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilters([])}
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontWeight: '500',
                  borderRadius: '14px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-disabled)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* 3. Main Directory Content */}
        {loading ? (
          <div className="skeleton" style={{ height: '300px', width: '100%' }} />
        ) : filteredStudents.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '64px' }}>
            <User size={48} style={{ color: 'var(--text-disabled)', marginBottom: '16px' }} />
            <h3>No students found</h3>
            <p className="secondary-text">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <>
            {/* List/Table View (Desktop Only) */}
            <div className={`table-container table-desktop ${viewMode === 'card' ? 'hidden' : ''}`} style={{ display: viewMode === 'card' ? 'none' : 'block' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Student Code</th>
                    <th>Name</th>
                    <th>Parent Name</th>
                    <th>Class</th>
                    <th>Board</th>
                    <th>Batch</th>
                    <th>Package</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((st) => (
                    <tr key={st.id}>
                      <td style={{ fontWeight: '600', color: 'var(--primary-orange)' }}>{st.student_code}</td>
                      <td style={{ fontWeight: '500' }}>{st.name}</td>
                      <td className="secondary-text">{st.parent_name}</td>
                      <td>Class {st.class}</td>
                      <td>{st.board || '—'}</td>
                      <td>{st.batch_name}</td>
                      <td>
                        <span className="badge badge-info">{st.package_type}</span>
                      </td>
                      <td>
                        <span className={`badge ${st.status === 'Active' ? 'badge-success' :
                          st.status === 'Leave of Absence' ? 'badge-warning' :
                            st.status === 'Dropped Out' ? 'badge-error' : 'badge-info'
                          }`}>
                          {st.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 12px', minHeight: '32px', fontSize: '13px' }}
                          onClick={() => setSelectedStudent(st)}
                        >
                          View Profile
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Card View (Mobile default, or toggle) */}
            <div className={`mobile-card-list ${viewMode === 'card' ? 'grid-cards' : ''}`} style={{
              display: viewMode === 'card' ? 'grid' : undefined
            }}>
              {filteredStudents.map((st) => (
                <div key={st.id} className="card" style={{ margin: 0, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary-orange)' }}>{st.student_code}</span>
                      <h3 style={{ fontSize: '16px', marginTop: '4px' }}>{st.name}</h3>
                    </div>
                    <span className={`badge ${st.status === 'Active' ? 'badge-success' :
                      st.status === 'Leave of Absence' ? 'badge-warning' :
                        st.status === 'Dropped Out' ? 'badge-error' : 'badge-info'
                      }`}>
                      {st.status}
                    </span>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: '8px' }} className="caption">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Parent:</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{st.parent_name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Class & Batch:</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>Class {st.class} ({st.batch_name})</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Board:</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{st.board || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Package:</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{st.package_type}</span>
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', minHeight: '40px' }}
                    onClick={() => setSelectedStudent(st)}
                  >
                    View Full Profile
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 4. Admission / Add Student Modal (Admins/Directors only) */}
        {showAddModal && (
          <div className="modal-overlay">
            <div className="card modal-card" style={{ maxWidth: '600px' }}>
              <button
                className="btn btn-tertiary"
                style={{ position: 'absolute', right: '16px', top: '16px', padding: '8px', minHeight: '36px' }}
                onClick={() => setShowAddModal(false)}
              >
                <X size={20} />
              </button>

              <h2 style={{ fontSize: '20px', marginBottom: '24px' }}>Admit New Student</h2>

              <form onSubmit={handleAdmission} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="grid-form-2col">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Student Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={newStudent.name}
                      onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val === val.toUpperCase()) {
                          setNewStudent(prev => ({ ...prev, name: toTitleCase(val) }));
                        }
                      }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Parent/Guardian Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newStudent.parentName}
                      onChange={(e) => setNewStudent({ ...newStudent, parentName: e.target.value })}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val === val.toUpperCase()) {
                          setNewStudent(prev => ({ ...prev, parentName: toTitleCase(val) }));
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="grid-form-2col">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Date of Birth</label>
                    <input
                      type="date"
                      className="form-control"
                      value={newStudent.dob}
                      onChange={(e) => setNewStudent({ ...newStudent, dob: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Gender</label>
                    <select
                      className="form-control"
                      value={newStudent.gender}
                      onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value })}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid-form-2col">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">School Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. KV School"
                      value={newStudent.school}
                      onChange={(e) => setNewStudent({ ...newStudent, school: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0, visibility: 'hidden' }}>
                    <label className="form-label">Placeholder</label>
                    <input type="text" className="form-control" />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Address</label>
                  <textarea
                    className="form-control"
                    style={{ minHeight: '60px', resize: 'vertical' }}
                    value={newStudent.address}
                    onChange={(e) => setNewStudent({ ...newStudent, address: e.target.value })}
                  />
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>Academic Allocation</h3>
                  <div className="grid-form-2col">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Enrolled Class</label>
                      <select
                        className="form-control"
                        value={newStudent.classVal}
                        onChange={(e) => {
                          const newClass = e.target.value;
                          setNewStudent(prev => ({
                            ...prev,
                            classVal: newClass,
                            board: '' // reset board to avoid invalid board values for class
                          }));
                        }}
                      >
                        {Array.from(
                          { length: (currentBranch?.class_range_max || 12) - (currentBranch?.class_range_min || 11) + 1 },
                          (_, i) => {
                            const cls = String((currentBranch?.class_range_min || 11) + i);
                            return (
                              <option key={cls} value={cls}>
                                Class {cls}
                              </option>
                            );
                          }
                        )}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">
                        Board {['7', '8', '9', '10'].includes(newStudent.classVal) ? '*' : ''}
                      </label>
                      {['7', '8', '9', '10'].includes(newStudent.classVal) ? (
                        <select
                          className="form-control"
                          required
                          value={newStudent.board}
                          onChange={(e) => setNewStudent({ ...newStudent, board: e.target.value })}
                        >
                          <option value="">Select Board *</option>
                          <option value="ICSE">ICSE</option>
                          <option value="CBSE">CBSE</option>
                        </select>
                      ) : (
                        <select
                          className="form-control"
                          value={newStudent.board}
                          onChange={(e) => setNewStudent({ ...newStudent, board: e.target.value })}
                        >
                          <option value="">None / Not Specified</option>
                          <option value="ISC">ISC</option>
                          <option value="CBSE">CBSE</option>
                        </select>
                      )}
                    </div>
                  </div>
                  <div className="grid-form-2col" style={{ marginTop: '16px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Batch *</label>
                      <select
                        className="form-control"
                        required
                        value={newStudent.batchId}
                        onChange={(e) => setNewStudent({ ...newStudent, batchId: e.target.value })}
                      >
                        {availableBatches.length === 0 ? (
                          <option value="">No batches for this class</option>
                        ) : (
                          availableBatches.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))
                        )}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Package Option</label>
                      <select
                        className="form-control"
                        value={newStudent.packageType}
                        onChange={(e) => {
                          const val = e.target.value;
                          let defaultSubjects: string[] = [];
                          if (val === 'JEE') {
                            defaultSubjects = ['Physics', 'Chemistry', 'Mathematics'];
                          } else if (val === 'NEET') {
                            defaultSubjects = ['Physics', 'Chemistry', 'Biology'];
                          } else {
                            defaultSubjects = [];
                          }
                          setNewStudent({ ...newStudent, packageType: val, subjects: defaultSubjects });
                        }}
                      >
                        <option value="JEE">JEE Package</option>
                        <option value="NEET">NEET Package</option>
                        <option value="Boards">Boards (Subject Wise)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: '16px' }}>
                    <label className="form-label">Subjects Taken *</label>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: '10px',
                      backgroundColor: 'var(--surface-secondary)',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      marginTop: '6px'
                    }}>
                      {(() => {
                        // Determine if class 7-10 for extra subjects
                        const isClass7to10 = ['7', '8', '9', '10'].includes(newStudent.classVal);
                        const extraSubjects7to10 = isClass7to10 ? ['AI', 'IT'] : [];

                        if (newStudent.packageType === 'JEE') {
                          const core = ['Physics', 'Chemistry', 'Mathematics'];
                          const optionals = ['Biology (Board)', 'Biology (NEET)', 'Computer Science', ...extraSubjects7to10];
                          return (
                            <>
                              {core.map(s => (
                                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'not-allowed', color: 'var(--text-secondary)' }} className="caption">
                                  <input type="checkbox" checked disabled style={{ cursor: 'not-allowed' }} />
                                  <span>{s} (Core)</span>
                                </label>
                              ))}
                              {optionals.map(s => {
                                const checked = newStudent.subjects.includes(s);
                                return (
                                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} className="caption">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        const updated = checked
                                          ? newStudent.subjects.filter(sub => sub !== s)
                                          : [...newStudent.subjects, s];
                                        setNewStudent({ ...newStudent, subjects: updated });
                                      }}
                                    />
                                    <span>{s}</span>
                                  </label>
                                );
                              })}
                            </>
                          );
                        } else if (newStudent.packageType === 'NEET') {
                          const core = ['Physics', 'Chemistry', 'Biology'];
                          const optionals = ['Mathematics (Board)', 'Mathematics (JEE)', 'Mathematics (NEET)', 'Computer Science', ...extraSubjects7to10];
                          return (
                            <>
                              {core.map(s => (
                                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'not-allowed', color: 'var(--text-secondary)' }} className="caption">
                                  <input type="checkbox" checked disabled style={{ cursor: 'not-allowed' }} />
                                  <span>{s} (Core)</span>
                                </label>
                              ))}
                              {optionals.map(s => {
                                const checked = newStudent.subjects.includes(s);
                                return (
                                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} className="caption">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        const updated = checked
                                          ? newStudent.subjects.filter(sub => sub !== s)
                                          : [...newStudent.subjects, s];
                                        setNewStudent({ ...newStudent, subjects: updated });
                                      }}
                                    />
                                    <span>{s}</span>
                                  </label>
                                );
                              })}
                            </>
                          );
                        } else {
                          // Boards
                          const subjects = ['Physics (Board)', 'Chemistry (Board)', 'Mathematics (Board)', 'Biology (Board)', 'Computer Science', ...extraSubjects7to10];
                          return (
                            <>
                              {subjects.map(s => {
                                const checked = newStudent.subjects.includes(s);
                                return (
                                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} className="caption">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        const updated = checked
                                          ? newStudent.subjects.filter(sub => sub !== s)
                                          : [...newStudent.subjects, s];
                                        setNewStudent({ ...newStudent, subjects: updated });
                                      }}
                                    />
                                    <span>{s}</span>
                                  </label>
                                );
                              })}
                            </>
                          );
                        }
                      })()}
                    </div>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
                  Finalize Admission & Save
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 5. Student Details Tabbed Overlay Modal */}
        {selectedStudent && (
          <div className="modal-overlay">
            <StudentDetailModal
              student={selectedStudent}
              isMentor={isMentor}
              onClose={() => setSelectedStudent(null)}
              onUpdate={(updatedStudent: StudentListItem) => {
                setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
                setSelectedStudent(updatedStudent);
              }}
            />
          </div>
        )}

      {/* ── Import Preview Modal ── */}
      {showImportPreview && (
        <div className="modal-overlay" onClick={() => setShowImportPreview(false)}>
          <div className="card modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileSpreadsheet size={22} style={{ color: 'var(--primary-orange)' }} />
                Excel Import Preview
              </h3>
              <button className="btn btn-secondary" style={{ padding: '6px', minHeight: 'auto' }} onClick={() => setShowImportPreview(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '120px', backgroundColor: 'var(--surface-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{importPreviewRows.length}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Rows</div>
              </div>
              <div style={{ flex: 1, minWidth: '120px', backgroundColor: 'rgba(74, 222, 128, 0.1)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(74, 222, 128, 0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#16A34A' }}>{importPreviewRows.filter(r => r.isValid).length}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Valid Rows</div>
              </div>
              <div style={{ flex: 1, minWidth: '120px', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#DC2626' }}>{importPreviewRows.filter(r => !r.isValid).length}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Errors</div>
              </div>
            </div>

            <div style={{
              maxHeight: '360px', overflowY: 'auto', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)', marginBottom: '20px'
            }}>
              <table className="data-table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--surface-secondary)', zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '10px 12px', fontSize: '12px', width: '50px' }}>Row</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px' }}>Name</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px' }}>Parent Name</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', width: '70px' }}>Class</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', width: '70px' }}>Board</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px' }}>Batch</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px' }}>Package</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px' }}>Subjects</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px' }}>Status/Error</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreviewRows.map((row, idx) => (
                    <tr key={idx} style={{
                      backgroundColor: row.isValid ? 'transparent' : 'rgba(239, 68, 68, 0.04)',
                      borderBottom: '1px solid var(--border-color)'
                    }}>
                      <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600 }}>{row.rowNum}</td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: row.isValid ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{row.name || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{row.parentName || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '12px' }}>{row.classVal ? `Class ${row.classVal}` : '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{row.board || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{row.batchName || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '12px' }}>
                        {row.resolvedPackageType ? (
                          <span className="badge badge-info" style={{ fontSize: '10px', padding: '2px 6px' }}>{row.resolvedPackageType}</span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {row.resolvedSubjects && row.resolvedSubjects.length > 0
                          ? row.resolvedSubjects.join(', ')
                          : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '12px' }}>
                        {row.isValid ? (
                          <span style={{ color: '#16A34A', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16A34A' }}></span>
                            Ready ({row.resolvedStatus})
                          </span>
                        ) : (
                          <span style={{ color: '#DC2626', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }} title={row.errorReason}>
                            <AlertCircle size={14} />
                            {row.errorReason}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowImportPreview(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={importPreviewRows.filter(r => r.isValid).length === 0}
                onClick={handleConfirmImport}
              >
                {importing ? 'Importing...' : `Confirm Import (${importPreviewRows.filter(r => r.isValid).length} Students)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Results Modal ── */}
        {showImportResults && (
          <div className="modal-overlay" onClick={() => setShowImportResults(false)}>
            <div className="card modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileSpreadsheet size={22} style={{ color: 'var(--primary-orange)' }} />
                  Import Results
                </h3>
                <button className="btn btn-secondary" style={{ padding: '6px', minHeight: 'auto' }} onClick={() => setShowImportResults(false)}>
                  <X size={18} />
                </button>
              </div>

              {/* Summary cards */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <div style={{
                  flex: 1, padding: '16px', borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(22, 163, 74, 0.1)', border: '1px solid rgba(22, 163, 74, 0.25)', textAlign: 'center'
                }}>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#16A34A' }}>{importResults.imported}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Students Imported</div>
                </div>
                <div style={{
                  flex: 1, padding: '16px', borderRadius: 'var(--radius-md)',
                  backgroundColor: importResults.skipped.length > 0 ? 'rgba(234, 88, 12, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                  border: `1px solid ${importResults.skipped.length > 0 ? 'rgba(234, 88, 12, 0.25)' : 'rgba(107, 114, 128, 0.2)'}`,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: importResults.skipped.length > 0 ? '#EA580C' : 'var(--text-secondary)' }}>
                    {importResults.skipped.length}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Rows Skipped</div>
                </div>
              </div>

              {/* Skipped rows detail */}
              {importResults.skipped.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Skipped Rows</div>
                  <div style={{
                    maxHeight: '200px', overflowY: 'auto', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)', fontSize: '12px'
                  }}>
                    <table className="data-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: '70px', padding: '8px 12px' }}>Row</th>
                          <th style={{ padding: '8px 12px' }}>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResults.skipped.map((s: { row: number; reason: string }, i: number) => (
                          <tr key={i}>
                            <td style={{ padding: '6px 12px', fontWeight: 600 }}>{s.row > 0 ? `Row ${s.row}` : '—'}</td>
                            <td style={{ padding: '6px 12px', color: '#EA580C' }}>{s.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-secondary"
                  style={{ gap: '6px', fontSize: '13px' }}
                  onClick={handleDownloadTemplate}
                >
                  <FileSpreadsheet size={16} />
                  Download Template
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowImportResults(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // Student Detail Tabbed Modal Component
  function StudentDetailModal({
    student,
    isMentor,
    onClose,
    onUpdate
  }: {
    student: StudentListItem;
    isMentor: boolean;
    onClose: () => void;
    onUpdate: (updatedStudent: StudentListItem) => void;
  }) {
    const supabase = createClient();
    const { currentBranch, currentAcademicYear } = useAppStore();
    const [activeTab, setActiveTab] = useState<'info' | 'academic' | 'billing'>('info');

    const [loading, setLoading] = useState(true);
    const [subjectAttendance, setSubjectAttendance] = useState<SubjectAttendance[]>([]);
    const [attendanceTrend, setAttendanceTrend] = useState<AttendanceTrendPoint[]>([]);
    const [avgExamMark, setAvgExamMark] = useState<number | null>(null);
    const [examScores, setExamScores] = useState<any[]>([]);
    const [installments, setInstallments] = useState<any[]>([]);
    const [admissionMonthYear, setAdmissionMonthYear] = useState<string | null>(null);

    // Derived overall attendance
    const overallAttendance = useMemo(() => {
      if (subjectAttendance.length === 0) return null;
      const totalClasses = subjectAttendance.reduce((a, s) => a + s.totalClasses, 0);
      const totalPresent = subjectAttendance.reduce((a, s) => a + s.present, 0);
      if (totalClasses === 0) return null;
      return Math.round((totalPresent / totalClasses) * 1000) / 10;
    }, [subjectAttendance]);

    // Edit Profile State
    const [isEditing, setIsEditing] = useState(false);
    const [editState, setEditState] = useState({
      name: student.name,
      parentName: student.parent_name || '',
      dob: student.dob || '',
      gender: student.gender || 'Male',
      school: student.school || '',
      address: student.address || '',
      subjects: student.subjects_taken || [],
      batchId: student.batch_id || '',
      board: student.board || ''
    });
    const [savingEdit, setSavingEdit] = useState(false);
    const [availableBatches, setAvailableBatches] = useState<{ id: string; name: string }[]>([]);

    // Sync editState when student prop updates
    useEffect(() => {
      setEditState({
        name: student.name,
        parentName: student.parent_name || '',
        dob: student.dob || '',
        gender: student.gender || 'Male',
        school: student.school || '',
        address: student.address || '',
        subjects: student.subjects_taken || [],
        batchId: student.batch_id || '',
        board: student.board || ''
      });
    }, [student]);

    // Load available batches for the student's class
    useEffect(() => {
      if (!currentBranch || !currentAcademicYear || !student.class) return;
      (async () => {
        try {
          const { data } = await supabase
            .from('batches')
            .select('id, name')
            .eq('class', student.class)
            .eq('branch_id', currentBranch.id)
            .eq('academic_year_id', currentAcademicYear.id)
            .order('name');
          setAvailableBatches(data || []);
        } catch (err) {
          console.error('Failed to load available batches for editing:', err);
        }
      })();
    }, [currentBranch, currentAcademicYear, student.class]);

    const toTitleCase = (str: string) => {
      if (!str) return '';
      if (str === str.toUpperCase()) {
        return str
          .toLowerCase()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
      return str;
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
      e.preventDefault();

      // Validate Board
      const classVal = student.class;
      const board = editState.board;
      if (['7', '8', '9', '10'].includes(classVal)) {
        if (!board) {
          alert('Board is required for Class 7-10.');
          return;
        }
        if (!['ICSE', 'CBSE'].includes(board)) {
          alert('Board must be "ICSE" or "CBSE" for Class 7-10.');
          return;
        }
      } else if (['11', '12'].includes(classVal)) {
        if (board && !['ISC', 'CBSE'].includes(board)) {
          alert('Board must be "ISC" or "CBSE" for Class 11-12.');
          return;
        }
      }

      setSavingEdit(true);
      try {
        const finalName = toTitleCase(editState.name);
        const finalParentName = toTitleCase(editState.parentName);

        // Update student table (try with board, fallback if columns do not exist yet)
        let sErr;
        const { error: sErrWithBoard } = await supabase
          .from('students')
          .update({
            name: finalName,
            parent_name: finalParentName || null,
            date_of_birth: editState.dob || null,
            gender: editState.gender,
            school: editState.school,
            address: editState.address,
            board: editState.board || null
          })
          .eq('id', student.studentId);

        if (sErrWithBoard) {
          console.warn('Student update with board failed, retrying without:', sErrWithBoard.message);
          const { error: sErrWithoutBoard } = await supabase
            .from('students')
            .update({
              name: finalName,
              parent_name: finalParentName || null,
              date_of_birth: editState.dob || null,
              gender: editState.gender,
              school: editState.school,
              address: editState.address
            })
            .eq('id', student.studentId);
          if (sErrWithoutBoard) {
            sErr = sErrWithoutBoard;
          }
        }

        if (sErr) throw sErr;

        const selectedBatch = availableBatches.find(b => b.id === editState.batchId);
        const newBatchName = selectedBatch ? selectedBatch.name : student.batch_name;
        const newPackage = selectedBatch
          ? getPackageTypeFromBatchName(selectedBatch.name, student.package_type || 'Boards')
          : (student.package_type || 'Boards');

        // Update enrollment table for subjects, batch, package, and board (try with board, fallback if not available)
        let eErr;
        const { error: eErrWithBoard } = await supabase
          .from('enrollments')
          .update({
            batch_id: editState.batchId,
            package_type: newPackage,
            subjects_taken: editState.subjects,
            board: editState.board || null
          })
          .eq('id', student.id);

        if (eErrWithBoard) {
          console.warn('Enrollment update with board failed, retrying without board:', eErrWithBoard.message);
          const { error: eErrWithoutBoard } = await supabase
            .from('enrollments')
            .update({
              batch_id: editState.batchId,
              package_type: newPackage,
              subjects_taken: editState.subjects
            })
            .eq('id', student.id);
          
          if (eErrWithoutBoard) {
            eErr = eErrWithoutBoard;
          }
        }

        if (eErr) throw eErr;

        onUpdate({
          ...student,
          name: finalName,
          parent_name: finalParentName,
          dob: editState.dob,
          gender: editState.gender,
          school: editState.school,
          address: editState.address,
          subjects_taken: editState.subjects,
          batch_id: editState.batchId,
          batch_name: newBatchName,
          package_type: newPackage,
          board: editState.board || ''
        });

        setIsEditing(false);
      } catch (err) {
        console.error('Failed to update student profile:', err);
      } finally {
        setSavingEdit(false);
      }
    };

    // ── Batch Transfer State ──
    const [showTransfer, setShowTransfer] = useState(false);
    const [transferBatches, setTransferBatches] = useState<{ id: string; name: string }[]>([]);
    const [transferBatchId, setTransferBatchId] = useState('');
    const [savingTransfer, setSavingTransfer] = useState(false);

    // Load available batches for transfer (same class, exclude current)
    useEffect(() => {
      if (!showTransfer || !currentBranch || !currentAcademicYear) return;
      (async () => {
        const { data } = await supabase
          .from('batches')
          .select('id, name')
          .eq('class', student.class)
          .eq('branch_id', currentBranch.id)
          .eq('academic_year_id', currentAcademicYear.id)
          .order('name');
        const batches = (data || []).filter(b => b.id !== student.batch_id);
        setTransferBatches(batches);
        if (batches.length > 0) setTransferBatchId(batches[0].id);
      })();
    }, [showTransfer, currentBranch, currentAcademicYear, student.class, student.batch_id]);

    const handleBatchTransfer = async () => {
      if (!transferBatchId) return;
      setSavingTransfer(true);
      try {
        const newBatchName = transferBatches.find(b => b.id === transferBatchId)?.name || 'Unknown';
        const nameLower = newBatchName.toLowerCase();

        // Derive new package type and default subjects from batch name
        let newPackage = student.package_type;
        let newSubjects: string[] = student.subjects_taken || [];
        if (nameLower.includes('jee')) {
          newPackage = 'JEE';
          newSubjects = ['Physics', 'Chemistry', 'Mathematics'];
        } else if (nameLower.includes('neet')) {
          newPackage = 'NEET';
          newSubjects = ['Physics', 'Chemistry', 'Biology'];
        } else if (nameLower.includes('board')) {
          newPackage = 'Boards';
          newSubjects = ['Physics (Board)', 'Chemistry (Board)', 'Mathematics (Board)', 'Biology (Board)', 'Computer Science'];
        }

        const { error } = await supabase
          .from('enrollments')
          .update({
            batch_id: transferBatchId,
            package_type: newPackage,
            subjects_taken: newSubjects,
            status: 'Batch Transfer',
            status_effective_date: new Date().toISOString().split('T')[0]
          })
          .eq('id', student.id);

        if (error) throw error;

        onUpdate({
          ...student,
          batch_id: transferBatchId,
          batch_name: newBatchName,
          package_type: newPackage,
          subjects_taken: newSubjects,
          status: 'Batch Transfer'
        });
        setShowTransfer(false);
      } catch (err) {
        console.error('Batch transfer failed:', err);
      } finally {
        setSavingTransfer(false);
      }
    };

    // ── Status Change State ──
    const [showStatusChange, setShowStatusChange] = useState(false);
    const [newStatus, setNewStatus] = useState(student.status);
    const [savingStatus, setSavingStatus] = useState(false);

    const statusOptions = ['Active', 'Leave of Absence', 'Completed', 'Dropped Out'];

    const handleStatusChange = async () => {
      if (newStatus === student.status) { setShowStatusChange(false); return; }
      setSavingStatus(true);
      try {
        const { error } = await supabase
          .from('enrollments')
          .update({
            status: newStatus,
            status_effective_date: new Date().toISOString().split('T')[0]
          })
          .eq('id', student.id);

        if (error) throw error;

        onUpdate({ ...student, status: newStatus });
        setShowStatusChange(false);
      } catch (err) {
        console.error('Status change failed:', err);
      } finally {
        setSavingStatus(false);
      }
    };

    useEffect(() => {
      async function fetchDetails() {
        setLoading(true);
        try {
          // Fetch Attendance with class_sessions join for subject-wise breakdown
          const { data: attData } = await supabase
            .from('attendance')
            .select('status, class_sessions(subject_name, date)')
            .eq('enrollment_id', student.id);

          if (attData && attData.length > 0) {
            // Get subjects from enrollment, plus any additional from attendance data
            const enrolledSubjectsList = student.subjects_taken || [];
            const enrolledSubjects = new Set<string>(enrolledSubjectsList);
            attData.forEach((a: any) => {
              if (a.class_sessions?.subject_name) {
                enrolledSubjects.add(getEnrolledSubjectName(a.class_sessions.subject_name, enrolledSubjectsList));
              }
            });

            // Compute per-subject attendance
            const subjectMap = new Map<string, { present: number; absent: number; leave: number; total: number }>();
            enrolledSubjects.forEach(subj => subjectMap.set(subj, { present: 0, absent: 0, leave: 0, total: 0 }));

            attData.forEach((a: any) => {
              const rawSubj = a.class_sessions?.subject_name;
              if (!rawSubj) return;
              const subj = getEnrolledSubjectName(rawSubj, enrolledSubjectsList);
              if (!subjectMap.has(subj)) {
                subjectMap.set(subj, { present: 0, absent: 0, leave: 0, total: 0 });
              }
              const entry = subjectMap.get(subj)!;
              entry.total++;
              if (a.status === 'Present') entry.present++;
              else if (a.status === 'Absent') entry.absent++;
              else if (a.status === 'Leave') entry.leave++;
            });

            const subjectStats: SubjectAttendance[] = Array.from(subjectMap.entries()).map(([subject, stats]) => ({
              subject,
              totalClasses: stats.total,
              present: stats.present,
              absent: stats.absent,
              leave: stats.leave,
              percentage: stats.total > 0 ? Math.round((stats.present / stats.total) * 1000) / 10 : 0
            })).sort((a, b) => a.subject.localeCompare(b.subject));

            setSubjectAttendance(subjectStats);

            // Compute attendance trend over time (running average)
            const sortedRecords = [...attData]
              .filter((a: any) => a.class_sessions?.date)
              .sort((a: any, b: any) => new Date(a.class_sessions.date).getTime() - new Date(b.class_sessions.date).getTime());

            let runningPresent = 0;
            let runningTotal = 0;
            const trendMap = new Map<string, { present: number; total: number }>();

            sortedRecords.forEach((a: any) => {
              const dateStr = a.class_sessions.date;
              runningTotal++;
              if (a.status === 'Present') runningPresent++;
              trendMap.set(dateStr, { present: runningPresent, total: runningTotal });
            });

            const trend: AttendanceTrendPoint[] = Array.from(trendMap.entries()).map(([dateStr, stats]) => {
              const d = new Date(dateStr);
              return {
                date: dateStr,
                label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
                present: stats.present,
                total: stats.total,
                percentage: Math.round((stats.present / stats.total) * 1000) / 10
              };
            });

            setAttendanceTrend(trend);
          } else {
            setSubjectAttendance([]);
            setAttendanceTrend([]);
          }

          // Fetch Exam Scores
          const { data: resultsData } = await supabase
            .from('results')
            .select(`
            marks_obtained,
            percentage,
            rank_in_batch,
            exams (
              name,
              date,
              subject_name,
              max_marks
            )
          `)
            .eq('enrollment_id', student.id);

          if (resultsData && resultsData.length > 0) {
            const validResults = resultsData.filter((r: any) => parseFloat(r.marks_obtained) >= 0);
            if (validResults.length > 0) {
              const totalPct = validResults.reduce((acc, r) => acc + parseFloat(r.percentage), 0);
              setAvgExamMark(Math.round(totalPct / validResults.length));
            } else {
              setAvgExamMark(null);
            }

            const scores = resultsData.map((r: any) => ({
              date: r.exams?.date || '',
              subject: getEnrolledSubjectName(r.exams?.subject_name || '', student.subjects_taken || []),
              name: r.exams?.name || '',
              score: parseFloat(r.marks_obtained) < 0
                ? 'Absent'
                : `${r.marks_obtained}/${r.exams?.max_marks || 0} (${parseFloat(r.percentage).toFixed(1)}%)`,
              rank: r.rank_in_batch && parseFloat(r.marks_obtained) >= 0 ? `${r.rank_in_batch}` : '—'
            }));
            setExamScores(scores);
          } else {
            setAvgExamMark(null);
            setExamScores([]);
          }

          // Fetch Billing Dues
          if (!isMentor) {
            const { data: sfData } = await supabase
              .from('student_fees')
              .select(`
              id,
              fee_type,
              fee_installments (
                id,
                installment_number,
                due_date,
                due_amount,
                status
              )
            `)
              .eq('enrollment_id', student.id)
              .maybeSingle();

            if (sfData && sfData.fee_installments) {
              const list = sfData.fee_installments.map((fi: any) => {
                let term = '';
                if (sfData.fee_type === 'Monthly') {
                  term = fi.installment_number === 0 ? 'Admission Fee' : `Month ${fi.installment_number}`;
                } else {
                  term = `Installment ${fi.installment_number}`;
                }
                return {
                  term,
                  dueDate: fi.due_date,
                  amount: `₹${parseFloat(fi.due_amount).toLocaleString()}`,
                  status: fi.status,
                  instNum: fi.installment_number
                };
              }).sort((a: any, b: any) => a.instNum - b.instNum);
              setInstallments(list);

              // Fetch first payment date for Admission Month/Year
              const instIds = sfData.fee_installments.map((fi: any) => fi.id);
              if (instIds.length > 0) {
                const { data: payData } = await supabase
                  .from('payments')
                  .select('payment_date')
                  .in('installment_id', instIds)
                  .order('payment_date', { ascending: true })
                  .limit(1);
                if (payData && payData.length > 0) {
                  const d = new Date(payData[0].payment_date);
                  setAdmissionMonthYear(d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
                } else {
                  setAdmissionMonthYear(null);
                }
              } else {
                setAdmissionMonthYear(null);
              }
            } else {
              setInstallments([]);
              setAdmissionMonthYear(null);
            }
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
      fetchDetails();
    }, [student, isMentor]);

    return (
      <div className="card modal-card" style={{ maxWidth: '700px' }}>
        <button
          className="btn btn-tertiary"
          style={{ position: 'absolute', right: '16px', top: '16px', padding: '8px', minHeight: '36px' }}
          onClick={onClose}
        >
          <X size={20} />
        </button>

        {/* Modal Profile Header */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            backgroundColor: 'var(--surface-secondary)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'var(--primary-orange)'
          }}>
            <User size={30} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary-orange)' }}>{student.student_code}</span>
            <h2 style={{ margin: 0, fontSize: '20px' }}>{student.name}</h2>
          </div>
        </div>

        {/* Tab Headers */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '24px',
          gap: '24px'
        }}>
          <button
            className="btn btn-tertiary"
            style={{
              borderBottom: activeTab === 'info' ? '2px solid var(--primary-orange)' : 'none',
              color: activeTab === 'info' ? 'var(--primary-orange)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'info' ? '600' : '500',
              borderRadius: 0, paddingBottom: '12px', minHeight: 'unset'
            }}
            onClick={() => setActiveTab('info')}
          >
            General Info
          </button>
          <button
            className="btn btn-tertiary"
            style={{
              borderBottom: activeTab === 'academic' ? '2px solid var(--primary-orange)' : 'none',
              color: activeTab === 'academic' ? 'var(--primary-orange)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'academic' ? '600' : '500',
              borderRadius: 0, paddingBottom: '12px', minHeight: 'unset'
            }}
            onClick={() => setActiveTab('academic')}
          >
            Academic History
          </button>
          {/* Hide tab header from Mentor role */}
          {!isMentor && (
            <button
              className="btn btn-tertiary"
              style={{
                borderBottom: activeTab === 'billing' ? '2px solid var(--primary-orange)' : 'none',
                color: activeTab === 'billing' ? 'var(--primary-orange)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'billing' ? '600' : '500',
                borderRadius: 0, paddingBottom: '12px', minHeight: 'unset'
              }}
              onClick={() => setActiveTab('billing')}
            >
              Billing & Dues
            </button>
          )}
        </div>

        {/* Tab Contents */}
        <div style={{ minHeight: '260px' }}>

          {/* TABS 1: General Info */}
          {activeTab === 'info' && (
            isEditing ? (
              <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="grid-form-2col" style={{ gap: '16px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Student Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={editState.name}
                      onChange={(e) => setEditState({ ...editState, name: e.target.value })}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val === val.toUpperCase()) {
                          setEditState(prev => ({ ...prev, name: toTitleCase(val) }));
                        }
                      }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Parent / Guardian Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editState.parentName}
                      onChange={(e) => setEditState({ ...editState, parentName: e.target.value })}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val === val.toUpperCase()) {
                          setEditState(prev => ({ ...prev, parentName: toTitleCase(val) }));
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="grid-form-2col" style={{ gap: '16px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">School Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editState.school}
                      onChange={(e) => setEditState({ ...editState, school: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Date of Birth</label>
                    <input
                      type="date"
                      className="form-control"
                      value={editState.dob}
                      onChange={(e) => setEditState({ ...editState, dob: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid-form-2col" style={{ gap: '16px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Gender</label>
                    <select
                      className="form-control"
                      value={editState.gender}
                      onChange={(e) => setEditState({ ...editState, gender: e.target.value })}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Assigned Batch</label>
                    <select
                      className="form-control"
                      value={editState.batchId}
                      onChange={(e) => {
                        const newBatchId = e.target.value;
                        const selectedBatch = availableBatches.find(b => b.id === newBatchId);
                        let updatedSubjects = editState.subjects;
                        if (selectedBatch) {
                          const oldBatch = availableBatches.find(b => b.id === editState.batchId);
                          const oldPackage = oldBatch
                            ? getPackageTypeFromBatchName(oldBatch.name, student.package_type || 'Boards')
                            : (student.package_type || 'Boards');
                          const newPackage = getPackageTypeFromBatchName(selectedBatch.name, student.package_type || 'Boards');

                          if (oldPackage !== newPackage) {
                            if (newPackage === 'JEE') {
                              updatedSubjects = ['Physics', 'Chemistry', 'Mathematics'];
                            } else if (newPackage === 'NEET') {
                              updatedSubjects = ['Physics', 'Chemistry', 'Biology'];
                            } else if (newPackage === 'Boards') {
                              updatedSubjects = ['Physics (Board)', 'Chemistry (Board)', 'Mathematics (Board)', 'Biology (Board)', 'Computer Science'];
                            }
                          }
                        }
                        setEditState(prev => ({
                          ...prev,
                          batchId: newBatchId,
                          subjects: updatedSubjects
                        }));
                      }}
                    >
                      {availableBatches.length === 0 ? (
                        <option value={student.batch_id}>{student.batch_name}</option>
                      ) : (
                        availableBatches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <div className="grid-form-2col" style={{ gap: '16px', marginTop: '16px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">
                      Board {['7', '8', '9', '10'].includes(student.class) ? '*' : ''}
                    </label>
                    {['7', '8', '9', '10'].includes(student.class) ? (
                      <select
                        className="form-control"
                        required
                        value={editState.board}
                        onChange={(e) => setEditState({ ...editState, board: e.target.value })}
                      >
                        <option value="">Select Board *</option>
                        <option value="ICSE">ICSE</option>
                        <option value="CBSE">CBSE</option>
                      </select>
                    ) : (
                      <select
                        className="form-control"
                        value={editState.board}
                        onChange={(e) => setEditState({ ...editState, board: e.target.value })}
                      >
                        <option value="">None / Not Specified</option>
                        <option value="ISC">ISC</option>
                        <option value="CBSE">CBSE</option>
                      </select>
                    )}
                  </div>
                  <div className="form-group" style={{ margin: 0, visibility: 'hidden' }}>
                    <label className="form-label">Placeholder</label>
                    <input type="text" className="form-control" />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Address</label>
                  <textarea
                    className="form-control"
                    style={{ minHeight: '60px', resize: 'vertical' }}
                    value={editState.address}
                    onChange={(e) => setEditState({ ...editState, address: e.target.value })}
                  />
                </div>

                <div style={{ marginTop: '8px' }}>
                  <label className="form-label">Subjects Taken *</label>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '10px',
                    backgroundColor: 'var(--surface-secondary)',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    marginTop: '6px'
                  }}>
                    {(() => {
                      const selectedBatch = availableBatches.find(b => b.id === editState.batchId);
                      const packageType = selectedBatch
                        ? getPackageTypeFromBatchName(selectedBatch.name, student.package_type || 'Boards')
                        : (student.package_type || 'Boards');
                      // Add AI and IT for classes 7-10
                      const isClass7to10 = ['7', '8', '9', '10'].includes(student.class);
                      const extraSubjects7to10 = isClass7to10 ? ['AI', 'IT'] : [];

                      if (packageType === 'JEE') {
                        const core = ['Physics', 'Chemistry', 'Mathematics'];
                        const optionals = ['Biology (Board)', 'Biology (NEET)', 'Computer Science', ...extraSubjects7to10];
                        return (
                          <>
                            {core.map(s => (
                              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'not-allowed', color: 'var(--text-secondary)' }} className="caption">
                                <input type="checkbox" checked disabled style={{ cursor: 'not-allowed' }} />
                                <span>{s} (Core)</span>
                              </label>
                            ))}
                            {optionals.map(s => {
                              const checked = editState.subjects.includes(s);
                              return (
                                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} className="caption">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      const updated = checked
                                        ? editState.subjects.filter(sub => sub !== s)
                                        : [...editState.subjects, s];
                                      setEditState({ ...editState, subjects: updated });
                                    }}
                                  />
                                  <span>{s}</span>
                                </label>
                              );
                            })}
                          </>
                        );
                      } else if (packageType === 'NEET') {
                        const core = ['Physics', 'Chemistry', 'Biology'];
                        const optionals = ['Mathematics (Board)', 'Mathematics (JEE)', 'Mathematics (NEET)', 'Computer Science', ...extraSubjects7to10];
                        return (
                          <>
                            {core.map(s => (
                              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'not-allowed', color: 'var(--text-secondary)' }} className="caption">
                                <input type="checkbox" checked disabled style={{ cursor: 'not-allowed' }} />
                                <span>{s} (Core)</span>
                              </label>
                            ))}
                            {optionals.map(s => {
                              const checked = editState.subjects.includes(s);
                              return (
                                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} className="caption">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      const updated = checked
                                        ? editState.subjects.filter(sub => sub !== s)
                                        : [...editState.subjects, s];
                                      setEditState({ ...editState, subjects: updated });
                                    }}
                                  />
                                  <span>{s}</span>
                                </label>
                              );
                            })}
                          </>
                        );
                      } else {
                        // Boards
                        const subjects = ['Physics (Board)', 'Chemistry (Board)', 'Mathematics (Board)', 'Biology (Board)', 'Computer Science', ...extraSubjects7to10];
                        return (
                          <>
                            {subjects.map(s => {
                              const checked = editState.subjects.includes(s);
                              return (
                                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} className="caption">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      const updated = checked
                                        ? editState.subjects.filter(sub => sub !== s)
                                        : [...editState.subjects, s];
                                      setEditState({ ...editState, subjects: updated });
                                    }}
                                  />
                                  <span>{s}</span>
                                </label>
                              );
                            })}
                          </>
                        );
                      }
                    })()}
                  </div>
                </div>


                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={savingEdit}
                  >
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setIsEditing(false)}
                    disabled={savingEdit}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="grid-form-2col" style={{ gap: '20px' }}>
                  <div>
                    <span className="caption">Parent / Guardian</span>
                    <p style={{ fontWeight: '500', marginTop: '4px' }}>{student.parent_name || '—'}</p>
                  </div>
                  <div>
                    <span className="caption">Admission Month</span>
                    <p style={{ fontWeight: '500', marginTop: '4px' }}>{admissionMonthYear || 'Pending Payment'}</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                  <div>
                    <span className="caption">School Name</span>
                    <p style={{ fontWeight: '500', marginTop: '4px' }}>{student.school || '—'}</p>
                  </div>
                  <div>
                    <span className="caption">Board</span>
                    <p style={{ fontWeight: '500', marginTop: '4px' }}>{student.board || '—'}</p>
                  </div>
                  <div>
                    <span className="caption">Date of Birth / Age</span>
                    <p style={{ fontWeight: '500', marginTop: '4px' }}>{student.dob || '—'}</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <span className="caption">Assigned Batch</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <p style={{ fontWeight: '500', margin: 0 }}>{student.batch_name}</p>
                      {student.status === 'Batch Transfer' && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          fontSize: '11px', fontWeight: '600', color: 'var(--primary-orange)',
                          backgroundColor: 'rgba(255, 152, 0, 0.1)', padding: '2px 8px',
                          borderRadius: '12px', border: '1px solid rgba(255, 152, 0, 0.3)'
                        }}>
                          <ArrowRightLeft size={11} />
                          Batch Transferred
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="caption">Package Plan</span>
                    <p style={{ fontWeight: '500', marginTop: '4px' }}>{student.package_type}</p>
                  </div>
                </div>

                <div>
                  <span className="caption">Subjects Taken</span>
                  <p style={{ fontWeight: '500', marginTop: '4px' }}>
                    {student.subjects_taken && student.subjects_taken.length > 0
                      ? student.subjects_taken.join(', ')
                      : 'No custom subjects registered'}
                  </p>
                </div>

                <div>
                  <span className="caption">Address</span>
                  <p style={{ fontWeight: '500', marginTop: '4px', whiteSpace: 'pre-wrap' }}>{student.address || '—'}</p>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <span className="caption">Current Status</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                    <span className={`badge ${student.status === 'Active' ? 'badge-success' : student.status === 'Dropped Out' ? 'badge-error' : 'badge-warning'}`}>{student.status}</span>
                    {!isMentor && !showStatusChange && (
                      <button
                        className="btn btn-tertiary"
                        style={{ fontSize: '12px', padding: '2px 8px', minHeight: 'unset' }}
                        onClick={() => { setNewStatus(student.status); setShowStatusChange(true); }}
                      >
                        Change
                      </button>
                    )}
                  </div>

                  {/* Inline Status Change Form */}
                  {showStatusChange && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px',
                      padding: '12px', backgroundColor: 'var(--surface-secondary)', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)'
                    }}>
                      <AlertCircle size={16} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
                      <select
                        className="form-control"
                        style={{ flex: 1, minHeight: '32px', fontSize: '13px', padding: '4px 8px' }}
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                      >
                        {statusOptions.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '4px 14px', minHeight: '32px', fontSize: '13px' }}
                        disabled={savingStatus}
                        onClick={handleStatusChange}
                      >
                        {savingStatus ? '...' : 'Save'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', minHeight: '32px', fontSize: '13px' }}
                        onClick={() => setShowStatusChange(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline Batch Transfer Form */}
                {showTransfer && (
                  <div style={{
                    padding: '16px', backgroundColor: 'var(--surface-secondary)', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)', marginTop: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <ArrowRightLeft size={16} style={{ color: 'var(--primary-orange)' }} />
                      <span style={{ fontWeight: '600', fontSize: '14px' }}>Transfer to another batch</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <span className="caption" style={{ whiteSpace: 'nowrap' }}>From:</span>
                      <span style={{ fontWeight: '500', fontSize: '13px' }}>{student.batch_name}</span>
                      <ChevronRight size={14} style={{ color: 'var(--text-disabled)' }} />
                      <span className="caption" style={{ whiteSpace: 'nowrap' }}>To:</span>
                      {transferBatches.length > 0 ? (
                        <select
                          className="form-control"
                          style={{ flex: 1, minHeight: '32px', fontSize: '13px', padding: '4px 8px' }}
                          value={transferBatchId}
                          onChange={(e) => setTransferBatchId(e.target.value)}
                        >
                          {transferBatches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="secondary-text" style={{ fontSize: '13px' }}>No other batches available for Class {student.class}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1, fontSize: '13px' }}
                        disabled={savingTransfer || !transferBatchId || transferBatches.length === 0}
                        onClick={handleBatchTransfer}
                      >
                        {savingTransfer ? 'Transferring...' : 'Confirm Transfer'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '13px' }}
                        onClick={() => setShowTransfer(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  {!isMentor && (
                    <button
                      className="btn btn-secondary"
                      style={{ flex: 1, gap: '6px' }}
                      onClick={() => { setShowTransfer(!showTransfer); setShowStatusChange(false); }}
                    >
                      <ArrowRightLeft size={16} />
                      Batch Transfer
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Profile
                  </button>
                </div>
              </div>
            )
          )}

          {/* TABS 2: Academic History */}
          {activeTab === 'academic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {loading ? (
                <div className="skeleton" style={{ height: '300px', width: '100%' }} />
              ) : (
                <>
                  {/* Print Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <PDFDownloadLink
                      document={
                        <AcademicHistoryPDF
                          studentName={student.name}
                          studentCode={student.student_code}
                          batchName={student.batch_name}
                          className={student.class}
                          board={student.board || ''}
                          school={student.school || ''}
                          subjectAttendance={subjectAttendance}
                          overallAttendance={overallAttendance}
                          examScores={examScores}
                        />
                      }
                      fileName={`Academic_History_${student.student_code}.pdf`}
                      style={{ textDecoration: 'none' }}
                    >
                      {({ loading: pdfLoading }) => (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ gap: '6px', fontSize: '13px' }}
                          disabled={pdfLoading}
                        >
                          <Printer size={16} />
                          <span>{pdfLoading ? 'Generating...' : 'Print Academic History'}</span>
                        </button>
                      )}
                    </PDFDownloadLink>
                  </div>

                  {/* Overall Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="card" style={{
                      margin: 0, padding: '16px', display: 'flex', gap: '12px', alignItems: 'center',
                      border: '1px solid',
                      borderColor: overallAttendance !== null && overallAttendance >= 75 ? '#BBF7D0' : overallAttendance !== null && overallAttendance >= 60 ? '#FDE68A' : '#FECACA'
                    }}>
                      <div style={{
                        width: '44px', height: '44px', borderRadius: '50%',
                        backgroundColor: overallAttendance !== null && overallAttendance >= 75 ? '#DCFCE7' : overallAttendance !== null && overallAttendance >= 60 ? '#FEF3C7' : '#FEE2E2',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: overallAttendance !== null && overallAttendance >= 75 ? '#16A34A' : overallAttendance !== null && overallAttendance >= 60 ? '#D97706' : '#DC2626'
                      }}>
                        <TrendingUp size={22} />
                      </div>
                      <div>
                        <span className="caption">Overall Attendance</span>
                        <p style={{ fontWeight: '700', fontSize: '20px', margin: 0 }}>{overallAttendance !== null ? `${overallAttendance}%` : '—'}</p>
                      </div>
                    </div>
                    <div className="card" style={{ margin: 0, padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{
                        width: '44px', height: '44px', borderRadius: '50%',
                        backgroundColor: 'var(--surface-secondary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--color-info)'
                      }}>
                        <TrendingUp size={22} />
                      </div>
                      <div>
                        <span className="caption">Avg. Exam Score</span>
                        <p style={{ fontWeight: '700', fontSize: '20px', margin: 0 }}>{avgExamMark !== null ? `${avgExamMark}%` : '—'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Subject-wise Attendance Breakdown */}
                  <div>
                    <span className="caption" style={{ display: 'block', marginBottom: '10px' }}>Subject-wise Attendance</span>
                    {subjectAttendance.length === 0 ? (
                      <p className="secondary-text" style={{ textAlign: 'center', padding: '20px 0' }}>No attendance data recorded yet.</p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                        {subjectAttendance.map((sa) => {
                          const color = sa.percentage >= 75 ? '#16A34A' : sa.percentage >= 60 ? '#D97706' : '#DC2626';
                          const bgColor = sa.percentage >= 75 ? '#F0FDF4' : sa.percentage >= 60 ? '#FFFBEB' : '#FEF2F2';
                          const borderColor = sa.percentage >= 75 ? '#BBF7D0' : sa.percentage >= 60 ? '#FDE68A' : '#FECACA';
                          return (
                            <div key={sa.subject} style={{
                              padding: '16px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: bgColor,
                              border: `1px solid ${borderColor}`,
                              display: 'flex', flexDirection: 'column', gap: '8px'
                            }}>
                              <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{sa.subject}</span>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                  {sa.present} / {sa.totalClasses} classes
                                </span>
                                <span style={{ fontWeight: '700', fontSize: '18px', color }}>{sa.percentage}%</span>
                              </div>
                              {/* Mini progress bar */}
                              <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%',
                                  width: `${Math.min(sa.percentage, 100)}%`,
                                  backgroundColor: color,
                                  borderRadius: '3px',
                                  transition: 'width 0.5s ease'
                                }} />
                              </div>
                              <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                <span>A: {sa.absent}</span>
                                <span>L: {sa.leave}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Attendance Trend Chart */}
                  {attendanceTrend.length > 1 && (
                    <div>
                      <span className="caption" style={{ display: 'block', marginBottom: '10px' }}>Attendance Trend</span>
                      <div style={{
                        backgroundColor: 'var(--surface-secondary)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '16px 8px 8px 0',
                        border: '1px solid var(--border-color)'
                      }}>
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={attendanceTrend}>
                            <defs>
                              <linearGradient id="attendanceGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                            <XAxis
                              dataKey="label"
                              tick={{ fontSize: 11, fill: '#9CA3AF' }}
                              axisLine={{ stroke: '#E5E7EB' }}
                              tickLine={false}
                            />
                            <YAxis
                              domain={[0, 100]}
                              tick={{ fontSize: 11, fill: '#9CA3AF' }}
                              axisLine={{ stroke: '#E5E7EB' }}
                              tickLine={false}
                              tickFormatter={(v) => `${v}%`}
                            />
                            <Tooltip
                              formatter={(value: any) => [`${value}%`, 'Attendance']}
                              contentStyle={{
                                borderRadius: '8px',
                                border: '1px solid #E5E7EB',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                fontSize: '12px'
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="percentage"
                              stroke="#F59E0B"
                              strokeWidth={2.5}
                              fill="url(#attendanceGrad)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Exams Ledger */}
                  <div>
                    <span className="caption" style={{ display: 'block', marginBottom: '8px' }}>Examination Record</span>
                    <div className="table-container">
                      <table className="table" style={{ fontSize: '13px' }}>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Subject</th>
                            <th>Exam Name</th>
                            <th>Marks</th>
                            <th>Rank</th>
                          </tr>
                        </thead>
                        <tbody>
                          {examScores.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="secondary-text" style={{ textAlign: 'center' }}>No exam scores recorded yet.</td>
                            </tr>
                          ) : (
                            examScores.map((score, i) => (
                              <tr key={i}>
                                <td>{score.date}</td>
                                <td>{score.subject}</td>
                                <td>{score.name}</td>
                                <td style={{ fontWeight: '600' }}>{score.score}</td>
                                <td>{score.rank}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TABS 3: Billing & Dues (Hidden from Mentors) */}
          {activeTab === 'billing' && !isMentor && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {loading ? (
                <div className="skeleton" style={{ height: '140px', width: '100%' }} />
              ) : (
                <>
                  {/* Installment Breakdown card */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span className="caption">Installment Schedule</span>
                    <div className="table-container">
                      <table className="table" style={{ fontSize: '13px' }}>
                        <thead>
                          <tr>
                            <th>Term</th>
                            <th>Due Date</th>
                            <th>Amount</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {installments.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="secondary-text" style={{ textAlign: 'center' }}>No billing details configured yet.</td>
                            </tr>
                          ) : (
                            installments.map((inst, i) => (
                              <tr key={i}>
                                <td>{inst.term}</td>
                                <td>{inst.dueDate}</td>
                                <td>{inst.amount}</td>
                                <td>
                                  <span className={`badge ${inst.status === 'Paid' ? 'badge-success' : inst.status === 'Overdue' ? 'badge-error' : 'badge-warning'}`}>
                                    {inst.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    );
  }
