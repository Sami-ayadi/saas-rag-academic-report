'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { signOut } from 'next-auth/react'
import {
  User,
  CreditCard,
  Trash2,
  ShieldCheck,
  Loader2,
  FileText,
  Upload,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

import { useAppStore } from '@/lib/store'
import { secureFetch } from '@/lib/secure-fetch'
import type { UserWithStats } from '@/lib/types'
import { TIER_LABELS, TIER_COLORS } from '@/lib/constants'

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
}

export function SettingsView() {
  const navigate = useAppStore((s) => s.navigate)
  const [user, setUser] = useState<UserWithStats | null>(null)
  const [quota, setQuota] = useState<{
    generation: { used: number; limit: number; remaining: number }
    regeneration: { used: number; limit: number; remaining: number }
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  // Profile form state (decorative)
  const [name, setName] = useState('')
  const [university, setUniversity] = useState('')


  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {
    setLoading(true)
    try {
      const res = await fetch('/api/user')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        setQuota(data.quota ?? null)
        setName(data.user?.name ?? '')
        setUniversity(data.user?.university ?? '')
      }
    } catch {
      toast.error('Erreur lors du chargement du profil')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveProfile() {
    setSavingProfile(true)
    try {
      const response = await secureFetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, university }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(data.error ?? 'Impossible de sauvegarder le profil')
        return
      }
      setUser((current) => current ? { ...current, ...data.user } : current)
      toast.success('Profil mis à jour')
    } catch {
      toast.error('Erreur réseau pendant la sauvegarde')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true)
    try {
      const response = await secureFetch('/api/user', { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(data.error ?? 'Impossible de supprimer le compte')
        return
      }
      setDeleteDialogOpen(false)
      await signOut({ callbackUrl: '/' })
    } catch {
      toast.error('Erreur réseau pendant la suppression')
    } finally {
      setDeletingAccount(false)
    }
  }

  async function handleOpenPortal() {
    setPortalLoading(true)
    try {
      const res = await secureFetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Impossible d'ouvrir le portail de facturation")
        return
      }
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error("Impossible d'ouvrir le portail de facturation")
      }
    } catch {
      toast.error('Erreur réseau lors de la ouverture du portail')
    } finally {
      setPortalLoading(false)
    }
  }

  // Quota counters come from the canonical entitlement server (period reset,
  // administrator overrides, regeneration included).
  const generationLimit = quota?.generation.limit ?? user?.creditsLimit ?? 0
  const generationUsed = quota?.generation.used ?? user?.creditsUsed ?? 0
  const creditsPercentage = generationLimit > 0 ? Math.round((generationUsed / generationLimit) * 100) : 0

  const userTier = user?.tier?.toUpperCase() ?? 'FREE'

  return (
    <motion.div
      className="mx-auto max-w-3xl space-y-6 p-4 md:p-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Paramètres
        </h1>
        <p className="text-muted-foreground">
          Gérez votre profil et vos préférences
        </p>
      </motion.div>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          {/* Profile Section */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="size-5" />
                  Profil
                </CardTitle>
                <CardDescription>
                  Informations personnelles et identité
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <Avatar className="size-20 text-xl">
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                      {name
                        ? name
                            .split(' ')
                            .map((w) => w[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)
                        : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1 text-center sm:text-left">
                    <p className="text-lg font-semibold">{name || 'Utilisateur'}</p>
                    <p className="text-sm text-muted-foreground">
                      {user?.email ?? 'demo@rapportgen.fr'}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Fields */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="settings-name">Nom complet</Label>
                    <Input
                      id="settings-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Votre nom"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settings-email">Email</Label>
                    <Input
                      id="settings-email"
                      value={user?.email ?? ''}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="settings-university">Université</Label>
                    <Input
                      id="settings-university"
                      value={university}
                      onChange={(e) => setUniversity(e.target.value)}
                      placeholder="Nom de votre université"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button onClick={() => void handleSaveProfile()} disabled={savingProfile || !name.trim()}>
                  {savingProfile && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Sauvegarder
                </Button>
              </CardFooter>
            </Card>
          </motion.div>

          {/* Subscription Section */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="size-5" />
                  Abonnement
                </CardTitle>
                <CardDescription>
                  Votre plan actuel et l&apos;utilisation de vos crédits
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current Tier */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">Plan actuel :</span>
                    <Badge className={TIER_COLORS[userTier] ?? 'bg-secondary text-secondary-foreground'}>
                      {TIER_LABELS[userTier] ?? userTier}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('pricing')}
                  >
                    Changer de plan
                  </Button>
                </div>

                {/* Credits Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Générations ce mois-ci</span>
                    <span className="font-medium tabular-nums">
                      {generationUsed} / {generationLimit}
                    </span>
                  </div>
                  <Progress value={creditsPercentage} className="h-2" />
                </div>

                <Separator />

                {/* Usage Stats */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <FileText className="size-3.5" />
                      <span className="text-xs">Rapports</span>
                    </div>
                    <p className="text-lg font-semibold">
                      {user?.creditsUsed ?? 0}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Upload className="size-3.5" />
                      <span className="text-xs">Documents</span>
                    </div>
                    <p className="text-lg font-semibold">
                      {user?.creditsUsed ?? 0}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <DollarSign className="size-3.5" />
                      <span className="text-xs">Coût estimé</span>
                    </div>
                    <p className="text-lg font-semibold">$0.00</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <ShieldCheck className="size-3.5" />
                      <span className="text-xs">Restant</span>
                    </div>
                    <p className="text-lg font-semibold">
                      {generationLimit - generationUsed}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <RefreshCw className="size-3.5" />
                      <span className="text-xs">Régénérations restantes</span>
                    </div>
                    <p className="text-lg font-semibold">
                      {quota?.regeneration.remaining ?? 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Danger Zone */}
          <motion.div variants={itemVariants}>
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="size-5" />
                  Zone Dangereuse
                </CardTitle>
                <CardDescription>
                  Actions irréversibles sur votre compte
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">
                  La suppression de votre compte est irréversible. Toutes vos données, projets et rapports seront définitivement supprimés.
                </p>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="mr-2 size-4" />
                      Supprimer mon compte
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Supprimer le compte</DialogTitle>
                      <DialogDescription>
                        Cette action est irréversible. Tous vos projets, documents et rapports seront définitivement supprimés.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                      <Button
                        variant="outline"
                        onClick={() => setDeleteDialogOpen(false)}
                      >
                        Annuler
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => void handleDeleteAccount()}
                        disabled={deletingAccount}
                      >
                        {deletingAccount && <Loader2 className="mr-2 size-4 animate-spin" />}
                        Confirmer la suppression
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardFooter>
            </Card>
          </motion.div>

          {/* Billing Management */}
          {userTier !== 'FREE' && (
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="size-5" />
                    Gérer mon abonnement
                  </CardTitle>
                  <CardDescription>
                    Accédez au portail de facturation Stripe pour gérer votre moyen de paiement, vos factures et votre abonnement.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Plan actuel : <Badge variant="outline">{TIER_LABELS[userTier]}</Badge>
                  </p>
                </CardContent>
                <CardFooter className="border-t pt-4">
                  <Button
                    variant="outline"
                    disabled={portalLoading}
                    onClick={() => void handleOpenPortal()}
                  >
                    {portalLoading ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <ExternalLink className="mr-2 size-4" />
                    )}
                    Ouvrir le portail de facturation
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  )
}
