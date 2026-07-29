// ==================== Project Types ====================

export interface ProjectWithDetails {
  id: string;
  userId: string;
  title: string;
  brief: string | null;
  academicLevel: string;
  university: string | null;
  field: string | null;
  status: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    documents: number;
    summaries: number;
    reports: number;
    jobs: number;
  };
  latestReport?: {
    id: string;
    title: string;
    status: string;
    createdAt: Date;
  } | null;
}

export interface ProjectFull {
  id: string;
  userId: string;
  title: string;
  brief: string | null;
  academicLevel: string;
  university: string | null;
  field: string | null;
  status: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
  documents: DocumentItem[];
  summaries: SummaryItem[];
  reports: ReportItem[];
  jobs: GenerationJobItem[];
}

// ==================== Document Types ====================

export interface DocumentItem {
  id: string;
  projectId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  status: string;
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Summary Types ====================

export interface SummaryItem {
  id: string;
  projectId: string;
  version: number;
  content: string;
  structure: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SummaryStructure {
  title: string;
  keyPoints: string[];
  methodology: string;
  findings: string[];
  gaps: string[];
}

// ==================== Report Types ====================

export interface ReportItem {
  id: string;
  projectId: string;
  summaryId: string | null;
  title: string;
  content: string;
  sections: string;
  status: string;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportSection {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'generating' | 'completed' | 'failed';
  order: number;
}

// ==================== Generation Job Types ====================

export interface GenerationJobItem {
  id: string;
  userId: string;
  projectId: string;
  type: string;
  status: string;
  progress: number;
  progressMessage: string;
  outputData: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== User Types ====================

export interface UserWithStats {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  tier: string;
  creditsUsed: number;
  creditsLimit: number;
  createdAt: Date;
  updatedAt: Date;
  usageStats: UsageStats;
}

export interface UsageStats {
  totalProjects: number;
  totalDocuments: number;
  totalReports: number;
  totalCreditsUsed: number;
  creditsRemaining: number;
  thisMonthUsage: number;
}

// ==================== Pricing Types ====================

export interface PricingTier {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: string;
  credits: number;
  features: string[];
  recommended?: boolean;
}

// ==================== Request/Response Body Types ====================

export interface CreateProjectBody {
  title: string;
  brief?: string;
  academicLevel?: string;
  university?: string;
  field?: string;
  language?: string;
}

export interface UpdateProjectBody {
  title?: string;
  brief?: string;
  academicLevel?: string;
  university?: string;
  field?: string;
  status?: string;
}

export interface UploadDocumentBody {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  content: string;
}

export interface RegenerateSectionBody {
  sectionId: string;
  instructions?: string;
}

export interface ExportReportBody {
  format: 'docx' | 'pdf';
}

export interface UpdateReportBody {
  content?: string;
  sectionId?: string;
  sectionContent?: string;
}

// ==================== Demo Content ====================

export const DEMO_FRENCH_TOPICS = [
  "L'intelligence artificielle dans la santé",
  "La blockchain et la finance décentralisée",
  "Le cloud computing et les architectures microservices",
  "L'Internet des Objets (IoT) dans l'agriculture",
  "La cybersécurité dans les systèmes critiques",
  "Le machine learning pour la prédiction financière",
  "Les systèmes distribués et le computing en grille",
  "Le traitement du langage naturel pour l'analyse de sentiment",
  "La vision par ordinateur dans les véhicules autonomes",
  "L'énergie renouvelable et les smart grids",
];

export function generateFrenchSummary(topic: string): string {
  return `# Synthèse Bibliographique : ${topic}

## Contexte et Problématique

Le domaine de ${topic.toLowerCase()} connaît un essor remarquable ces dernières années. Les avancées technologiques rapides ont transformé les paradigmes traditionnels et ouvert de nouvelles perspectives de recherche. Cette étude s'inscrit dans un contexte où les organisations cherchent à adopter des solutions innovantes pour améliorer leurs processus et répondre aux défis contemporains.

La problématique centrale de ce travail s'articule autour de l'optimisation et de l'intégration de ces technologies dans les systèmes existants, tout en tenant compte des contraintes de performance, de sécurité et de scalabilité.

## Revue de la Littérature

### Travaux Fondamentaux

Les travaux pionniers de plusieurs chercheurs ont posé les bases théoriques de ce domaine. Smith et al. (2021) ont démontré l'importance d'une approche méthodique dans l'implémentation de ces technologies, en soulignant les gains de performance significatifs obtenus par l'adoption de meilleures pratiques.

Martin et Dubois (2022) ont proposé un cadre d'analyse complet permettant d'évaluer l'efficacité des solutions existantes. Leur approche combine des métriques quantitatives et qualitatives pour une évaluation holistique.

### État de l'Art Récent

Les développements récents mettent en évidence une convergence vers des architectures plus modulaires et résilientes. L'approche par microservices, combinée aux paradigmes DevOps, permet une meilleure gestion du cycle de vie des applications.

Les études empiriques menées par Chen et al. (2023) ont révélé que l'adoption de ces technologies entraîne une amélioration moyenne de 35% de la productivité des équipes de développement, tout en réduisant les temps de mise sur le marché de 40%.

## Lacunes Identifiées

L'analyse de la littérature existante révèle plusieurs lacunes importantes :

1. **Manque de documentation** sur les aspects de migration depuis les systèmes legacy
2. **Absence de métriques standardisées** pour l'évaluation de la performance
3. **Besoins non satisfaits** en matière d'outils de monitoring et d'observabilité
4. **Complexité sous-estimée** de l'intégration dans les environnements hétérogènes

## Pistes de Recherche

Cette synthèse identifie plusieurs pistes de recherche prometteuses qui seront explorées dans le cadre de ce projet, notamment l'optimisation des architectures existantes, le développement de nouveaux outils de gestion et la validation empirique des approches proposées.`;
}

export function generateFrenchReportSections(topic: string): ReportSection[] {
  return [
    {
      id: 'introduction',
      title: 'Introduction',
      content: `L'introduction de ce rapport présente le contexte général de l'étude portant sur ${topic.toLowerCase()}. Dans un monde en constante évolution technologique, ce domaine représente un enjeu majeur pour les organisations publiques et privées.

L'objectif principal de ce travail est de proposer une approche méthodologique rigoureuse pour l'analyse et l'implémentation de solutions innovantes dans ce domaine. Nous examinerons les fondements théoriques, les méthodologies existantes, et nous proposerons une contribution originale basée sur une étude de cas approfondie.

Ce rapport est structuré en plusieurs sections : après cette introduction, nous présenterons le cadre théorique, suivi de la méthodologie adoptée, puis les résultats obtenus, avant de conclure avec une discussion des implications et des perspectives futures.`,
      status: 'completed',
      order: 0,
    },
    {
      id: 'chapitre1',
      title: 'Chapitre 1 : Cadre Théorique et État de l\'Art',
      content: `## 1.1 Fondements Théoriques

Le cadre théorique de cette étude repose sur plusieurs concepts fondamentaux issus de la littérature académique. Les théories des systèmes complexes et de l'ingénierie logicielle constituent les piliers de notre approche.

### 1.1.1 Concepts de Base

Les concepts fondamentaux qui sous-tendent ${topic.toLowerCase()} sont multiples et interconnectés. L'approche systémique permet de comprendre les interactions entre les différents composants et de modéliser les comportements émergents du système global.

La modélisation formelle des processus métier, associée aux techniques d'architecture logicielle, offre un cadre rigoureux pour la conception de solutions adaptées aux besoins spécifiques de chaque organisation.

### 1.1.2 Travaux Antérieurs

Les travaux de recherche antérieurs dans ce domaine ont établi des fondations solides sur lesquelles notre étude s'appuie. Les contributions majeures incluent :

- **Architecture de référence** : Modèles conceptuels permettant de structurer les solutions
- **Méthodologies d'évaluation** : Critères et indicateurs de performance
- **Bonnes pratiques** : Standards de qualité et de conformité

## 1.2 État de l'Art

L'état de l'art dans le domaine de ${topic.toLowerCase()} révèle une évolution significative au cours de la dernière décennie. Les avancées en matière de computing, de connectivité et d'algorithmique ont ouvert de nouvelles possibilités qui redéfinissent les frontières de ce champ de recherche.

Les approches modernes privilégient la modularité, la résilience et l'évolutivité. L'adoption de paradigmes tels que le cloud-native, le serverless et l'intelligence artificielle distribuée témoigne de cette tendance.`,
      status: 'completed',
      order: 1,
    },
    {
      id: 'chapitre2',
      title: 'Chapitre 2 : Méthodologie',
      content: `## 2.1 Démarche Méthodologique

La méthodologie adoptée pour cette étude repose sur une approche mixte combinant une recherche bibliographique systématique et une étude de cas pratique. Cette démarche permet de confronter les résultats théoriques aux réalités du terrain.

### 2.1.1 Recherche Bibliographique

La revue de littérature a été conduite suivant les principes de la méthodologie PRISMA. Les bases de données consultées incluent IEEE Xplore, ACM Digital Library, ScienceDirect et Google Scholar. Les critères de sélection ont été définis de manière à inclure les publications pertinentes des cinq dernières années.

### 2.1.2 Collecte et Analyse des Données

Les données ont été collectées à travers plusieurs canaux : entretiens semi-directifs avec des experts du domaine, analyse de projets open source, et observation participante. L'analyse thématique a été réalisée à l'aide d'un codage inductif et déductif.

## 2.2 Architecture de la Solution Proposée

L'architecture proposée s'articule autour de trois couches principales :

1. **Couche de données** : Gestion du stockage, de l'indexation et de la récupération des informations
2. **Couche de traitement** : Moteurs d'analyse, de transformation et de génération de contenu
3. **Couche de présentation** : Interfaces utilisateur et APIs d'intégration

Cette architecture modulaire facilite l'évolutivité et la maintenance du système, tout en respectant les principes de séparation des responsabilités.`,
      status: 'completed',
      order: 2,
    },
    {
      id: 'chapitre3',
      title: 'Chapitre 3 : Résultats et Analyse',
      content: `## 3.1 Présentation des Résultats

Les résultats obtenus dans le cadre de cette étude démontrent la pertinence de l'approche proposée. Les expérimentations menées sur un ensemble de cas d'usage réels ont permis de valider les hypothèses formulées.

### 3.1.1 Résultats Quantitatifs

L'analyse statistique des données recueillies révèle des améliorations significatives dans plusieurs dimensions :

- **Gain de productivité** : Amélioration de 38% par rapport aux approches traditionnelles
- **Réduction des erreurs** : Diminution de 52% des incidents critiques
- **Temps de réponse** : Accélération de 45% des processus de traitement
- **Satisfaction utilisateur** : Score de satisfaction de 4.2/5 en moyenne

### 3.1.2 Résultats Qualitatifs

Les retours qualitatifs des utilisateurs et des experts confirment les tendances observées dans les données quantitatives. La facilité d'utilisation et la flexibilité du système sont particulièrement appréciées.

## 3.2 Discussion

Les résultats obtenus sont cohérents avec les travaux antérieurs, tout en apportant des contributions originales. L'approche modulaire proposée permet une adaptation flexible aux besoins spécifiques de chaque contexte d'utilisation.

Les limites de cette étude concernent principalement la taille de l'échantillon et la diversité des contextes testés. Des travaux futurs permettront de valider les résultats sur un périmètre plus large.`,
      status: 'completed',
      order: 3,
    },
    {
      id: 'conclusion',
      title: 'Conclusion et Perspectives',
      content: `## Synthèse des Contributions

Ce rapport a présenté une étude approfondie sur ${topic.toLowerCase()}, couvrant les aspects théoriques, méthodologiques et pratiques de ce domaine. Les contributions principales de ce travail sont les suivantes :

1. **État de l'art actualisé** : Une revue comprehensive de la littérature récente, intégrant les dernières avancées du domaine
2. **Méthodologie rigoureuse** : Un cadre d'analyse reproductible et adapté aux problématiques de recherche actuelles
3. **Résultats empiriques** : Des données quantitatives et qualitatives validant l'approche proposée
4. **Recommandations pratiques** : Des directives actionnables pour les praticiens et les décideurs

## Perspectives de Recherche

Plusieurs perspectives de recherche se dégagent de ce travail :

- **Étude longitudinale** : Suivre l'évolution des pratiques et des performances sur une période prolongée
- **Extension multi-domaines** : Appliquer la méthodologie à d'autres secteurs et contextes culturels
- **Intelligence artificielle** : Explorer l'intégration de modèles d'IA avancés pour automatiser certains processus
- **Scalabilité** : Étudier les défis liés au passage à l'échelle de la solution proposée

## Conclusion

En conclusion, cette étude confirme le potentiel significatif de ${topic.toLowerCase()} comme domaine d'innovation et de création de valeur. Les résultats obtenus ouvrent la voie à de nouvelles recherches et applications pratiques dans ce domaine en pleine évolution.`,
      status: 'completed',
      order: 4,
    },
  ];
}
