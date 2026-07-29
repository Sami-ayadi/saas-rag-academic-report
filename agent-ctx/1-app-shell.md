# Task 1 - Application Shell

## Status: COMPLETED

## Files Created/Modified

### Core Theme & Config
- **`src/app/globals.css`** - Custom emerald/teal theme (oklch format) with light/dark mode support
  - Primary: emerald-teal (~oklch(0.55 0.15 165))
  - Accent: amber/gold (~oklch(0.75 0.18 85))
  - Destructive: red, muted: subtle gray
  - Sidebar-specific colors for proper integration

### State Management
- **`src/lib/store.ts`** - Zustand store for client-side navigation
  - `AppView` type union for all views
  - `navigate()`, `toggleSidebar()`, `setSidebarOpen()` actions
  - Tracks `currentView`, `selectedProjectId`, `selectedReportId`, `sidebarOpen`

### Type Definitions
- **`src/lib/types.ts`** - Shared TypeScript types matching Prisma schema
  - Enums: Tier, JobStatus, ProjectStatus
  - Interfaces: User, Project, Document, Summary, Report, GenerationJob, Embedding, ApiUsage
  - Helper types: ProjectWithRelations, ReportWithSections, SummaryStructure
  - API response types: ApiResponse, PaginatedResponse

### Constants
- **`src/lib/constants.ts`** - Application constants
  - TIER_LIMITS (file sizes, project limits)
  - French labels for statuses, tiers
  - Color mappings for badges
  - Academic levels and languages

### Seed Data
- **`src/lib/seed.ts`** - Database seed function
  - 2 demo users (FREE + PRO)
  - 3 projects with various statuses
  - 7 documents, 2 summaries, 1 report, 2 jobs, 4 API usage records

### API Route
- **`src/app/api/seed/route.ts`** - POST endpoint to trigger database seeding

### Layout Components
- **`src/components/layout/app-sidebar.tsx`** - Professional sidebar with:
  - GraduationCap logo + "RAG Report" branding
  - Nav items: Dashboard, Nouveau Projet, Projets, Tarifs, Paramètres
  - Active state highlighting via store
  - Collapsible icon mode on desktop, Sheet on mobile
  - User avatar + tier badge at bottom

- **`src/components/layout/app-header.tsx`** - Top header with:
  - SidebarTrigger (toggle on all sizes)
  - Breadcrumb navigation based on current view
  - Mobile fallback title (hidden breadcrumbs on mobile)
  - Search button (decorative)
  - Notification bell with indicator dot (decorative)
  - User avatar dropdown menu (decorative)

### Providers
- **`src/components/providers/theme-provider.tsx`** - next-themes ThemeProvider wrapper

### App Shell
- **`src/app/layout.tsx`** - Updated with:
  - French `lang="fr"`, metadata for "RAG Report"
  - ThemeProvider with class strategy
  - Sonner Toaster for notifications

- **`src/app/page.tsx`** - Main client-side routed page:
  - SidebarProvider wrapping AppSidebar + SidebarInset
  - AppHeader at top of content area
  - AnimatePresence with ViewPlaceholder for each view
  - Placeholder views with icons and French descriptions
  - Framer Motion fade/slide transitions between views

## Notes
- All lint errors in `src/` are resolved
- Only pre-existing error in `scripts/diagrams/generate-diagrams.js` (not part of this task)
- Database seeded successfully with POST /api/seed
- Dev server compiles without errors
