'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Check, FlaskConical, Loader2, RefreshCw, Star, Sparkles } from 'lucide-react'

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

import { useAppStore } from '@/lib/store'
import { secureFetch } from '@/lib/secure-fetch'
import { TIER_LABELS, TIER_COLORS } from '@/lib/constants'
import type { PricingTier } from '@/lib/types'

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
}

const FAQ_ITEMS = [
  {
    question: 'Puis-je changer de plan à tout moment ?',
    answer:
      'Oui, vous pouvez passer à un plan supérieur à tout moment. Le changement sera effectif immédiatement et la facturation sera ajustée au prorata. Pour passer à un plan inférieur, le changement prendra effet à la fin de la période en cours.',
  },
  {
    question: 'Que se passe-t-il si j\'atteins ma limite de rapports ?',
    answer:
      'Lorsque vous atteignez votre limite mensuelle de rapports, vous ne pourrez plus en générer de nouveaux jusqu\'au renouvellement de votre abonnement. Vous pourrez toujours consulter et exporter vos rapports existants.',
  },
  {
    question: 'Les crédits sont-ils cumulatifs d\'un mois sur l\'autre ?',
    answer:
      'Non, les crédits de rapports sont réinitialisés chaque mois à la date de renouvellement de votre abonnement. Nous vous recommandons d\'utiliser vos crédits avant la fin de la période.',
  },
  {
    question: 'Existe-t-il un essai gratuit pour les plans payants ?',
    answer:
      'Oui, nous offrons un essai gratuit de 14 jours sur les plans Starter et Pro. Vous pouvez tester toutes les fonctionnalités sans engagement et sans carte bancaire.',
  },
]

// The tier cards render server-defined limits from the canonical entitlement
// module via `/api/pricing`; no limits are duplicated in the client.

