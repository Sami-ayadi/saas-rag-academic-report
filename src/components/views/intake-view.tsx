'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Loader2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/lib/store'
import { secureFetch } from '@/lib/secure-fetch'

interface IntakeFormState {
  organization: string
  industry: string
  role: string
  internshipPeriod: string
  missionSummary: string
  problemStatement: string
  objectives: string
  methodsAndTools: string
  results: string
  constraints: string
  universityRequirements: string
  confidentialityNotes: string
  specialization: string
  countryOrJurisdiction: string
  medicalSpecialty: string
  technicalEnvironment: string
  applicableStandards: string
}

const EMPTY_FORM: IntakeFormState = {
  organization: '', industry: '', role: '', internshipPeriod: '', missionSummary: '',
  problemStatement: '', objectives: '', methodsAndTools: '', results: '', constraints: '',
  universityRequirements: '', confidentialityNotes: '', specialization: '',
  countryOrJurisdiction: '', medicalSpecialty: '', technicalEnvironment: '', applicableStandards: '',
}

const STEP_TITLES = ['Stage', 'Mission', 'Objectifs', 'Domaine', 'Validation']

function splitEntries(value: string) {
  return value.split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean)
}

export function IntakeView() {
  const { selectedProjectId, navigate } = useAppStore()
  const [form, setForm] = useState<IntakeFormState>(EMPTY_FORM)
  const [field, setField] = useState('')
  const [projectTitle, setProjectTitle] = useState('')
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [riskMessage, setRiskMessage] = useState('')

  useEffect(() => {
    if (!selectedProjectId) return
    Promise.all([
      fetch(`/api/projects/${selectedProjectId}`).then((response) => response.json()),
      fetch(`/api/projects/${selectedProjectId}/intake`).then((response) => response.json()),
    ]).then(([projectData, intakeData]) => {
      setField(projectData.project?.field ?? '')
      setProjectTitle(projectData.project?.title ?? '')
      const answers = intakeData.intake?.answers
      if (answers) {
        setForm({
          ...EMPTY_FORM,
          ...answers,
          objectives: (answers.objectives ?? []).join('\n'),
          methodsAndTools: (answers.methodsAndTools ?? []).join(', '),
          ...answers.disciplineContext,
        })
        setStep(Math.min(intakeData.intake.currentStep ?? 1, 5))
      }
    }).catch(() => toast.error('Impossible de charger le questionnaire'))
      .finally(() => setLoading(false))
  }, [selectedProjectId])

  const answers = useMemo(() => ({
    organization: form.organization,
    industry: form.industry,
    role: form.role,
    internshipPeriod: form.internshipPeriod,
    missionSummary: form.missionSummary,
    problemStatement: form.problemStatement,
    objectives: splitEntries(form.objectives),
    methodsAndTools: splitEntries(form.methodsAndTools),
    results: form.results,
    constraints: form.constraints,
    universityRequirements: form.universityRequirements,
    confidentialityNotes: form.confidentialityNotes,
    disciplineContext: {
      specialization: form.specialization,
      countryOrJurisdiction: form.countryOrJurisdiction,
      medicalSpecialty: form.medicalSpecialty,
      technicalEnvironment: form.technicalEnvironment,
      applicableStandards: form.applicableStandards,
    },
  }), [form])

  function update(name: keyof IntakeFormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
    setRiskMessage('')
  }

  function validateStep(currentStep: number) {
    if (currentStep === 1 && (!form.organization || !form.industry || !form.role)) {
      return 'Renseignez l’organisation, le secteur et votre rôle.'
    }
    if (currentStep === 2 && (form.missionSummary.trim().length < 20 || form.problemStatement.trim().length < 20)) {
      return 'Décrivez la mission et la problématique avec au moins 20 caractères.'
    }
    if (currentStep === 3 && splitEntries(form.objectives).length === 0) {
      return 'Ajoutez au moins un objectif.'
    }
    return null
  }

  async function save(nextStep: number) {
    if (!selectedProjectId) return false
    setSaving(true)
    try {
      const response = await secureFetch(`/api/projects/${selectedProjectId}/intake`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStep: nextStep, answers }),
      })
      const data = await response.json()
      if (!response.ok) {
        setRiskMessage(data.error ?? 'Impossible de sauvegarder les réponses.')
        return false
      }
      return true
    } catch {
      toast.error('Erreur réseau pendant la sauvegarde')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function goNext() {
    const validationError = validateStep(step)
    if (validationError) return toast.error(validationError)
    const nextStep = Math.min(step + 1, 5)
    if (await save(nextStep)) setStep(nextStep)
  }

  async function approveBrief() {
    const validationError = [1, 2, 3].map(validateStep).find(Boolean)
    if (validationError) return toast.error(validationError)
    if (!(await save(5)) || !selectedProjectId) return

    setSaving(true)
    try {
      const response = await secureFetch(`/api/projects/${selectedProjectId}/intake`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) {
        setRiskMessage(data.error ?? 'Le brief ne peut pas encore être validé.')
        return
      }
      toast.success('Brief de projet validé')
      navigate('project-detail', selectedProjectId)
    } catch {
      toast.error('Erreur réseau pendant la validation')
    } finally {
      setSaving(false)
    }
  }

  if (!selectedProjectId) return null
  if (loading) return <div className="flex flex-1 items-center justify-center"><Loader2 className="size-7 animate-spin" /></div>

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate('project-detail', selectedProjectId)}>
          <ArrowLeft className="mr-2 size-4" /> Retour au projet
        </Button>
        <h1 className="text-2xl font-bold">Questionnaire de cadrage</h1>
        <p className="text-muted-foreground">{projectTitle} · {field || 'Domaine à préciser'}</p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          {STEP_TITLES.map((title, index) => <span key={title} className={step === index + 1 ? 'font-semibold text-primary' : ''}>{title}</span>)}
        </div>
        <Progress value={(step / 5) * 100} />
      </div>

      {riskMessage && (
        <Alert variant="destructive">
          <ShieldAlert className="size-4" />
          <AlertTitle>Réponses à vérifier</AlertTitle>
          <AlertDescription>{riskMessage}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{STEP_TITLES[step - 1]}</CardTitle>
          <CardDescription>Étape {step} sur 5 — vos réponses sont enregistrées entre les étapes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 1 && <>
            <Field label="Organisation d’accueil *"><Input value={form.organization} onChange={(e) => update('organization', e.target.value)} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Secteur *"><Input value={form.industry} onChange={(e) => update('industry', e.target.value)} /></Field>
              <Field label="Votre rôle *"><Input value={form.role} onChange={(e) => update('role', e.target.value)} /></Field>
            </div>
            <Field label="Période du stage"><Input placeholder="Ex. février à juillet 2026" value={form.internshipPeriod} onChange={(e) => update('internshipPeriod', e.target.value)} /></Field>
          </>}

          {step === 2 && <>
            <Field label="Mission principale *"><Textarea className="min-h-32" value={form.missionSummary} onChange={(e) => update('missionSummary', e.target.value)} /></Field>
            <Field label="Problématique traitée *"><Textarea className="min-h-32" value={form.problemStatement} onChange={(e) => update('problemStatement', e.target.value)} /></Field>
          </>}

          {step === 3 && <>
            <Field label="Objectifs *" hint="Un objectif par ligne, six maximum."><Textarea className="min-h-32" value={form.objectives} onChange={(e) => update('objectives', e.target.value)} /></Field>
            <Field label="Méthodes et outils" hint="Séparez-les par des virgules."><Textarea value={form.methodsAndTools} onChange={(e) => update('methodsAndTools', e.target.value)} /></Field>
          </>}

          {step === 4 && <>
            <Field label="Spécialisation"><Input value={form.specialization} onChange={(e) => update('specialization', e.target.value)} /></Field>
            {field.toLowerCase().includes('droit') && <Field label="Pays ou juridiction"><Input value={form.countryOrJurisdiction} onChange={(e) => update('countryOrJurisdiction', e.target.value)} /></Field>}
            {field.toLowerCase().includes('médec') && <Field label="Spécialité médicale"><Input value={form.medicalSpecialty} onChange={(e) => update('medicalSpecialty', e.target.value)} /></Field>}
            <Field label="Environnement technique ou méthodologique"><Textarea value={form.technicalEnvironment} onChange={(e) => update('technicalEnvironment', e.target.value)} /></Field>
            <Field label="Normes, protocoles ou textes applicables"><Textarea value={form.applicableStandards} onChange={(e) => update('applicableStandards', e.target.value)} /></Field>
          </>}

          {step === 5 && <>
            <Field label="Résultats obtenus"><Textarea className="min-h-28" value={form.results} onChange={(e) => update('results', e.target.value)} /></Field>
            <Field label="Contraintes et limites"><Textarea value={form.constraints} onChange={(e) => update('constraints', e.target.value)} /></Field>
            <Field label="Exigences de l’université"><Textarea value={form.universityRequirements} onChange={(e) => update('universityRequirements', e.target.value)} /></Field>
            <Field label="Informations confidentielles à exclure"><Textarea value={form.confidentialityNotes} onChange={(e) => update('confidentialityNotes', e.target.value)} /></Field>
          </>}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={step === 1 || saving} onClick={() => setStep((current) => Math.max(1, current - 1))}>
          <ArrowLeft className="mr-2 size-4" /> Précédent
        </Button>
        {step < 5 ? (
          <Button disabled={saving} onClick={goNext}>{saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}Suivant</Button>
        ) : (
          <Button disabled={saving} onClick={approveBrief}>{saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}Valider le brief</Button>
        )}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
}
