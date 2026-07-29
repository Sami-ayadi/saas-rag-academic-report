'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  User,
  CreditCard,
  Trash2,
  Key,
  ShieldCheck,
  Loader2,
  FileText,
  Upload,
  DollarSign,
  AlertTriangle,
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
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

export function SettingsView() {
  const navigate = useAppStore((s) => s.navigate)
  const [user, setUser] = useState<UserWithStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [testing, setTesting] = useState(false)

  // Profile form state (decorative)
  const [name, setName] = useState('')
  const [university, setUniversity] = useState('')

  // API Keys (decorative)
  const [anthropicKey, setAnthropicKey] = useState('')
  const [voyageKey, setVoyageKey] = useState('')
  const [showAnthropic, setShowAnthropic] = useState(false)
  const [showVoyage, setShowVoyage] = useState(false)

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
        setName(data.user?.name ?? '')
        setUniversity(data.user?.image ?? '') // placeholder — no university on user model
      }
    } catch {
      toast.error('Erreur lors du chargement du profil')
    } finally {
      setLoading(false)
    }
  }

  function handleSaveProfile() {
    toast.success('Profil mis à jour (démonstration)')
  }

  async function handleTestConnection() {
    setTesting(true)
    // Simulate testing
    await new Promise((r) => setTimeout(r, 1500))
    setTesting(false)
    toast.info('Test de connexion (démonstration)')
  }

  function handleDeleteAccount() {
    setDeleteDialogOpen(false)
    toast.success('Compte supprimé (démonstration)')
  }

  const creditsPercentage = user
    ? user.creditsLimit > 0
      ? Math.round((user.creditsUsed / user.creditsLimit) * 100)
      : 0
    : 0

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
                <Button onClick={handleSaveProfile}>Sauvegarder</Button>
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
                    <span className="text-muted-foreground">Crédits utilisés</span>
                    <span className="font-medium tabular-nums">
                      {user?.creditsUsed ?? 0} / {user?.creditsLimit ?? 0}
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
                      {user ? user.creditsLimit - user.creditsUsed : 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* API Keys Section */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="size-5" />
                  Clés API
                </CardTitle>
                <CardDescription>
                  Configurez vos clés pour les services d&apos;IA
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  En phase test, les clés API sont stockées localement.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="anthropic-key">Clé Anthropic (Claude)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="anthropic-key"
                      type={showAnthropic ? 'text' : 'password'}
                      value={anthropicKey}
                      onChange={(e) => setAnthropicKey(e.target.value)}
                      placeholder="sk-ant-..."
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAnthropic(!showAnthropic)}
                      className="shrink-0"
                    >
                      {showAnthropic ? 'Masquer' : 'Voir'}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="voyage-key">Clé Voyage AI</Label>
                  <div className="flex gap-2">
                    <Input
                      id="voyage-key"
                      type={showVoyage ? 'text' : 'password'}
                      value={voyageKey}
                      onChange={(e) => setVoyageKey(e.target.value)}
                      placeholder="pa-..."
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowVoyage(!showVoyage)}
                      className="shrink-0"
                    >
                      {showVoyage ? 'Masquer' : 'Voir'}
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testing}
                >
                  {testing ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 size-4" />
                  )}
                  Tester la connexion
                </Button>
              </CardFooter>
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
                        onClick={handleDeleteAccount}
                      >
                        Confirmer la suppression
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardFooter>
            </Card>
          </motion.div>
        </>
      )}
    </motion.div>
  )
}
