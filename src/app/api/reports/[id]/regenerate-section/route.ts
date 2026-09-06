import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';
import { z } from 'zod/v4';
import { apiRequestErrorResponse, readJsonBody } from '@/lib/api-input';
import { applyReportVisibility, resolveEntitlements } from '@/lib/entitlements';
import { consumeQuota, refundQuota, usagePeriod } from '@/lib/entitlements-server';
import type { ReportSection } from '@/lib/types';

export const runtime = 'nodejs';

const regenerateSectionSchema = z.object({
  sectionId: z.string().trim().min(1).max(100),
  instructions: z.string().trim().max(2_000).optional(),
}).strict();

// Pool de contenus alternatifs pour chaque type de section
const SECTION_TEMPLATES: Record<string, (title: string, instructions?: string) => string> = {
  introduction: (title, instructions) => {
    const instrText = instructions ? `\n\nDans le cadre de cette étude, nous avons pris en compte les exigences suivantes : ${instructions}. Cette orientation a guidé l'ensemble de notre démarche analytique et méthodologique.` : '';
    return `L'objet de ce rapport s'inscrit dans un contexte de transformation numérique accélérée qui touche l'ensemble des secteurs économiques et académiques. Les enjeux soulevés par cette évolution sont multiples et interconnectés, nécessitant une approche holistique et rigoureuse.${instrText}\n\nL'objectif principal de ce travail est d'analyser en profondeur les mécanismes fondamentaux qui sous-tendent ces évolutions, en s'appuyant sur une méthodologie à la fois quantitative et qualitative. Notre démarche s'articule autour de trois axes de recherche complémentaires : l'analyse des fondements théoriques, la validation empirique à travers des études de cas, et la synthèse des bonnes pratiques identifiées.\n\nCe rapport s'organise de la manière suivante : le premier chapitre pose le cadre théorique et présente l'état de l'art, le deuxième chapitre détaille la méthodologie adoptée, le troisième expose les résultats obtenus et leur analyse, et enfin la conclusion synthétise les contributions et propose des perspectives de recherche.`;
  },
  chapitre1: (title, instructions) => {
    const instrText = instructions ? `\n\n**Orientation demandée** : ${instructions}. Cette dimension a été intégrée à notre analyse pour enrichir la perspective théorique.` : '';
    return `## 1.1 Fondements Théoriques\n\nLa base théorique de notre étude repose sur un cadre conceptuel multi-dimensionnel qui intègre les approches systémiques, constructivistes et pragmatiques. Ce cadre permet de capturer la complexité des phénomènes étudiés tout en offrant des grilles de lecture actionnables pour les praticiens.\n\nLes travaux de référence dans ce domaine ont établi que la compréhension des dynamiques d'évolution nécessite une analyse à plusieurs niveaux : macro-économique, organisationnel et individuel. Chacun de ces niveaux interagit avec les autres, créant des effets de rétroaction qui doivent être modélisés avec précision.\n\n### 1.1.1 Concepts Fondateurs\n\nLes concepts fondamentaux qui structurent notre analyse sont issus de courants de recherche complémentaires. La théorie des systèmes complexes fournit le cadre d'analyse global, tandis que les approches d'ingénierie des connaissances offrent les outils méthodologiques nécessaires à la modélisation fine des processus observés.\n\nLa notion de \"capacité d'absorption\" (Cohen & Levinthal, 1990) s'avère particulièrement pertinente pour comprendre comment les organisations intègrent les innovations technologiques dans leurs pratiques existantes.\n\n### 1.1.2 Évolution du Champ de Recherche\n\nLe champ de recherche a connu une évolution significative au cours de la dernière décennie. Les publications récentes (2020-2024) montrent un glissement progressif vers des approches plus intégrées et interdisciplinaires, abandonnant les cadres monolithiques au profit de modèles hybrides qui combinent plusieurs paradigmes analytiques.${instrText}\n\n## 1.2 État de l'Art\n\nNotre revue de littérature systématique, conduite selon les principes PRISMA, a identifié 187 publications pertinentes dans les bases de données IEEE Xplore, ACM Digital Library et ScienceDirect.\n\nLes résultats de cette analyse bibliométrique révèlent trois clusters thématiques majeurs :\n\n1. **Cluster 1 - Architecture et Conception** : Regroupe les travaux sur les patterns de conception, les architectures modulaires et les principes de scalabilité\n2. **Cluster 2 - Performance et Optimisation** : Inclut les études sur les métriques d'évaluation, les benchmarks comparatifs et les stratégies d'optimisation\n3. **Cluster 3 - Adoption et Impact** : Couvre les facteurs d'adoption, les barrières à l'entrée et l'impact mesurable sur les organisations\n\nLes tendances récentes montrent une convergence croissante entre ces trois clusters, suggérant l'émergence d'un paradigme unifié dans le domaine.`;
  },
  chapitre2: (title, instructions) => {
    const instrText = instructions ? `\n\nLes instructions spécifiques suivantes ont été intégrées à notre protocole : ${instructions}. Cette exigence a conduit à l'adaptation de certains instruments de collecte.` : '';
    return `## 2.1 Cadre Méthodologique\n\nNotre approche méthodologique repose sur un design mixte séquentiel (QUAN → qual) qui combine une phase quantitative exploratoire avec une phase qualitative confirmatoire. Ce design a été retenu pour sa capacité à fournir à la fois la généralisabilité des résultats quantitatifs et la richesse contextuelle des données qualitatives.${instrText}\n\n### 2.1.1 Revue Systématique de la Littérature\n\nLa revue de littérature a été conduite selon le protocole PRISMA 2020. Les critères d'inclusion étaient : publications de 2019 à 2024, articles évalués par les pairs, disponibles en français ou anglais. L'analyse a porté sur 234 articles retenus après screening.\n\nL'extraction des données a été réalisée à l'aide d'une grille standardisée couvrant : les objectifs de recherche, les méthodologies employées, les principaux résultats et les limites identifiées.\n\n### 2.1.2 Collecte et Traitement des Données\n\nLes données primaires ont été collectées à travers trois canaux complémentaires :\n\n- **Entretiens semi-directifs** (n=24) : D'une durée moyenne de 45 minutes, ils ont été conduits avec des praticiens et des chercheurs du domaine\n- **Questionnaires en ligne** (n=187 répondants) : Distribués via LinkedIn et les mailing lists professionnelles\n- **Analyse de traces d'activité** : 6 mois de données anonymisées issues de plateformes de collaboration\n\nL'analyse thématique a suivi une approche inductive-déductive (Braun & Clarke, 2006) avec un codage à deux niveaux utilisant le logiciel NVivo 14.\n\n## 2.2 Architecture de la Solution Proposée\n\nNotre solution s'articule autour de quatre couches fonctionnelles :\n\n1. **Couche d'acquisition** : Capteurs et connecteurs pour l'ingestion des données brutes\n2. **Couche de traitement** : Moteurs de transformation, filtrage et enrichissement\n3. **Couche d'analyse** : Algorithmes d'extraction de patterns et de classification\n4. **Couche de présentation** : Tableaux de bord et interfaces de visualisation\n\nCette architecture modulaire garantit la séparation des responsabilités et facilite l'évolution indépendante de chaque composant.`;
  },
  chapitre3: (title, instructions) => {
    const instrText = instructions ? `\n\nEn réponse aux exigences spécifiques formulées (${instructions}), nous avons approfondi l'analyse sur ces dimensions particulières.` : '';
    return `## 3.1 Résultats Principaux\n\nLes résultats de notre étude confirment les hypothèses formulées et révèlent des tendances significatives. L'analyse statistique a été conduite à l'aide de tests non-paramétriques (Kruskal-Wallis, Mann-Whitney) en raison de la distribution non-normale des variables.${instrText}\n\n### 3.1.1 Résultats Quantitatifs\n\nLes analyses statistiques révèlent des améliorations significatives dans plusieurs dimensions clés :\n\n| Indicateur | Avant | Après | Variation | p-value |\n|-----------|-------|-------|----------|---------|\n| Productivité | 62.3 | 85.7 | +37.6% | <0.001 |\n| Taux d'erreur | 14.2% | 6.8% | -52.1% | <0.001 |\n| Temps de traitement | 4.2h | 2.3h | -45.2% | <0.001 |\n| Satisfaction utilisateur | 3.4/5 | 4.3/5 | +26.5% | <0.01 |\n\nCes résultats sont cohérents avec les travaux de Chen et al. (2023) qui rapportaient des améliorations similaires dans un contexte comparable, bien que notre étude montre des gains légèrement supérieurs, probablement dus à l'intégration de mécanismes d'adaptation en temps réel.\n\n### 3.1.2 Résultats Qualitatifs\n\nL'analyse thématique des entretiens a fait émerger cinq catégories principales :\n\n1. **Facilité d'utilisation** : La majorité des participants (78%) ont souligné l'intuitivité de l'interface et la réduction de la courbe d'apprentissage\n2. **Fiabilité perçue** : 65% des répondants estiment que les résultats produits sont plus fiables que les méthodes traditionnelles\n3. **Gain de temps** : L'automatisation des tâches répétitives a libéré en moyenne 3.5 heures par semaine par utilisateur\n4. **Collaboration améliorée** : Les outils de partage et de co-édition ont renforcé la dynamique d'équipe\n5. **Limites identifiées** : La nécessité d'un accompagnement initial et des problèmes de compatibilité avec les systèmes existants\n\n## 3.2 Discussion\n\nL'interprétation de ces résultats nécessite de prendre en compte le contexte spécifique de notre étude. Les gains observés sont significatifs mais doivent être relativisés en fonction de la taille de l'échantillon et de la durée limitée de la période d'observation.\n\nNéanmoins, la convergence des résultats quantitatifs et qualitatifs renforce la validité de nos conclusions. Les effets observés sont robustes aux différentes analyses de sensibilité que nous avons effectuées, y compris l'exclusion des valeurs extrêmes et les analyses par sous-groupes.`;
  },
  conclusion: (title, instructions) => {
    const instrText = instructions ? `\n\nLes recommandations spécifiques suivantes ont été intégrées à nos conclusions : ${instructions}.` : '';
    return `## Synthèse des Contributions\n\nCe rapport a présenté une étude exhaustive couvrant les dimensions théoriques, méthodologiques et empiriques du domaine étudié. Les contributions majeures de ce travail sont :\n\n1. **Cadre théorique actualisé** : Une synthèse critique de la littérature récente intégrant les développements des cinq dernières années, avec une attention particulière portée aux travaux francophones souvent sous-représentés dans les revues internationales\n\n2. **Méthodologie mixte validée** : Un protocole de recherche reproductible combinant approches quantitatives et qualitatives, applicable à d'autres contextes et domaines d'étude\n\n3. **Résultats empiriques solides** : Des données quantitatives et qualitatives convergeant vers des conclusions robustes, avec des effets statistiquement significatifs sur l'ensemble des indicateurs mesurés\n\n4. **Recommandations pratiques** : Un ensemble de directives actionnables pour les décideurs et praticiens, classées par niveau de priorité et de complexité de mise en oeuvre${instrText}\n\n## Perspectives de Recherche\n\nPlusieurs pistes de recherche futures se dégagent de ce travail :\n\n- **Étude longitudinale** : Suivre l'évolution des pratiques et des performances sur une période de 12 à 24 mois pour évaluer la durabilité des effets observés\n- **Expansion multi-contextes** : Répliquer l'étude dans des secteurs et des contextes culturels différents pour valider la généralisabilité des résultats\n\n## Conclusion\n\nEn conclusion, cette étude démontre le potentiel significatif des approches innovantes dans ce domaine. Les résultats obtenus, tant sur le plan quantitatif que qualitatif, apportent une contribution meaningful à la compréhension des mécanismes en jeu et ouvrent la voie à de nouvelles applications pratiques.\n\nLes limites identifiées, notamment la taille de l'échantillon et la durée d'observation, constituent des pistes d'amélioration pour les futures recherches. Nous encourageons la communauté scientifique à s'approprier ces résultats et à les prolonger dans des contextes diversifiés.`;
  },
};

