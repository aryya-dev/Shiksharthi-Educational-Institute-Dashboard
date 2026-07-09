'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Users, 
  Layers, 
  Calendar, 
  CheckSquare, 
  FileText, 
  CreditCard, 
  Settings, 
  Activity, 
  LogOut, 
  Globe,
  CalendarDays,
  Menu,
  X,
  BookOpen
} from 'lucide-react';
import { useAppStore, Branch, AcademicYear } from '@/store/useAppStore';
import { createClient } from '@/utils/supabase/client';



export default function LayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  
  const {
    currentAcademicYear,
    currentBranch,
    userProfile,
    userBranches,
    setCurrentAcademicYear,
    setCurrentBranch,
    setUserProfile,
    setUserBranches
  } = useAppStore();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isLogin = pathname === '/login';

  // Fetch initial profile, branches, and academic years
  useEffect(() => {
    async function initApp() {
      if (isLogin) {
        setLoading(false);
        return;
      }



      // ── Normal Supabase Flow ──
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (!profile) {
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }

      setUserProfile(profile);

      const { data: branchesData } = await supabase.from('branches').select('*');
      const { data: yearsData } = await supabase.from('academic_years').select('*');

      const allBranches = (branchesData || []) as Branch[];
      const allYears = (yearsData || []) as AcademicYear[];
      
      setBranches(allBranches);
      setAcademicYears(allYears);

      let allowedBranches: Branch[] = [];
      if (profile.role === 'Director') {
        allowedBranches = allBranches;
      } else {
        const { data: mappedBranches } = await supabase
          .from('profile_branches')
          .select('branch_id')
          .eq('profile_id', profile.id);
        const branchIds = mappedBranches?.map(mb => mb.branch_id) || [];
        allowedBranches = allBranches.filter(b => branchIds.includes(b.id));
      }

      setUserBranches(allowedBranches);

      const currentYear = allYears.find(y => y.is_current) || allYears[0] || null;
      setCurrentAcademicYear(currentYear);

      const defaultBranch = allowedBranches.find(b => b.code === 'BGP' && b.is_active) 
        || allowedBranches.find(b => b.is_active) 
        || allowedBranches[0] 
        || null;
      
      setCurrentBranch(defaultBranch);
      setLoading(false);
    }

    initApp();
  }, [pathname]);

  const handleSignOut = async () => {
    document.cookie = 'demo_mode=; path=/; max-age=0';
    document.cookie = 'demo_role=; path=/; max-age=0';
    await supabase.auth.signOut();
    setUserProfile(null);
    setUserBranches([]);
    setCurrentBranch(null);
    setCurrentAcademicYear(null);
    router.push('/login');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-color)' }}>
        <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }}></div>
      </div>
    );
  }

  if (isLogin) {
    return <>{children}</>;
  }

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['Director', 'Mentor', 'Admin'] },
    { label: 'Students', path: '/students', icon: Users, roles: ['Director', 'Mentor', 'Admin'] },
    { label: 'Batches', path: '/batches', icon: Layers, roles: ['Director', 'Mentor', 'Admin'] },
    { label: 'Schedule', path: '/schedule', icon: Calendar, roles: ['Director', 'Mentor', 'Admin'] },
    { label: 'Attendance', path: '/attendance', icon: CheckSquare, roles: ['Director', 'Mentor', 'Admin'] },
    { label: 'Class Reports', path: '/class-reports', icon: FileText, roles: ['Director', 'Mentor', 'Admin'] },
    { label: 'Exams', path: '/exams', icon: FileText, roles: ['Director', 'Mentor', 'Admin'] },
    { label: 'Report Cards', path: '/report-cards', icon: FileText, roles: ['Director', 'Mentor', 'Admin'] },
    { label: 'Syllabus Tracker', path: '/syllabus', icon: BookOpen, roles: ['Director', 'Mentor', 'Admin'] },
    { label: 'Fees', path: '/fees', icon: CreditCard, roles: ['Director', 'Admin'] },
    { label: 'Activity Logs', path: '/activity-logs', icon: Activity, roles: ['Director', 'Mentor', 'Admin'] },
    { label: 'Settings', path: '/settings', icon: Settings, roles: ['Director'] },
  ];

  const visibleNavItems = navItems.filter(item => userProfile && item.roles.includes(userProfile.role));
  const pageTitle = pathname.split('/')[1]?.replace(/-/g, ' ') || 'Dashboard';

  return (
    <div className="app-layout">
      {/* Sidebar - Desktop Only */}
      <aside className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px', padding: '0 4px' }}>
          <img 
            src="/logo.png" 
            alt="Shiksharthi Logo" 
            style={{ maxHeight: '45px', maxWidth: '100%', objectFit: 'contain' }} 
          />
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {visibleNavItems.map((item) => {
            const isActive = pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <Link 
                key={item.path} 
                href={item.path}
                className="btn btn-tertiary"
                style={{ 
                  justifyContent: 'flex-start',
                  color: isActive ? 'var(--primary-orange)' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'var(--surface-secondary)' : 'transparent',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-btn)'
                }}
              >
                <Icon size={22} />
                <span style={{ marginLeft: '12px', fontWeight: isActive ? '600' : '500' }}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {userProfile && (
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{userProfile.name}</span>
              <span style={{ fontSize: '12px' }} className="badge badge-info">
                {userProfile.role}
              </span>
            </div>
            <button 
              onClick={handleSignOut}
              className="btn btn-secondary" 
              style={{ justifyContent: 'flex-start', width: '100%', gap: '8px', minHeight: '40px' }}
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </aside>

      {/* Main Area */}
      <div className="main-content">
        {/* Header */}
        <header className="header-bar">
          <div className="header-left" style={{ display: 'flex', alignItems: 'center' }}>
            <img 
              src="/logo.png" 
              className="mobile-logo" 
              alt="Shiksharthi Logo" 
            />
            <div>
              <span className="caption" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Internal Portal</span>
              <h2 style={{ margin: 0, textTransform: 'capitalize' }}>{pageTitle}</h2>
            </div>
          </div>

          <div className="header-filters">
            <div className="header-filter-item">
              <Globe size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              <select 
                className="form-control"
                value={currentBranch?.id || ''}
                onChange={(e) => {
                  const b = branches.find(item => item.id === e.target.value);
                  if (b) setCurrentBranch(b);
                }}
                disabled={userProfile?.role !== 'Director'}
              >
                {userBranches.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>

            <div className="header-filter-item">
              <CalendarDays size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              <select 
                className="form-control"
                value={currentAcademicYear?.id || ''}
                onChange={(e) => {
                  const y = academicYears.find(item => item.id === e.target.value);
                  if (y) setCurrentAcademicYear(y);
                }}
              >
                {academicYears.map(y => (
                  <option key={y.id} value={y.id}>{y.label}</option>
                ))}
              </select>
            </div>
          </div>
        </header>

        <main>{children}</main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {visibleNavItems.slice(0, 5).map((item) => {
            const isActive = pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <Link 
                key={item.path} 
                href={item.path}
                className={`bottom-nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={22} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
