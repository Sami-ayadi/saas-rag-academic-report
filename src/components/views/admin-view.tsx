'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, Archive, ArrowDown, ArrowUp, ArrowUpDown, Bot, ChartPie, CheckCircle2, Clock3, Coins, Database, Download, Eye,
  FileText, FolderKanban, HardDrive, Loader2, RefreshCw, Search, Settings2,
  ShieldCheck, Sparkles, UserCheck, Users, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TablePagination } from '@/components/ui/table-pagination'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { secureFetch } from '@/lib/secure-fetch'

type Tier = 'FREE' | 'STARTER' | 'PRO'
type Role = 'USER' | 'ADMIN'
type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
type LogCategory = 'AUDIT' | 'JOB' | 'AI_USAGE'
type LogLevel = 'INFO' | 'WARNING' | 'CRITICAL'
type UserSortKey = 'identity' | 'tier' | 'role' | 'usage' | 'activity' | 'createdAt' | 'isActive' | 'creditsLimit'
type SortDirection = 'asc' | 'desc'

interface ManagedUser {
  id: string
  email: string | null
  name: string | null
  tier: Tier
  role: Role
  isActive: boolean
  creditsUsed: number
  creditsLimit: number
  createdAt: string
  reportCount: number
  _count: { projects: number; jobs: number }
}

interface AdminLog {
  id: string
  category: LogCategory
  level: LogLevel
  title: string
  detail: string
  actor: string | null
  target: string | null
  createdAt: string
  metadata?: Record<string, unknown>
}

interface AdminJob {
  id: string
  type: string
  status: JobStatus
  progress: number
  progressMessage: string
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
  user: { name: string | null; email: string | null }
  project: { id: string; title: string }
}

interface RetentionItem {
  id: string
  userId: string
  projectId: string | null
  type: string
  tokens: number
  costUsd: number
  createdAt: string
  retentionExempt: boolean
  retentionReason: string | null
  retentionMarkedAt: string | null
  user: { id: string; name: string | null; email: string | null } | null
  project: { id: string; title: string } | null
}

interface RoleRequest {
  id: string
  targetUserId: string
  requestedById: string
  currentRole: Role
  requestedRole: Role
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  reason: string | null
  reviewReason: string | null
  createdAt: string
  reviewedAt: string | null
  target: { id: string; name: string | null; email: string | null } | null
  requestedBy: { id: string; name: string | null; email: string | null } | null
  reviewedBy: { id: string; name: string | null; email: string | null } | null
}

interface UserProject {
  id: string
  title: string
  status: string
  academicLevel: string
  field: string | null
  createdAt: string
  updatedAt: string
  _count: { documents: number; reports: number; jobs: number }
}

interface Overview {
  stats: {
    users: number
    activeUsers: number
    newUsers: number
    projects: number
    reports: number
    documents: number
    storageBytes: number
    costUsd: number
    tokens: number
    costUsd7d: number
    tokens7d: number
    requests7d: number
    activeJobs: number
    failedJobs24h: number
    successRate: number
  }
  jobsByStatus: Record<string, number>
  usersByTier: Record<Tier, number>
  dailyUsage: Array<{ date: string; costUsd: number; tokens: number; requests: number }>
  recentProjects: Array<{
    id: string
    title: string
    status: string
    updatedAt: string
    user: { id: string; name: string | null; email: string | null }
    _count: { documents: number; reports: number }
  }>
  recentAudit: Array<{
    id: string
    action: string
    severity: LogLevel
    summary: string
    targetLabel: string | null
    createdAt: string
    actor: { name: string | null; email: string | null } | null
  }>
  retention: {
    retentionDays: number
    cutoff: string
    detailedRows: number
    eligibleRows: number
    retainedRows: number
    monthlyRows: number
    oldestDetailedAt: string | null
  }
  backup: { configured: boolean; lastCompletedAt: string | null; provider: string | null }
  analytics: {
    ageGroups: Record<string, number>
    genderGroups: Record<string, number>
    sessions: { active: number; total: number; averageMinutes: number }
  }
  generatedAt: string
}

const tierLabels: Record<Tier, string> = { FREE: 'Gratuit', STARTER: 'Essentiel', PRO: 'Pro' }
const statusLabels: Record<JobStatus, string> = {
  PENDING: 'En attente', PROCESSING: 'En cours', COMPLETED: 'Terminé', FAILED: 'Échec', CANCELLED: 'Annulé',
}
const categoryLabels: Record<LogCategory, string> = { AUDIT: 'Administration', JOB: 'Traitement', AI_USAGE: 'Usage IA' }

