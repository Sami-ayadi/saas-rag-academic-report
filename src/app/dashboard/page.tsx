'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getProviders, signIn, useSession } from 'next-auth/react'
import { GraduationCap, Loader2 } from 'lucide-react'

import { AppHeader } from '@/components/layout/app-header'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AdminView } from '@/components/views/admin-view'
import { DashboardView } from '@/components/views/dashboard-view'
import { IntakeView } from '@/components/views/intake-view'
import { NewProjectView } from '@/components/views/new-project-view'
import { PricingView } from '@/components/views/pricing-view'
import { ProjectDetailView } from '@/components/views/project-detail-view'
import { ReportEditorView } from '@/components/views/report-editor-view'
import { SettingsView } from '@/components/views/settings-view'
import { SummaryEditorView } from '@/components/views/summary-editor-view'
import { useAppStore } from '@/lib/store'

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15, ease: 'easeIn' as const } },
}

export default function DashboardPage() {
  const { currentView, sidebarOpen, setSidebarOpen } = useAppStore()
  const { status } = useSession()
  const demoMode = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_AUTH_ALLOW_DEMO === 'true'
  const [googleReady, setGoogleReady] = useState<boolean | null>(null)

  useEffect(() => {
    if (demoMode) return
    let cancelled = false
    getProviders()
      .then((providers) => {
        if (!cancelled) setGoogleReady(Boolean(providers?.google))
      })
      .catch(() => {
        if (!cancelled) setGoogleReady(false)
      })
    return () => {
      cancelled = true
    }
  }, [demoMode])

  if (!demoMode && status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-7 animate-spin text-primary" aria-label="Chargement de la session" />
      </main>
    )
  }

  if (!demoMode && status === 'unauthenticated') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="size-6" />
            </div>
            <CardTitle>Connectez-vous pour continuer</CardTitle>
            <CardDescription>Votre espace conserve vos projets, sources, rapports et exports.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {googleReady === false ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">Connexion Google non configurée</p>
                <p className="mt-1">
                  Renseignez <code>GOOGLE_CLIENT_ID</code> et <code>GOOGLE_CLIENT_SECRET</code> dans <code>.env.local</code>,
                  puis redémarrez le serveur. Voir <code>GOOGLE_AUTH_SETUP.md</code>.
                </p>
              </div>
            ) : (
              <Button
                className="w-full"
                disabled={googleReady === null}
                onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
              >
                {googleReady === null ? 'Chargement de la connexion…' : 'Continuer avec Google'}
              </Button>
            )}
            <Button className="w-full" variant="outline" asChild>
              <a href="/">Retour au site</a>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  function renderView() {
    switch (currentView) {
      case 'dashboard': return <DashboardView />
      case 'new-project': return <NewProjectView />
      case 'project-detail': return <ProjectDetailView />
      case 'intake': return <IntakeView />
      case 'summary-editor': return <SummaryEditorView />
      case 'report-editor': return <ReportEditorView />
      case 'pricing': return <PricingView />
      case 'settings': return <SettingsView />
      case 'admin': return <AdminView />
      default: return <DashboardView />
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
