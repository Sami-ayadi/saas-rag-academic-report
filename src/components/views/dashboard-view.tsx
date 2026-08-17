'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  FolderOpen,
  FileText,
  Upload,
  Zap,
  Eye,
  Play,
  Plus,
  CreditCard,
  Database,
  Loader2,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { TablePagination } from '@/components/ui/table-pagination'

import { useAppStore } from '@/lib/store'
import { secureFetch } from '@/lib/secure-fetch'
import type { ProjectWithDetails, UserWithStats, UsageStats } from '@/lib/types'
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '@/lib/constants'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
}

function formatDate(date: string | Date): string {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr })
  } catch {
    return '—'
  }
}

export function DashboardView() {
  const demoMode = process.env.NEXT_PUBLIC_AUTH_ALLOW_DEMO === 'true'
  const navigate = useAppStore((s) => s.navigate)
  const [projects, setProjects] = useState<ProjectWithDetails[]>([])
  const [user, setUser] = useState<UserWithStats | null>(null)
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [projectScope, setProjectScope] = useState<'OWN' | 'ALL'>('OWN')
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [projectPage, setProjectPage] = useState(1)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [projectsRes, userRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/user'),
      ])
      if (projectsRes.ok) {
        const data = await projectsRes.json()
        setProjects(data.projects ?? [])
        setProjectPage(1)
        setProjectScope(data.scope === 'ALL' ? 'ALL' : 'OWN')
      }
      if (userRes.ok) {
        const data = await userRes.json()
        setUser(data.user)
        setUsageStats(data.usageStats)
      }
    } catch {
      toast.error('Erreur lors du chargement des données')
    } finally {
      setLoading(false)
    }
  }

  async function handleSeed() {
    setSeeding(true)
    try {
      const res = await secureFetch('/api/seed', { method: 'POST' })
      if (res.ok) {
        toast.success('Données de démonstration ajoutées avec succès')
        await loadData()
      } else {
        toast.error('Erreur lors du peuplement des données')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSeeding(false)
    }
  }

  const isAdminPortfolio = projectScope === 'ALL' && user?.role === 'ADMIN'
  const projectPageSize = 10
  const pagedProjects = projects.slice((projectPage - 1) * projectPageSize, projectPage * projectPageSize)
  const totalReports = isAdminPortfolio ? projects.reduce((total, project) => total + project._count.reports, 0) : usageStats?.totalReports ?? 0
  const totalDocuments = isAdminPortfolio ? projects.reduce((total, project) => total + project._count.documents, 0) : usageStats?.totalDocuments ?? 0
  const totalProjects = isAdminPortfolio ? projects.length : usageStats?.totalProjects ?? projects.length
  const creditsUsed = user?.creditsUsed ?? 0
  const creditsLimit = user?.creditsLimit ?? 0

  const statsCards = [
    {
      label: 'Total Projets',
      value: totalProjects,
      icon: FolderOpen,
    },
    {
      label: 'Rapports Générés',
      value: totalReports,
      icon: FileText,
    },
    {
      label: 'Documents Uploadés',
      value: totalDocuments,
      icon: Upload,
    },
    {
      label: 'Crédits Utilisés',
      value: `${creditsUsed} / ${creditsLimit}`,
      icon: Zap,
    },
  ]

  return (
    <motion.div
      className="space-y-6 p-4 md:p-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Tableau de bord
          </h1>
          <p className="text-muted-foreground">
            {isAdminPortfolio ? "Vue d'ensemble de tous les projets de la plateforme" : "Vue d'ensemble de vos projets et activités"}
          </p>
        </div>
        {demoMode && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeed}
            disabled={seeding}
            className="w-fit"
          >
            {seeding ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Database className="mr-2 size-4" />
            )}
            Seeder les données
          </Button>
        )}
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        variants={containerVariants}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {statsCards.map((stat) => (
          <motion.div key={stat.label} variants={itemVariants}>
            <Card className="relative overflow-hidden">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <stat.icon className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    {loading ? (
                      <Skeleton className="mb-1 h-8 w-16" />
                    ) : (
                      <div className="text-2xl font-bold tabular-nums">
                        {stat.value}
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground truncate">
                      {stat.label}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Recent Projects */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{isAdminPortfolio ? 'Tous les projets' : 'Projets récents'}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <FolderOpen className="size-12 text-muted-foreground/40" />
                <p className="text-muted-foreground">
                  Aucun projet pour le moment
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('new-project')}
                >
                  <Plus className="mr-2 size-4" />
                  Créer votre premier projet
                </Button>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titre</TableHead>
                      {isAdminPortfolio && <TableHead>Propriétaire</TableHead>}
                      <TableHead className="hidden sm:table-cell">Statut</TableHead>
                      <TableHead className="hidden md:table-cell">Niveau</TableHead>
                      <TableHead className="hidden lg:table-cell">Dernière MAJ</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedProjects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {project.title}
                        </TableCell>
                        {isAdminPortfolio && (
                          <TableCell>
                            <p className="max-w-48 truncate text-sm">{project.owner?.name ?? project.owner?.email ?? 'Utilisateur'}</p>
                            <p className="max-w-48 truncate text-xs text-muted-foreground">{project.owner?.email ?? `ID : ${project.owner?.id ?? 'inconnu'}`}</p>
                          </TableCell>
                        )}
                        <TableCell className="hidden sm:table-cell">
                          <Badge
                            variant="secondary"
                            className={PROJECT_STATUS_COLORS[project.status] ?? 'bg-secondary text-secondary-foreground'}
                          >
                            {PROJECT_STATUS_LABELS[project.status] ?? project.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {project.academicLevel}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {formatDate(project.updatedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {project.userId === user?.id ? <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => navigate('project-detail', project.id)}
                              title="Voir le projet"
                            >
                              <Eye className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => navigate('project-detail', project.id)}
                              title="Générer"
                            >
                              <Play className="size-4" />
                            </Button>
                          </div> : <Badge variant="outline" className="font-normal">Lecture admin</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          <TablePagination page={projectPage} pageSize={projectPageSize} total={projects.length} onPageChange={setProjectPage} />
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <Button
          onClick={() => navigate('new-project')}
          className="flex-1 sm:flex-none"
        >
          <Plus className="mr-2 size-4" />
          Nouveau Projet
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate('pricing')}
          className="flex-1 sm:flex-none"
        >
          <CreditCard className="mr-2 size-4" />
          Voir les Tarifs
        </Button>
      </motion.div>
    </motion.div>
  )
}
