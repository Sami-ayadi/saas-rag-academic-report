# RAG Report — Plateforme SaaS de Génération de Rapports Académiques

<p align="center">
  <strong>Pipeline RAG intelligent pour la synthèse documentaire et la génération de rapports académiques structurés</strong><br/>
  <em>Importez vos sources, laissez l'IA synthétiser, éditez et exportez.</em>
</p>

---

## 📋 Table des matières

- [Vue d'ensemble](#-vue-densemble)
- [Architecture technique](#-architecture-technique)
- [Stack technique](#-stack-technique)
- [Structure du projet](#-structure-du-projet)
- [Installation et configuration](#-installation-et-configuration)
- [Base de données](#-base-de-donnees)
- [Vues de l'application](#-vues-de-lapplication)
- [API Routes](#-api-routes)
- [Pipeline RAG (flux utilisateur)](#-pipeline-rag-flux-utilisateur)
- [Bonnes pratiques](#-bonnes-pratiques)
- [Tests et vérification](#-tests-et-verification)
- [Déploiement](#-deploiement)
- [Contribuer](#-contribuer)

---

## 🎯 Vue d'ensemble

**RAG Report** est une application SaaS destinée aux chercheurs, étudiants et professionnels qui doivent produire des rapports académiques de qualité à partir de documents sources. Le système utilise un pipeline **RAG (Retrieval-Augmented Generation)** pour :

1. **Ingestion de documents** — L'utilisateur uploade des PDF, articles, notes de recherche.
2. **Synthèse intelligente** — Le système analyse, chunk et génère une synthèse structurée des sources.
3. **Génération de rapport** — Un rapport académique complet est produit (Introduction, Cadre théorique, Méthodologie, Résultats, Conclusion).
4. **Édition et régénération** — L'utilisateur peut éditer chaque section et demander à l'IA de régénérer avec des instructions spécifiques (vue split avec diff).
5. **Export** — Le rapport final est exportable en PDF ou DOCX.

### Public cible

| Profil | Usage typique |
|--------|---------------|
| Étudiants Master/Doctorat | Rédaction de mémoires et thèses |
| Chercheurs académiques | Revues de littérature et synthèses bibliographiques |
| Équipes R&D | Rapports d'analyse et veille technologique |

---

## 🏗️ Architecture technique

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ 7 Vues   │  │  Composants  │  │  Zustand Store    │  │
│  │ (SPA)    │  │  shadcn/ui   │  │  (navigation)     │  │
│  └────┬─────┘  └──────┬───────┘  └───────┬───────────┘  │
│       └────────────────┼──────────────────┘              │
│                        ▼                                  │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              12 API Routes (App Router)             │ │
│  └──────────────────────┬──────────────────────────────┘ │
└─────────────────────────┼────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Backend (Next.js API)                  │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Prisma   │  │  Pipeline    │  │  Seed Data        │  │
│  │ ORM      │  │  RAG (sim.)  │  │  (démo)           │  │
│  └────┬─────┘  └──────────────┘  └───────────────────┘  │
│       ▼                                                  │
│  ┌──────────┐                                           │
│  │ SQLite   │                                           │
│  │ (prod)   │                                           │
│  └──────────┘                                           │
└─────────────────────────────────────────────────────────┘
```

### Architecture SPA avec Zustand

L'application fonctionne en **mode SPA (Single Page Application)** : une seule route Next.js (`/`) gère l'ensemble de la navigation. Les vues sont commutées côté client via un **store Zustand** (`useAppStore`). Ce pattern offre :

- Des transitions fluides entre les vues (Framer Motion `AnimatePresence`)
- Pas de rechargement de page lors de la navigation
- Un state management centralisé et prévisible

```typescript
// Navigation entre vues
const { navigate } = useAppStore()
navigate('report-editor', projectId, reportId)
```

---

## 🛠️ Stack technique

| Catégorie | Technologie | Version | Rôle |
|-----------|-------------|---------|------|
| Framework | Next.js (App Router) | 16.x | Framework fullstack React |
| Langage | TypeScript | 5.x | Typage statique |
| Styles | Tailwind CSS | 4.x | Utilitaires CSS |
| UI | shadcn/ui | latest | Composants accessibles (Radix) |
| State | Zustand | 5.x | Navigation SPA / state client |
| ORM | Prisma | 6.x | Accès base de données |
| Base de données | SQLite | — | Stockage persistant |
| Validation | Zod | 4.x | Validation schémas (API & formulaires) |
| Animations | Framer Motion | 12.x | Transitions de vues |
| Notifications | Sonner | 2.x | Toasts |
| Forms | React Hook Form | 7.x | Gestion formulaires |
| Runtime | Bun | — | Runtime JavaScript rapide |

---

## 📁 Structure du projet

```
my-project/
├── prisma/
│   └── schema.prisma          # Schéma BDD (9 modèles, 3 enums)
├── db/
│   ├── custom.db              # Base SQLite (générée)
│   └── seed.ts                # Données de démonstration
├── public/
│   ├── logo.svg               # Logo de l'application
│   └── robots.txt
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Layout racine (fonts, theme, toaster)
│   │   ├── page.tsx            # Point d'entrée SPA (toutes les vues)
│   │   ├── globals.css         # Styles globaux + variables CSS
│   │   └── api/                # 12 API routes
│   │       ├── user/route.ts
│   │       ├── pricing/route.ts
│   │       ├── seed/route.ts
│   │       ├── projects/
│   │       │   ├── route.ts                  # GET (liste) / POST (créer)
│   │       │   └── [id]/
│   │       │       ├── route.ts              # GET / PATCH (détail / maj)
│   │       │       ├── documents/route.ts    # GET / POST (docs)
│   │       │       ├── generate-summary/route.ts  # POST (lancer synthèse)
│   │       │       └── generate-report/route.ts   # POST (lancer génération)
│   │       ├── reports/
│   │       │   └── [id]/
│   │       │       ├── route.ts              # GET / PATCH
│   │       │       ├── regenerate-section/route.ts  # POST (régénérer section IA)
│   │       │       └── export/route.ts       # POST (exporter PDF/DOCX)
│   │       └── jobs/
│   │           └── [id]/route.ts              # GET (statut job)
│   ├── components/
│   │   ├── layout/             # Layout principal
│   │   │   ├── app-header.tsx
│   │   │   └── app-sidebar.tsx
│   │   ├── providers/
│   │   │   └── theme-provider.tsx
│   │   ├── ui/                 # ~40 composants shadcn/ui
│   │   └── views/              # 7 vues de l'application
│   │       ├── dashboard-view.tsx
│   │       ├── project-detail-view.tsx
│   │       ├── report-editor-view.tsx
│   │       ├── summary-editor-view.tsx
│   │       ├── new-project-view.tsx
│   │       ├── pricing-view.tsx
│   │       └── settings-view.tsx
│   ├── lib/
│   │   ├── db.ts               # Instance Prisma Client
│   │   ├── store.ts            # Store Zustand (navigation SPA)
│   │   ├── types.ts            # Interfaces TypeScript + templates contenu
│   │   ├── constants.ts        # Labels, couleurs, limites par tier
│   │   ├── utils.ts            # Utilitaire cn() (classnames)
│   │   └── seed.ts             # Logique de seed
│   └── hooks/
│       ├── use-toast.ts
│       └── use-mobile.ts
├── .env                        # DATABASE_URL
├── .gitignore
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.ts
```

---

## 🚀 Installation et configuration

### Prérequis

- **Node.js** >= 18 ou **Bun** >= 1.0
- **Git**
- Un terminal / IDE de votre choix (VS Code recommandé)

### Installation

```bash
# 1. Cloner le dépôt
git clone https://github.com/<ORG>/saas-rag-report.git
cd saas-rag-report

# 2. Installer les dépendances
bun install
# ou : npm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env et définir DATABASE_URL

# 4. Initialiser la base de données
bun run db:push
bun run db:generate

# 5 (optionnel). Charger les données de démonstration
# Via l'interface : cliquer le bouton "Charger les données démo" sur le Dashboard
# Ou via API : curl -X POST http://localhost:3000/api/seed

# 6. Lancer le serveur de développement
bun run dev
```

L'application est accessible sur **http://localhost:3000**.

### Variables d'environnement

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `DATABASE_URL` | URL de connexion SQLite | `file:./db/custom.db` |

> **Note** : En production, vous remplacerez SQLite par PostgreSQL et ajouterez les variables pour les API d'IA (Claude, Voyage AI) et Stripe.

---

## 🗄️ Base de données

### Schéma (Prisma)

Le schéma comporte **9 modèles** et **3 énumérations** :

```
┌──────────┐     ┌───────────┐     ┌─────────┐
│   User   │────<│  Project  │────<│ Document│
│          │     │           │     └─────────┘
│  tier    │     │  status   │     ┌─────────┐
│  credits │     │  language │     │ Summary │
└────┬─────┘     └─────┬─────┘     └────┬────┘
     │                 │                │
     │           ┌─────┴─────┐     ┌────┴────┐
     │           │   Report  │<────┘         │
     │           └───────────┘              │
     │                                       │
│  ┌──────────────┐  ┌──────────┐  ┌──────┴──┐
│  │  ApiUsage    │  │  Embedding│  │  Job   │
│  └──────────────┘  └──────────┘  └─────────┘
└─────────────────────────────────────────────┘
```

### Enums

| Enum | Valeurs | Usage |
|------|---------|-------|
| `Tier` | `FREE`, `STARTER`, `PRO` | Niveau d'abonnement utilisateur |
| `JobStatus` | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED` | Cycle de vie des jobs de génération |
| `ProjectStatus` | `DRAFT`, `SUMMARIZING`, `SUMMARY_READY`, `GENERATING`, `REPORT_READY`, `EXPORTED` | Pipeline de progression d'un projet |

### Commandes Prisma utiles

```bash
bun run db:push      # Appliquer le schéma à la BDD (destructif)
bun run db:generate  # Générer le client Prisma
bun run db:migrate   # Créer une migration
bun run db:reset     # Réinitialiser la BDD
```

---

## 🖥️ Vues de l'application

L'application comporte **7 vues principales**, toutes rendues dans le composant `page.tsx` via `AnimatePresence` et le store Zustand.

| # | Vue | Fichier | Description |
|---|-----|---------|-------------|
| 1 | **Dashboard** | `dashboard-view.tsx` | Vue d'accueil : statistiques, tableau des projets, bouton de seed |
| 2 | **Nouveau Projet** | `new-project-view.tsx` | Formulaire de création (titre, niveau académique, université, domaine, langue) |
| 3 | **Détail Projet** | `project-detail-view.tsx` | Pipeline visuel, 4 onglets (Documents, Résumés, Rapports, Jobs) |
| 4 | **Éditeur de Résumé** | `summary-editor-view.tsx` | Split-view : liste des résumés + éditeur markdown + diff |
| 5 | **Éditeur de Rapport** | `report-editor-view.tsx` | Split-view : sections (gauche) + inspecteur avec régénération IA et diff (droite) |
| 6 | **Tarification** | `pricing-view.tsx` | 3 cartes d'abonnement (Free/Starter/Pro) + FAQ |
| 7 | **Paramètres** | `settings-view.tsx` | Profil utilisateur, abonnement, clés API |

### Vue détaillée — Éditeur de Rapport

C'est la vue la plus complexe. Elle utilise `ResizablePanelGroup` pour un layout split :

- **Panneau gauche** : Liste des sections du rapport (Introduction, Chapitres 1-3, Conclusion)
- **Panneau droit** :
  - Titre de la section sélectionnée
  - Zone de texte pour les **instructions de modification**
  - Bouton **"Régénérer avec l'IA"**
  - **Vue diff** : comparaison visuelle contenu original vs contenu régénéré
  - Boutons pour accepter ou rejeter la régénération

---

## 🔌 API Routes

### Projets

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/projects` | Liste des projets (avec stats) |
| `POST` | `/api/projects` | Créer un nouveau projet |
| `GET` | `/api/projects/[id]` | Détail complet d'un projet |
| `PATCH` | `/api/projects/[id]` | Mettre à jour un projet |
| `GET` | `/api/projects/[id]/documents` | Liste des documents d'un projet |
| `POST` | `/api/projects/[id]/documents` | Uploader un document |
| `POST` | `/api/projects/[id]/generate-summary` | Lancer la génération de synthèse |
| `POST` | `/api/projects/[id]/generate-report` | Lancer la génération de rapport |

### Rapports

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/reports/[id]` | Récupérer un rapport complet |
| `PATCH` | `/api/reports/[id]` | Mettre à jour contenu/section |
| `POST` | `/api/reports/[id]/regenerate-section` | Régénérer une section avec l'IA |
| `POST` | `/api/reports/[id]/export` | Exporter en PDF ou DOCX |

### Autres

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/user` | Profil utilisateur + stats |
| `GET` | `/api/pricing` | Taux d'abonnement |
| `POST` | `/api/seed` | Charger les données de démo |
| `GET` | `/api/jobs/[id]` | Statut d'un job de génération |

---

## ⚙️ Pipeline RAG (flux utilisateur)

Le flux complet de l'application suit un pipeline en 5 étapes, chacune correspondant à un statut dans l'enum `ProjectStatus` :

```
  DRAFT ──► SUMMARIZING ──► SUMMARY_READY ──► GENERATING ──► REPORT_READY ──► EXPORTED
   │              │                │                │              │               │
   ▼              ▼                ▼                ▼              ▼               ▼
Création      Upload docs      Synthèse        Génération     Rapport        Export
projet        + Analyse        IA prête         du rapport     édité         PDF/DOCX
```

### Détail de chaque étape

1. **DRAFT** — L'utilisateur crée un projet via le formulaire (titre, niveau académique, université, domaine, langue). Les métadonnées sont stockées en BDD.

2. **SUMMARIZING** — Les documents sources sont uploadés (PDF, articles). Le système les chunk, génère des embeddings (Voyage AI), et produit une synthèse structurée via Claude AI.

3. **SUMMARY_READY** — La synthèse est disponible dans l'éditeur de résumé. L'utilisateur peut la consulter, la modifier, et lancer la génération du rapport.

4. **GENERATING → REPORT_READY** — Le rapport est généré section par section. L'utilisateur peut éditer chaque section, demander une régénération avec des instructions spécifiques, et comparer les versions (diff view).

5. **EXPORTED** — Le rapport final est exporté en PDF ou DOCX.

---

## ✅ Bonnes pratiques

### Conventions de code

| Aspect | Convention |
|--------|-----------|
| **Composants** | PascalCase, un composant par fichier, préfixe descriptif (`report-editor-view.tsx`) |
| **Typage** | Interfaces dans `src/lib/types.ts`, toujours typer les props et les réponses API |
| **API Routes** | Un fichier `route.ts` par endpoint, validation Zod des inputs |
| **State** | Navigation via Zustand (`useAppStore`), données serveur via React Query ou fetch natif |
| **Styles** | Tailwind CSS uniquement, pas de CSS custom sauf dans `globals.css` |
| **Imports** | Alias `@/` pour `src/`, regrouper les imports par catégorie |

### Architecture — ce qu'il faut faire

- **Garder le pattern SPA avec Zustand** pour la navigation : c'est cohérent avec le design de l'application et évite les rechargements de page. Ne pas migrer vers un routing multi-pages sauf si le besoin d'URLs profondes est avéré.
- **Séparer les préoccupations** : chaque vue dans son propre fichier, chaque API route dans son dossier. Ne pas mélanger logique métier et UI.
- **Typer tout** : ajouter des interfaces TypeScript pour toute nouvelle structure de données. Utiliser les types déjà définis dans `src/lib/types.ts`.
- **Valider les inputs API** avec Zod (cf. `export/route.ts` pour un exemple). Ne jamais faire confiance aux données entrantes.
- **Utiliser `src/lib/constants.ts`** pour tout mapping de labels, couleurs et limites. Ne pas hardcoder ces valeurs dans les composants.

### Architecture — à ajouter pour la production

| Composant | Pourquoi | Comment |
|-----------|----------|--------|
| **Authentification** | Sécuriser l'accès utilisateur | Intégrer NextAuth.js (déjà en dépendance) avec un provider OAuth (Google, GitHub) |
| **PostgreSQL** | SQLite ne scale pas en production | Changer `provider` dans `schema.prisma`, mettre à jour `DATABASE_URL` |
| **Claude API réelle** | Remplacer la simulation de génération | Appeler l'API Anthropic dans les routes `generate-summary` et `generate-report` |
| **Voyage AI embeddings** | Embeddings réels pour le RAG | Intégrer le SDK Voyage AI pour le chunking et l'embedding |
| **Stripe** | Paiement des abonnements | Utiliser `stripeCustomerId`, `stripePriceId`, `stripeSubId` du modèle User |
| **Upload de fichiers réels** | Stockage persistant | Ajouter S3/R2/Uploadthing pour le stockage des documents |
| **WebSocket / SSE** | Progression temps réel des jobs | Remplacer le polling par Server-Sent Events ou Socket.io |
| **Tests** | Fiabilité du code | Ajouter Vitest + Testing Library (cf. section Tests) |
| **Rate limiting** | Protéger les API | Middleware Next.js ou upstash/ratelimit |
| **i18n** | L'app est en français | `next-intl` est déjà en dépendance, configurer les locales |
| **Export réel PDF/DOCX** | Génération de fichiers | Utiliser `@react-pdf/renderer` ou `puppeteer` pour PDF, `docx` pour Word |

### Bonnes pratiques pour l'équipe Frontend

- **Ne pas dupliquer les composants shadcn/ui** : vérifier si un composant existe dans `src/components/ui/` avant d'en créer un nouveau.
- **Utiliser les composants de shadcn/ui** (`Button`, `Card`, `Badge`, `Dialog`, etc.) pour maintenir la cohérence visuelle.
- **Gérer les états de chargement** : utiliser `Skeleton` de shadcn/ui pour les données en cours de chargement.
- **Gérer les erreurs** : afficher des messages clairs avec `toast.error()` (sonner) en cas d'échec API.
- **Accessibilité** : shadcn/ui gère l'a11y via Radix, mais pensez aux `aria-label` sur les éléments interactifs custom.

### Bonnes pratiques pour l'équipe Backend / API

- **Toujours retourner des objets structurés** : `{ report: {...} }`, `{ projects: [...] }`, `{ error: "..." }`.
- **Codes HTTP corrects** : `200` (succès), `201` (créé), `400` (bad request), `404` (non trouvé), `500` (erreur serveur).
- **Envelopper les routes dans un try/catch** et logger les erreurs avec `console.error()`.
- **Utiliser `runtime = 'nodejs'`** pour les routes qui accèdent à la BDD (Prisma ne fonctionne pas en Edge Runtime).
- **Ne pas exposer de données sensibles** dans les réponses API (mots de passe, clés API complètes, etc.).

---

## 🧪 Tests et vérification

Cette section décrit comment **tester chaque use case** de l'application pour vérifier qu'elle fonctionne correctement.

### Prérequis

```bash
# Lancer le serveur de développement
bun run dev

# Dans un autre terminal, charger les données de démo
curl -X POST http://localhost:3000/api/seed
```

### Use Case 1 — Dashboard et navigation

**Objectif** : Vérifier que le Dashboard charge correctement et que la navigation fonctionne.

1. Ouvrir `http://localhost:3000`
2. ✅ La page Dashboard s'affiche avec les cartes de statistiques (Projets, Documents, Rapports, Crédits)
3. ✅ Le tableau des projets liste les projets de démo (4 projets attendus)
4. ✅ Cliquer sur un projet dans le tableau → la vue **Détail Projet** s'ouvre
5. ✅ Le sidebar gauche affiche les items de navigation
6. ✅ Cliquer sur chaque item du sidebar → la vue correspondante s'affiche avec animation

### Use Case 2 — Création de projet

**Objectif** : Vérifier le formulaire de création de projet.

1. Naviguer vers **Nouveau Projet** (via le sidebar ou le bouton "Nouveau projet")
2. ✅ Le formulaire s'affiche avec tous les champs (Titre, Niveau académique, Université, Domaine, Langue)
3. ✅ Soumettre le formulaire vide → des erreurs de validation apparaissent (Zod)
4. ✅ Remplir le titre (obligatoire) + sélectionner un niveau académique → soumettre
5. ✅ Le projet est créé, redirection vers le Dashboard ou le Détail du projet
6. ✅ Vérifier en BDD : `SELECT * FROM Project ORDER BY createdAt DESC LIMIT 1;`

### Use Case 3 — Pipeline de génération

**Objectif** : Vérifier le flux complet DRAFT → REPORT_READY.

1. Sur le Dashboard, cliquer sur un projet existant
2. ✅ La vue **Détail Projet** s'affiche avec le pipeline visuel en haut
3. ✅ L'onglet "Documents" liste les documents du projet
4. ✅ Cliquer sur "Générer la synthèse" → un job est créé avec le statut `PROCESSING`
5. ✅ Après quelques secondes, le statut passe à `COMPLETED` et le projet passe en `SUMMARY_READY`
6. ✅ L'onglet "Résumés" affiche la synthèse générée
7. ✅ Cliquer sur "Générer le rapport" → un nouveau job est créé
8. ✅ Après génération, le projet passe en `REPORT_READY`

### Use Case 4 — Éditeur de rapport (split-view)

**Objectif** : Vérifier l'éditeur de rapport, la régénération IA et la vue diff.

1. Depuis le Détail Projet, cliquer sur un rapport dans l'onglet "Rapports"
2. ✅ L'**Éditeur de Rapport** s'ouvre en mode split-view
3. ✅ Le panneau gauche liste les 5 sections (Introduction, Chapitre 1-3, Conclusion)
4. ✅ Cliquer sur une section → son contenu s'affiche dans le panneau droit
5. ✅ Saisir des instructions dans le champ texte (ex: "Ajouter plus de détails sur les méthodes quantitatives")
6. ✅ Cliquer sur **"Régénérer avec l'IA"**
7. ✅ Un indicateur de chargement apparaît pendant 1.5-2.5 secondes
8. ✅ La **vue diff** s'affiche : contenu original (gauche) vs contenu régénéré (droite)
9. ✅ Le contenu régénéré est **différent** de l'original et intègre les instructions
10. ✅ Cliquer sur **"Accepter"** → le nouveau contenu remplace l'ancien
11. ✅ Cliquer sur **"Rejeter"** → l'ancien contenu est conservé

### Use Case 5 — Éditeur de résumé

**Objectif** : Vérifier l'éditeur de résumé et le mode diff.

1. Depuis le Détail Projet, cliquer sur un résumé dans l'onglet "Résumés"
2. ✅ L'**Éditeur de Résumé** s'ouvre en mode split-view
3. ✅ Le contenu markdown du résumé s'affiche
4. ✅ Modifier le texte directement dans l'éditeur
5. ✅ Sauvegarder → les changements sont persistés en BDD

### Use Case 6 — Export de rapport

**Objectif** : Vérifier l'endpoint d'export.

```bash
# Via l'interface : cliquer sur le bouton d'export dans l'éditeur de rapport

# Ou via API :
curl -X POST http://localhost:3000/api/reports/<REPORT_ID>/export \
  -H "Content-Type: application/json" \
  -d '{"format": "pdf"}'
```

7. ✅ La réponse contient l'URL de téléchargement, le nom de fichier et les métadonnées
8. ✅ Le statut du projet passe à `EXPORTED`

### Use Case 7 — API Routes directes

**Objectif** : Tester les endpoints API directement avec `curl`.

```bash
# Liste des projets
curl http://localhost:3000/api/projects

# Détail d'un projet (remplacer <ID>)
curl http://localhost:3000/api/projects/<PROJECT_ID>

# Créer un projet
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"title":"Test API","academicLevel":"Master"}'

# Profil utilisateur
curl http://localhost:3000/api/user

# Taux de pricing
curl http://localhost:3000/api/pricing

# Statut d'un job
curl http://localhost:3000/api/jobs/<JOB_ID>

# Régénérer une section
curl -X POST http://localhost:3000/api/reports/<REPORT_ID>/regenerate-section \
  -H "Content-Type: application/json" \
  -d '{"sectionId":"introduction","instructions":"Rendre plus concis"}'
```

✅ Chaque endpoint doit retourner un code HTTP approprié et une réponse JSON structurée.

### Use Case 8 — Tarification et Paramètres

1. ✅ Cliquer sur "Tarification" dans le sidebar → les 3 cartes (Gratuit/Starter/Pro) s'affichent avec les fonctionnalités et prix
2. ✅ La FAQ est fonctionnelle (accordeon dépliable)
3. ✅ Cliquer sur "Paramètres" → le profil utilisateur s'affiche avec l'abonnement et la section clés API

### Use Case 9 — Thème et responsive

1. ✅ Cliquer sur le toggle dark/light dans le header → le thème change
2. ✅ Redimensionner la fenêtre du navigateur → le sidebar se replie sur mobile
3. ✅ Les vues s'adaptent à différentes largeurs d'écran

---

## 🚢 Déploiement

### Build de production

```bash
# Build
bun run build

# Lancer en production
bun run start
# Le serveur écoute sur le port 3000
```

### Déploiement recommandé

| Plateforme | Méthode |
|------------|--------|
| **Vercel** | `git push` → déploiement automatique (recommandé pour Next.js) |
| **Docker** | Utiliser le `Dockerfile` (à créer) avec `node:20-alpine` |
| **VPS** | Build + `bun run start` derrière un reverse proxy (Caddy/Nginx) |

### Configuration production

Avant de déployer en production :

1. Remplacer **SQLite** par **PostgreSQL** (`provider = "postgresql"` dans `schema.prisma`)
2. Ajouter les variables d'environnement pour les API d'IA (Claude, Voyage AI)
3. Configurer **Stripe** pour les paiements
4. Configurer un **stockage S3/R2** pour les uploads
5. Activer **NextAuth** avec un provider OAuth
6. Mettre en place le **rate limiting** et la gestion CORS

---

## 🤝 Contribuer

### Workflow de contribution

1. Forker le dépôt
2. Créer une branche feature : `git checkout -b feature/ma-fonctionnalite`
3. Commiter les changements : `git commit -m 'feat: ajouter ma fonctionnalite'`
4. Pusher : `git push origin feature/ma-fonctionnalite`
5. Ouvrir une Pull Request

### Convention de commits

Utiliser les [Conventional Commits](https://www.conventionalcommits.org/) :

```
feat: nouvelle fonctionnalité
fix: correction de bug
docs: documentation
style: formatage (pas de changement de logique)
refactor: refactoring
test: ajout de tests
chore: maintenance (dépendances, config)
```

---

<p align="center">
  <strong>RAG Report</strong> — Plateforme de Génération de Rapports Académiques<br/>
  Construit avec Next.js 16 · Tailwind CSS 4 · Prisma · shadcn/ui · Zustand
</p>
