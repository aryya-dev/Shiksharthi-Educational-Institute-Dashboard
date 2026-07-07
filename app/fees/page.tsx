'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { 
  CreditCard, 
  TrendingUp, 
  DollarSign, 
  Search, 
  Plus, 
  Clock, 
  Check, 
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  X,
  Calendar,
  Repeat,
  Layers
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { createClient } from '@/utils/supabase/client';

interface FeeDueRecord {
  id: string; // installment id
  studentCode: string;
  studentName: string;
  batchName: string;
  installmentNum: number;
  dueDate: string;
  dueAmount: number;
  status: 'Due' | 'Overdue';
  feeType: 'Installment' | 'Monthly';
  totalInstallments?: number;
}

interface PaymentRecord {
  id: string;
  studentName: string;
  amount: number;
  date: string;
  method: string;
  transactionId: string;
}

interface EnrollmentOption {
  id: string;
  studentCode: string;
  studentName: string;
  batchName: string;
  hasFeeSetup: boolean;
}

export default function FeesPage() {
  const supabase = createClient();
  const { currentBranch, currentAcademicYear, userProfile } = useAppStore();

  const [dues, setDues] = useState<FeeDueRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    studentId: '',
    installmentId: '',
    amount: '',
    method: 'UPI',
    txId: '',
    notes: ''
  });

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fee Setup Modal State
  const [showFeeSetup, setShowFeeSetup] = useState(false);
  const [enrollments, setEnrollments] = useState<EnrollmentOption[]>([]);
  const [feeSetup, setFeeSetup] = useState({
    enrollmentId: '',
    feeType: 'Installment' as 'Installment' | 'Monthly',
    // Installment fields
    tuitionFee: '',
    admissionFee: '',
    scholarshipPct: '0',
    discount: '0',
    numInstallments: 4,
    dueDates: ['', '', '', ''] as string[],
    // Monthly fields
    monthlyAmount: '',
    additionalAmount: '',
    additionalAmountStartMonth: String(new Date().getMonth() + 1)
  });
  const [savingFee, setSavingFee] = useState(false);

  // Generate all 12 months for the active academic year (April to next March)
  const academicYearMonths = useMemo(() => {
    const startYear = currentAcademicYear 
      ? new Date(currentAcademicYear.start_date).getFullYear() 
      : new Date().getFullYear();
      
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const list: { label: string; value: string }[] = [];
    
    // April to December
    for (let m = 3; m <= 11; m++) {
      list.push({
        label: `${monthNames[m]} ${startYear}`,
        value: String(m + 1)
      });
    }
    // January to March
    for (let m = 0; m <= 2; m++) {
      list.push({
        label: `${monthNames[m]} ${startYear + 1}`,
        value: String(m + 1)
      });
    }
    return list;
  }, [currentAcademicYear]);

  const isMentor = userProfile?.role === 'Mentor';

  // Computed scholarship and net payable for installment mode
  const tuitionFeeNum = parseFloat(feeSetup.tuitionFee) || 0;
  const admissionFeeNum = parseFloat(feeSetup.admissionFee) || 0;
  const courseFeeNum = tuitionFeeNum + admissionFeeNum;
  const scholarshipPctNum = parseFloat(feeSetup.scholarshipPct) || 0;
  const discountNum = parseFloat(feeSetup.discount) || 0;
  const scholarshipAmount = Math.round(tuitionFeeNum * scholarshipPctNum / 100);
  const netPayable = Math.max(0, (tuitionFeeNum - scholarshipAmount - discountNum) + admissionFeeNum);
  const perInstallment = feeSetup.numInstallments > 0 ? Math.ceil(netPayable / feeSetup.numInstallments) : 0;

  // Load Financial Ledger Data
  useEffect(() => {
    if (isMentor) return;

    async function loadFeesData() {
      if (!currentBranch || !currentAcademicYear) return;
      setLoading(true);

      try {
        const { data: installmentsData } = await supabase
          .from('fee_installments')
          .select(`
            id,
            installment_number,
            due_date,
            due_amount,
            status,
            student_fees (
              fee_type,
              num_installments,
              enrollments (
                id,
                branch_id,
                academic_year_id,
                students (
                  student_code,
                  name
                ),
                batches (
                  name
                )
              )
            )
          `)
          .in('status', ['Due', 'Overdue']);

        const filteredInstallments = (installmentsData || []).filter((inst: any) => {
          const enrollment = inst.student_fees?.enrollments;
          return enrollment && 
            enrollment.branch_id === currentBranch.id && 
            enrollment.academic_year_id === currentAcademicYear.id;
        });

        const duesList: FeeDueRecord[] = filteredInstallments.map((inst: any) => {
          const enrollment = inst.student_fees.enrollments;
          return {
            id: inst.id,
            studentCode: enrollment.students?.student_code || '',
            studentName: enrollment.students?.name || '',
            batchName: enrollment.batches?.name || 'Unassigned',
            installmentNum: inst.installment_number,
            dueDate: inst.due_date,
            dueAmount: parseFloat(inst.due_amount),
            status: inst.status,
            feeType: inst.student_fees?.fee_type || 'Installment',
            totalInstallments: inst.student_fees?.num_installments || 4
          };
        });

        const { data: paymentsData } = await supabase
          .from('payments')
          .select(`
            id,
            amount_paid,
            payment_date,
            payment_type,
            transaction_id,
            fee_installments (
              student_fees (
                enrollments (
                  branch_id,
                  academic_year_id,
                  students (
                    name
                  )
                )
              )
            )
          `)
          .order('payment_date', { ascending: false });

        const filteredPayments = (paymentsData || []).filter((pay: any) => {
          const enrollment = pay.fee_installments?.student_fees?.enrollments;
          return enrollment && 
            enrollment.branch_id === currentBranch.id && 
            enrollment.academic_year_id === currentAcademicYear.id;
        });

        const paymentsList: PaymentRecord[] = filteredPayments.map((pay: any) => {
          const enrollment = pay.fee_installments.student_fees.enrollments;
          return {
            id: pay.id,
            studentName: enrollment.students?.name || '',
            amount: parseFloat(pay.amount_paid),
            date: pay.payment_date,
            method: pay.payment_type,
            transactionId: pay.transaction_id || '-'
          };
        });

        setDues(duesList);
        setPayments(paymentsList);

        if (duesList.length > 0) {
          setPaymentForm(prev => ({
            ...prev,
            studentId: duesList[0].studentCode,
            installmentId: duesList[0].id,
            amount: duesList[0].dueAmount.toString()
          }));
        } else {
          setPaymentForm(prev => ({
            ...prev,
            studentId: '',
            installmentId: '',
            amount: ''
          }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadFeesData();
  }, [currentBranch, currentAcademicYear, isMentor]);

  // Fetch enrollments for fee setup modal
  const openFeeSetupModal = async () => {
    if (!currentBranch || !currentAcademicYear) return;

    try {
      // Fetch all active enrollments
      const { data: enrollData } = await supabase
        .from('enrollments')
        .select('id, batch_id, students(student_code, name), batches(name)')
        .eq('branch_id', currentBranch.id)
        .eq('academic_year_id', currentAcademicYear.id)
        .eq('status', 'Active');

      // Fetch enrollments that already have fee setup
      const { data: existingFees } = await supabase
        .from('student_fees')
        .select('enrollment_id');

      const feeEnrollmentIds = new Set((existingFees || []).map((f: any) => f.enrollment_id));

      const options: EnrollmentOption[] = (enrollData || []).map((e: any) => ({
        id: e.id,
        studentCode: e.students?.student_code || '',
        studentName: e.students?.name || '',
        batchName: e.batches?.name || '',
        hasFeeSetup: feeEnrollmentIds.has(e.id)
      }));

      setEnrollments(options);
      setFeeSetup({
        enrollmentId: '',
        feeType: 'Installment',
        tuitionFee: '',
        admissionFee: '',
        scholarshipPct: '0',
        discount: '0',
        numInstallments: 4,
        dueDates: ['', '', '', ''],
        monthlyAmount: '',
        additionalAmount: '',
        additionalAmountStartMonth: String(new Date().getMonth() + 1)
      });
      setShowFeeSetup(true);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Fee Setup Save
  const handleSaveFeeSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeSetup.enrollmentId) return;
    setSavingFee(true);

    try {
      if (feeSetup.feeType === 'Installment') {
        // Insert student_fees record
        const { data: sfData, error: sfErr } = await supabase
          .from('student_fees')
          .insert({
            enrollment_id: feeSetup.enrollmentId,
            fee_type: 'Installment',
            package_fee: courseFeeNum,
            scholarship_percentage: scholarshipPctNum,
            scholarship: scholarshipAmount,
            discount: discountNum,
            num_installments: feeSetup.numInstallments,
            monthly_amount: 0,
            tuition_fee: tuitionFeeNum,
            admission_fee: admissionFeeNum
          })
          .select()
          .single();

        if (sfErr) throw sfErr;

        // Insert installment rows
        const installmentRows = [];
        for (let i = 0; i < feeSetup.numInstallments; i++) {
          // For last installment, handle rounding remainder
          const isLast = i === feeSetup.numInstallments - 1;
          const amount = isLast 
            ? netPayable - (perInstallment * (feeSetup.numInstallments - 1))
            : perInstallment;

          installmentRows.push({
            student_fee_id: sfData.id,
            installment_number: i + 1,
            due_date: feeSetup.dueDates[i],
            due_amount: Math.max(0, amount),
            status: 'Due'
          });
        }

        const { error: instErr } = await supabase
          .from('fee_installments')
          .insert(installmentRows);

        if (instErr) throw instErr;

      } else {
        // Monthly mode
        const monthlyAmt = parseFloat(feeSetup.monthlyAmount) || 0;
        const admissionFeeAmt = parseFloat(feeSetup.admissionFee) || 0;
        const additionalAmt = parseFloat(feeSetup.additionalAmount) || 0;
        const additionalStartMonth = parseInt(feeSetup.additionalAmountStartMonth) || 0; // 1-indexed month

        const { data: sfData, error: sfErr } = await supabase
          .from('student_fees')
          .insert({
            enrollment_id: feeSetup.enrollmentId,
            fee_type: 'Monthly',
            package_fee: monthlyAmt,
            scholarship_percentage: 0,
            scholarship: 0,
            discount: 0,
            num_installments: 1,
            monthly_amount: monthlyAmt,
            admission_fee: admissionFeeAmt,
            additional_amount: additionalAmt,
            additional_amount_start_month: additionalStartMonth > 0 ? additionalStartMonth : null
          })
          .select()
          .single();

        if (sfErr) throw sfErr;

        // Auto-generate dues for remaining months in the academic year
        const now = new Date();
        const currentMonth = now.getMonth(); // 0-indexed
        const monthsToGenerate: number[] = [];
        
        // Generate from current month through March (end of academic year)
        for (let m = currentMonth; m <= 11; m++) {
          monthsToGenerate.push(m);
        }
        if (currentMonth > 2) {
          for (let m = 0; m <= 2; m++) {
            monthsToGenerate.push(m);
          }
        }

        const monthlyRows: any[] = [];

        // Installment 0: Admission Fee (if > 0)
        if (admissionFeeAmt > 0) {
          monthlyRows.push({
            student_fee_id: sfData.id,
            installment_number: 0,
            due_date: now.toISOString().split('T')[0],
            due_amount: admissionFeeAmt,
            status: 'Due'
          });
        }

        // Check if the additional amount applies to month `m` (using April-March academic indexing)
        const selectedMonthZeroIndexed = additionalStartMonth - 1;
        const getAcademicMonthIndex = (monthVal: number) => (monthVal >= 3 ? monthVal - 3 : monthVal + 9);
        const selectedAcademicIndex = getAcademicMonthIndex(selectedMonthZeroIndexed);

        // Monthly installments with optional additional amount
        monthsToGenerate.forEach((m, idx) => {
          const year = m >= currentMonth ? now.getFullYear() : now.getFullYear() + 1;
          const dueDate = `${year}-${String(m + 1).padStart(2, '0')}-05`;
          
          const installmentAcademicIndex = getAcademicMonthIndex(m);
          const isAdditionalApplicable = installmentAcademicIndex >= selectedAcademicIndex;
          const dueAmount = (additionalAmt > 0 && isAdditionalApplicable)
            ? monthlyAmt + additionalAmt
            : monthlyAmt;
          monthlyRows.push({
            student_fee_id: sfData.id,
            installment_number: idx + 1,
            due_date: dueDate,
            due_amount: dueAmount,
            status: new Date(dueDate) < now ? 'Overdue' : 'Due'
          });
        });

        if (monthlyRows.length > 0) {
          const { error: monthErr } = await supabase
            .from('fee_installments')
            .insert(monthlyRows);

          if (monthErr) throw monthErr;
        }
      }

      // Log activity
      const selectedEnrollment = enrollments.find(e => e.id === feeSetup.enrollmentId);
      await supabase
        .from('activity_logs')
        .insert({
          action: 'Fee Structure Configured',
          details: { 
            studentName: selectedEnrollment?.studentName,
            feeType: feeSetup.feeType,
            amount: feeSetup.feeType === 'Installment' ? netPayable : parseFloat(feeSetup.monthlyAmount)
          },
          branch_id: currentBranch?.id
        });

      setSuccessMsg(`Fee structure set up successfully for ${selectedEnrollment?.studentName}!`);
      setShowFeeSetup(false);

      // Reload data
      window.location.reload();

    } catch (err) {
      console.error('Failed to set up fee:', err);
    } finally {
      setSavingFee(false);
    }
  };

  // Handle Payment Log Submission
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.installmentId) return;

    try {
      const selectedDue = dues.find(d => d.id === paymentForm.installmentId);
      if (!selectedDue) return;

      const amtPaid = parseFloat(paymentForm.amount);
      const isFullyPaid = amtPaid >= selectedDue.dueAmount;

      const { data: pData, error: pErr } = await supabase
        .from('payments')
        .insert({
          installment_id: selectedDue.id,
          amount_paid: amtPaid,
          payment_type: paymentForm.method,
          transaction_id: paymentForm.txId,
          notes: paymentForm.notes
        })
        .select()
        .single();

      if (pErr) throw pErr;

      await supabase
        .from('fee_installments')
        .update({
          status: isFullyPaid ? 'Paid' : 'Due',
          due_amount: isFullyPaid ? 0 : selectedDue.dueAmount - amtPaid
        })
        .eq('id', selectedDue.id);

      await supabase
        .from('activity_logs')
        .insert({
          action: 'Fee Payment Recorded',
          details: { studentCode: selectedDue.studentCode, amount: amtPaid },
          branch_id: currentBranch?.id
        });

      setSuccessMsg(`Payment of ₹${amtPaid.toLocaleString()} recorded for ${selectedDue.studentName}.`);

      setPayments([
        {
          id: pData.id,
          studentName: selectedDue.studentName,
          amount: amtPaid,
          date: new Date().toISOString().split('T')[0],
          method: paymentForm.method,
          transactionId: paymentForm.txId || '-'
        },
        ...payments
      ]);

      setDues(dues.filter(d => d.id !== selectedDue.id));
      setPaymentForm({
        studentId: '',
        installmentId: '',
        amount: '',
        method: 'UPI',
        txId: '',
        notes: ''
      });
    } catch (err) {
      console.error(err);
      const selectedDue = dues.find(d => d.id === paymentForm.installmentId);
      if (!selectedDue) return;
      const amtPaid = parseFloat(paymentForm.amount);

      setSuccessMsg(`Payment of ₹${amtPaid.toLocaleString()} recorded for ${selectedDue.studentName} (local save).`);
      setPayments([
        {
          id: `p-temp-${Date.now()}`,
          studentName: selectedDue.studentName,
          amount: amtPaid,
          date: new Date().toISOString().split('T')[0],
          method: paymentForm.method,
          transactionId: paymentForm.txId || '-'
        },
        ...payments
      ]);
      setDues(dues.filter(d => d.id !== selectedDue.id));
      setPaymentForm({
        studentId: '',
        installmentId: '',
        amount: '',
        method: 'UPI',
        txId: '',
        notes: ''
      });
    }
  };

  // Lock Mentors entirely out
  if (isMentor) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ textAlign: 'center', padding: '48px', maxWidth: '400px' }}>
          <ShieldAlert size={48} style={{ color: 'var(--color-error)', marginBottom: '16px' }} />
          <h3>Access Restricted</h3>
          <p className="secondary-text">Mentors are strictly blocked from accessing financial modules.</p>
        </div>
      </div>
    );
  }

  // Filter dues list by search
  const filteredDues = dues.filter(d => 
    d.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.studentCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Compute metrics summaries
  const totalCollected = payments.reduce((acc, curr) => acc + curr.amount, 0);
  const totalOutstanding = dues.reduce((acc, curr) => acc + curr.dueAmount, 0);

  // Enrollments without fee setup (for the modal dropdown)
  const availableEnrollments = enrollments.filter(e => !e.hasFeeSetup);

  return (
    <div className="page-column-32">
      
      {/* Success Notification */}
      {successMsg && (
        <div className="badge badge-success" style={{
          width: '100%',
          borderRadius: 'var(--radius-sm)',
          padding: '16px var(--space-4)',
          justifyContent: 'flex-start',
          textTransform: 'none',
          fontSize: '14px',
          gap: '8px'
        }}>
          <Check size={20} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header with Set Up Fee button */}
      <div className="toolbar">
        <h3 className="section-title" style={{ margin: 0, fontSize: '18px' }}>Fee Management</h3>
        <button 
          className="btn btn-primary"
          style={{ gap: '8px' }}
          onClick={openFeeSetupModal}
        >
          <Plus size={18} />
          <span>Set Up Fee</span>
        </button>
      </div>

      {/* 1. Collection stats cards */}
      <section className="grid-stats">
        <div className="card" style={{ margin: 0, padding: '20px 24px', display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-success)' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <span className="caption">Total Collections (Current session)</span>
            <p style={{ fontSize: '28px', fontWeight: '700', marginTop: '4px' }}>₹{totalCollected.toLocaleString()}</p>
          </div>
        </div>

        <div className="card" style={{ margin: 0, padding: '20px 24px', display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-error)' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <span className="caption">Total Outstanding Dues</span>
            <p style={{ fontSize: '28px', fontWeight: '700', marginTop: '4px' }}>₹{totalOutstanding.toLocaleString()}</p>
          </div>
        </div>
      </section>

      {/* 2. Main content grids: Outstanding Left, Forms & Logs Right */}
      <div className="grid-2col-equal">
        
        {/* Left Column: Outstanding list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="caption" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Outstanding Dues</span>
            <span className="badge badge-error">{dues.length} Pending</span>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-disabled)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search due profiles..."
              style={{ paddingLeft: '38px', minHeight: '38px', fontSize: '13px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredDues.length === 0 ? (
              <p className="secondary-text">No outstanding balances found.</p>
            ) : (
              filteredDues.map((due) => (
                <div 
                  key={due.id}
                  className="card"
                  style={{
                    margin: 0,
                    padding: '16px',
                    borderColor: paymentForm.installmentId === due.id ? 'var(--primary-orange)' : 'var(--border-color)',
                    backgroundColor: paymentForm.installmentId === due.id ? 'var(--surface-secondary)' : 'var(--surface-card)',
                    cursor: 'pointer'
                  }}
                  onClick={() => setPaymentForm({
                    ...paymentForm,
                    studentId: due.studentCode,
                    installmentId: due.id,
                    amount: due.dueAmount.toString()
                  })}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{due.studentCode} ({due.batchName})</span>
                        <span className={`badge ${due.feeType === 'Monthly' ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                          {due.feeType === 'Monthly' ? <><Repeat size={10} style={{ marginRight: '3px' }} />Monthly</> : <><Layers size={10} style={{ marginRight: '3px' }} />Installment</>}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '15px', fontWeight: '600', marginTop: '2px' }}>{due.studentName}</h4>
                    </div>
                    <span style={{ fontWeight: '700', color: due.status === 'Overdue' ? 'var(--color-error)' : 'var(--text-primary)' }}>
                      ₹{due.dueAmount.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }} className="caption">
                    <span>
                      {due.installmentNum === 0
                        ? 'Admission Fee'
                        : due.feeType === 'Monthly' 
                          ? `Month ${due.installmentNum}` 
                          : `Installment ${due.installmentNum} of ${due.totalInstallments}`}
                    </span>
                    <span style={{ color: due.status === 'Overdue' ? 'var(--color-error)' : 'var(--text-secondary)' }}>
                      Due: {due.dueDate} {due.status === 'Overdue' && '(Overdue)'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Collect payment form & Recent transaction list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Payment receipt form */}
          <div className="card" style={{ margin: 0, padding: '24px' }}>
            <h3 style={{ fontSize: '17px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>
              Log Payment Receipt
            </h3>

            <form onSubmit={handleSavePayment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="grid-form-2col" style={{ gridTemplateColumns: '1.2fr 0.8fr' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Selected Due *</label>
                  <select
                    className="form-control"
                    value={paymentForm.installmentId}
                    onChange={(e) => {
                      const selected = dues.find(d => d.id === e.target.value);
                      if (selected) {
                        setPaymentForm({
                          ...paymentForm,
                          installmentId: selected.id,
                          studentId: selected.studentCode,
                          amount: selected.dueAmount.toString()
                        });
                      }
                    }}
                  >
                    <option value="">-- Choose student --</option>
                    {dues.map(d => (
                      <option key={d.id} value={d.id}>{d.studentName} — ₹{d.dueAmount.toLocaleString()} ({d.feeType})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Amount Collected (₹) *</label>
                  <input
                    type="number"
                    className="form-control"
                    required
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid-form-2col">
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Payment Method</label>
                  <select
                    className="form-control"
                    value={paymentForm.method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                  >
                    <option value="UPI">UPI (GPay/PhonePe)</option>
                    <option value="Cash">Cash Receipt</option>
                    <option value="Bank Transfer">Bank Transfer (IMPS/NEFT)</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Transaction Reference ID</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. TXN1029472"
                    value={paymentForm.txId}
                    onChange={(e) => setPaymentForm({ ...paymentForm, txId: e.target.value })}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', gap: '8px' }}
                disabled={!paymentForm.installmentId}
              >
                <ArrowUpRight size={18} />
                <span>Confirm Payment</span>
              </button>
            </form>
          </div>

          {/* Recent Collections Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <span className="caption" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Cash Ledger</span>
            
            <div className="table-container">
              <table className="table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Student Name</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.slice(0, 5).map((pay) => (
                    <tr key={pay.id}>
                      <td>{pay.date}</td>
                      <td style={{ fontWeight: '500' }}>{pay.studentName}</td>
                      <td>{pay.method}</td>
                      <td className="secondary-text" style={{ fontSize: '12px' }}>{pay.transactionId}</td>
                      <td style={{ fontWeight: '700', color: 'var(--color-success)' }}>+₹{pay.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* Fee Setup Modal */}
      {showFeeSetup && (
        <div className="modal-overlay">
          <div className="card modal-card" style={{ maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto' }}>
            <button 
              className="btn btn-tertiary" 
              style={{ position: 'absolute', right: '16px', top: '16px', padding: '8px', minHeight: '36px' }}
              onClick={() => setShowFeeSetup(false)}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>Set Up Fee Structure</h2>
            <p className="secondary-text" style={{ marginBottom: '24px' }}>Configure fee type and payment schedule for a student.</p>

            <form onSubmit={handleSaveFeeSetup} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Student Select */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Student *</label>
                <select
                  className="form-control"
                  required
                  value={feeSetup.enrollmentId}
                  onChange={(e) => setFeeSetup({ ...feeSetup, enrollmentId: e.target.value })}
                >
                  <option value="">— Select student —</option>
                  {availableEnrollments.map(e => (
                    <option key={e.id} value={e.id}>{e.studentName} ({e.studentCode}) — {e.batchName}</option>
                  ))}
                </select>
                {availableEnrollments.length === 0 && enrollments.length > 0 && (
                  <p style={{ fontSize: '12px', color: 'var(--color-warning)', marginTop: '6px' }}>All enrolled students already have a fee structure configured.</p>
                )}
              </div>

              {/* Fee Type Toggle */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Fee Type *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`btn ${feeSetup.feeType === 'Installment' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, gap: '6px' }}
                    onClick={() => setFeeSetup({ ...feeSetup, feeType: 'Installment' })}
                  >
                    <Layers size={16} />
                    <span>Installment</span>
                  </button>
                  <button
                    type="button"
                    className={`btn ${feeSetup.feeType === 'Monthly' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, gap: '6px' }}
                    onClick={() => setFeeSetup({ ...feeSetup, feeType: 'Monthly' })}
                  >
                    <Repeat size={16} />
                    <span>Monthly</span>
                  </button>
                </div>
              </div>

              {/* === INSTALLMENT MODE === */}
              {feeSetup.feeType === 'Installment' && (
                <>
                  <div className="grid-form-2col">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Tuition Fee (₹) *</label>
                      <input
                        type="number"
                        className="form-control"
                        required
                        min="0"
                        placeholder="e.g. 120000"
                        value={feeSetup.tuitionFee}
                        onChange={(e) => setFeeSetup({ ...feeSetup, tuitionFee: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">On Admission Fee (₹) *</label>
                      <input
                        type="number"
                        className="form-control"
                        required
                        min="0"
                        placeholder="e.g. 30000"
                        value={feeSetup.admissionFee}
                        onChange={(e) => setFeeSetup({ ...feeSetup, admissionFee: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid-form-2col">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Scholarship %</label>
                      <input
                        type="number"
                        className="form-control"
                        min="0"
                        max="100"
                        value={feeSetup.scholarshipPct}
                        onChange={(e) => setFeeSetup({ ...feeSetup, scholarshipPct: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Discount (₹, optional)</label>
                      <input
                        type="number"
                        className="form-control"
                        min="0"
                        value={feeSetup.discount}
                        onChange={(e) => setFeeSetup({ ...feeSetup, discount: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Auto-computed summary */}
                  <div style={{ 
                    backgroundColor: 'var(--surface-secondary)', 
                    borderRadius: 'var(--radius-sm)', 
                    padding: '16px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span className="secondary-text">Tuition Fee</span>
                      <span>₹{tuitionFeeNum.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span className="secondary-text">On Admission Fee</span>
                      <span>₹{admissionFeeNum.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span className="secondary-text">Scholarship ({scholarshipPctNum}% of Tuition)</span>
                      <span style={{ color: 'var(--color-success)' }}>−₹{scholarshipAmount.toLocaleString()}</span>
                    </div>
                    {discountNum > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span className="secondary-text">Discount</span>
                        <span style={{ color: 'var(--color-success)' }}>−₹{discountNum.toLocaleString()}</span>
                      </div>
                    )}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '15px' }}>
                      <span>Net Payable</span>
                      <span style={{ color: 'var(--primary-orange)' }}>₹{netPayable.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Number of Installments */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Number of Installments *</label>
                    <select
                      className="form-control"
                      value={feeSetup.numInstallments}
                      onChange={(e) => {
                        const num = parseInt(e.target.value);
                        setFeeSetup({ 
                          ...feeSetup, 
                          numInstallments: num,
                          dueDates: Array.from({ length: 4 }, (_, i) => i < num ? feeSetup.dueDates[i] || '' : '')
                        });
                      }}
                    >
                      <option value={1}>1 Installment (Full Payment)</option>
                      <option value={2}>2 Installments</option>
                      <option value={3}>3 Installments</option>
                      <option value={4}>4 Installments</option>
                    </select>
                  </div>

                  {/* Due date inputs per installment */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label className="form-label" style={{ marginBottom: '0' }}>Installment Due Dates *</label>
                    {Array.from({ length: feeSetup.numInstallments }).map((_, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span className="caption" style={{ width: '100px', flexShrink: 0 }}>
                          Inst. {idx + 1} — ₹{idx === feeSetup.numInstallments - 1 
                            ? Math.max(0, netPayable - (perInstallment * (feeSetup.numInstallments - 1))).toLocaleString()
                            : perInstallment.toLocaleString()}
                        </span>
                        <input
                          type="date"
                          className="form-control"
                          required
                          value={feeSetup.dueDates[idx]}
                          onChange={(e) => {
                            const newDates = [...feeSetup.dueDates];
                            newDates[idx] = e.target.value;
                            setFeeSetup({ ...feeSetup, dueDates: newDates });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* === MONTHLY MODE === */}
              {feeSetup.feeType === 'Monthly' && (
                <>
                  <div className="grid-form-2col" style={{ gap: '12px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">On Admission Fee (₹) *</label>
                      <input
                        type="number"
                        className="form-control"
                        required
                        min="0"
                        placeholder="e.g. 5000"
                        value={feeSetup.admissionFee}
                        onChange={(e) => setFeeSetup({ ...feeSetup, admissionFee: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Monthly Fee (₹) *</label>
                      <input
                        type="number"
                        className="form-control"
                        required
                        min="0"
                        placeholder="e.g. 3500"
                        value={feeSetup.monthlyAmount}
                        onChange={(e) => setFeeSetup({ ...feeSetup, monthlyAmount: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid-form-2col" style={{ gap: '12px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Additional Amount (₹)</label>
                      <input
                        type="number"
                        className="form-control"
                        min="0"
                        placeholder="Optional"
                        value={feeSetup.additionalAmount}
                        onChange={(e) => setFeeSetup({ ...feeSetup, additionalAmount: e.target.value })}
                      />
                      <p className="caption" style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
                        Added to monthly fee for additional subjects.
                      </p>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Additional Starts From</label>
                      <select
                        className="form-control"
                        value={feeSetup.additionalAmountStartMonth}
                        onChange={(e) => setFeeSetup({ ...feeSetup, additionalAmountStartMonth: e.target.value })}
                        disabled={!feeSetup.additionalAmount || parseFloat(feeSetup.additionalAmount) <= 0}
                      >
                        {academicYearMonths.map((mOpt) => (
                          <option key={mOpt.value} value={mOpt.value}>
                            {mOpt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <p className="caption" style={{ marginTop: '0px', color: 'var(--text-secondary)' }}>
                    Monthly dues will be auto-generated for the remaining academic year. Admission fee generates an immediate due.
                  </p>
                </>
              )}

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '8px', gap: '8px' }}
                disabled={savingFee || !feeSetup.enrollmentId}
              >
                <Check size={18} />
                <span>{savingFee ? 'Saving...' : 'Save Fee Structure'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
