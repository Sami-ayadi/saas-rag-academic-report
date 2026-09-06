# Development handoff and remaining work

Last updated: 2026-09-02

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
- **Server-side entitlements and protected previews are implemented** (the previous exact next milestone). `src/lib/entitlements.ts` is the canonical, server-owned plan definition (prices, credits, project/document/upload limits, export permissions, regeneration limits, preview pages, TOC visibility). Quotas are consumed through guarded atomic counters in `src/lib/entitlements-server.ts` (`consumeQuota`/`refundQuota`), project creation is capped with a serializable transaction, free exports are denied with `402`, section regeneration consumes regeneration credits and only allows fully visible preview sections, report editing is reserved for paid tiers, and the protected outline (`Report.outline`) never leaves the server for `FREE` (report JSON, project JSON, exports and job metadata are all scrubbed).
- **Stripe billing is implemented** with a server-owned reconciliation path: Checkout Session, Customer Portal, signed + idempotent webhook, and a local plan simulator for testing without payment. The tier is always derived from a verified Stripe price ID — never from the browser. The only CSRF-exempt mutating route is `/api/webhooks/stripe`, with mandatory signature verification as the alternative authenticity check.
- The tracked `.env` was removed. A local `.env.local` is in place (gitignored); never commit it.
- The latest validation passed: typecheck, lint, webpack production build, 12 test files/43 tests (40 passed, 3 opt-in integration tests skipped without a database), plus HTTP smoke tests for the landing page, dashboard, demo account switcher, and admin authorization boundary.

> **Worktree build note**: this repository is often opened as a git worktree whose `node_modules` is a junction to the sibling checkout. Turbopack (`next build`) panics on that junction (`Symlink [project]/node_modules is invalid`). Use `npm run build -- --webpack` in that case. A regular checkout anywhere else builds normally.

## What is still missing at a glance

The application is a working development prototype, not yet a production SaaS. The main launch blockers are:

| Area | Current state | Missing before launch |
| --- | --- | --- |
| Google authentication | Implemented in code | Real Google credentials and production consent-screen/domain configuration |
| Admin | User/role/plan/suspension and overview implemented | Pagination, audit trail, job/project investigation, and optional credit-limit editing UI |
| AI generation | OpenAI Responses API plus local fallback works | True semantic retrieval, template library, citations, model-backed section regeneration, asynchronous execution |
| Uploads | PDF/DOCX/TXT/MD upload and validation works | PDF/DOCX text extraction, private object storage, malware scanning |
| Plans | Canonical entitlement module + server-side quotas + protected preview/TOC implemented | Monthly credit reset workflow, exact regional prices before Stripe |
| Billing | Stripe Checkout/Portal/webhooks + idempotency + local simulator implemented | Real Stripe prices, production webhook endpoint, CI |
| Export | Real MD/DOCX/PDF downloads work | Professional pagination, cover page, references, conditional TOC and visual regression tests |
| Operations | Local PostgreSQL and security middleware work | Deployment, shared rate limiting, monitoring, backups, privacy/legal pages and CI |

Important partial behaviors:

- Generation rejects a request at the credit limit (atomically, per UTC month). `User.creditsUsed` mirrors the current period counter; a monthly reset/accounting cron is still missing.
- The free-plan four-page preview and hidden table of contents **are enforced** on the server (report GET, project GET, regeneration responses, exports).
- Uploaded TXT/Markdown content can reach generation context. Uploaded PDF/DOCX files are stored but their text is not yet extracted.
- The `Embedding` table currently stores chunks with placeholder `[]` embeddings. Retrieval is ordered chunk selection, not vector similarity search.
- Section regeneration consumes the `regeneration` quota but is still local/template-based rather than OpenAI-backed.
- The `Embedding` table currently stores chunks with placeholder `[]` embeddings. Retrieval is ordered chunk selection, not vector similarity search.
- Generation creates a job record but still executes synchronously inside the HTTP request.
- API usage stores token counts, but model cost remains `0` and there is no monthly reset/accounting workflow.
- The Markdown template database and discipline-aware template retrieval described in the product brief are not implemented.

## Exact next milestone

**Server-side entitlements and protected previews are DONE** (implemented on the `agents/attachment-pasted-text-1` branch). Achieved:

1. ✅ Canonical entitlement module `src/lib/entitlements.ts` owns prices, tier names, credits, project limits, export permissions, regeneration limits and preview rules.
2. ✅ `/api/pricing`, the public landing page cards and the dashboard pricing/settings views consume that canonical definition; no pricing literals remain duplicated in components.
3. ✅ Project (`withProjectSlot`), generation (`consumeQuota`), regeneration, export (`canExport` → 402) and upload limits are enforced server-side. A tier sent by the browser is never trusted.
4. ✅ Credits are consumed with guarded atomic `UPDATE ... WHERE used < limit` transactions; parallel bursts cannot exceed the limit, and failed generations/regenerations return their credit (`refundQuota`).
5. ✅ The full outline is generated and stored privately (`Report.outline`), but `FREE` only ever receives a four-page character-budget preview. The outline and locked section titles are withheld from report JSON, project JSON, regeneration responses, exports and job metadata.
6. ✅ Tests added for exhausted credits, parallel generation (opt-in integration), free export denial, hidden TOC leakage, paid access and administrator tier changes (`src/lib/entitlements.test.ts`, `src/lib/entitlements-server.test.ts`).

Definition of done for that milestone — all met:

- A free user cannot bypass limits with direct API calls.
- A paid/admin-assigned tier immediately receives the correct server-side permissions.
- No free-tier response or export contains the protected outline/TOC.
- Pricing is defined once and rendered consistently everywhere.
- Credit consumption is atomic and failed generations have a documented refund policy.

The next milestone is **Stripe billing**. Before touching Stripe, validate the opt-in quota integration tests on a real database:

```powershell
docker compose up -d postgres
npm run db:deploy
# This machine: the project container is mapped to host port 5433 (a native
# PostgreSQL service owns 5432). On a regular checkout, keep 5432.
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5433/rag_report?schema=public"
$env:RUN_ENTITLEMENT_INTEGRATION="1"
npm test
```

Then implement, in order:

1. Add the Stripe SDK and map verified Stripe price IDs to the canonical entitlement tiers (the free tier keeps `price: 0`).
2. Add Checkout + Customer Portal + subscription status webhooks. Verify webhook signatures against the raw request body; exempt only the webhook path from browser CSRF and rely on signature verification.
3. Make webhook processing idempotent (persist event IDs) and reconcile `User.stripeCustomerId`/`stripePriceId`/`stripeSubId` with `tier` on the server. Never accept a tier, price, customer ID or subscription status from the browser.
4. Add the monthly credit-reset workflow (cron) and keep `EntitlementUsage` as the single quota source of truth.
5. Wire the pricing cards' "Choisir le plan" buttons to Checkout; refresh entitlements after subscription changes.

## Start here next time

Before changing code:

1. Read this file and `README.md`.
2. Run `git status --short` and preserve existing user changes.
3. Create `.env.local` from `.env.example`, follow `GOOGLE_AUTH_SETUP.md`, and supply real local credentials.
4. Start PostgreSQL. On this machine a native PostgreSQL service owns port 5432, so the project container must be created on host port 5433:
   ```powershell
   $env:POSTGRES_HOST_PORT = "5433"
   docker compose up -d postgres
   ```
5. Run `npm run db:deploy`. All migrations through `20260902120000_add_entitlement_usage_and_report_outline` were applied on 2026-09-02 (verified; the `EntitlementUsage` table exists).
6. Run the dev server on port 3001 with webpack (port 3000 is occupied by a local Grafana process, and the worktree junction breaks Turbopack):
   ```powershell
   $env:NEXTAUTH_URL = "http://localhost:3001"
   node node_modules/next/dist/bin/next dev -p 3001 --webpack
   ```
   Stop it later with `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/stop-server.ps1 -Port 3001` (`npm stop` targets port 3000 by default; the script refuses to kill non-Node processes, so Grafana is never touched, and its messages now report the actual `-Port` value).
7. Run `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build -- --webpack` (see the worktree junction note above) before handoff.

Local smoke results on 2026-09-02 (dev server on 3001): `/` 200, `/dashboard` 200 (the sign-in UI is rendered by the dashboard view; there is no `/login` route), `/api/pricing` 200 with the canonical tiers, and unauthenticated `/api/user`, `/api/admin/overview`, `/api/admin/users` all return 401. Google sign-in initially failed with NextAuth `OAuthSignin` ("client_id is required") because `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` were empty; the Google provider is now registered only when configured (`isGoogleAuthConfigured` in `src/lib/auth.ts`), the sign-in card explains the missing setup instead of failing, and demo mode (`AUTH_ALLOW_DEMO`) was enabled for this machine so sign-in works without Google credentials.

