import { create } from 'zustand';
import { User } from 'firebase/auth';

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  role: 'user' | 'admin';
  createdAt: string;
  walletBalance: number;
  isCreator: boolean;
  bio?: string;
  username?: string;
  website?: string;
  category?: string;
  theme?: string;
}

interface AppState {
  user: User | null;
  userProfile: UserProfile | null;
  setUser: (user: User | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  isAuthModalOpen: boolean;
  setAuthModalOpen: (isOpen: boolean) => void;
  isPremiumModalOpen: boolean;
  setPremiumModalOpen: (isOpen: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  userProfile: null,
  setUser: (user) => set({ user }),
  setUserProfile: (userProfile) => set({ userProfile }),
  theme: 'light',
  setTheme: (theme) => {
    set({ theme });
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },
  isAuthModalOpen: false,
  setAuthModalOpen: (isOpen) => set({ isAuthModalOpen: isOpen }),
  isPremiumModalOpen: false,
  setPremiumModalOpen: (isOpen) => set({ isPremiumModalOpen: isOpen }),
}));
