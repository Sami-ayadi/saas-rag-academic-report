'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, FileText, FolderKanban, Loader2, Search, ShieldCheck, Users } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { secureFetch } from '@/lib/secure-fetch'

type Tier = 'FREE' | 'STARTER' | 'PRO'
type Role = 'USER' | 'ADMIN'

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

interface Overview {
  stats: { users: number; projects: number; reports: number; documents: number; costUsd: number; tokens: number }
  recentProjects: Array<{
    id: string
    title: string
    status: string
    updatedAt: string
    user: { name: string | null; email: string | null }
    _count: { documents: number; reports: number }
  }>
}

export function AdminView() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [overviewResponse, usersResponse] = await Promise.all([
        fetch('/api/admin/overview'),
        fetch('/api/admin/users'),
      ])
      if (overviewResponse.status === 403 || usersResponse.status === 403) {
        setForbidden(true)
        return
      }
      if (!overviewResponse.ok || !usersResponse.ok) throw new Error('Chargement impossible')
      const [overviewData, usersData] = await Promise.all([overviewResponse.json(), usersResponse.json()])
      setOverview(overviewData)
      setUsers(usersData.users)
      setCurrentUserId(usersData.currentUserId)
    } catch {
      toast.error("Impossible de charger l'administration")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return users
    return users.filter((user) => `${user.name ?? ''} ${user.email ?? ''}`.toLowerCase().includes(query))
  }, [search, users])

  async function updateUser(id: string, update: Partial<Pick<ManagedUser, 'tier' | 'role' | 'isActive'>>) {
    setUpdatingId(id)
    try {
      const response = await secureFetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Mise à jour impossible')
      setUsers((current) => current.map((user) => user.id === id ? { ...user, ...data.user } : user))
      toast.success('Utilisateur mis à jour')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Mise à jour impossible')
    } finally {
      setUpdatingId(null)
    }
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
    { label: 'Utilisateurs', value: overview.stats.users, icon: Users },
    { label: 'Projets', value: overview.stats.projects, icon: FolderKanban },
    { label: 'Rapports', value: overview.stats.reports, icon: FileText },
    { label: 'Coût IA total', value: `$${overview.stats.costUsd.toFixed(2)}`, icon: Activity },
  ] : []

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <div>
          <Badge variant="secondary" className="mb-2"><ShieldCheck className="mr-1 size-3" />Administration</Badge>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Pilotage de la plateforme</h1>
          <p className="mt-1 text-muted-foreground">Gérez les comptes, les plans et surveillez l'activité globale.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map(({ label, value, icon: Icon }) => (
            <Card key={label}><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div><div className="rounded-xl bg-primary/10 p-3 text-primary"><Icon className="size-5" /></div></CardContent></Card>
          ))}
        </div>

        <Card>
          <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between">
            <div><CardTitle>Utilisateurs</CardTitle><CardDescription>Changez un plan, accordez un rôle ou suspendez un compte.</CardDescription></div>
            <div className="relative w-full md:w-72"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom ou e-mail" className="pl-9" /></div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Utilisateur</TableHead><TableHead>Plan</TableHead><TableHead>Rôle</TableHead><TableHead>Usage</TableHead><TableHead>Projets</TableHead><TableHead>Actif</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} className={!user.isActive ? 'opacity-60' : undefined}>
                    <TableCell><div className="font-medium">{user.name ?? 'Sans nom'} {user.id === currentUserId && <Badge variant="outline" className="ml-1">Vous</Badge>}</div><div className="text-xs text-muted-foreground">{user.email ?? 'Sans e-mail'}</div></TableCell>
                    <TableCell><Select value={user.tier} disabled={updatingId === user.id} onValueChange={(tier: Tier) => void updateUser(user.id, { tier })}><SelectTrigger size="sm" className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FREE">Gratuit</SelectItem><SelectItem value="STARTER">Essentiel</SelectItem><SelectItem value="PRO">Pro</SelectItem></SelectContent></Select></TableCell>
                    <TableCell><Select value={user.role} disabled={updatingId === user.id} onValueChange={(role: Role) => void updateUser(user.id, { role })}><SelectTrigger size="sm" className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USER">Utilisateur</SelectItem><SelectItem value="ADMIN">Admin</SelectItem></SelectContent></Select></TableCell>
                    <TableCell><span className="text-sm">{user.creditsUsed}/{user.creditsLimit}</span><div className="text-xs text-muted-foreground">{user.reportCount} rapport(s)</div></TableCell>
                    <TableCell>{user._count.projects}</TableCell>
                    <TableCell><Switch aria-label={`Activer ${user.name ?? user.email}`} checked={user.isActive} disabled={updatingId === user.id} onCheckedChange={(isActive) => void updateUser(user.id, { isActive })} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredUsers.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aucun utilisateur trouvé.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Projets récemment actifs</CardTitle><CardDescription>{overview?.stats.documents ?? 0} documents et {overview?.stats.tokens.toLocaleString('fr-FR') ?? 0} jetons traités au total.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {overview?.recentProjects.map((project) => <div key={project.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{project.title}</p><p className="text-xs text-muted-foreground">{project.user.name ?? project.user.email ?? 'Utilisateur'}</p></div><Badge variant="outline">{project.status}</Badge></div><p className="mt-3 text-xs text-muted-foreground">{project._count.documents} document(s) · {project._count.reports} rapport(s) · {new Date(project.updatedAt).toLocaleDateString('fr-FR')}</p></div>)}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
