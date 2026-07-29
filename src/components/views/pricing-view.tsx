'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Check, Star, Sparkles } from 'lucide-react'

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
import type { PricingTier } from '@/lib/types'
import { TIER_LABELS, TIER_COLORS } from '@/lib/constants'

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
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

// Tier limits for display on pricing cards
const TIER_DISPLAY_LIMITS: Record<string, { projects: string; reports: string; documents: string; fileSize: string }> = {
  free: {
    projects: '1 projet',
    reports: '3 rapports / mois',
    documents: '5 documents',
    fileSize: '5 Mo max / fichier',
  },
  starter: {
    projects: '5 projets',
    reports: '15 rapports / mois',
    documents: '50 documents',
    fileSize: '25 Mo max / fichier',
  },
  pro: {
    projects: 'Projets illimités',
    reports: '50 rapports / mois',
    documents: 'Documents illimités',
    fileSize: '100 Mo max / fichier',
  },
}

export function PricingView() {
  const navigate = useAppStore((s) => s.navigate)
  const [tiers, setTiers] = useState<PricingTier[]>([])
  const [currentTier, setCurrentTier] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPricing()
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

  function handleUpgrade(tierId: string) {
    toast.info(`Passage au plan ${tierId} — fonctionnalité de démonstration`)
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
              const limits = TIER_DISPLAY_LIMITS[tier.id]

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
                              <span>{limits.reports}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="size-3.5 text-primary" />
                              <span>{limits.documents}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="size-3.5 text-primary" />
                              <span>{limits.fileSize}</span>
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

                    <CardFooter className="pt-4">
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
                          onClick={() => handleUpgrade(tier.id)}
                        >
                          Passer au plan {tier.name}
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