export function PricingView() {
  const navigate = useAppStore((s) => s.navigate)
  const [tiers, setTiers] = useState<PricingTier[]>([])
  const [currentTier, setCurrentTier] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoSyncing, setAutoSyncing] = useState(false)
  const demoMode = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_AUTH_ALLOW_DEMO === 'true'
  const [upgradingId, setUpgradingId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    loadPricing()
  }, [])

  // Automatic sync when returning from Stripe Checkout
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const billingStatus = urlParams.get('billing')

    if (billingStatus === 'success') {
      setAutoSyncing(true)
      toast.info('Paiement en cours de confirmation...')
      syncSubscription().then(() => {
        window.history.replaceState({}, '', window.location.pathname)
        setAutoSyncing(false)
      })
    } else if (billingStatus === 'cancelled') {
      toast.info('Paiement annulé.')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  async function loadPricing() {
    setLoading(true)
    try {
      const [pricingRes, userRes] = await Promise.all([
        fetch('/api/pricing'),
        fetch('/api/user'),
      ])
      if (pricingRes.ok) {
        const data = await pricingRes.json()
        setTiers(data.tiers ?? [])
      }
      if (userRes.ok) {
        const data = await userRes.json()
        setCurrentTier(data.user?.tier?.toUpperCase() ?? 'FREE')
      }
    } catch {
      toast.error('Erreur lors du chargement des tarifs')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpgrade(tierId: string) {
    if (upgradingId) return
    setUpgradingId(tierId)

    // The free tier is not billable: downgrading is handled by the billing
    // portal (production) or the local simulator (demo) — never Stripe Checkout.
    if (tierId === 'free') {
      if (demoMode) {
        toast.info('Retour au plan Gratuit via le simulateur local...')
        await handleSimulate('free')
      } else {
        toast.info(
          'Le plan Gratuit ne nécessite pas de paiement. Utilisez « Gérer mon abonnement » dans les paramètres pour revenir au plan Gratuit.'
        )
      }
      return
    }

    try {
      const res = await secureFetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId }),
      })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }

      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      if (res.status === 503) {
        toast.error(
          'Le paiement Stripe n’est pas configuré. Utilisez le bouton « Simuler ce plan » pour tester en local.'
        )
        return
      }
      if (res.status === 409) {
        toast.info(data.error ?? 'Vous êtes déjà abonné à ce plan.')
        return
      }
      toast.error(data.error ?? 'Impossible de démarrer le changement de plan.')
    } catch {
      toast.error('Erreur réseau lors du changement de plan.')
    } finally {
      setUpgradingId(null)
    }
  }

  // Local development only: switch plan server-side without payment. The
  // server refuses this endpoint (404) unless demo auth is enabled.
  async function handleSimulate(tierId: string) {
    setUpgradingId(tierId)
    try {
      const res = await secureFetch('/api/billing/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (res.ok) {
        toast.success(`Plan de test activé sans paiement : ${tierId.toUpperCase()}`)
        await loadPricing()
        return
      }
      toast.error(data.error ?? 'Simulation indisponible.')
    } catch {
      toast.error('Erreur réseau lors de la simulation.')
    } finally {
      setUpgradingId(null)
    }
  }

  // Pull-based reconciliation: re-read the authenticated user's Stripe
  // subscription from the server. This fixes the "payment succeeded but the
  // plan did not switch" case when a webhook was missed (e.g. stripe listen
  // was not running at delivery time).
  async function syncSubscription(): Promise<void> {
    if (syncing) return
    setSyncing(true)
    try {
      const res = await secureFetch('/api/billing/sync', { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as {
        tier?: string
        changed?: boolean
        error?: string
      }
      if (res.ok) {
        if (data.changed) {
          toast.success(`Abonnement synchronisé : plan ${data.tier ?? ''} activé.`)
        } else {
          toast.success(`Abonnement synchronisé — plan actuel : ${data.tier ?? ''}.`)
        }
        await loadPricing()
        return
      }
      if (res.status === 503) {
        toast.error('La facturation Stripe n’est pas configurée sur ce serveur.')
        return
      }
      toast.error(data.error ?? 'Synchronisation impossible.')
    } catch {
      toast.error('Erreur réseau lors de la synchronisation.')
    } finally {
      setSyncing(false)
    }
  }

  function handleSync() {
    void syncSubscription()
  }

  if (autoSyncing) {
    return (
      <motion.div
        className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <Loader2 className="size-10 animate-spin text-primary" />
        <div className="text-center">
          <h2 className="text-xl font-semibold">Confirmation du paiement...</h2>
          <p className="mt-2 text-muted-foreground">
            Nous synchronisons votre abonnement. Cela ne prendra qu&apos;un instant.
          </p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="space-y-8 p-4 md:p-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="text-center">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Tarifs
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
          Choisissez le plan adapté à vos besoins académiques. Commencez gratuitement et évoluez selon vos besoins.
        </p>
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={syncing}
            onClick={() => void handleSync()}
            title="Vérifier votre abonnement Stripe et appliquer le plan correspondant"
          >
            {syncing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Synchroniser mon abonnement
          </Button>
        </div>
      </motion.div>

      {/* Pricing Cards */}
      <motion.div
        variants={containerVariants}
        className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3"
      >
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="flex flex-col">
                <CardHeader className="pb-2">
                  <Skeleton className="mb-2 h-6 w-24" />
                  <Skeleton className="h-10 w-32" />
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Skeleton key={j} className="h-4 w-full" />
                  ))}
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            ))
          : tiers.map((tier) => {
              const isCurrent = tier.id.toUpperCase() === currentTier
              const isRecommended = tier.recommended === true
              const limits = tier.limits

              return (
                <motion.div key={tier.id} variants={itemVariants}>
                  <Card
                    className={`relative flex h-full flex-col ${
                      isRecommended
                        ? 'border-2 border-primary shadow-lg'
                        : ''
                    }`}
                  >
                    {/* Recommended Badge */}
                    {isRecommended && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground shadow-sm">
                          <Star className="mr-1 size-3" />
                          Populaire
                        </Badge>
                      </div>
                    )}

                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{tier.name}</CardTitle>
                        {tier.id === 'free' && (
                          <Badge variant="secondary" className={TIER_COLORS.FREE}>
                            Gratuit
                          </Badge>
                        )}
                        {isRecommended && (
                          <Badge variant="secondary" className={TIER_COLORS.PRO}>
                            Recommandé
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2">
                        {tier.price === 0 ? (
                          <span className="text-3xl font-bold">Gratuit</span>
                        ) : (
                          <>
                            <span className="text-4xl font-bold">{tier.price}€</span>
                            <span className="text-muted-foreground">/{tier.period.replace('par ', '')}</span>
                          </>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="flex-1 space-y-4">
                      {/* Tier Limits */}
                      {limits && (
                        <div className="space-y-2 rounded-lg bg-muted/50 p-3">
                          <p className="text-sm font-medium">Limites du plan</p>
                          <div className="grid gap-1.5 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Check className="size-3.5 text-primary" />
                              <span>{limits.projects}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="size-3.5 text-primary" />
                              <span>{limits.generations}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="size-3.5 text-primary" />
                              <span>{limits.documents}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="size-3.5 text-primary" />
                              <span>{limits.fileSize}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="size-3.5 text-primary" />
                              <span>{limits.exports}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="size-3.5 text-primary" />
                              <span>{limits.preview}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Features */}
                      <div className="space-y-2">
                        {tier.features.map((feature) => (
                          <div
                            key={feature}
                            className="flex items-start gap-2 text-sm"
                          >
                            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>

                    <CardFooter className="flex-col gap-2 pt-4">
                      {isCurrent ? (
                        <Button
                          variant="secondary"
                          className="w-full"
                          disabled
                        >
                          <Sparkles className="mr-2 size-4" />
                          Plan Actuel
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          variant={isRecommended ? 'default' : 'outline'}
                          disabled={upgradingId !== null}
                          onClick={() => void handleUpgrade(tier.id)}
                        >
                          {upgradingId === tier.id ? (
                            <Loader2 className="mr-2 size-4 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 size-4" />
                          )}
                          Passer au plan {tier.name}
                        </Button>
                      )}
                      {demoMode && !isCurrent && (
                        <Button
                          variant="ghost"
                          className="w-full text-xs text-muted-foreground"
                          disabled={upgradingId !== null}
                          onClick={() => void handleSimulate(tier.id)}
                        >
                          <FlaskConical className="mr-2 size-3.5" />
                          Simuler ce plan (test local, sans paiement)
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                </motion.div>
              )
            })}
      </motion.div>

      {/* FAQ Section */}
      <motion.div variants={itemVariants} className="mx-auto max-w-3xl">
        <h2 className="mb-4 text-center text-xl font-bold">
          Questions Fréquentes
        </h2>
        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((faq, index) => (
            <AccordionItem key={index} value={`faq-${index}`}>
              <AccordionTrigger className="text-left">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </motion.div>
    </motion.div>
  )
}
