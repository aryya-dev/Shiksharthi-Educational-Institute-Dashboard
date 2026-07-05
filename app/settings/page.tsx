'use client';

import React, { useEffect, useState } from 'react';
import { 
  Settings, 
  Users, 
  Globe, 
  CalendarDays, 
  Plus, 
  X, 
  ShieldAlert,
  CheckCircle,
  ToggleLeft,
  BookOpen
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { createClient } from '@/utils/supabase/client';

interface AccountItem {
  id: string;
  name: string;
  email: string;
  role: 'Director' | 'Mentor' | 'Admin';
  branches: string[];
}

interface BranchItem {
  id: string;
  name: string;
  code: string;
  classRange: string;
  isActive: boolean;
}

interface YearItem {
  id: string;
  label: string;
  isCurrent: boolean;
}

interface FacultyItem {
  id: string;
  name: string;
  email: string;
  subjects: string[];
  branches: string[];
}

export default function SettingsPage() {
  const supabase = createClient();
  const { currentBranch, currentAcademicYear, userProfile } = useAppStore();

  const [activeTab, setActiveTab] = useState<'users' | 'branches' | 'rollover' | 'faculty'>('users');
  const [users, setUsers] = useState<AccountItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [years, setYears] = useState<YearItem[]>([]);
  const [facultyMembers, setFacultyMembers] = useState<FacultyItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms states
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Mentor' as AccountItem['role'], selectedBranches: [] as string[] });
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Faculty form state
  const [showAddFacultyModal, setShowAddFacultyModal] = useState(false);
  const [newFaculty, setNewFaculty] = useState({ name: '', email: '', subjects: '', selectedBranches: [] as string[] });

  const isDirector = userProfile?.role === 'Director';

  // Load Settings Data
  useEffect(() => {
    if (!isDirector) return; // Guard for director access

    async function loadSettings() {
      setLoading(true);
      try {
        // Query users, branches, academic_years from Supabase...

        const { data: usersData } = await supabase
          .from('profiles')
          .select('*, profile_branches(branches(name))')
          .order('name');
        
        const { data: branchesData } = await supabase
          .from('branches')
          .select('*')
          .order('name');
          
        const { data: yearsData } = await supabase
          .from('academic_years')
          .select('*')
          .order('label');

        // Fetch faculty with their branch assignments
        const { data: facultyData } = await supabase
          .from('faculty')
          .select('*, faculty_branches(branch_id, branches(name))')
          .order('name');

        const mappedUsers: AccountItem[] = (usersData || []).map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          branches: u.profile_branches?.map((pb: any) => pb.branches?.name).filter(Boolean) || []
        }));
        
        const mappedBranches: BranchItem[] = (branchesData || []).map((b: any) => ({
          id: b.id,
          name: b.name,
          code: b.code,
          classRange: `Class ${b.class_range_min} - ${b.class_range_max}`,
          isActive: b.is_active
        }));
        
        const mappedYears: YearItem[] = (yearsData || []).map((y: any) => ({
          id: y.id,
          label: y.label,
          isCurrent: y.is_current
        }));

        const mappedFaculty: FacultyItem[] = (facultyData || []).map((f: any) => ({
          id: f.id,
          name: f.name,
          email: f.email || '',
          subjects: f.subjects || [],
          branches: f.faculty_branches?.map((fb: any) => fb.branches?.name).filter(Boolean) || []
        }));
        
        setUsers(mappedUsers);
        setBranches(mappedBranches);
        setYears(mappedYears);
        setFacultyMembers(mappedFaculty);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [isDirector]);

  // Handle Create User Profile
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);

    try {
      // In real code, we insert auth user via admin supabase client and write to `profiles`
      // For MVP, we insert locally
      const createdItem: AccountItem = {
        id: `u-temp-${Date.now()}`,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        branches: newUser.selectedBranches.length > 0 ? newUser.selectedBranches : ['Baguipara']
      };

      setUsers([...users, createdItem]);
      setShowAddUserModal(false);
      setSuccessMsg(`Success! Created account for ${newUser.name} as ${newUser.role}.`);

      // Reset
      setNewUser({ name: '', email: '', role: 'Mentor', selectedBranches: [] });
    } catch (err) {
      console.error(err);
    }
  };

  // Handle toggle year rollover
  const handleRolloverYear = (yearId: string) => {
    setYears(years.map(y => ({
      ...y,
      isCurrent: y.id === yearId
    })));
    setSuccessMsg(`Success! Calendar system has rolled over to selected academic session.`);
  };

  // Handle Add Faculty
  const handleAddFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);

    try {
      const subjectsArr = newFaculty.subjects.split(',').map(s => s.trim()).filter(Boolean);

      const { data, error } = await supabase
        .from('faculty')
        .insert({
          name: newFaculty.name,
          email: newFaculty.email || null,
          subjects: subjectsArr
        })
        .select()
        .single();

      if (error) throw error;

      // Insert branch assignments
      if (newFaculty.selectedBranches.length > 0) {
        const branchInserts = newFaculty.selectedBranches.map(branchId => ({
          faculty_id: data.id,
          branch_id: branchId
        }));
        await supabase.from('faculty_branches').insert(branchInserts);
      }

      const branchNames = branches
        .filter(b => newFaculty.selectedBranches.includes(b.id))
        .map(b => b.name);

      setFacultyMembers([...facultyMembers, {
        id: data.id,
        name: data.name,
        email: data.email || '',
        subjects: data.subjects || [],
        branches: branchNames
      }]);

      setShowAddFacultyModal(false);
      setNewFaculty({ name: '', email: '', subjects: '', selectedBranches: [] });
      setSuccessMsg(`Success! Faculty member ${newFaculty.name} registered.`);
    } catch (err) {
      console.error(err);
    }
  };

  // Lock Non-directors out
  if (!isDirector) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ textAlign: 'center', padding: '48px', maxWidth: '400px' }}>
          <ShieldAlert size={48} style={{ color: 'var(--color-error)', marginBottom: '16px' }} />
          <h3>Access Denied</h3>
          <p className="secondary-text">Only Directors can access system configuration controls.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="skeleton" style={{ height: '300px', width: '100%' }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Success alert Banner */}
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
          <CheckCircle size={20} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 1. Header selection Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '24px' }}>
        <button 
          className="btn btn-tertiary"
          style={{ 
            borderBottom: activeTab === 'users' ? '2px solid var(--primary-orange)' : 'none',
            color: activeTab === 'users' ? 'var(--primary-orange)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'users' ? '600' : '500',
            borderRadius: 0, paddingBottom: '12px', minHeight: 'unset', gap: '8px'
          }}
          onClick={() => { setActiveTab('users'); setSuccessMsg(null); }}
        >
          <Users size={18} />
          <span>User Management</span>
        </button>
        <button 
          className="btn btn-tertiary"
          style={{ 
            borderBottom: activeTab === 'branches' ? '2px solid var(--primary-orange)' : 'none',
            color: activeTab === 'branches' ? 'var(--primary-orange)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'branches' ? '600' : '500',
            borderRadius: 0, paddingBottom: '12px', minHeight: 'unset', gap: '8px'
          }}
          onClick={() => { setActiveTab('branches'); setSuccessMsg(null); }}
        >
          <Globe size={18} />
          <span>Branch Directory</span>
        </button>
        <button 
          className="btn btn-tertiary"
          style={{ 
            borderBottom: activeTab === 'rollover' ? '2px solid var(--primary-orange)' : 'none',
            color: activeTab === 'rollover' ? 'var(--primary-orange)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'rollover' ? '600' : '500',
            borderRadius: 0, paddingBottom: '12px', minHeight: 'unset', gap: '8px'
          }}
          onClick={() => { setActiveTab('rollover'); setSuccessMsg(null); }}
        >
          <CalendarDays size={18} />
          <span>Session Rollover</span>
        </button>
        <button 
          className="btn btn-tertiary"
          style={{ 
            borderBottom: activeTab === 'faculty' ? '2px solid var(--primary-orange)' : 'none',
            color: activeTab === 'faculty' ? 'var(--primary-orange)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'faculty' ? '600' : '500',
            borderRadius: 0, paddingBottom: '12px', minHeight: 'unset', gap: '8px'
          }}
          onClick={() => { setActiveTab('faculty'); setSuccessMsg(null); }}
        >
          <BookOpen size={18} />
          <span>Faculty Directory</span>
        </button>
      </div>

      {/* 2. Tabs view panel components */}
      <div style={{ minHeight: '300px' }}>
        
        {/* TAB 1: User management */}
        {activeTab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="caption" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>User Registry Profiles</span>
              <button 
                className="btn btn-primary" 
                style={{ gap: '8px', padding: '8px 16px', minHeight: '38px' }}
                onClick={() => setShowAddUserModal(true)}
              >
                <Plus size={16} />
                <span>Add User Account</span>
              </button>
            </div>

            <div className="table-container">
              <table className="table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Staff Name</th>
                    <th>Email Address</th>
                    <th>System Role</th>
                    <th>Assigned Branch Access</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: '600' }}>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`badge ${
                          u.role === 'Director' ? 'badge-error' : 
                          u.role === 'Admin' ? 'badge-warning' : 'badge-info'
                        }`}>{u.role}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {u.branches.map((b, idx) => (
                            <span key={idx} className="badge badge-success" style={{ fontSize: '11px', backgroundColor: 'var(--surface-secondary)', color: 'var(--primary-orange)', border: '1px solid var(--light-orange)' }}>{b}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Branch config */}
        {activeTab === 'branches' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <span className="caption" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Institutes Location Centers</span>
            
            <div className="table-container">
              <table className="table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Branch Name</th>
                    <th>Branch Code</th>
                    <th>Classes Served</th>
                    <th>Status</th>
                    <th>Control</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map(b => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: '600' }}>{b.name}</td>
                      <td style={{ fontWeight: '700', color: 'var(--primary-orange)' }}>{b.code}</td>
                      <td>{b.classRange}</td>
                      <td>
                        <span className={`badge ${b.isActive ? 'badge-success' : 'badge-error'}`}>
                          {b.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 10px', minHeight: '30px', fontSize: '12px' }}
                          disabled={b.code === 'BGP'} // Cannot disable Baguipara (primary MVP)
                          onClick={() => {
                            setBranches(branches.map(item => {
                              if (item.id === b.id) {
                                return { ...item, isActive: !item.isActive };
                              }
                              return item;
                            }));
                            setSuccessMsg(`Status for branch ${b.name} updated.`);
                          }}
                        >
                          {b.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Academic Roll over indicators */}
        {activeTab === 'rollover' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card" style={{ margin: 0, padding: '20px', borderLeft: '4px solid var(--primary-orange)' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Active Session Rollover</h3>
              <p className="secondary-text" style={{ fontSize: '13px' }}>
                Flipping the active academic session shifts default dashboard calendars, query filters, and installment collections. Historical records are archived automatically without overwriting.
              </p>
            </div>

            <div className="table-container">
              <table className="table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Session Year</th>
                    <th>Active Status</th>
                    <th>Toggle Activation</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map(y => (
                    <tr key={y.id}>
                      <td style={{ fontWeight: '600' }}>{y.label}</td>
                      <td>
                        {y.isCurrent ? (
                          <span className="badge badge-success">Active Session</span>
                        ) : (
                          <span className="badge badge-info" style={{ backgroundColor: '#EEF2F6', color: 'var(--text-disabled)' }}>Archived</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', minHeight: '32px', fontSize: '12px', gap: '4px' }}
                          disabled={y.isCurrent}
                          onClick={() => handleRolloverYear(y.id)}
                        >
                          <ToggleLeft size={16} />
                          <span>Activate</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: Faculty Directory */}
        {activeTab === 'faculty' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="caption" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registered Faculty Members</span>
              <button 
                className="btn btn-primary" 
                style={{ gap: '8px', padding: '8px 16px', minHeight: '38px' }}
                onClick={() => setShowAddFacultyModal(true)}
              >
                <Plus size={16} />
                <span>Add Faculty</span>
              </button>
            </div>

            {facultyMembers.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
                <BookOpen size={48} style={{ color: 'var(--text-disabled)', marginBottom: '16px' }} />
                <h4>No faculty members registered</h4>
                <p className="secondary-text">Add faculty to assign them to batches and subjects.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Faculty Name</th>
                      <th>Email</th>
                      <th>Subjects Taught</th>
                      <th>Branch Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facultyMembers.map(f => (
                      <tr key={f.id}>
                        <td style={{ fontWeight: '600' }}>{f.name}</td>
                        <td>{f.email || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {f.subjects.map((s, idx) => (
                              <span key={idx} className="badge badge-info" style={{ fontSize: '11px' }}>{s}</span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {f.branches.map((b, idx) => (
                              <span key={idx} className="badge badge-success" style={{ fontSize: '11px', backgroundColor: 'var(--surface-secondary)', color: 'var(--primary-orange)', border: '1px solid var(--light-orange)' }}>{b}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* 3. Add User Modal dialog */}
      {showAddUserModal && (
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
              onClick={() => setShowAddUserModal(false)}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Register User Account</h2>

            <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  className="form-control"
                  required
                  placeholder="name@shiksharthi.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">System Role Type</label>
                <select
                  className="form-control"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as AccountItem['role'] })}
                >
                  <option value="Mentor">Academic Mentor</option>
                  <option value="Admin">Reception Admin</option>
                  <option value="Director">Director Principal</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Branch Access Scope</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }} className="caption">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" id="scBGP" defaultChecked value="Baguipara" onChange={(e) => {
                      if (e.target.checked) {
                        setNewUser({ ...newUser, selectedBranches: [...newUser.selectedBranches, 'Baguipara'] });
                      } else {
                        setNewUser({ ...newUser, selectedBranches: newUser.selectedBranches.filter(i => i !== 'Baguipara') });
                      }
                    }} />
                    <label htmlFor="scBGP">Baguipara (BGP)</label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" id="scPUB" value="Pubali" onChange={(e) => {
                      if (e.target.checked) {
                        setNewUser({ ...newUser, selectedBranches: [...newUser.selectedBranches, 'Pubali'] });
                      } else {
                        setNewUser({ ...newUser, selectedBranches: newUser.selectedBranches.filter(i => i !== 'Pubali') });
                      }
                    }} />
                    <label htmlFor="scPUB">Pubali (PUB)</label>
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                Register Account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add Faculty Modal */}
      {showAddFacultyModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 200,
          padding: '16px'
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: '420px', padding: '32px',
            position: 'relative', margin: 0, boxShadow: 'var(--shadow-hover)'
          }}>
            <button 
              className="btn btn-tertiary" 
              style={{ position: 'absolute', right: '16px', top: '16px', padding: '8px', minHeight: '36px' }}
              onClick={() => setShowAddFacultyModal(false)}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>Register Faculty</h2>
            <p className="secondary-text" style={{ marginBottom: '20px' }}>Add a new faculty member to the system.</p>

            <form onSubmit={handleAddFaculty} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="e.g. Dr. Arin Banerjee"
                  value={newFaculty.name}
                  onChange={(e) => setNewFaculty({ ...newFaculty, name: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="faculty@shiksharthi.com"
                  value={newFaculty.email}
                  onChange={(e) => setNewFaculty({ ...newFaculty, email: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Subjects Taught *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="Physics, Mathematics, Chemistry"
                  value={newFaculty.subjects}
                  onChange={(e) => setNewFaculty({ ...newFaculty, subjects: e.target.value })}
                />
                <span className="caption" style={{ marginTop: '4px' }}>Separate multiple subjects with commas</span>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Branch Assignment</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }} className="caption">
                  {branches.map(b => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="checkbox" 
                        id={`fac-branch-${b.id}`}
                        checked={newFaculty.selectedBranches.includes(b.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewFaculty({ ...newFaculty, selectedBranches: [...newFaculty.selectedBranches, b.id] });
                          } else {
                            setNewFaculty({ ...newFaculty, selectedBranches: newFaculty.selectedBranches.filter(id => id !== b.id) });
                          }
                        }}
                      />
                      <label htmlFor={`fac-branch-${b.id}`}>{b.name} ({b.code})</label>
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                Register Faculty
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
