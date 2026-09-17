'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Download,
  RefreshCw,
  Loader2,
  FileText,
  Sparkles,
  Check,
  X,
  ChevronRight,
  Eye,
  Pencil,
  RotateCcw,
  FileDown,
  BookOpen,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'

import { useAppStore } from '@/lib/store'
import { secureFetch } from '@/lib/secure-fetch'
import type { ReportItem, ReportSection, GenerationJobItem } from '@/lib/types'
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '@/lib/constants'

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

/**
 * LLM-generated section ids can repeat (e.g. two "chapitre9"); React keys and
 * DOM scroll anchors must be unique, so duplicates get a -2/-3 suffix. Kept in
 * sync with the same dedupe applied server-side in report-generation.ts.
 */
function withUniqueSectionIds(sections: ReportSection[]): ReportSection[] {
  const seen = new Map<string, number>()
  return sections.map((section) => {
    const base = section.id || 'section'
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return count === 0 ? section : { ...section, id: `${base}-${count + 1}` }
  })
}

function SectionCard({
  section,
  isActive,
  onSelect,
  onRegenerate,
}: {
  section: ReportSection
  isActive: boolean
  onSelect: () => void
  onRegenerate: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onSelect}
      className={`group relative cursor-pointer rounded-lg border p-4 transition-all duration-200 ${
        isActive
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'hover:border-primary/30 hover:bg-muted/50'
      }`}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute left-0 top-0 h-full w-1 rounded-l-lg bg-primary" />
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ChevronRight className={`size-3.5 text-muted-foreground transition-transform ${
              isActive ? 'rotate-90 text-primary' : ''
            }`} />
            <h3 className="text-sm font-medium leading-tight">{section.title}</h3>
          </div>
          <p className="mt-1.5 pl-6 text-xs leading-relaxed text-muted-foreground line-clamp-3">
            {section.content.substring(0, 200)}...
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge
            variant="secondary"
            className={`text-[10px] ${
              section.status === 'completed' ? 'bg-primary/10 text-primary' :
              section.status === 'generating' ? 'bg-accent/10 text-accent' :
              section.status === 'failed' ? 'bg-destructive/10 text-destructive' :
              'bg-muted'
            }`}
          >
            {section.status === 'completed' ? 'Terminé' :
             section.status === 'generating' ? 'En cours' :
             section.status === 'failed' ? 'Échoué' : 'Brouillon'}
          </Badge>
        </div>
      </div>

      {/* Action buttons on hover */}
      <div className={`absolute right-3 top-3 flex gap-1 transition-opacity ${
        isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={(e) => { e.stopPropagation(); onRegenerate() }}
          title="Régénérer"
        >
          <RotateCcw className="size-3" />
        </Button>
      </div>
    </motion.div>
  )
}

export function ReportEditorView() {
  const navigate = useAppStore((s) => s.navigate)
  const selectedProjectId = useAppStore((s) => s.selectedProjectId)
  const selectedReportId = useAppStore((s) => s.selectedReportId)

  const [report, setReport] = useState<ReportItem | null>(null)
  const [sections, setSections] = useState<ReportSection[]>([])
  const [reportAccess, setReportAccess] = useState<{
    previewApplied?: boolean
    tableOfContents?: boolean
    exportFormats?: string[]
    canEditReport?: boolean
    canRegenerate?: boolean
  } | null>(null)
  const [fullyVisibleSectionIds, setFullyVisibleSectionIds] = useState<string[]>([])
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [instructions, setInstructions] = useState('')
  const [diffContent, setDiffContent] = useState<{ original: string; newContent: string } | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState<string | null>(null)

  // Load report
  const loadReport = useCallback(async () => {
    if (!selectedReportId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/${selectedReportId}`)
      if (res.ok) {
        const data = await res.json()
        setReport(data.report)
        setReportAccess(data.access ?? null)
        setFullyVisibleSectionIds(Array.isArray(data.fullyVisibleSectionIds) ? data.fullyVisibleSectionIds : [])
        try {
          const parsed = JSON.parse(data.report.sections)
          setSections(Array.isArray(parsed) ? withUniqueSectionIds(parsed) : [])
        } catch {
          setSections([])
        }
      }
    } catch {
      toast.error('Erreur lors du chargement du rapport')
    } finally {
      setLoading(false)
    }
  }, [selectedReportId])

  useEffect(() => { loadReport() }, [loadReport])

  const activeSection = sections.find((s) => s.id === activeSectionId)
  useEffect(() => { setEditingContent(null) }, [activeSectionId])

  async function saveSectionEdit() {
    if (!selectedReportId || !activeSectionId || editingContent === null) return
    try {
      const res = await secureFetch(`/api/reports/${selectedReportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: activeSectionId, sectionContent: editingContent }),
      })
      if (!res.ok) {
        const failure = await res.json().catch(() => ({}))
        toast.error(failure.error || 'Impossible de sauvegarder la section')
        return
      }
      setSections((previous) => previous.map((section) => section.id === activeSectionId
        ? { ...section, content: editingContent, status: 'completed' as const }
        : section))
      setEditingContent(null)
      toast.success('Section sauvegardée')
    } catch {
      toast.error('Erreur réseau pendant la sauvegarde')
    }
  }

  async function handleRegenerateSection(sectionId?: string) {
    const targetId = sectionId ?? activeSectionId
    if (!targetId || !selectedReportId) return
    // Preview-limited tiers may only regenerate sections returned in full; the
    // server enforces this too, but failing fast avoids a wasted request.
    if (fullyVisibleSectionIds.length > 0 && !fullyVisibleSectionIds.includes(targetId)) {
      toast.error('Cette section n’est pas disponible dans l’aperçu de votre plan.')
      return
    }
    setRegenerating(true)
    setDiffContent(null)
    try {
      const res = await secureFetch(`/api/reports/${selectedReportId}/regenerate-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: targetId, instructions: instructions || undefined }),
      })
      if (res.ok) {
        const data = await res.json()
        // Use originalContent from the API (DB-stored) for accurate diff
        const originalContent = data.originalContent || ''
        const newContent = data.section?.content || ''
        if (originalContent && newContent && originalContent !== newContent) {
          setDiffContent({ original: originalContent, newContent })
          // Also update local sections state with new data from DB
          setSections((prev) =>
            prev.map((s) =>
              s.id === targetId ? { ...s, content: originalContent, status: 'completed' as const } : s
            )
          )
          toast.success('Section régénérée — vérifiez les modifications')
        } else {
          toast.error('Le contenu généré est identique à l\'original')
        }
      } else {
        const errData = await res.json().catch(() => ({}))
        toast.error(errData.error || 'Erreur lors de la régénération')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setRegenerating(false)
    }
  }

  async function acceptDiff() {
    if (!diffContent || !activeSectionId || !selectedReportId) return
    // Save accepted changes to DB
    try {
      const res = await secureFetch(`/api/reports/${selectedReportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: activeSectionId, sectionContent: diffContent.newContent }),
      })
      if (res.ok) {
        // Update local state
        setSections((prev) =>
          prev.map((s) =>
            s.id === activeSectionId ? { ...s, content: diffContent.newContent, status: 'completed' as const } : s
          )
        )
        setDiffContent(null)
        toast.success('Modifications acceptées et sauvegardées')
      } else {
        toast.error('Erreur lors de la sauvegarde')
      }
    } catch {
      toast.error('Erreur réseau')
    }
  }

  function rejectDiff() {
    setDiffContent(null)
  }

  async function handleExport(format: 'docx' | 'pdf' | 'md') {
    if (!selectedReportId) return
    setExporting(format)
    try {
      const res = await secureFetch(`/api/reports/${selectedReportId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const disposition = res.headers.get('Content-Disposition') ?? ''
        const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `rapport.${format}`
        const downloadUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(downloadUrl)
        toast.success(`Export ${format.toUpperCase()} prêt`)
      } else {
        const failure = await res.json().catch(() => ({}))
        toast.error(failure.error || 'Erreur lors de l\'export')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setExporting(null)
    }
  }

  const canUseExportFormat = (format: string) =>
    !reportAccess || (Array.isArray(reportAccess.exportFormats) && reportAccess.exportFormats.includes(format))

  if (loading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    )
  }

  if (!report || sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <FileText className="size-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">Rapport introuvable ou en cours de génération</p>
        <Button variant="outline" onClick={() => navigate('project-detail', selectedProjectId!)}>
          <ArrowLeft className="mr-2 size-4" /> Retour au projet
        </Button>
      </div>
    )
  }

  return (
    <motion.div
      className="flex flex-col overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Toolbar */}
      <motion.div variants={itemVariants} className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('project-detail', selectedProjectId!)}>
            <ArrowLeft className="mr-2 size-4" /> Retour
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-primary" />
              <h1 className="text-base font-semibold">{report.title}</h1>
              <Badge variant="secondary" className={`text-[10px] ${PROJECT_STATUS_COLORS[report.status]}`}>
                {PROJECT_STATUS_LABELS[report.status]}
              </Badge>
              {reportAccess?.previewApplied && (
                <Badge variant="secondary" className="bg-amber-500/15 text-[10px] text-amber-700">
                  Aperçu gratuit
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{report.wordCount} mots · {sections.length} sections</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExport('md')}
            disabled={exporting === 'md' || !canUseExportFormat('md')}
          >
            {exporting === 'md' ? <Loader2 className="mr-2 size-3 animate-spin" /> : <FileDown className="mr-2 size-3" />}
            MD
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExport('docx')}
            disabled={exporting === 'docx' || !canUseExportFormat('docx')}
          >
            {exporting === 'docx' ? <Loader2 className="mr-2 size-3 animate-spin" /> : <FileDown className="mr-2 size-3" />}
            DOCX
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExport('pdf')}
            disabled={exporting === 'pdf' || !canUseExportFormat('pdf')}
          >
            {exporting === 'pdf' ? <Loader2 className="mr-2 size-3 animate-spin" /> : <Download className="mr-2 size-3" />}
            PDF
          </Button>
        </div>
      </motion.div>

      {/* Split View */}
      <motion.div variants={itemVariants} className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel: Report Content */}
          <ResizablePanel defaultSize={60} minSize={35}>
            <div className="flex h-full flex-col">
              {/* Table of Contents - horizontal scroll */}
              <div className="flex gap-1 border-b overflow-x-auto px-4 py-2">
                {sections.map((section, i) => (
                  <Button
                    key={section.id}
                    variant="ghost"
                    size="sm"
                    className={`shrink-0 text-xs ${activeSectionId === section.id ? 'bg-primary/10 text-primary' : ''}`}
                    onClick={() => setActiveSectionId(section.id)}
                  >
                    {i === 0 ? 'Intro' : i === sections.length - 1 ? 'Conclusion' : `§${i}`}
                    <span className="ml-1.5 hidden sm:inline max-w-[120px] truncate">{section.title.split(':')[1]?.trim() || section.title.replace(/Chapitre \d+\s*:\s*/, '')}</span>
                  </Button>
                ))}
              </div>

              {/* Section Content */}
              <ScrollArea className="flex-1">
                <div className="space-y-4 p-4 md:p-6 max-w-3xl mx-auto">
                  {sections.map((section) => (
                    <div
                      key={section.id}
                      id={`section-${section.id}`}
                      className={`rounded-xl border p-5 transition-all duration-200 cursor-pointer ${
                        activeSectionId === section.id
                          ? 'border-primary/40 bg-primary/[0.02] shadow-sm'
                          : 'hover:border-primary/20'
                      }`}
                      onClick={() => setActiveSectionId(section.id)}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h2 className="text-base font-semibold leading-tight text-foreground">
                          {section.title}
                        </h2>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${
                              section.status === 'completed' ? 'bg-primary/10 text-primary' : 'bg-muted'
                            }`}
                          >
                            {section.status === 'completed' ? 'Complété' : section.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground/85">
                        {section.content.split('\n').map((line, i) => {
                          if (line.startsWith('## ') || line.startsWith('### ')) {
                            const level = line.startsWith('### ') ? 'text-sm font-semibold' : 'text-base font-semibold'
                            return <h3 key={i} className={`${level} mt-3 mb-1 text-foreground`}>{line.replace(/^#+\s*/, '')}</h3>
                          }
                          if (line.startsWith('- **')) {
                            const parts = line.replace(/^- \*\*/, '').split('**')
                            return (
                              <li key={i} className="ml-4 list-disc text-foreground/80">
                                <strong>{parts[0]}</strong>{parts[1]}
                              </li>
                            )
                          }
                          if (line.match(/^\d+\./)) {
                            return <li key={i} className="ml-4 list-decimal text-foreground/80">{line.replace(/^\d+\.\s*/, '')}</li>
                          }
                          if (line.trim() === '') return <br key={i} />
                          return <p key={i}>{line}</p>
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>

          {/* Handle */}
          <ResizableHandle withHandle />

          {/* Right Panel: Section Inspector / Diff */}
          <ResizablePanel defaultSize={40} minSize={25}>
            <div className="flex h-full flex-col border-l">
              {/* Inspector Header */}
              <div className="border-b px-4 py-3">
                <h3 className="text-sm font-semibold">
                  {activeSection ? activeSection.title : 'Inspecteur de section'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {activeSection
                    ? 'Instructions de régénération et comparaison'
                    : 'Sélectionnez une section dans le rapport'}
                </p>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {!activeSection ? (
                    /* No section selected - show report metadata */
                    <div className="space-y-4">
                      <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                        <h4 className="text-sm font-medium">Métadonnées du rapport</h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Titre</p>
                            <p className="font-medium">{report.title}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Sections</p>
                            <p className="font-medium">{sections.length}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Mots</p>
                            <p className="font-medium">{report.wordCount}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Statut</p>
                            <Badge variant="secondary" className={PROJECT_STATUS_COLORS[report.status]}>
                              {PROJECT_STATUS_LABELS[report.status]}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-dashed p-4 text-center">
                        <Sparkles className="mx-auto size-6 text-muted-foreground/40" />
                        <p className="mt-2 text-xs text-muted-foreground">
                          Cliquez sur une section pour la modifier ou la régénérer
                        </p>
                      </div>
                    </div>
                  ) : diffContent ? (
                    /* Diff view */
                    <AnimatePresence>
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        {/* Instructions area */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">Instructions pour l'IA</label>
                          <Textarea
                            className="min-h-[80px] text-sm"
                            placeholder="Ex: Développer davantage l'aspect méthodologique, ajouter des exemples concrets..."
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                          />
                        </div>

                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => handleRegenerateSection()}
                          disabled={regenerating}
                        >
                          {regenerating ? (
                            <Loader2 className="mr-2 size-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 size-3.5" />
                          )}
                          Régénérer avec IA
                        </Button>

                        <Separator />

                        {/* Diff comparison */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-destructive/10 text-destructive text-[10px]">Original</Badge>
                            <span className="text-xs text-muted-foreground">Version actuelle</span>
                          </div>
                          <div className="max-h-32 overflow-y-auto rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-destructive/70">
                              {diffContent.original.substring(0, 800)}...
                            </pre>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-primary/10 text-primary text-[10px]">Nouveau</Badge>
                            <span className="text-xs text-muted-foreground">Généré par l'IA</span>
                          </div>
                          <div className="max-h-32 overflow-y-auto rounded-lg border border-primary/20 bg-primary/5 p-3">
                            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-primary/70">
                              {diffContent.newContent.substring(0, 800)}...
                            </pre>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1" onClick={acceptDiff}>
                            <Check className="mr-1.5 size-3.5" /> Accepter
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1" onClick={rejectDiff}>
                            <X className="mr-1.5 size-3.5" /> Rejeter
                          </Button>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  ) : (
                    /* Section selected - show controls */
                    <AnimatePresence>
                      <motion.div
                        key={activeSectionId}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        {/* Section title editable */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">Titre de la section</label>
                          <Input
                            className="text-sm"
                            value={activeSection.title}
                            readOnly
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-muted-foreground">Contenu</label>
                            {reportAccess?.canEditReport && editingContent === null && <Button variant="ghost" size="sm" onClick={() => setEditingContent(activeSection.content)}>Modifier</Button>}
                          </div>
                          {editingContent !== null && <>
                            <Textarea className="min-h-48 text-sm" value={editingContent} onChange={(event) => setEditingContent(event.target.value)} />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={saveSectionEdit}>Enregistrer</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingContent(null)}>Annuler</Button>
                            </div>
                          </>}
                        </div>

                        {/* Instructions */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">
                            Instructions pour la régénération
                          </label>
                          <Textarea
                            className="min-h-[100px] text-sm"
                            placeholder="Ex: Approfondir l'analyse bibliographique, ajouter des références récentes, restructurer les sous-parties..."
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                          />
                        </div>

                        {/* Regenerate button */}
                        <Button
                          className="w-full"
                          size="sm"
                          onClick={() => handleRegenerateSection()}
                          disabled={regenerating || !reportAccess?.canRegenerate}
                        >
                          {regenerating ? (
                            <Loader2 className="mr-2 size-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 size-3.5" />
                          )}
                          Régénérer avec l&apos;IA
                        </Button>

                        <Separator />

                        {/* Preview */}
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Aperçu de la section</p>
                          <div className="rounded-lg border bg-muted/30 p-3">
                            <ScrollArea className="max-h-48">
                              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
                                {activeSection.content.substring(0, 1000)}...
                              </pre>
                            </ScrollArea>
                          </div>
                        </div>

                        {/* Word count */}
                        <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                          <span>Mots dans cette section</span>
                          <span className="font-medium tabular-nums">
                            {activeSection.content.split(/\s+/).filter(Boolean).length}
                          </span>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </motion.div>
    </motion.div>
  )
}
