'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Upload,
  FileText,
  Trash2,
  Play,
  Eye,
  Download,
  RefreshCw,
  Loader2,
  FolderOpen,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  FileUp,
  Layers,
  ClipboardList,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import type { ProjectFull, DocumentItem, SummaryItem, ReportItem, GenerationJobItem } from '@/lib/types'
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
} from '@/lib/constants'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
}

function formatDate(date: string | Date): string {
  try { return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr }) } catch { return '—' }
}
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

const PIPELINE_STEPS = [
  { key: 'documents', label: 'Documents', icon: FileUp },
  { key: 'summary', label: 'Résumé RAG', icon: Layers },
  { key: 'report', label: 'Rapport', icon: FileText },
  { key: 'export', label: 'Export', icon: Download },
]

export function ProjectDetailView() {
  const navigate = useAppStore((s) => s.navigate)
  const selectedProjectId = useAppStore((s) => s.selectedProjectId)
  const [project, setProject] = useState<ProjectFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [jobProgress, setJobProgress] = useState<{ progress: number; message: string; status: string } | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const loadProject = useCallback(async () => {
    if (!selectedProjectId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`)
      if (res.ok) {
        const data = await res.json()
        setProject(data.project)
      }
    } catch {
      toast.error('Erreur lors du chargement du projet')
    } finally {
      setLoading(false)
    }
  }, [selectedProjectId])

  useEffect(() => { loadProject() }, [loadProject])

  // Poll job status
  useEffect(() => {
    if (!activeJobId) return
    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${activeJobId}`)
        if (res.ok) {
          const data = await res.json()
          setJobProgress({ progress: data.job.progress, message: data.job.progressMessage, status: data.job.status })
          if (data.job.status === 'COMPLETED' || data.job.status === 'FAILED') {
            if (data.job.status === 'FAILED') {
              toast.error(data.job.progressMessage || 'La génération a échoué. Réessayez.')
            }
            setActiveJobId(null)
            setJobProgress(null)
            setGeneratingSummary(false)
            setGeneratingReport(false)
            loadProject()
          }
        }
      } catch { /* ignore */ }
    }
    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [activeJobId, loadProject])

  async function handleGenerateSummary() {
    if (!selectedProjectId) return
    setGeneratingSummary(true)
    try {
      const res = await secureFetch(`/api/projects/${selectedProjectId}/generate-summary`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setActiveJobId(data.jobId)
        toast.success('Génération du résumé lancée')
      } else {
        const failure = await res.json().catch(() => ({}))
        toast.error(failure.error || 'Erreur lors de la génération')
        setGeneratingSummary(false)
      }
    } catch {
      toast.error('Erreur réseau')
      setGeneratingSummary(false)
    }
  }

  async function handleGenerateReport() {
    if (!selectedProjectId) return
    setGeneratingReport(true)
    try {
      const res = await secureFetch(`/api/projects/${selectedProjectId}/generate-report`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setActiveJobId(data.jobId)
        toast.success('Génération du rapport lancée')
      } else {
        const failure = await res.json().catch(() => ({}))
        toast.error(failure.error || 'Erreur lors de la génération')
        setGeneratingReport(false)
      }
    } catch {
      toast.error('Erreur réseau')
      setGeneratingReport(false)
    }
  }

  async function handleUploadDocument() {
    if (!selectedProjectId || !uploadFile) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set('file', uploadFile)
      const res = await secureFetch(`/api/projects/${selectedProjectId}/documents`, {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        toast.success('Document ajouté')
        setUploadOpen(false)
        setUploadFile(null)
        loadProject()
      } else {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? 'Erreur lors de l\'ajout')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteDocument(docId: string) {
    if (!selectedProjectId) return
    try {
      const res = await secureFetch(`/api/projects/${selectedProjectId}/documents`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId }),
      })
      if (res.ok) {
        toast.success('Document supprimé')
        loadProject()
      }
    } catch {
      toast.error('Erreur')
    }
  }

  function getPipelineStatus(stepKey: string): 'done' | 'current' | 'pending' {
    if (!project) return 'pending'
    const status = project.status
    switch (stepKey) {
      case 'documents': return (project.documents?.length ?? 0) > 0 ? 'done' : 'current'
      case 'summary': return ['SUMMARIZING', 'SUMMARY_READY', 'GENERATING', 'REPORT_READY', 'EXPORTED'].includes(status) ? 'done' : (project.documents?.length ?? 0) > 0 ? 'current' : 'pending'
      case 'report': return ['REPORT_READY', 'EXPORTED'].includes(status) ? 'done' : ['SUMMARY_READY'].includes(status) ? 'current' : 'pending'
      case 'export': return status === 'EXPORTED' ? 'done' : status === 'REPORT_READY' ? 'current' : 'pending'
      default: return 'pending'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <FolderOpen className="size-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">Projet introuvable</p>
        <Button variant="outline" onClick={() => navigate('dashboard')}>
          <ArrowLeft className="mr-2 size-4" /> Retour au tableau de bord
        </Button>
      </div>
    )
  }

  const latestSummary = project.summaries?.[0]
  const latestReport = project.reports?.[0]

  return (
    <motion.div
      className="space-y-6 p-4 md:p-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Progress Overlay */}
      {jobProgress && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <Loader2 className="mx-auto size-10 animate-spin text-primary" />
              <CardTitle className="mt-2">Génération en cours...</CardTitle>
              <CardDescription>{jobProgress.message || 'Traitement en cours'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={jobProgress.progress} className="h-2" />
              <p className="text-center text-sm text-muted-foreground tabular-nums">
                {jobProgress.progress}%
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="mb-2 w-fit" onClick={() => navigate('dashboard')}>
            <ArrowLeft className="mr-2 size-4" /> Retour
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
            <Badge className={PROJECT_STATUS_COLORS[project.status] ?? 'bg-secondary'}>
              {PROJECT_STATUS_LABELS[project.status] ?? project.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{project.academicLevel}</span>
            {project.university && <span>· {project.university}</span>}
            {project.field && <span>· {project.field}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('intake', project.id)}>
            <ClipboardList className="mr-2 size-4" /> Questionnaire
          </Button>
          <Button size="sm" onClick={() => navigate('new-project')}>
            <RefreshCw className="mr-2 size-4" /> Modifier
          </Button>
        </div>
      </motion.div>

      {/* Pipeline Visual */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              {PIPELINE_STEPS.map((step, i) => {
                const status = getPipelineStatus(step.key)
                const Icon = step.icon
                return (
                  <div key={step.key} className="flex flex-1 items-center gap-2">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={`flex size-10 items-center justify-center rounded-full border-2 transition-colors ${
                        status === 'done' ? 'border-primary bg-primary/10 text-primary' :
                        status === 'current' ? 'border-primary/50 bg-primary/5 text-primary animate-pulse' :
                        'border-muted bg-muted text-muted-foreground'
                      }`}>
                        {status === 'done' ? <CheckCircle2 className="size-5" /> :
                         status === 'current' ? <Icon className="size-5" /> :
                         <Icon className="size-4 opacity-50" />}
                      </div>
                      <span className={`text-xs font-medium ${
                        status === 'done' ? 'text-primary' :
                        status === 'current' ? 'text-primary' :
                        'text-muted-foreground'
                      }`}>{step.label}</span>
                    </div>
                    {i < PIPELINE_STEPS.length - 1 && (
                      <div className={`mt-[-16px] h-[2px] flex-1 ${
                        getPipelineStatus(PIPELINE_STEPS[i + 1].key) !== 'pending' || status === 'done' ? 'bg-primary' : 'bg-muted'
                      }`} />
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={itemVariants}>
        <Tabs defaultValue="documents" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="documents" className="text-xs sm:text-sm">Documents</TabsTrigger>
            <TabsTrigger value="resume" className="text-xs sm:text-sm">Résumé</TabsTrigger>
            <TabsTrigger value="rapports" className="text-xs sm:text-sm">Rapports</TabsTrigger>
            <TabsTrigger value="pipeline" className="text-xs sm:text-sm">Pipeline</TabsTrigger>
          </TabsList>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="text-base">Documents sources</CardTitle>
                  <CardDescription>PDF, Word, images — les sources pour votre rapport</CardDescription>
                </div>
                <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Upload className="mr-2 size-4" /> Ajouter
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Ajouter un document</DialogTitle>
                      <DialogDescription>Sélectionnez un fichier PDF, DOCX, TXT ou Markdown de 10 Mo maximum.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <label htmlFor="project-document-upload" className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center hover:bg-muted/40">
                        <Upload className="size-10 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {uploadFile ? uploadFile.name : 'Cliquez pour choisir un document'}
                        </p>
                      </label>
                      <div className="mt-4 space-y-2">
                        <input
                          id="project-document-upload"
                          type="file"
                          accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                          className="sr-only"
                          onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setUploadOpen(false)}>Annuler</Button>
                      <Button onClick={handleUploadDocument} disabled={uploading || !uploadFile}>
                        {uploading && <Loader2 className="mr-2 size-4 animate-spin" />}
                        Ajouter
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {!project.documents || project.documents.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <FileText className="size-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Aucun document uploadé</p>
                    <p className="text-xs text-muted-foreground/60">Ajoutez vos sources pour commencer la génération</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-72">
                    <div className="space-y-2">
                      {project.documents.map((doc: DocumentItem) => (
                        <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 items-center justify-center rounded-md bg-primary/10">
                              <FileText className="size-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{doc.originalName}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(doc.size)} · {doc.chunkCount} chunks
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="secondary" className="text-[10px]">
                              {doc.status === 'uploaded' ? 'Indexé' : doc.status}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteDocument(doc.id)}
                              aria-label={`Supprimer ${doc.originalName}`}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Summary Tab */}
          <TabsContent value="resume" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Résumé RAG</CardTitle>
                    <CardDescription>Synthèse automatique de vos documents sources</CardDescription>
                  </div>
                  {latestSummary && (
                    <Badge variant="secondary" className={PROJECT_STATUS_COLORS[latestSummary.status]}>
                      {PROJECT_STATUS_LABELS[latestSummary.status]}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!latestSummary ? (
                  <div className="flex flex-col items-center gap-4 py-8 text-center">
                    <Sparkles className="size-10 text-muted-foreground/40" />
                    <div>
                      <p className="text-sm font-medium">Aucun résumé généré</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Le résumé RAG analyse vos documents et génère une synthèse structurée
                      </p>
                    </div>
                    <Button size="sm" onClick={handleGenerateSummary} disabled={generatingSummary}>
                      {generatingSummary ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
                      Générer le résumé
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      Version {latestSummary.version} · {formatDate(latestSummary.createdAt)}
                    </div>
                    <div className="max-h-64 overflow-y-auto rounded-lg border bg-muted/30 p-4">
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                        {latestSummary.content || 'Contenu vide'}
                      </pre>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate('summary-editor', selectedProjectId!)}
                      >
                        <Eye className="mr-2 size-4" /> Modifier
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleGenerateSummary} disabled={generatingSummary}>
                        {generatingSummary ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
                        Régénérer
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="rapports" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Rapports</CardTitle>
                    <CardDescription>Rapports académiques générés à partir du résumé</CardDescription>
                  </div>
                  {latestReport && (
                    <Button size="sm" onClick={() => navigate('report-editor', selectedProjectId!, latestReport.id)}>
                      <Eye className="mr-2 size-4" /> Ouvrir
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!latestReport ? (
                  <div className="flex flex-col items-center gap-4 py-8 text-center">
                    <FileText className="size-10 text-muted-foreground/40" />
                    <div>
                      <p className="text-sm font-medium">Aucun rapport généré</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Générez d&apos;abord un résumé, puis créez votre rapport complet
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleGenerateReport}
                      disabled={generatingReport}
                    >
                      {generatingReport ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
                      Générer le rapport
                    </Button>
                    {!latestSummary && (
                      <p className="text-xs text-destructive">Un résumé est requis avant la génération du rapport</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                          <FileText className="size-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{latestReport.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{latestReport.wordCount} mots</span>
                            <span>·</span>
                            <span>{formatDate(latestReport.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={PROJECT_STATUS_COLORS[latestReport.status]}>
                          {PROJECT_STATUS_LABELS[latestReport.status]}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => navigate('report-editor', selectedProjectId!, latestReport.id)}
                      >
                        <Eye className="mr-2 size-4" /> Ouvrir l&apos;éditeur
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleGenerateReport} disabled={generatingReport}>
                        <RefreshCw className="mr-2 size-4" /> Régénérer
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pipeline Tab */}
          <TabsContent value="pipeline" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Historique des jobs</CardTitle>
                <CardDescription>Historique de toutes les générations pour ce projet</CardDescription>
              </CardHeader>
              <CardContent>
                {!project.jobs || project.jobs.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <AlertCircle className="size-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Aucun job de génération</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-72">
                    <div className="space-y-2">
                      {project.jobs.map((job: GenerationJobItem) => (
                        <div key={job.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-3">
                            <div className={`flex size-8 items-center justify-center rounded-full ${
                              job.status === 'COMPLETED' ? 'bg-primary/10 text-primary' :
                              job.status === 'PROCESSING' ? 'bg-accent/10 text-accent' :
                              job.status === 'FAILED' ? 'bg-destructive/10 text-destructive' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {job.status === 'COMPLETED' ? <CheckCircle2 className="size-4" /> :
                               job.status === 'PROCESSING' ? <Loader2 className="size-4 animate-spin" /> :
                               job.status === 'FAILED' ? <AlertCircle className="size-4" /> :
                               <Clock className="size-4" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium capitalize">{job.type}</p>
                              <p className="text-xs text-muted-foreground">
                                {job.progressMessage || JOB_STATUS_LABELS[job.status]}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className={`text-[10px] ${JOB_STATUS_COLORS[job.status]}`}>
                              {JOB_STATUS_LABELS[job.status]}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(job.createdAt)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  )
}
