'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'
import { useAppStore } from '@/lib/store'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AppView } from '@/lib/store'
import { secureFetch } from '@/lib/secure-fetch'

interface HeaderUser {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  role?: 'USER' | 'ADMIN'
}

interface AppNotification {
  id: string
  type: string
  title: string
  message: string
  linkView: string | null
  metadata: { requestId?: string }
  createdAt: string
}

const viewLabels: Record<AppView, string> = {
  dashboard: 'Tableau de bord',
  'new-project': 'Nouveau Projet',
  'project-detail': 'Détail du projet',
  intake: 'Questionnaire de cadrage',
  'summary-editor': 'Éditeur de résumé',
  'report-editor': 'Éditeur de rapport',
  pricing: 'Tarifs',
  settings: 'Paramètres',
  admin: 'Administration',
}

const viewParentMap: Partial<Record<AppView, { label: string; view: AppView }>> = {
  'new-project': { label: 'Projets', view: 'project-detail' },
  'project-detail': { label: 'Tableau de bord', view: 'dashboard' },
  intake: { label: 'Projet', view: 'project-detail' },
  'summary-editor': { label: 'Projets', view: 'project-detail' },
  'report-editor': { label: 'Projets', view: 'project-detail' },
}

export function AppHeader() {
  const { currentView, navigate } = useAppStore()
  const { data: session } = useSession()
  const demoMode = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_AUTH_ALLOW_DEMO === 'true'
  const [demoUser, setDemoUser] = useState<HeaderUser | null>(null)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [notificationCount, setNotificationCount] = useState(0)

  useEffect(() => {
    if (!demoMode) return
    fetch('/api/user')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setDemoUser(data?.user ?? null))
      .catch(() => undefined)
  }, [demoMode])

  async function switchDemoUser(userId: 'demo-user-001' | 'demo-admin-001' | 'demo-admin-002') {
    const response = await secureFetch('/api/demo/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (response.ok) window.location.reload()
  }

  const currentUser: HeaderUser | undefined = demoUser ?? session?.user

  useEffect(() => {
    if (!currentUser?.id) return
    fetch('/api/notifications?page=1&pageSize=10')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setNotificationCount(data?.pagination?.total ?? 0))
      .catch(() => undefined)
  }, [currentUser?.id])

  async function openNotifications(open: boolean) {
    if (!open) { setNotifications([]); return }
    const response = await fetch('/api/notifications?page=1&pageSize=10')
    if (!response.ok) return
    const data = await response.json() as { notifications: AppNotification[] }
    setNotifications(data.notifications)
    const seenNotifications = data.notifications.filter((item) => item.type !== 'ROLE_APPROVAL_REQUIRED')
    if (seenNotifications.length > 0) {
      await secureFetch('/api/notifications', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: seenNotifications.map((item) => item.id) }),
      })
      setNotificationCount((count) => Math.max(0, count - seenNotifications.length))
    }
  }

  async function reviewRoleFromNotification(notification: AppNotification, decision: 'APPROVE' | 'REJECT') {
    if (!notification.metadata.requestId) return
    const response = await secureFetch(`/api/admin/role-requests/${notification.metadata.requestId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }),
    })
    if (response.ok) {
      await secureFetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [notification.id] }) })
      setNotifications((current) => current.filter((item) => item.id !== notification.id))
      setNotificationCount((count) => Math.max(0, count - 1))
    }
  }

  async function markAllNotificationsRead() {
    const response = await secureFetch('/api/notifications', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }),
    })
    if (response.ok) {
      setNotifications([])
      setNotificationCount(0)
    }
  }

  const breadcrumbParent = viewParentMap[currentView]

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
      <SidebarTrigger className="-ml-1" />

      <Separator orientation="vertical" className="mr-2 h-4" />

      <Breadcrumb className="hidden sm:flex">
        <BreadcrumbList>
          {breadcrumbParent && (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    navigate(breadcrumbParent.view)
                  }}
                >
                  {breadcrumbParent.label}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbPage>{viewLabels[currentView]}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Mobile title */}
      <span className="sm:hidden text-sm font-medium ml-2">
        {viewLabels[currentView]}
      </span>

      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu onOpenChange={(open) => void openNotifications(open)}>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="relative size-8"><Bell className="size-4" />{notificationCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-white">{notificationCount > 99 ? '99+' : notificationCount}</span>}<span className="sr-only">Notifications non lues : {notificationCount}</span></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between gap-3"><span>Notifications récentes</span><Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" disabled={notificationCount === 0 && notifications.length === 0} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void markAllNotificationsRead() }}>Tout marquer comme lu</Button></DropdownMenuLabel><DropdownMenuSeparator />
            {notifications.map((notification) => notification.type === 'ROLE_APPROVAL_REQUIRED'
              ? <div key={notification.id} className="space-y-2 px-2 py-3"><p className="text-sm font-medium">{notification.title}</p><p className="text-xs text-muted-foreground">{notification.message}</p><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void reviewRoleFromNotification(notification, 'REJECT')}>Refuser</Button><Button size="sm" onClick={() => void reviewRoleFromNotification(notification, 'APPROVE')}>Approuver</Button></div></div>
              : <DropdownMenuItem key={notification.id} className="flex cursor-pointer flex-col items-start gap-1 py-3" onClick={() => notification.linkView && navigate(notification.linkView as AppView)}><span className="font-medium">{notification.title}</span><span className="whitespace-normal text-xs text-muted-foreground">{notification.message}</span><span className="text-[10px] text-muted-foreground">{new Date(notification.createdAt).toLocaleString('fr-FR')}</span></DropdownMenuItem>)}
            {notifications.length === 0 && <DropdownMenuItem disabled>Aucune nouvelle notification</DropdownMenuItem>}
            {notifications.length > 0 && <><DropdownMenuSeparator /><DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">Ces notifications sont retirées du fil après cette consultation.</DropdownMenuLabel></>}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User avatar dropdown (decorative) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 rounded-full">
              <Avatar className="size-7">
                <AvatarImage src={currentUser?.image ?? ''} alt={currentUser?.name ?? 'Utilisateur'} />
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                  {(currentUser?.name ?? 'Utilisateur').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="sr-only">Menu utilisateur</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{currentUser?.name ?? 'Utilisateur'}</p>
                <p className="text-xs text-muted-foreground">{currentUser?.email ?? ''}</p>
                {currentUser?.role && <p className="text-[10px] uppercase text-muted-foreground">{currentUser.role}</p>}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {demoMode && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">Changer de compte démo</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => switchDemoUser('demo-user-001')}>
                  Étudiant démo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => switchDemoUser('demo-admin-001')}>
                  Administrateur démo (propriétaire)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => switchDemoUser('demo-admin-002')}>
                  Validateur démo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => navigate('settings')}>
              Paramètres
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('pricing')}>
              Abonnement
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => signOut({ callbackUrl: '/' })}>
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
