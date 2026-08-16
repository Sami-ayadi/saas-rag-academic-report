'use client'

import { useEffect, useState } from 'react'
import { GraduationCap, LayoutDashboard, FilePlus, FolderOpen, CreditCard, Settings, ShieldCheck } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useSidebar } from '@/components/ui/sidebar'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { TIER_LABELS, TIER_COLORS } from '@/lib/constants'
import { useSession } from 'next-auth/react'
import type { AppView } from '@/lib/store'

const navItems = [
  {
    label: 'Tableau de bord',
    view: 'dashboard' as const,
    icon: LayoutDashboard,
  },
  {
    label: 'Nouveau Projet',
    view: 'new-project' as const,
    icon: FilePlus,
  },
  {
    label: 'Projets',
    view: 'project-detail' as const,
    icon: FolderOpen,
  },
]

const settingsItems = [
  {
    label: 'Tarifs',
    view: 'pricing' as const,
    icon: CreditCard,
  },
  {
    label: 'Paramètres',
    view: 'settings' as const,
    icon: Settings,
  },
]

export function AppSidebar() {
  const { currentView, navigate } = useAppStore()
  const { data: session } = useSession()
  const { isMobile, setOpenMobile } = useSidebar()
  const [apiUser, setApiUser] = useState<{
    name?: string | null
    email?: string | null
    image?: string | null
    tier: 'FREE' | 'STARTER' | 'PRO'
    role: 'USER' | 'ADMIN'
  } | null>(null)

  useEffect(() => {
    fetch('/api/user')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setApiUser(data?.user ?? null))
      .catch(() => undefined)
  }, [])

  const currentUser = apiUser ?? session?.user

  const handleNavigate = (view: AppView) => {
    navigate(view)
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="px-4 py-3">
        <a href="/" className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-4" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold tracking-tight text-sidebar-foreground">
              RAG Report
            </span>
            <span className="text-[10px] text-sidebar-foreground/60">
              Génération Académique
            </span>
          </div>
        </a>
      </SidebarHeader>

      <Separator className="mx-3 w-auto" />

      <SidebarContent>
        {currentUser?.role === 'ADMIN' && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={currentView === 'admin'} tooltip="Administration" onClick={() => handleNavigate('admin')}>
                    <ShieldCheck className="size-4" />
                    <span>Utilisateurs & activité</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.view}>
                  <SidebarMenuButton
                    isActive={currentView === item.view}
                    tooltip={item.label}
                    onClick={() => handleNavigate(item.view)}
                  >
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Compte</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.view}>
                  <SidebarMenuButton
                    isActive={currentView === item.view}
                    tooltip={item.label}
                    onClick={() => handleNavigate(item.view)}
                  >
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Separator className="mx-3 w-auto" />
        <div className="flex items-center gap-3 px-2 py-2 group-data-[collapsible=icon]:justify-center">
          <Avatar className="size-8 shrink-0">
            <AvatarImage src={currentUser?.image ?? ''} alt={currentUser?.name ?? 'Utilisateur'} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {(currentUser?.name ?? 'Utilisateur').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-xs font-medium text-sidebar-foreground truncate">
              {currentUser?.name ?? 'Utilisateur'}
            </span>
            <Badge
              variant="secondary"
              className={`h-5 px-1.5 text-[10px] font-medium ${TIER_COLORS[currentUser?.tier ?? 'FREE']}`}
            >
              {TIER_LABELS[currentUser?.tier ?? 'FREE']}
            </Badge>
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