function formatNumber(value: number) {
  return new Intl.NumberFormat('fr-FR', { notation: value >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value)
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} o`
  const units = ['Ko', 'Mo', 'Go', 'To']
  let size = value / 1024
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1 }
  return `${size.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ${units[unit]}`
}

function formatDate(value: string, withTime = true) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: 'short', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : { year: 'numeric' }),
  }).format(new Date(value))
}

function levelDot(level: LogLevel) {
  return level === 'CRITICAL' ? 'bg-destructive' : level === 'WARNING' ? 'bg-amber-500' : 'bg-emerald-500'
}

function statusBadge(status: JobStatus) {
  const classes = status === 'FAILED'
    ? 'border-destructive/30 bg-destructive/10 text-destructive'
    : status === 'COMPLETED'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      : status === 'PROCESSING'
        ? 'border-primary/30 bg-primary/10 text-primary'
        : status === 'CANCELLED'
          ? 'border-muted-foreground/20 bg-muted text-muted-foreground'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
  return <Badge variant="outline" className={classes}>{statusLabels[status]}</Badge>
}

function SortableHead({ label, sortKey, activeKey, direction, onSort, className }: {
  label: string; sortKey: UserSortKey; activeKey: UserSortKey; direction: SortDirection
  onSort: (key: UserSortKey) => void; className?: string
}) {
  const Icon = activeKey !== sortKey ? ArrowUpDown : direction === 'asc' ? ArrowUp : ArrowDown
  return <TableHead className={className}><button type="button" className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium hover:text-foreground" onClick={() => onSort(sortKey)}>{label}<Icon className="size-3.5" /></button></TableHead>
}

const chartColors = ['#2563eb', '#ef4444', '#60a5fa', '#f87171', '#1d4ed8', '#dc2626', '#93c5fd']

function AnalyticsPie({ values, centerLabel, centerValue }: {
  values: Record<string, number>
  centerLabel?: string
  centerValue?: string
}) {
  const data = Object.entries(values).map(([name, value]) => ({ name, value }))
  const total = data.reduce((sum, item) => sum + item.value, 0)
  return <div>
    <div className="relative h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2} stroke="hsl(var(--background))">{data.map((item, index) => <Cell key={item.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip formatter={(value) => [`${value} utilisateur(s)`, 'Total']} /></PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-bold">{centerValue ?? total}</span><span className="max-w-24 text-center text-[10px] text-muted-foreground">{centerLabel ?? 'utilisateurs'}</span></div>
    </div>
    <div className="grid grid-cols-2 gap-x-3 gap-y-2">{data.map((item, index) => <div key={item.name} className="flex min-w-0 items-center gap-2 text-xs"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} /><span className="truncate text-muted-foreground">{item.name}</span><span className="ml-auto font-medium">{item.value}</span></div>)}</div>
  </div>
}

export function AdminView() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [logs, setLogs] = useState<AdminLog[]>([])
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [roleRequests, setRoleRequests] = useState<RoleRequest[]>([])
  const [platformOwner, setPlatformOwner] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [userSort, setUserSort] = useState<{ key: UserSortKey; direction: SortDirection }>({ key: 'createdAt', direction: 'desc' })
  const [userPage, setUserPage] = useState(1)
  const [jobPage, setJobPage] = useState(1)
  const [logPage, setLogPage] = useState(1)
  const [projectPage, setProjectPage] = useState(1)
  const [adminPage, setAdminPage] = useState(1)
  const [candidatePage, setCandidatePage] = useState(1)
  const [logSearch, setLogSearch] = useState('')
  const [logCategory, setLogCategory] = useState('ALL')
  const [logLevel, setLogLevel] = useState('ALL')
  const [jobSearch, setJobSearch] = useState('')
  const [jobStatus, setJobStatus] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [retentionRunning, setRetentionRunning] = useState(false)
  const [retentionDialogOpen, setRetentionDialogOpen] = useState(false)
  const [retentionItemsLoading, setRetentionItemsLoading] = useState(false)
  const [retentionItems, setRetentionItems] = useState<RetentionItem[]>([])
  const [retentionNextCursor, setRetentionNextCursor] = useState<string | null>(null)
  const [retentionUpdatingId, setRetentionUpdatingId] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [creditUser, setCreditUser] = useState<ManagedUser | null>(null)
  const [creditLimit, setCreditLimit] = useState('')
  const [changeReason, setChangeReason] = useState('')
  const [projectUser, setProjectUser] = useState<ManagedUser | null>(null)
  const [userProjects, setUserProjects] = useState<UserProject[]>([])
  const [userProjectsLoading, setUserProjectsLoading] = useState(false)
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const responses = await Promise.all([
        fetch('/api/admin/overview'), fetch('/api/admin/users'), fetch('/api/admin/logs?limit=200'), fetch('/api/admin/jobs'), fetch('/api/admin/role-requests'),
      ])
      if (responses.some((response) => response.status === 403)) {
        setForbidden(true)
        return
      }
      if (responses.some((response) => !response.ok)) throw new Error('Chargement impossible')
      const [overviewData, usersData, logsData, jobsData, roleData] = await Promise.all(responses.map((response) => response.json()))
      setOverview(overviewData)
      setUsers(usersData.users)
      setCurrentUserId(usersData.currentUserId)
      setLogs(logsData.events)
      setJobs(jobsData.jobs)
      setRoleRequests(roleData.requests)
      setPlatformOwner(roleData.isPlatformOwner)
    } catch {
      toast.error("Impossible de charger l'administration")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase()
    const tierRank: Record<Tier, number> = { FREE: 0, STARTER: 1, PRO: 2 }
    const roleRank: Record<Role, number> = { USER: 0, ADMIN: 1 }
    const value = (user: ManagedUser) => ({
      identity: `${user.name ?? ''} ${user.email ?? ''}`.toLowerCase(), tier: tierRank[user.tier], role: roleRank[user.role],
      usage: user.creditsUsed, activity: user._count.projects + user.reportCount + user._count.jobs,
      createdAt: new Date(user.createdAt).getTime(), isActive: Number(user.isActive), creditsLimit: user.creditsLimit,
    })[userSort.key]
    return users
      .filter((user) => !query || `${user.name ?? ''} ${user.email ?? ''} ${user.id}`.toLowerCase().includes(query))
      .sort((a, b) => {
        const left = value(a); const right = value(b)
        const result = typeof left === 'string' ? left.localeCompare(String(right), 'fr') : left - Number(right)
        return userSort.direction === 'asc' ? result : -result
      })
  }, [userSearch, userSort, users])

  function sortUsers(key: UserSortKey) {
    setUserSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))
  }

  const filteredLogs = useMemo(() => {
    const query = logSearch.trim().toLowerCase()
    return logs.filter((event) =>
      (logCategory === 'ALL' || event.category === logCategory)
      && (logLevel === 'ALL' || event.level === logLevel)
      && (!query || `${event.title} ${event.detail} ${event.actor ?? ''} ${event.target ?? ''}`.toLowerCase().includes(query)),
    )
  }, [logCategory, logLevel, logSearch, logs])

  const filteredJobs = useMemo(() => {
    const query = jobSearch.trim().toLowerCase()
    return jobs.filter((job) =>
      (jobStatus === 'ALL' || job.status === jobStatus)
      && (!query || `${job.project.title} ${job.user.name ?? ''} ${job.user.email ?? ''} ${job.id}`.toLowerCase().includes(query)),
    )
  }, [jobSearch, jobStatus, jobs])

  const pageSize = 10
  const pagedUsers = filteredUsers.slice((userPage - 1) * pageSize, userPage * pageSize)
  const pagedJobs = filteredJobs.slice((jobPage - 1) * pageSize, jobPage * pageSize)
  const pagedLogs = filteredLogs.slice((logPage - 1) * pageSize, logPage * pageSize)
  const pagedUserProjects = userProjects.slice((projectPage - 1) * pageSize, projectPage * pageSize)
  const administratorUsers = users.filter((user) => user.role === 'ADMIN')
  const adminCandidates = users.filter((user) => user.role === 'USER')
  const pagedAdministrators = administratorUsers.slice((adminPage - 1) * pageSize, adminPage * pageSize)
  const pagedCandidates = adminCandidates.slice((candidatePage - 1) * pageSize, candidatePage * pageSize)

  useEffect(() => { setUserPage(1) }, [userSearch, userSort])
  useEffect(() => { setJobPage(1) }, [jobSearch, jobStatus])
  useEffect(() => { setLogPage(1) }, [logCategory, logLevel, logSearch])

  async function updateUser(id: string, update: Partial<Pick<ManagedUser, 'tier' | 'isActive' | 'creditsLimit'>>, reason?: string) {
    setUpdatingId(id)
    try {
      const response = await secureFetch(`/api/admin/users/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...update, ...(reason ? { reason } : {}) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Mise à jour impossible')
      setUsers((current) => current.map((user) => user.id === id ? { ...user, ...data.user } : user))
      toast.success('Utilisateur mis à jour et action journalisée')
      setCreditUser(null)
      void load(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Mise à jour impossible')
    } finally {
      setUpdatingId(null)
    }
  }

  async function cancelJob(id: string) {
    if (!window.confirm('Annuler ce traitement actif ? Cette action sera inscrite au journal.')) return
    setUpdatingId(id)
    try {
      const response = await secureFetch(`/api/admin/jobs/${id}`, { method: 'PATCH' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Annulation impossible')
      toast.success('Traitement annulé')
      await load(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Annulation impossible')
    } finally {
      setUpdatingId(null)
    }
  }

  async function openRetentionReview() {
    setRetentionDialogOpen(true)
    setRetentionItems([])
    setRetentionNextCursor(null)
    await loadRetentionItems()
  }

  async function loadRetentionItems(cursor?: string) {
    setRetentionItemsLoading(true)
    try {
      const response = await fetch(`/api/admin/maintenance/usage-retention?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Chargement impossible')
      setRetentionItems((current) => cursor ? [...current, ...(data.items ?? [])] : data.items ?? [])
      setRetentionNextCursor(data.nextCursor ?? null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Chargement impossible')
    } finally {
      setRetentionItemsLoading(false)
    }
  }

  async function toggleRetentionItem(item: RetentionItem, retained: boolean) {
    setRetentionUpdatingId(item.id)
    try {
      const response = await secureFetch(`/api/admin/maintenance/usage-retention/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retained, reason: retained ? 'Conservation manuelle depuis la console' : undefined }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Mise à jour impossible')
      setRetentionItems((current) => current.map((candidate) => candidate.id === item.id
        ? { ...candidate, retentionExempt: data.usage.retentionExempt, retentionReason: data.usage.retentionReason, retentionMarkedAt: data.usage.retentionMarkedAt }
        : candidate))
      setOverview((current) => current ? {
        ...current,
        retention: {
          ...current.retention,
          eligibleRows: current.retention.eligibleRows + (retained ? -1 : 1),
          retainedRows: current.retention.retainedRows + (retained ? 1 : -1),
        },
      } : current)
      toast.success(retained ? 'Enregistrement conservé hors archivage' : 'Enregistrement réintégré à l’archivage')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Mise à jour impossible')
    } finally {
      setRetentionUpdatingId(null)
    }
  }

  async function runUsageRetention() {
    if (!overview?.retention.eligibleRows) return
    setRetentionRunning(true)
    try {
      const response = await secureFetch('/api/admin/maintenance/usage-retention', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Archivage impossible')
      toast.success(`${data.result.archivedRows} enregistrement(s) agrégé(s) et archivés`)
      setRetentionDialogOpen(false)
      await load(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Archivage impossible')
    } finally {
      setRetentionRunning(false)
    }
  }

  function openCredits(user: ManagedUser) {
    setCreditUser(user)
    setCreditLimit(String(user.creditsLimit))
    setChangeReason('')
  }

  function toggleUserActive(user: ManagedUser, isActive: boolean) {
    if (!isActive && !window.confirm(`Suspendre le compte de ${user.name ?? user.email ?? 'cet utilisateur'} ?`)) return
    void updateUser(user.id, { isActive })
  }

  async function openUserProjects(user: ManagedUser) {
    setProjectUser(user)
    setProjectPage(1)
    setUserProjects([])
    setUserProjectsLoading(true)
    try {
      const response = await fetch(`/api/admin/user-projects/${user.id}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Chargement impossible')
      setUserProjects(data.projects)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Chargement impossible')
    } finally {
      setUserProjectsLoading(false)
    }
  }

  async function requestRoleChange(user: ManagedUser) {
    const requestedRole: Role = user.role === 'ADMIN' ? 'USER' : 'ADMIN'
    if (!window.confirm(`Créer une demande pour passer ${user.name ?? user.email ?? user.id} au rôle ${requestedRole} ? Un autre administrateur devra l'approuver.`)) return
    setRoleUpdatingId(user.id)
    try {
      const response = await secureFetch('/api/admin/role-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: user.id, requestedRole }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Demande impossible')
      toast.success("Demande créée : elle attend l'approbation d'un autre administrateur")
      await load(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Demande impossible')
    } finally {
      setRoleUpdatingId(null)
    }
  }

  function exportLogs() {
    const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const rows = [
      ['Date', 'Niveau', 'Catégorie', 'Événement', 'Détail', 'Acteur', 'Cible'],
      ...filteredLogs.map((event) => [event.createdAt, event.level, categoryLabels[event.category], event.title, event.detail, event.actor, event.target]),
    ]
    const blob = new Blob([`\uFEFF${rows.map((row) => row.map(quote).join(';')).join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `journal-admin-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="flex flex-1 items-center justify-center"><Loader2 className="size-7 animate-spin text-primary" /></div>

  if (forbidden) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="max-w-md text-center">
          <CardHeader><ShieldCheck className="mx-auto size-10 text-muted-foreground" /><CardTitle>Accès réservé</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Cette section est uniquement accessible aux administrateurs.</CardContent>
        </Card>
      </div>
    )
  }

  const statCards = overview ? [
    { label: 'Utilisateurs actifs', value: overview.stats.activeUsers, detail: `+${overview.stats.newUsers} sur 30 jours`, icon: UserCheck },
    { label: 'Projets', value: overview.stats.projects, detail: `${overview.stats.reports} rapports générés`, icon: FolderKanban },
    { label: 'Jetons IA', value: formatNumber(overview.stats.tokens), detail: `$${overview.stats.costUsd.toFixed(2)} de coût total`, icon: Sparkles },
    { label: 'Stockage', value: formatBytes(overview.stats.storageBytes), detail: `${overview.stats.documents} documents`, icon: HardDrive },
  ] : []
  const maxDailyTokens = Math.max(...(overview?.dailyUsage.map((day) => day.tokens) ?? [1]), 1)
  const retentionEligibleCount = retentionItems.filter((item) => !item.retentionExempt).length

  return (
    <div className="flex-1 overflow-y-auto bg-muted/20">
      <div className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="secondary"><ShieldCheck className="mr-1 size-3" />Centre d'administration</Badge>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-emerald-500" />Système opérationnel</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Vue d'ensemble de la plateforme</h1>
            <p className="mt-1 text-muted-foreground">Surveillez l'activité, accompagnez les utilisateurs et gardez une trace de chaque intervention.</p>
          </div>
          <div className="flex items-center gap-3">
            {overview && <span className="hidden text-xs text-muted-foreground sm:inline">Actualisé à {formatDate(overview.generatedAt)}</span>}
            <Button variant="outline" size="sm" disabled={refreshing} onClick={() => void load(true)}>
              <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />Actualiser
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map(({ label, value, detail, icon: Icon }) => (
            <Card key={label} className="overflow-hidden">
              <CardContent className="flex items-center justify-between p-5">
                <div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>
                <div className="rounded-xl bg-primary/10 p-3 text-primary"><Icon className="size-5" /></div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="overview" className="gap-5">
          <div className="overflow-x-auto pb-1">
            <TabsList className="h-10 min-w-max">
              <TabsTrigger value="overview"><Activity />Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="statistics"><ChartPie />Statistiques</TabsTrigger>
              <TabsTrigger value="users"><Users />Utilisateurs <Badge variant="secondary" className="ml-1 h-5 px-1.5">{users.length}</Badge></TabsTrigger>
              <TabsTrigger value="admins"><ShieldCheck />Administrateurs <Badge variant="secondary" className="ml-1 h-5 px-1.5">{users.filter((user) => user.role === 'ADMIN').length}</Badge></TabsTrigger>
              <TabsTrigger value="jobs"><Bot />Traitements {overview && overview.stats.activeJobs > 0 && <span className="size-2 rounded-full bg-primary" />}</TabsTrigger>
              <TabsTrigger value="logs"><FileText />Journal</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div><CardTitle>Consommation IA</CardTitle><CardDescription>Jetons traités sur les 7 derniers jours</CardDescription></div>
                    <Badge variant="outline"><Coins className="mr-1 size-3" />{formatNumber(overview?.stats.tokens7d ?? 0)} jetons · {overview?.stats.requests7d ?? 0} appels</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex h-52 items-end gap-2 pt-6 sm:gap-4">
                    {overview?.dailyUsage.map((day) => (
                      <div key={day.date} className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-2">
                        <div className="relative flex flex-1 items-end justify-center rounded-md bg-muted/45 px-1">
                          <div className="absolute -top-5 hidden whitespace-nowrap text-[10px] font-medium group-hover:block">{formatNumber(day.tokens)} jetons</div>
                          <div className="w-full max-w-10 rounded-t-md bg-primary/80 transition-all group-hover:bg-primary" style={{ height: `${Math.max(day.tokens ? 8 : 2, (day.tokens / maxDailyTokens) * 100)}%` }} />
                        </div>
                        <div className="text-center"><p className="text-[11px] font-medium">{new Date(`${day.date}T00:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })}</p><p className="text-[10px] text-muted-foreground">{day.requests} appel{day.requests !== 1 ? 's' : ''}</p></div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Santé opérationnelle</CardTitle><CardDescription>Signaux essentiels à surveiller</CardDescription></CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3"><div className={`rounded-lg p-2 ${overview?.backup.configured ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}><Database className="size-4" /></div><div><p className="text-sm font-medium">Dernière sauvegarde</p><p className="text-xs text-muted-foreground">{overview?.backup.lastCompletedAt ? formatDate(overview.backup.lastCompletedAt) : 'Signal non configuré'}{overview?.backup.provider ? ` · ${overview.backup.provider}` : ''}</p></div></div>
                    {overview?.backup.configured ? <CheckCircle2 className="size-4 text-emerald-500" /> : <AlertTriangle className="size-4 text-amber-500" />}
                  </div>
                  <div><div className="mb-2 flex items-center justify-between text-sm"><span>Taux de réussite</span><span className="font-semibold">{overview?.stats.successRate ?? 100}%</span></div><Progress value={overview?.stats.successRate ?? 100} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/60 p-3"><p className="text-xs text-muted-foreground">En cours</p><p className="mt-1 text-xl font-semibold">{overview?.stats.activeJobs ?? 0}</p></div>
                    <div className={`rounded-lg p-3 ${(overview?.stats.failedJobs24h ?? 0) > 0 ? 'bg-destructive/10' : 'bg-muted/60'}`}><p className="text-xs text-muted-foreground">Échecs · 24 h</p><p className="mt-1 text-xl font-semibold">{overview?.stats.failedJobs24h ?? 0}</p></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Archive className="size-5" /></div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">Conservation des données IA</p><Badge variant="outline">{overview?.retention.retentionDays ?? 180} jours</Badge></div>
                    <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Les appels détaillés arrivés à expiration sont d'abord regroupés par mois, utilisateur et opération. Seuls les détails sont ensuite supprimés&nbsp;: les totaux historiques restent disponibles.</p>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                      <span><strong className="text-foreground">{overview?.retention.detailedRows ?? 0}</strong> lignes détaillées</span>
                      <span><strong className="text-foreground">{overview?.retention.monthlyRows ?? 0}</strong> agrégats mensuels</span>
                      <span><strong className={(overview?.retention.eligibleRows ?? 0) > 0 ? 'text-amber-600' : 'text-foreground'}>{overview?.retention.eligibleRows ?? 0}</strong> à archiver</span>
                      <span><strong className="text-primary">{overview?.retention.retainedRows ?? 0}</strong> conservés</span>
                    </div>
                  </div>
                </div>
                <Button variant="outline" className="w-full lg:w-auto" disabled={retentionRunning || !((overview?.retention.eligibleRows ?? 0) + (overview?.retention.retainedRows ?? 0))} onClick={() => void openRetentionReview()}>
                  <Archive />Examiner l'archivage
                </Button>
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Activité récente</CardTitle><CardDescription>Dernières interventions administratives</CardDescription></CardHeader>
                <CardContent className="space-y-1">
                  {overview?.recentAudit.length ? overview.recentAudit.map((event) => (
                    <div key={event.id} className="flex gap-3 rounded-lg px-2 py-3 hover:bg-muted/50">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${levelDot(event.severity)}`} />
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{event.summary}</p><p className="mt-0.5 text-xs text-muted-foreground">{event.actor?.name ?? event.actor?.email ?? 'Système'}{event.targetLabel ? ` · ${event.targetLabel}` : ''}</p></div>
                      <time className="shrink-0 text-xs text-muted-foreground">{formatDate(event.createdAt)}</time>
                    </div>
                  )) : <p className="py-8 text-center text-sm text-muted-foreground">Aucune intervention journalisée.</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Projets récemment actifs</CardTitle><CardDescription>Travaux ayant reçu une activité récente</CardDescription></CardHeader>
                <CardContent className="space-y-2">
                  {overview?.recentProjects.map((project) => (
                    <div key={project.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary"><FolderKanban className="size-4" /></div>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{project.title}</p><p className="truncate text-xs text-muted-foreground">{project.user.name ?? project.user.email ?? 'Utilisateur'} · {project.user.email ?? `ID : ${project.user.id}`} · {project._count.documents} doc. · {project._count.reports} rapport</p></div>
                      <Badge variant="outline" className="hidden sm:flex">{project.status}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="statistics" className="space-y-5">
            <div><h2 className="text-xl font-semibold">Statistiques de la plateforme</h2><p className="mt-1 text-sm text-muted-foreground">Analyse de l'audience et des sessions authentifiées, séparée des opérations quotidiennes.</p></div>
            <div className="grid gap-5 lg:grid-cols-3">
              <Card><CardHeader><CardTitle>Âge des utilisateurs</CardTitle><CardDescription>Répartition par tranche d'âge</CardDescription></CardHeader><CardContent>{overview && <AnalyticsPie values={overview.analytics.ageGroups} />}</CardContent></Card>
              <Card><CardHeader><CardTitle>Genre déclaré</CardTitle><CardDescription>Information facultative issue des profils</CardDescription></CardHeader><CardContent>{overview && <AnalyticsPie values={overview.analytics.genderGroups} />}</CardContent></Card>
              <Card><CardHeader><CardTitle>Sessions actives</CardTitle><CardDescription>Activité observée pendant les 30 dernières minutes</CardDescription></CardHeader><CardContent>{overview && <AnalyticsPie values={{ Actives: overview.analytics.sessions.active, Inactives: Math.max(0, overview.analytics.sessions.total - overview.analytics.sessions.active) }} centerValue={`${overview.analytics.sessions.averageMinutes} min`} centerLabel="durée moyenne" />}<p className="mt-4 text-center text-xs text-muted-foreground">{overview?.analytics.sessions.total ?? 0} session(s) authentifiée(s) non expirée(s)</p></CardContent></Card>
            </div>
            <Card><CardContent className="flex gap-3 p-5 text-sm text-muted-foreground"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" /><p>Les données d'âge et de genre sont déclaratives et facultatives. Les profils incomplets restent comptabilisés sous « Non renseigné » afin de ne pas fausser les graphiques.</p></CardContent></Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div><CardTitle>Utilisateurs</CardTitle><CardDescription>Consultez leurs projets et gérez plans, accès et crédits. Les rôles suivent une validation séparée.</CardDescription></div>
                <div className="relative w-full lg:w-80"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Nom, e-mail ou ID" className="pl-9" /></div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <SortableHead label="Utilisateur" sortKey="identity" activeKey={userSort.key} direction={userSort.direction} onSort={sortUsers} />
                      <SortableHead label="Plan" sortKey="tier" activeKey={userSort.key} direction={userSort.direction} onSort={sortUsers} />
                      <SortableHead label="Rôle" sortKey="role" activeKey={userSort.key} direction={userSort.direction} onSort={sortUsers} />
                      <SortableHead label="Consommation" sortKey="usage" activeKey={userSort.key} direction={userSort.direction} onSort={sortUsers} />
                      <SortableHead label="Activité" sortKey="activity" activeKey={userSort.key} direction={userSort.direction} onSort={sortUsers} />
                      <SortableHead label="Création" sortKey="createdAt" activeKey={userSort.key} direction={userSort.direction} onSort={sortUsers} />
                      <SortableHead label="Compte" sortKey="isActive" activeKey={userSort.key} direction={userSort.direction} onSort={sortUsers} />
                      <SortableHead label="Crédits" sortKey="creditsLimit" activeKey={userSort.key} direction={userSort.direction} onSort={sortUsers} className="text-right" />
                    </TableRow></TableHeader>
                    <TableBody>
                      {pagedUsers.map((user) => {
                        const usagePercent = user.creditsLimit > 0 ? Math.min((user.creditsUsed / user.creditsLimit) * 100, 100) : 0
                        return (
                          <TableRow key={user.id} className={!user.isActive ? 'opacity-60' : undefined}>
                            <TableCell><button type="button" className="text-left hover:underline" onClick={() => void openUserProjects(user)}><div className="font-medium">{user.name ?? 'Sans nom'} {user.id === currentUserId && <Badge variant="outline" className="ml-1">Vous</Badge>}</div><div className="text-xs text-muted-foreground">{user.email ?? 'Sans e-mail'} · {user.id}</div></button></TableCell>
                            <TableCell><Select value={user.tier} disabled={updatingId === user.id} onValueChange={(tier: Tier) => void updateUser(user.id, { tier })}><SelectTrigger size="sm" className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FREE">Gratuit</SelectItem><SelectItem value="STARTER">Essentiel</SelectItem><SelectItem value="PRO">Pro</SelectItem></SelectContent></Select></TableCell>
                            <TableCell><div className="flex min-w-32 flex-col items-start gap-1"><Badge variant={user.role === 'ADMIN' ? 'default' : 'outline'}>{user.role === 'ADMIN' ? 'Admin' : 'Utilisateur'}</Badge>{roleRequests.some((item) => item.targetUserId === user.id && item.status === 'PENDING') && <span className="text-[10px] text-amber-600">Demande en attente</span>}</div></TableCell>
                            <TableCell className="min-w-36"><div className="mb-1.5 flex justify-between text-xs"><span>{user.creditsUsed} / {user.creditsLimit}</span><span className="text-muted-foreground">{Math.round(usagePercent)}%</span></div><Progress value={usagePercent} className="h-1.5" /></TableCell>
                            <TableCell><p className="text-sm">{user._count.projects} projet{user._count.projects !== 1 ? 's' : ''}</p><p className="text-xs text-muted-foreground">{user.reportCount} rapport · {user._count.jobs} traitements</p></TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(user.createdAt, false)}</TableCell>
                            <TableCell><div className="flex items-center gap-2"><Switch aria-label={`Activer ${user.name ?? user.email}`} checked={user.isActive} disabled={updatingId === user.id} onCheckedChange={(isActive) => toggleUserActive(user, isActive)} /><span className="text-xs">{user.isActive ? 'Actif' : 'Suspendu'}</span></div></TableCell>
                            <TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" title="Voir tous les projets" onClick={() => void openUserProjects(user)}><Eye className="size-4" /></Button><Button variant="ghost" size="sm" onClick={() => openCredits(user)}><Settings2 className="size-4" />Gérer</Button></div></TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                <TablePagination page={userPage} pageSize={pageSize} total={filteredUsers.length} onPageChange={setUserPage} />
                {filteredUsers.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Aucun utilisateur trouvé.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admins" className="space-y-5">
            <Card>
              <CardHeader><CardTitle>Administrateurs</CardTitle><CardDescription>Comptes disposant actuellement d'un accès administrateur.</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {pagedAdministrators.map((user) => (
                  <div key={user.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
                    <ShieldCheck className="size-5 text-primary" />
                    <div className="min-w-0 flex-1"><p className="font-medium">{user.name ?? 'Sans nom'} {user.id === currentUserId && <Badge variant="outline" className="ml-1">Vous{platformOwner ? ' · propriétaire' : ''}</Badge>}</p><p className="truncate text-xs text-muted-foreground">{user.email ?? user.id} · créé le {formatDate(user.createdAt, false)}</p></div>
                    <Button variant="outline" size="sm" disabled={user.id === currentUserId || roleUpdatingId === user.id || roleRequests.some((item) => item.targetUserId === user.id && item.status === 'PENDING')} onClick={() => void requestRoleChange(user)}>Demander le retrait</Button>
                  </div>
                ))}
              </CardContent>
              <TablePagination page={adminPage} pageSize={pageSize} total={administratorUsers.length} onPageChange={setAdminPage} />
            </Card>

            <Card>
              <CardHeader><CardTitle>Proposer un nouvel administrateur</CardTitle><CardDescription>{platformOwner ? "Vous êtes reconnu comme propriétaire de la plateforme." : "Votre identité n'est pas configurée comme propriétaire. Ajoutez votre e-mail Google SSO à PLATFORM_OWNER_EMAILS plus tard."}</CardDescription></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {pagedCandidates.map((user) => <Button key={user.id} variant="outline" disabled={!platformOwner || roleUpdatingId === user.id || roleRequests.some((item) => item.targetUserId === user.id && item.status === 'PENDING')} onClick={() => void requestRoleChange(user)}><UserCheck />{user.name ?? user.email ?? user.id}</Button>)}
              </CardContent>
              <TablePagination page={candidatePage} pageSize={pageSize} total={adminCandidates.length} onPageChange={setCandidatePage} />
            </Card>
          </TabsContent>

          <TabsContent value="jobs">
            <Card>
              <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div><CardTitle>Traitements de génération</CardTitle><CardDescription>Suivez les travaux, identifiez les échecs et interrompez un traitement bloqué.</CardDescription></div>
                <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                  <div className="relative sm:w-64"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={jobSearch} onChange={(event) => setJobSearch(event.target.value)} placeholder="Projet, utilisateur, ID" className="pl-9" /></div>
                  <Select value={jobStatus} onValueChange={setJobStatus}><SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Tous les statuts</SelectItem>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Traitement</TableHead><TableHead>Projet / utilisateur</TableHead><TableHead>Statut</TableHead><TableHead>Progression</TableHead><TableHead>Mis à jour</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {pagedJobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell><div className="flex items-center gap-2"><div className="rounded-md bg-primary/10 p-1.5 text-primary">{job.type === 'summary' ? <FileText className="size-4" /> : <Bot className="size-4" />}</div><div><p className="text-sm font-medium">{job.type === 'summary' ? 'Synthèse' : 'Rapport'}</p><p className="font-mono text-[10px] text-muted-foreground">{job.id}</p></div></div></TableCell>
                          <TableCell><p className="max-w-64 truncate text-sm font-medium">{job.project.title}</p><p className="text-xs text-muted-foreground">{job.user.name ?? job.user.email ?? 'Utilisateur'}</p></TableCell>
                          <TableCell>{statusBadge(job.status)}</TableCell>
                          <TableCell className="min-w-52"><div className="mb-1.5 flex justify-between text-xs"><span className="max-w-40 truncate text-muted-foreground">{job.errorMessage ?? job.progressMessage ?? '—'}</span><span>{job.progress}%</span></div><Progress value={job.progress} className="h-1.5" /></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(job.updatedAt)}</TableCell>
                          <TableCell className="text-right">{['PENDING', 'PROCESSING'].includes(job.status) ? <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={updatingId === job.id} onClick={() => void cancelJob(job.id)}>{updatingId === job.id ? <Loader2 className="animate-spin" /> : <XCircle />}Annuler</Button> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <TablePagination page={jobPage} pageSize={pageSize} total={filteredJobs.length} onPageChange={setJobPage} />
                {filteredJobs.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Aucun traitement ne correspond aux filtres.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader className="gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div><CardTitle>Journal d'activité</CardTitle><CardDescription>Audit administratif, traitements et consommation IA réunis dans une chronologie.</CardDescription></div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <div className="relative sm:w-60"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={logSearch} onChange={(event) => setLogSearch(event.target.value)} placeholder="Rechercher dans le journal" className="pl-9" /></div>
                  <Select value={logCategory} onValueChange={setLogCategory}><SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Toutes les sources</SelectItem><SelectItem value="AUDIT">Administration</SelectItem><SelectItem value="JOB">Traitements</SelectItem><SelectItem value="AI_USAGE">Usage IA</SelectItem></SelectContent></Select>
                  <Select value={logLevel} onValueChange={setLogLevel}><SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Tous niveaux</SelectItem><SelectItem value="INFO">Information</SelectItem><SelectItem value="WARNING">Attention</SelectItem><SelectItem value="CRITICAL">Critique</SelectItem></SelectContent></Select>
                  <Button variant="outline" onClick={exportLogs} disabled={filteredLogs.length === 0}><Download />Exporter</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="divide-y rounded-lg border">
                  {pagedLogs.map((event) => (
                    <div key={event.id} className="grid gap-3 p-4 transition-colors hover:bg-muted/35 md:grid-cols-[auto_minmax(0,1fr)_auto]">
                      <div className={`mt-1 flex size-8 items-center justify-center rounded-full ${event.level === 'CRITICAL' ? 'bg-destructive/10 text-destructive' : event.level === 'WARNING' ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                        {event.level === 'CRITICAL' ? <AlertTriangle className="size-4" /> : event.category === 'JOB' ? <Clock3 className="size-4" /> : event.category === 'AI_USAGE' ? <Sparkles className="size-4" /> : <ShieldCheck className="size-4" />}
                      </div>
                      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{event.title}</p><Badge variant="outline" className="text-[10px]">{categoryLabels[event.category]}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{event.detail}</p><p className="mt-2 text-xs text-muted-foreground">{event.actor ? `Par ${event.actor}` : 'Système'}{event.target ? ` · ${event.target}` : ''}</p></div>
                      <time className="text-xs text-muted-foreground md:text-right">{formatDate(event.createdAt)}</time>
                    </div>
                  ))}
                </div>
                <TablePagination page={logPage} pageSize={pageSize} total={filteredLogs.length} onPageChange={setLogPage} />
                {filteredLogs.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Aucun événement ne correspond aux filtres.</p>}
                {filteredLogs.length > 0 && <p className="mt-3 text-right text-xs text-muted-foreground">{filteredLogs.length} événement{filteredLogs.length !== 1 ? 's' : ''} affiché{filteredLogs.length !== 1 ? 's' : ''}</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={Boolean(projectUser)} onOpenChange={(open) => { if (!open) setProjectUser(null) }}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader><DialogTitle>Projets de {projectUser?.name ?? projectUser?.email ?? 'cet utilisateur'}</DialogTitle><DialogDescription>{projectUser?.email ?? projectUser?.id} · {projectUser?._count.projects ?? 0} projet(s) au total</DialogDescription></DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 bg-background"><TableRow><TableHead>Projet</TableHead><TableHead>Statut</TableHead><TableHead>Contenu</TableHead><TableHead>Création</TableHead><TableHead>Dernière activité</TableHead></TableRow></TableHeader>
              <TableBody>{pagedUserProjects.map((project) => <TableRow key={project.id}><TableCell><p className="font-medium">{project.title}</p><p className="font-mono text-[10px] text-muted-foreground">{project.id}</p></TableCell><TableCell><Badge variant="outline">{project.status}</Badge></TableCell><TableCell className="whitespace-nowrap text-xs text-muted-foreground">{project._count.documents} doc. · {project._count.reports} rapport · {project._count.jobs} traitement</TableCell><TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(project.createdAt, false)}</TableCell><TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(project.updatedAt)}</TableCell></TableRow>)}</TableBody>
            </Table>
            {userProjectsLoading && <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Chargement…</div>}
            {!userProjectsLoading && userProjects.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Cet utilisateur n'a encore aucun projet.</p>}
          </div>
          <TablePagination page={projectPage} pageSize={pageSize} total={userProjects.length} onPageChange={setProjectPage} />
          <DialogFooter><Button variant="outline" onClick={() => setProjectUser(null)}>Fermer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={retentionDialogOpen} onOpenChange={setRetentionDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Examiner l'archivage des données IA</DialogTitle>
            <DialogDescription>Vérifiez chaque enregistrement arrivé à expiration. Activez « Conserver » pour l'exclure durablement de l'agrégation et de la suppression.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/60 p-3 text-sm">
            <span><strong>{overview?.retention.eligibleRows ?? 0}</strong> à archiver</span>
            <span className="text-muted-foreground">·</span>
            <span><strong>{overview?.retention.retainedRows ?? 0}</strong> conservés</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">Antérieurs au {overview?.retention.cutoff ? formatDate(overview.retention.cutoff, false) : '—'}</span>
          </div>
          <div className="max-h-[52vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background"><TableRow><TableHead>Date</TableHead><TableHead>Utilisateur / projet</TableHead><TableHead>Opération</TableHead><TableHead>Consommation</TableHead><TableHead className="text-right">Conserver</TableHead></TableRow></TableHeader>
              <TableBody>
                {retentionItems.map((item) => (
                  <TableRow key={item.id} className={item.retentionExempt ? 'bg-primary/5' : undefined}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(item.createdAt, false)}</TableCell>
                    <TableCell><p className="max-w-48 truncate text-sm font-medium">{item.user?.name ?? item.user?.email ?? item.userId}</p><p className="max-w-48 truncate text-xs text-muted-foreground">{item.project?.title ?? item.projectId ?? 'Sans projet'}</p></TableCell>
                    <TableCell><Badge variant="outline" className="font-normal">{item.type.replaceAll('_', ' ')}</Badge></TableCell>
                    <TableCell><p className="text-sm">{formatNumber(item.tokens)} jetons</p><p className="text-xs text-muted-foreground">${item.costUsd.toFixed(4)}</p></TableCell>
                    <TableCell className="text-right"><div className="flex items-center justify-end gap-2"><span className="text-xs text-muted-foreground">{item.retentionExempt ? 'Oui' : 'Non'}</span><Switch aria-label={`Conserver l'enregistrement ${item.id}`} checked={item.retentionExempt} disabled={retentionUpdatingId === item.id || retentionRunning} onCheckedChange={(retained) => void toggleRetentionItem(item, retained)} /></div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {retentionItemsLoading && <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Chargement…</div>}
            {!retentionItemsLoading && retentionItems.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Aucun enregistrement arrivé à expiration.</p>}
          </div>
          {retentionNextCursor && <Button variant="ghost" size="sm" disabled={retentionItemsLoading} onClick={() => void loadRetentionItems(retentionNextCursor)}>Afficher davantage</Button>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetentionDialogOpen(false)}>Annuler</Button>
            <Button disabled={retentionRunning || retentionItemsLoading || Boolean(retentionNextCursor) || !overview?.retention.eligibleRows} onClick={() => void runUsageRetention()}>{retentionRunning && <Loader2 className="animate-spin" />}Archiver {overview?.retention.eligibleRows ?? retentionEligibleCount} élément(s)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(creditUser)} onOpenChange={(open) => { if (!open) setCreditUser(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gérer l'enveloppe de crédits</DialogTitle><DialogDescription>{creditUser?.name ?? creditUser?.email} utilise actuellement {creditUser?.creditsUsed ?? 0} crédit(s) sur {creditUser?.creditsLimit ?? 0}.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><label htmlFor="credit-limit" className="text-sm font-medium">Nouvelle limite</label><Input id="credit-limit" type="number" min="0" max="100000" value={creditLimit} onChange={(event) => setCreditLimit(event.target.value)} /></div>
            <div className="space-y-2"><label htmlFor="change-reason" className="text-sm font-medium">Motif <span className="font-normal text-muted-foreground">(facultatif)</span></label><Textarea id="change-reason" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} placeholder="Ex. geste commercial, extension temporaire…" maxLength={500} /></div>
            {creditUser && Number(creditLimit) < creditUser.creditsUsed && <div className="flex gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300"><AlertTriangle className="mt-0.5 size-4 shrink-0" />La nouvelle limite est inférieure à la consommation actuelle. L'utilisateur ne pourra plus lancer de génération.</div>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreditUser(null)}>Annuler</Button><Button disabled={!creditUser || updatingId === creditUser.id || !Number.isInteger(Number(creditLimit)) || Number(creditLimit) < 0 || Number(creditLimit) > 100000} onClick={() => creditUser && void updateUser(creditUser.id, { creditsLimit: Number(creditLimit) }, changeReason)}>{updatingId === creditUser?.id && <Loader2 className="animate-spin" />}Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
