import { create } from 'zustand';

export interface Branch {
  id: string;
  name: string;
  code: string;
  class_range_min: number;
  class_range_max: number;
  is_active: boolean;
}

export interface AcademicYear {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'Director' | 'Mentor' | 'Admin';
}

interface AppState {
  currentAcademicYear: AcademicYear | null;
  currentBranch: Branch | null;
  userProfile: UserProfile | null;
  userBranches: Branch[];
  setCurrentAcademicYear: (year: AcademicYear | null) => void;
  setCurrentBranch: (branch: Branch | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setUserBranches: (branches: Branch[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentAcademicYear: null,
  currentBranch: null,
  userProfile: null,
  userBranches: [],
  setCurrentAcademicYear: (year) => set({ currentAcademicYear: year }),
  setCurrentBranch: (branch) => set({ currentBranch: branch }),
  setUserProfile: (profile) => set({ userProfile: profile }),
  setUserBranches: (branches) => set({ userBranches: branches }),
}));
