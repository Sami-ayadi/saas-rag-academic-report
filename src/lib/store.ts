import { create } from 'zustand'

export type AppView =
  | 'dashboard'
  | 'new-project'
  | 'project-detail'
  | 'intake'
  | 'summary-editor'
  | 'report-editor'
  | 'pricing'
  | 'settings'
  | 'admin'

interface AppState {
  currentView: AppView
  selectedProjectId: string | null
  selectedReportId: string | null
  sidebarOpen: boolean
  navigate: (view: AppView, projectId?: string, reportId?: string) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  selectedProjectId: null,
  selectedReportId: null,
  sidebarOpen: true,
  navigate: (view, projectId, reportId) => set({
    currentView: view,
    selectedProjectId: projectId ?? null,
    selectedReportId: reportId ?? null,
  }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
