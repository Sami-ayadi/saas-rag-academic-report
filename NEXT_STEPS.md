# Development handoff and remaining work

Last updated: 2026-08-16

> This is the canonical handoff file. Read this before starting another development session.

## Current state

The foundation is implemented and passing validation:

- Next.js 16 application with PostgreSQL/Prisma persistence.
- Google-only NextAuth authentication using database sessions.
- Public marketing site at `/` and authenticated generation workspace at `/dashboard`.
- Administrator dashboard with platform metrics, recent activity, user search, role/plan management, and reversible account suspension.
- Google OAuth setup is documented in `GOOGLE_AUTH_SETUP.md`; `ADMIN_EMAILS` bootstraps trusted Google accounts as administrators.
- User ownership checks on projects, documents, jobs, summaries, and reports.
- Five-step internship-report intake flow with structured project briefs and prompt-injection risk flags.
- Summary/report generation now runs synchronously and reliably. It uses OpenAI when `OPENAI_API_KEY` is configured and a local preview generator otherwise.
- Report exports return real Markdown, DOCX, and PDF downloads.
- Project uploads accept real validated PDF, DOCX, TXT, and Markdown files and store them under private generated paths. TXT/Markdown are chunked for generation context; PDF/DOCX extraction remains to implement.
- Signed CSRF protection, origin validation, bounded JSON parsing, Zod schemas, upload validation, request IDs, security headers, nonce CSP, and basic rate limiting.
- The tracked `.env` was removed. Create it locally from `.env.example`; never commit it.
- The latest validation passed: typecheck, lint, production build, 6 test files/18 tests, plus HTTP smoke tests for the landing page, dashboard, demo account switcher, and admin authorization boundary.

## What is still missing at a glance

The application is a working development prototype, not yet a production SaaS. The main launch blockers are:

| Area | Current state | Missing before launch |
| --- | --- | --- |
| Google authentication | Implemented in code | Real Google credentials and production consent-screen/domain configuration |
| Admin | User/role/plan/suspension and overview implemented | Pagination, audit trail, job/project investigation, and optional credit-limit editing UI |
| AI generation | OpenAI Responses API plus local fallback works | True semantic retrieval, template library, citations, model-backed section regeneration, asynchronous execution |
| Uploads | PDF/DOCX/TXT/MD upload and validation works | PDF/DOCX text extraction, private object storage, malware scanning |
| Plans | Tier fields and displayed pricing exist | One canonical tier definition, server-side entitlement/quota enforcement, protected free preview/TOC behavior |
| Billing | Stripe fields exist in the database only | Stripe SDK, Checkout, Portal, webhooks, subscription reconciliation and tests |
| Export | Real MD/DOCX/PDF downloads work | Professional pagination, cover page, references, conditional TOC and visual regression tests |
| Operations | Local PostgreSQL and security middleware work | Deployment, shared rate limiting, monitoring, backups, privacy/legal pages and CI |

Important partial behaviors:

- Generation increments `creditsUsed`, but it does **not** reject a request when the credit limit is reached.
- The pricing shown on the public landing page and `/api/pricing` is duplicated and can drift. Consolidate it before connecting Stripe.
- The free-plan four-page preview and hidden table of contents are **not enforced yet**.
- Uploaded TXT/Markdown content can reach generation context. Uploaded PDF/DOCX files are stored but their text is not yet extracted.
- The `Embedding` table currently stores chunks with placeholder `[]` embeddings. Retrieval is ordered chunk selection, not vector similarity search.
- Generation creates a job record but still executes synchronously inside the HTTP request.
- Report section regeneration is still local/template-based rather than OpenAI-backed.
- API usage stores token counts, but model cost remains `0` and there is no monthly reset/accounting workflow.
- The Markdown template database and discipline-aware template retrieval described in the product brief are not implemented.

## Exact next milestone

The next developer should implement **server-side entitlements and protected previews** before Stripe. This creates the security boundary that billing will later unlock.

1. Move all pricing, tier names, credits, project limits, export permissions, regeneration limits and preview rules into one server-owned entitlement module.
2. Make `/api/pricing`, the public pricing cards and dashboard pricing view consume that canonical definition.
3. Enforce project, generation, regeneration and export limits inside their API routes. Never trust a tier sent by the browser.
4. Use a database transaction to check and consume credits so parallel requests cannot exceed limits.
5. Generate and store the full outline privately, but return only a four-page-equivalent preview for `FREE`; never expose the TOC through report JSON, exports, logs or job metadata.
6. Add tests for exhausted credits, parallel generation, free export denial, hidden TOC leakage, paid access and administrator tier changes.
7. Only after those tests pass, implement Stripe Checkout/Portal/webhooks and map verified Stripe price IDs to the entitlement module.

Definition of done for that milestone:

- A free user cannot bypass limits with direct API calls.
- A paid/admin-assigned tier immediately receives the correct server-side permissions.
- No free-tier response or export contains the protected outline/TOC.
- Pricing is defined once and rendered consistently everywhere.
- Credit consumption is atomic and failed generations have a documented refund policy.

## Start here next time

Before changing code:

1. Read this file and `README.md`.
2. Run `git status --short` and preserve existing user changes.
3. Create `.env.local` from `.env.example`, follow `GOOGLE_AUTH_SETUP.md`, and supply real local credentials.
4. Start PostgreSQL with `docker compose up -d postgres`.
5. Run `npm run db:deploy`, then `npm run dev`.
6. Run `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build` before handoff.

