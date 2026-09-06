'use client'

import { useEffect, useState } from 'react'
import { getProviders, signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  Check,
  ChevronRight,
  FileDown,
  FileText,
  GraduationCap,
  Languages,
  LibraryBig,
  LockKeyhole,
  PencilLine,
  Quote,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { PricingTier } from '@/lib/types'

const features = [
  { icon: BrainCircuit, title: 'Cadrage intelligent', text: 'Un questionnaire guidé transforme votre stage, votre filière et vos objectifs en un brief académique exploitable.' },
  { icon: LibraryBig, title: 'Sources maîtrisées', text: 'Importez vos documents et inspirez-vous de structures adaptées au droit, à la médecine, au cloud et à bien d’autres domaines.' },
  { icon: PencilLine, title: 'Édition par section', text: 'Relisez, corrigez et régénérez uniquement la partie qui doit évoluer sans perdre le reste du rapport.' },
  { icon: FileDown, title: 'Exports prêts à remettre', text: 'Téléchargez votre travail en Markdown, Word ou PDF, avec une mise en page cohérente et professionnelle.' },
  { icon: LockKeyhole, title: 'Contenu protégé', text: 'Les plans, données privées et fonctionnalités payantes sont contrôlés côté serveur, jamais uniquement dans l’interface.' },
  { icon: Languages, title: 'Multi-domaine, multilingue', text: 'Une expérience adaptable à votre établissement, votre niveau académique, votre discipline et votre langue.' },
]

const steps = [
  ['01', 'Décrivez votre stage', 'Répondez à quelques questions sur l’organisation, vos missions et la problématique.'],
  ['02', 'Ajoutez vos sources', 'Déposez vos notes, documents et références pour contextualiser la génération.'],
  ['03', 'Générez et révisez', 'Obtenez une structure et un rapport modifiable section par section.'],
  ['04', 'Exportez votre rendu', 'Finalisez puis téléchargez le document dans le format demandé par votre école.'],
]

export default function LandingPage() {
  const router = useRouter()
  const { status } = useSession()
  const demoMode = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_AUTH_ALLOW_DEMO === 'true'
  // Pricing cards render the canonical entitlement module through /api/pricing.
  const [pricing, setPricing] = useState<PricingTier[]>([])
  const [googleReady, setGoogleReady] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/pricing', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { tiers: [] }))
      .then((data) => setPricing(Array.isArray(data.tiers) ? data.tiers : []))
      .catch(() => setPricing([]))
  }, [])

  useEffect(() => {
    if (demoMode) return
    let cancelled = false
    getProviders()
      .then((providers) => {
        if (!cancelled) setGoogleReady(Boolean(providers?.google))
      })
      .catch(() => {
        if (!cancelled) setGoogleReady(false)
      })
    return () => {
      cancelled = true
    }
  }, [demoMode])

  const dashboardLabel = demoMode || status === 'authenticated'
    ? 'Ouvrir le tableau de bord'
    : googleReady === false
      ? 'Entrer dans l’application'
      : 'Commencer avec Google'

  async function enterWorkspace() {
    if (demoMode || status === 'authenticated') {
      router.push('/dashboard')
      return
    }
    try {
      const providers = await getProviders()
      if (providers?.google) {
        await signIn('google', { callbackUrl: '/dashboard' })
        return
      }
    } catch {
      // Ignore and let the dashboard sign-in card explain the missing setup.
    }
    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7faf7] text-slate-950">
      <div className="absolute inset-x-0 top-0 -z-0 h-[720px] bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.16),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(245,158,11,0.15),transparent_28%),linear-gradient(to_bottom,#ffffff,#f7faf7)]" />

      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
        <a href="#top" className="flex items-center gap-3" aria-label="RAG Report, accueil">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-lg shadow-emerald-700/20">
            <GraduationCap className="size-5" />
          </span>
          <span>
            <span className="block text-base font-black tracking-tight">RAG Report</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Academic copilot</span>
          </span>
        </a>
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex" aria-label="Navigation principale">
          <a href="#features" className="hover:text-emerald-700">Fonctionnalités</a>
          <a href="#workflow" className="hover:text-emerald-700">Comment ça marche</a>
          <a href="#pricing" className="hover:text-emerald-700">Tarifs</a>
        </nav>
        <Button onClick={enterWorkspace} className="rounded-full bg-slate-950 px-5 text-white hover:bg-emerald-800">
          {dashboardLabel}<ArrowRight className="ml-2 size-4" />
        </Button>
      </header>

      <section id="top" className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-16 lg:grid-cols-[1.04fr_.96fr] lg:px-8 lg:pb-32 lg:pt-24">
        <div>
          <Badge className="mb-6 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800 hover:bg-emerald-50">
            <Sparkles className="mr-1.5 size-3.5" /> Votre rapport de stage, enfin maîtrisable
          </Badge>
          <h1 className="max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-7xl">
            De votre expérience terrain à un rapport{' '}
            <span className="text-emerald-700">clair, structuré, défendable.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">
            RAG Report vous guide du choix du sujet jusqu’à l’export final. Cadrez votre problématique, exploitez vos sources et construisez un rapport académique que vous gardez entièrement sous contrôle.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" onClick={enterWorkspace} className="h-12 rounded-full bg-emerald-700 px-7 text-base shadow-xl shadow-emerald-700/20 hover:bg-emerald-800">
              Créer mon rapport <ArrowRight className="ml-2 size-4" />
            </Button>
            <Button size="lg" variant="outline" asChild className="h-12 rounded-full border-slate-300 bg-white/70 px-7 text-base">
              <a href="#workflow">Voir le fonctionnement</a>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
            {['Aucune carte requise', 'Édition section par section', 'PDF, DOCX et Markdown'].map((item) => (
              <span key={item} className="flex items-center gap-2"><Check className="size-4 text-emerald-700" />{item}</span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -inset-5 -z-10 rounded-[2.5rem] bg-gradient-to-br from-emerald-200/70 via-white to-amber-100 blur-2xl" />
          <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 p-3 shadow-2xl shadow-slate-900/10 backdrop-blur">
            <div className="rounded-[1.45rem] border bg-slate-950 p-5 text-white">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300"><FileText className="size-4" /></span>
                  <div><p className="text-sm font-semibold">Rapport Cloud Engineering</p><p className="text-xs text-slate-400">Master · 6 sections · 7 840 mots</p></div>
                </div>
                <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">Prêt</span>
              </div>
              <div className="grid gap-3 py-5 sm:grid-cols-[150px_1fr]">
                <div className="space-y-2">
                  {['Introduction', 'Contexte', 'Architecture', 'Réalisation', 'Résultats', 'Conclusion'].map((item, index) => (
                    <div key={item} className={`rounded-lg px-3 py-2 text-xs ${index === 2 ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-400'}`}>{item}</div>
                  ))}
                </div>
                <div className="rounded-xl bg-white p-4 text-slate-900">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Chapitre 3</p>
                  <h3 className="mt-2 text-xl font-black tracking-tight">Architecture de la solution</h3>
                  <div className="mt-4 space-y-2.5">
                    <div className="h-2 w-full rounded bg-slate-200" /><div className="h-2 w-11/12 rounded bg-slate-200" /><div className="h-2 w-4/5 rounded bg-slate-200" />
                    <div className="my-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800"><BrainCircuit className="size-4" />Sources reliées au contexte</div>
                      <div className="mt-2 h-1.5 w-3/4 rounded bg-emerald-200" />
                    </div>
                    <div className="h-2 w-full rounded bg-slate-200" /><div className="h-2 w-10/12 rounded bg-slate-200" />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-400">
                <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-300" />Modifications enregistrées</span>
                <span>Exporter · DOCX · PDF</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="relative z-10 bg-white py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="max-w-2xl"><p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-700">Un vrai espace de travail</p><h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Plus qu’un bouton “générer”.</h2><p className="mt-5 text-lg leading-8 text-slate-600">Chaque étape reste visible, modifiable et vérifiable pour que l’IA accélère votre travail sans vous retirer la maîtrise du fond.</p></div>
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <article key={title} className="group rounded-3xl border border-slate-200 bg-[#fbfcfb] p-7 transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/5">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800"><Icon className="size-5" /></span>
                <h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 leading-7 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="bg-slate-950 py-24 text-white">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-14 lg:grid-cols-[.8fr_1.2fr]">
            <div><p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-300">Du stage au document</p><h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Une méthode simple pour un travail complexe.</h2><p className="mt-5 leading-8 text-slate-400">Vous avancez dans un parcours clair, avec la possibilité de revenir sur chaque décision avant la génération finale.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              {steps.map(([number, title, text]) => (
                <article key={number} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"><span className="font-mono text-sm font-bold text-emerald-300">{number}</span><h3 className="mt-6 text-xl font-bold">{title}</h3><p className="mt-2 leading-7 text-slate-400">{text}</p></article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-emerald-50 py-20">
        <div className="mx-auto max-w-5xl px-5 text-center lg:px-8">
          <Quote className="mx-auto size-10 text-emerald-700" />
          <blockquote className="mt-6 text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">“Un bon rapport ne se résume pas à remplir des pages. Il doit raconter ce que vous avez compris, construit et appris.”</blockquote>
          <p className="mt-5 text-slate-600">RAG Report organise ce raisonnement avec vous, sans remplacer votre expertise.</p>
        </div>
      </section>

      <section id="pricing" className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center"><p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-700">Tarifs simples</p><h2 className="mt-3 text-4xl font-black tracking-tight">Commencez gratuitement, évoluez quand vous êtes prêt.</h2></div>
          <div className="mx-auto mt-14 grid max-w-5xl gap-5 lg:grid-cols-3">
            {pricing.map((tier) => {
              const featured = tier.recommended === true
              const priceLabel = tier.price === 0 ? 'Gratuit' : `${tier.price} ${tier.currency}`
              const periodLabel = tier.period === 'par mois' ? 'mois' : tier.period
              return (
                <article key={tier.id} className={`rounded-3xl border p-7 ${featured ? 'border-emerald-600 bg-slate-950 text-white shadow-2xl shadow-emerald-900/15' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center justify-between"><h3 className="text-xl font-bold">{tier.name}</h3>{featured && <Badge className="bg-emerald-500 text-white">Recommandé</Badge>}</div>
                  <p className="mt-5 text-4xl font-black">{priceLabel}<span className="text-sm font-medium opacity-60"> / {periodLabel}</span></p><p className={`mt-3 leading-6 ${featured ? 'text-slate-400' : 'text-slate-600'}`}>{tier.limits.preview}</p>
                  <ul className="mt-7 space-y-3 text-sm">{tier.features.map((item) => <li key={item} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />{item}</li>)}</ul>
                  <Button onClick={enterWorkspace} className={`mt-8 w-full rounded-full ${featured ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-white text-slate-950 hover:bg-emerald-50'}`} variant={featured ? 'default' : 'outline'}>Choisir {tier.name}<ChevronRight className="ml-1 size-4" /></Button>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#f7faf7] px-5 py-20 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-8 rounded-[2.25rem] bg-emerald-700 px-8 py-12 text-white shadow-2xl shadow-emerald-900/15 md:flex-row md:px-12">
          <div><p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-200">Votre projet mérite mieux qu’une page blanche</p><h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">Transformez votre expérience de stage en un rapport dont vous êtes fier.</h2></div>
          <Button size="lg" onClick={enterWorkspace} className="h-12 shrink-0 rounded-full bg-white px-7 text-emerald-800 hover:bg-emerald-50">Commencer maintenant<ArrowRight className="ml-2 size-4" /></Button>
        </div>
      </section>

      <footer className="border-t bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-5 text-sm text-slate-500 sm:flex-row lg:px-8">
          <div className="flex items-center gap-2 font-bold text-slate-900"><BookOpenCheck className="size-4 text-emerald-700" />RAG Report</div>
          <p>Un assistant de rédaction académique responsable.</p>
          <div className="flex gap-5"><a href="#features">Fonctionnalités</a><a href="#pricing">Tarifs</a><button onClick={enterWorkspace}>Connexion</button></div>
        </div>
      </footer>
    </main>
  )
}
