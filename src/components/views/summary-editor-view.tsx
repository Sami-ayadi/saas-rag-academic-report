'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Save,
  RefreshCw,
  Loader2,
  BookOpen,
  Sparkles,
  Type,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'

import { useAppStore } from '@/lib/store'
import { secureFetch } from '@/lib/secure-fetch'
import type { ProjectFull, SummaryItem } from '@/lib/types'
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '@/lib/constants'

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
}

export function SummaryEditorView() {
  const navigate = useAppStore((s) => s.navigate)
  const selectedProjectId = useAppStore((s) => s.selectedProjectId)
  const [project, setProject] = useState<ProjectFull | null>(null)
  const [summary, setSummary] = useState<SummaryItem | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [regeneratedContent, setRegeneratedContent] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!selectedProjectId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`)
      if (res.ok) {
        const data = await res.json()
        setProject(data.project)
        const latest = data.project?.summaries?.[data.project.summaries.length - 1]
        if (latest) {
          setSummary(latest)
          setContent(latest.content)
        }
      }
    } catch {
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }, [selectedProjectId])

  useEffect(() => { loadData() }, [loadData])

  function countWords(text: string): number {
    return text.split(/\s+/).filter(Boolean).length
  }

  async function handleSave() {
    if (!summary) return
    setSaving(true)
    try {
      const res = await secureFetch(`/api/reports/${summary.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        toast.success('Résumé sauvegardé')
      } else {
        toast.error('Erreur lors de la sauvegarde')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  async function handleRegenerateSection(sectionTitle: string) {
    if (!selectedProjectId) return
    setRegenerating(true)
    setActiveSection(sectionTitle)
    try {
      // Simulate regeneration delay
      await new Promise((r) => setTimeout(r, 2000))
      const demoRegenerated = `## ${sectionTitle}\n\nCette section a été régénérée avec succès par l'IA. Le contenu a été mis à jour en fonction des dernières sources documentaires disponibles. Les points clés ont été reformulés pour améliorer la clarté et la pertinence par rapport à la problématique étudiée.\n\nLes avancées récentes dans ce domaine ont permis de mieux comprendre les mécanismes sous-jacents et d'identifier de nouvelles opportunités de recherche. Cette mise à jour tient compte des publications les plus récentes et des retours des experts du domaine.\n\nIl est recommandé de vérifier les références bibliographiques citées et de les mettre à jour si nécessaire pour garantir l'exactitude et la pertinence des informations présentées.`
      setRegeneratedContent(demoRegenerated)
      toast.success('Section régénérée')
    } catch {
      toast.error('Erreur lors de la régénération')
    } finally {
      setRegenerating(false)
    }
  }

  function acceptRegenerated() {
    if (regeneratedContent) {
      setContent(regeneratedContent)
      setRegeneratedContent(null)
      setActiveSection(null)
      toast.success('Modifications acceptées')
    }
  }

  function rejectRegenerated() {
    setRegeneratedContent(null)
    setActiveSection(null)
  }

  const sections = content.split('\n## ').filter(Boolean).map((s, i) => ({
    title: s.split('\n')[0].replace(/^# /, ''),
    content: s,
    index: i,
  }))

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-4 p-4 md:p-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Toolbar */}
      <motion.div variants={itemVariants} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('project-detail', selectedProjectId!)}>
            <ArrowLeft className="mr-2 size-4" /> Retour
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <h1 className="text-lg font-semibold">Éditeur de Résumé</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {summary && (
            <Badge variant="secondary" className="text-xs">
              Version {summary.version}
            </Badge>
          )}
          <div className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
            <Type className="size-3" />
            {countWords(content)} mots
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Sauvegarder
          </Button>
        </div>
      </motion.div>

      {/* Content + Diff Layout */}
      <motion.div variants={itemVariants} className="grid gap-4 lg:grid-cols-2">
        {/* Left: Editor */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Contenu du résumé</CardTitle>
            <CardDescription className="text-xs">Modifiez directement le contenu ou régénérez par section</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <Textarea
              className="min-h-[500px] resize-none font-mono text-sm leading-relaxed"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Le contenu du résumé s'affichera ici..."
            />
          </CardContent>
        </Card>

        {/* Right: Section Inspector / Diff */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              {regeneratedContent ? 'Comparaison' : 'Sections'}
            </CardTitle>
            <CardDescription className="text-xs">
              {regeneratedContent
                ? 'Vérifiez les modifications proposées'
                : 'Cliquez sur une section pour la régénérer'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {regeneratedContent ? (
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="outline" className="bg-destructive/10 text-destructive text-xs">Original</Badge>
                    <span className="text-xs text-muted-foreground">Version actuelle</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-destructive/80">
                      {content.substring(0, 500)}...
                    </pre>
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="outline" className="bg-primary/10 text-primary text-xs">Nouveau</Badge>
                    <span className="text-xs text-muted-foreground">Version régénérée par l'IA</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-primary/80">
                      {regeneratedContent}
                    </pre>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={acceptRegenerated}>
                    Accepter les modifications
                  </Button>
                  <Button size="sm" variant="outline" onClick={rejectRegenerated}>
                    Rejeter
                  </Button>
                </div>
              </div>
            ) : (
              <ScrollArea className="max-h-[500px]">
                <div className="space-y-2">
                  {sections.map((section) => (
                    <div
                      key={section.index}
                      className={`rounded-lg border p-3 cursor-pointer transition-colors hover:border-primary/50 ${
                        activeSection === section.title ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => handleRegenerateSection(section.title)}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium">{section.title}</h3>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={regenerating}
                        >
                          {regenerating && activeSection === section.title ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <RefreshCw className="size-3" />
                          )}
                        </Button>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {section.content.substring(0, 150)}...
                      </p>
                    </div>
                  ))}
                  {sections.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <Sparkles className="size-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">Aucune section détectée</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
