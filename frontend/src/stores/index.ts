import type { Tenant, User } from '@/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: User | null) => void;
  setTenant: (tenant: Tenant | null) => void;
  setAuth: (user: User, tenant: Tenant) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenant: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setTenant: (tenant) => set({ tenant }),
      setAuth: (user, tenant) => set({ user, tenant, isAuthenticated: true, isLoading: false }),
      logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, tenant: null, isAuthenticated: false });
      },
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, tenant: state.tenant, isAuthenticated: state.isAuthenticated }),
    }
  )
);

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarCollapsed: false,
      theme: 'system',

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ui-storage',
    }
  )
);

interface LeadFilters {
  search: string;
  status: string[];
  source: string[];
  assignedTo: string;
  tags: string[];
  dateRange: { start?: string; end?: string };
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface LeadState {
  filters: LeadFilters;
  selectedLeads: string[];
  viewMode: 'table' | 'pipeline' | 'cards';

  setFilters: (filters: Partial<LeadFilters>) => void;
  resetFilters: () => void;
  setSelectedLeads: (ids: string[]) => void;
  toggleSelectLead: (id: string) => void;
  selectAllLeads: (ids: string[]) => void;
  clearSelection: () => void;
  setViewMode: (mode: 'table' | 'pipeline' | 'cards') => void;
}

const defaultFilters: LeadFilters = {
  search: '',
  status: [],
  source: [],
  assignedTo: '',
  tags: [],
  dateRange: {},
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

export const useLeadStore = create<LeadState>()((set) => ({
  filters: defaultFilters,
  selectedLeads: [],
  viewMode: 'table',

  setFilters: (newFilters) =>
    set((state) => ({ filters: { ...state.filters, ...newFilters } })),
  resetFilters: () => set({ filters: defaultFilters }),
  setSelectedLeads: (selectedLeads) => set({ selectedLeads }),
  toggleSelectLead: (id) =>
    set((state) => ({
      selectedLeads: state.selectedLeads.includes(id)
        ? state.selectedLeads.filter((leadId) => leadId !== id)
        : [...state.selectedLeads, id],
    })),
  selectAllLeads: (ids) => set({ selectedLeads: ids }),
  clearSelection: () => set({ selectedLeads: [] }),
  setViewMode: (viewMode) => set({ viewMode }),
}));
