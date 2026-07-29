'use client'

import { GraduationCap, LayoutDashboard, FilePlus, FolderOpen, CreditCard, Settings } from 'lucide-react'
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
import type { Tier } from '@/lib/types'

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
  const { currentView, navigate, sidebarOpen } = useAppStore()
  const { state, isMobile, setOpenMobile } = useSidebar()

  const handleNavigate = (view: typeof navItems[number]['view']) => {
    navigate(view)
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="px-4 py-3">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
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
        </div>
      </SidebarHeader>

      <Separator className="mx-3 w-auto" />

      <SidebarContent>
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
            <AvatarImage src="" alt="Utilisateur" />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              JD
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-xs font-medium text-sidebar-foreground truncate">
              Jean Dupont
            </span>
            <Badge
              variant="secondary"
              className={`h-5 px-1.5 text-[10px] font-medium ${TIER_COLORS.PRO}`}
            >
              {TIER_LABELS.PRO}
            </Badge>
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
