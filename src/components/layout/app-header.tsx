'use client'

import { Bell, Search } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useSidebar } from '@/components/ui/sidebar'
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

const viewLabels: Record<AppView, string> = {
  dashboard: 'Tableau de bord',
  'new-project': 'Nouveau Projet',
  'project-detail': 'Détail du projet',
  'summary-editor': 'Éditeur de résumé',
  'report-editor': 'Éditeur de rapport',
  pricing: 'Tarifs',
  settings: 'Paramètres',
}

const viewParentMap: Partial<Record<AppView, { label: string; view: AppView }>> = {
  'new-project': { label: 'Projets', view: 'project-detail' },
  'project-detail': { label: 'Tableau de bord', view: 'dashboard' },
  'summary-editor': { label: 'Projets', view: 'project-detail' },
  'report-editor': { label: 'Projets', view: 'project-detail' },
}

export function AppHeader() {
  const { currentView, navigate } = useAppStore()
  const { isMobile } = useSidebar()

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
        {/* Search button (decorative) */}
        <Button variant="ghost" size="icon" className="size-8">
          <Search className="size-4" />
          <span className="sr-only">Rechercher</span>
        </Button>

        {/* Notification bell (decorative) */}
        <Button variant="ghost" size="icon" className="size-8 relative">
          <Bell className="size-4" />
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-accent" />
          <span className="sr-only">Notifications</span>
        </Button>

        {/* User avatar dropdown (decorative) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 rounded-full">
              <Avatar className="size-7">
                <AvatarImage src="" alt="Utilisateur" />
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                  JD
                </AvatarFallback>
              </Avatar>
              <span className="sr-only">Menu utilisateur</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">Jean Dupont</p>
                <p className="text-xs text-muted-foreground">jean.dupont@exemple.fr</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('settings')}>
              Paramètres
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('pricing')}>
              Abonnement
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
