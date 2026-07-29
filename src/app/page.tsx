'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { DashboardView } from '@/components/views/dashboard-view'
import { NewProjectView } from '@/components/views/new-project-view'
import { ProjectDetailView } from '@/components/views/project-detail-view'
import { SummaryEditorView } from '@/components/views/summary-editor-view'
import { ReportEditorView } from '@/components/views/report-editor-view'
import { PricingView } from '@/components/views/pricing-view'
import { SettingsView } from '@/components/views/settings-view'

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15, ease: 'easeIn' } },
}

export default function Home() {
  const { currentView, sidebarOpen, setSidebarOpen } = useAppStore()

  function renderView() {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />
      case 'new-project':
        return <NewProjectView />
      case 'project-detail':
        return <ProjectDetailView />
      case 'summary-editor':
        return <SummaryEditorView />
      case 'report-editor':
        return <ReportEditorView />
      case 'pricing':
        return <PricingView />
      case 'settings':
        return <SettingsView />
      default:
        return <DashboardView />
    }
  }

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <main className="flex flex-1 flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex flex-1 flex-col overflow-hidden"
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