Docker login is complete. Verify container state with `docker compose ps` rather than assuming it is still running, then apply any pending migrations with `npm run db:deploy`. Regenerate the Prisma client with `npm run db:generate` whenever the schema changes.

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

### 3. Plans, quotas, and TOC protection ✅ (implemented on the `agents/attachment-pasted-text-1` branch)

Server-side entitlements, atomic quotas, the protected outline and the four-page free preview are implemented and tested. Remaining here is product work, not engineering: validate the proposed tier limits with the product owner, then decide the exact regional prices before creating Stripe price IDs.

Tiers currently enforced (adjust in `src/lib/entitlements.ts` after validation):

| Tier | Suggested limits |
| --- | --- |
| Free | One active project, four generated preview pages, no visible/exported TOC, watermark, limited regeneration |
| Student | Five active projects, complete report, PDF/DOCX/Markdown export, citations, 20 section regenerations/month |
| Pro | Higher project/token limits, priority generation, version history, custom templates, approximately fair-use regeneration |

- Enforce entitlements on the server, never only in the UI.
- Store usage events and monthly counters transactionally.
- Generate the protected outline server-side and never return it through free-tier API responses, logs, previews, metadata, or exports.
- Decide exact page/token/project limits and regional prices before implementing Stripe price IDs.

### 4. Stripe billing — ✅ implemented

**Implemented:**
- `src/lib/stripe.ts` — lazy Stripe client + `isStripeConfigured()`
- `src/lib/billing.ts` — server-owned tier↔price mapping, `applyTierChange` (shared reconciliation), idempotency, audit logging
- `POST /api/billing/checkout` — Checkout Session, server-resolved price ID, anti-open-redirect `success_url`
- `POST /api/billing/portal` — Customer Portal for plan/payment management
- `POST /api/billing/simulate` — local dev-only plan switch (demo auth only, 404 otherwise)
- `POST /api/webhooks/stripe` — mandatory signature verification on raw body, idempotent via `ProcessedWebhookEvent` PK, full lifecycle (checkout/subscription/deleted/payment_failed)
- `src/lib/billing.test.ts` — mapping, params, simulation flag, reconciliation, downgrade, audit, unknown-user rejection
- CSRF exemption documented in `src/proxy.ts` (single exempted mutating route, signature = alternative authenticity check)

**Run book (when you're ready for real payments):**

1. Create two recurring prices at https://dashboard.stripe.com/prices (e.g. €19/month Starter, €49/month Pro).
2. Copy their price IDs into `.env.local`: `STRIPE_PRICE_STARTER_ID`, `STRIPE_PRICE_PRO_ID`.
3. Copy the secret key: `STRIPE_SECRET_KEY=sk_live_...`.
4. Install the Stripe CLI: `stripe login` then `stripe listen --forward-to localhost:3001/api/webhooks/stripe`.
5. Copy the webhook signing secret: `STRIPE_WEBHOOK_SECRET=whsec_...`.
6. Restart the server. The checkout button now redirects to a real Stripe payment page.
7. Test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 3220` (3DS), `4000 0000 0000 9995` (decline).

**Webhook resilience (local CLI caveat + recovery):**

- `stripe listen` only forwards events while the terminal stays open. If it was closed during a payment, `checkout.session.completed` is never delivered and the plan stays FREE even though the card was charged. This is the most common local integration failure.
- `POST /api/billing/sync` — authenticated recovery endpoint. It pulls the customer's latest subscription directly from Stripe and reconciles the tier through the same `applyTierChange` path as the webhook. The pricing view calls it automatically when landing on `?billing=success`, and a "Synchroniser mon abonnement" button is shown there. This makes the flow self-healing even if the webhook is missed.
- `node scripts/replay-stripe-events.mjs` — replays recent webhook events through the real signed endpoint (`--secret`, `--base-url`, `--count` flags). Requires `stripe listen` to be running. Also usable with `stripe events resend <event_id> --stripe-account` from the CLI.
- `scripts/start-stripe-webhook.ps1` — starts `stripe listen` with all six event types and keeps the console open.

**Still missing before launch:** real Stripe prices, production webhook endpoint, CI smoke test with replayed webhooks.

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