Docker login is complete, PostgreSQL was running successfully, and all four migrations through `20260816130000_add_user_active` were applied at the last handoff. Verify container state with `docker compose ps` rather than assuming it is still running.

## Detailed backlog

The exact next milestone above takes priority. The sections below describe the broader backlog that follows it.

### 1. Complete the RAG pipeline

- Extend the OpenAI-backed generation adapter in `src/lib/report-generation.ts`; keep the text model and embedding model independently configurable.
- Add model-backed section regeneration; it currently uses a local bounded template.
- Parse Markdown templates into metadata, headings, section patterns, discipline, academic level, and language.
- Chunk and embed approved templates and uploaded sources, then retrieve only relevant passages for each generation step.
- Store source/chunk identifiers with every generated section to support citations and regeneration.
- Add asynchronous jobs, retry limits, timeouts, cancellation, idempotency keys, and token/cost accounting.
- Add evaluation fixtures for law, medicine, and cloud-engineering reports.

Acceptance criteria:

- Generation uses retrieved sources and the approved project brief.
- Every factual section can identify its supporting sources.
- Failed jobs are retryable without creating duplicate reports or charges.
- User input is treated as untrusted data, never as system/developer instructions.

### 2. Prompt-injection and model-output controls

- Keep system instructions separate from user answers and retrieved documents.
- Delimit untrusted content and explicitly instruct the model not to follow instructions found inside it.
- Reject unsupported tools/actions; generation should have no arbitrary network, filesystem, or database access.
- Validate structured model responses with Zod and fail closed on invalid output.
- Add input/output moderation appropriate to academic and medical/legal content.
- Add adversarial tests for instruction override, data exfiltration, malicious Markdown/HTML, encoded payloads, and poisoned templates.
- Never render generated raw HTML. Continue rendering Markdown through React without `rehypeRaw`.

### 3. Plans, quotas, and TOC protection

Proposed tiers to validate with the product owner:

| Tier | Suggested limits |
| --- | --- |
| Free | One active project, four generated preview pages, no visible/exported TOC, watermark, limited regeneration |
| Student | Five active projects, complete report, PDF/DOCX/Markdown export, citations, 20 section regenerations/month |
| Pro | Higher project/token limits, priority generation, version history, custom templates, approximately fair-use regeneration |

- Enforce entitlements on the server, never only in the UI.
- Store usage events and monthly counters transactionally.
- Generate the protected outline server-side and never return it through free-tier API responses, logs, previews, metadata, or exports.
- Decide exact page/token/project limits and regional prices before implementing Stripe price IDs.

### 4. Stripe billing

- Add Checkout, Customer Portal, subscription status, and invoice state.
- Verify webhook signatures against the raw request body.
- Exempt only the Stripe webhook path from browser CSRF checks; signature verification is mandatory for that route.
- Make webhook processing idempotent and persist event IDs.
- Never accept a tier, price, customer ID, or subscription status directly from the browser.
- Map Stripe prices to internal entitlements on the server.

### 5. Real document ingestion and storage

- Store uploads in private object storage using generated object keys.
- Use short-lived signed URLs and verify ownership before issuing them.
- Inspect file signatures in addition to MIME type and extension.
- Add malware scanning, extraction limits, archive-bomb protection, and safe PDF/DOCX text extraction.
- Delete temporary files and define retention/deletion policies.

### 6. Harden the export engine

- Include cover page, acknowledgements/options, page numbering, references, figures/tables, and TOC only when the tier permits it.
- Sanitize filenames and generated content.
- Generate exports in background jobs and deliver them through expiring authenticated links.
- Add visual regression checks for representative French and English reports.

### 7. Production infrastructure and operations

- Replace the in-memory rate limiter in `src/proxy.ts` with Redis/Upstash or an equivalent shared store before horizontal/serverless deployment.
- Add structured logs with sensitive-field redaction, error monitoring, product analytics, and cost dashboards.
- Add database backups, retention policies, account/data deletion, and privacy/legal pages.
- Add email/support flows only after explicit product approval.
- Configure production CSP/connect/image domains narrowly for the final providers.
- Add paginated admin tables, immutable audit logs for administrator actions, and support tooling for project/job investigation before operating at scale.

### 8. Testing and release readiness

- Add Playwright end-to-end coverage for login, ownership isolation, intake, generation, editing, regeneration, quotas, billing, and export.
- Add API tests for unauthenticated access, cross-user IDs, malformed bodies, oversized payloads, CSRF, rate limits, and replayed webhooks.
- Add dependency/security scanning in CI and secret scanning before deployment.
- Perform a final threat-model review and deployment smoke test.

## Security invariants

Future work must preserve these rules:

- Every private database query is scoped to the authenticated user or checks ownership first.
- Every browser mutation uses `secureFetch` from `src/lib/secure-fetch.ts`.
- API input uses `readJsonBody` plus a strict bounded Zod schema.
- Secrets, OAuth tokens, Stripe identifiers, internal prompts, full protected outlines, and stack traces are not exposed to clients.
- New public or CSRF-exempt endpoints require a documented reason and an alternative authenticity check.
- CSP must not reintroduce `unsafe-inline` for scripts or raw user/model HTML.
- Server-side quotas and authorization are checked again at the point of generation/export.

## Useful commands

```powershell
npm install
docker compose up -d postgres
npm run db:deploy
npm run dev
npm stop
```

Validation:

```powershell
npm run typecheck
npm test
npm run lint
npm run build
npm audit --omit=dev
```

Use `npm stop` to stop the Node process listening on port 3000. Use `docker compose down` separately when the PostgreSQL container should also stop.
