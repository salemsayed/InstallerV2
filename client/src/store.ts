import { create } from 'zustand';

interface User {
  id: number;
  name: string;
  phone: string;
  role: string;
  points: number;
  level: number;
  region: string;
  status: string;
  badgeIds?: number[];
}

interface UserStore {
  user: User | null;
  isInitialized: boolean;
  setUser: (user: User | null) => void;
  setInitialized: (initialized: boolean) => void;
}

export const useStore = create<UserStore>((set) => ({
  user: null,
  isInitialized: false,
  setUser: (user: User | null) => set({ user }),
  setInitialized: (isInitialized: boolean) => set({ isInitialized }),
}));