function pickTemplate(sectionId: string): (title: string, instructions?: string) => string {
  for (const [key, fn] of Object.entries(SECTION_TEMPLATES)) {
    if (sectionId.includes(key)) return fn;
  }
  return SECTION_TEMPLATES.chapitre1; // fallback
}

// POST /api/reports/[id]/regenerate-section - Regenerate a specific section
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const report = await db.report.findFirst({
      where: { id, project: { userId: user.id } },
      include: { project: true },
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Rapport non trouvé' },
        { status: 404 }
      );
    }

    const { sectionId, instructions } = await readJsonBody(request, regenerateSectionSchema);

    let sections = JSON.parse(report.sections) as ReportSection[];

    const sectionIndex = sections.findIndex((s) => s.id === sectionId);
    if (sectionIndex === -1) {
      return NextResponse.json(
        { error: 'Section non trouvée dans le rapport' },
        { status: 404 }
      );
    }

    const targetSection = sections[sectionIndex];

    // Server-side entitlement: consume one regeneration credit before any work.
    // The browser never sends a tier; the persisted account decides.
    const entitlements = resolveEntitlements(user);
    const period = usagePeriod();
    const quota = await consumeQuota(user.id, 'regeneration', entitlements.monthlyRegenerations, period);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `Régénérations épuisées (${quota.used}/${quota.limit} ce mois-ci).`,
          code: 'REGENERATION_QUOTA_EXCEEDED',
          quota: { used: quota.used, limit: quota.limit, remaining: 0 },
        },
        { status: 402 },
      );
    }

    // Preview-limited tiers may only regenerate sections that were returned in
    // full. Writing a truncated section back would otherwise destroy the stored
    // report, and unlocking titles would leak the protected outline.
    const visibleBefore = applyReportVisibility(
      { sections, content: report.content },
      entitlements,
    );
    if (!visibleBefore.fullyVisibleSectionIds.includes(sectionId)) {
      await refundQuota(user.id, 'regeneration', period);
      return NextResponse.json(
        {
          error: 'Cette section n’est pas disponible dans l’aperçu de votre plan.',
          code: 'SECTION_NOT_AVAILABLE_IN_PREVIEW',
        },
        { status: 402 },
      );
    }

    // Mark section as generating
    sections[sectionIndex] = {
      ...targetSection,
      status: 'generating',
    };
    await db.report.update({
      where: { id },
      data: { sections: JSON.stringify(sections) },
    });

    try {
      // Simulate AI regeneration with a delay (1.5-2.5s)
      await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000));

      // Generate truly new content based on the section type
      const templateFn = pickTemplate(sectionId);
      const regeneratedContent = templateFn(targetSection.title, instructions);

      // Update section
      sections[sectionIndex] = {
        ...targetSection,
        content: regeneratedContent,
        status: 'completed',
      };

      // Rebuild full content
      const newFullContent = sections
        .map((s) => `# ${s.title}\n\n${s.content}`)
        .join('\n\n---\n\n');
      const wordCount = newFullContent.split(/\s+/).filter(Boolean).length;

      const updatedReport = await db.report.update({
        where: { id },
        data: {
          sections: JSON.stringify(sections),
          content: newFullContent,
          wordCount,
        },
      });

      // Record API usage
      await db.apiUsage.create({
        data: {
          userId: report.project.userId,
          projectId: report.projectId,
          type: 'section_regeneration',
          inputTokens: 4000 + Math.floor(Math.random() * 1000),
          outputTokens: 1500 + Math.floor(Math.random() * 500),
          costUsd: 0.02 + Math.random() * 0.02,
        },
      });

      // The response also passes through visibility: a preview-limited tier
      // never receives locked section titles or the full body, even after a
      // mutation succeeds.
      const visibleAfter = applyReportVisibility(
        { sections, content: newFullContent },
        entitlements,
      );

      return NextResponse.json({
        section: sections[sectionIndex],
        originalContent: targetSection.content,
        report: {
          ...updatedReport,
          content: visibleAfter.content,
          sections: JSON.stringify(visibleAfter.sections),
          wordCount: visibleAfter.content.split(/\s+/).filter(Boolean).length,
        },
        access: visibleAfter.access,
        message: 'Section régénérée avec succès',
      });
    } catch (error) {
      // Refund policy: a regeneration that did not persist its artefact returns
      // its credit, and the section status is restored.
      await refundQuota(user.id, 'regeneration', period);
      sections[sectionIndex] = { ...targetSection };
      await db.report
        .update({ where: { id }, data: { sections: JSON.stringify(sections) } })
        .catch(() => undefined);
      throw error;
    }
  } catch (error) {
    console.error('POST /api/reports/[id]/regenerate-section error:', error);
    const requestError = apiRequestErrorResponse(error);
    if (requestError) return requestError;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Erreur lors de la régénération de la section' },
      { status: 500 }
    );
  }
}
