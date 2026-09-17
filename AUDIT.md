# Code quality, security, and readiness audit

Reviewed 2026-09-17. The review used source tracing and local TypeScript, lint, unit, and build commands. External OAuth, Stripe, database-backed concurrency, and a live LLM call were not exercised without credentials and a running service.

## Findings fixed in this worktree

| Severity | Finding | Change |
| --- | --- | --- |
| Critical | FREE report filtering removed locked sections but returned the entire `Report.content` field. | Build the preview only from visible section bodies within a four-page word budget; add a locked-title/body regression test. |
| High | FREE job progress disclosed section titles through `progressMessage`; project/job APIs returned internal job data. | Scrub report progress, output data, and internal errors for FREE accounts. |
| High | Report section “AI regeneration” inserted a local template containing invented statistics and saved it before review. | Hosted API revision now returns a draft, records real token use, and saves only after acceptance. Missing API keys fail clearly. |
| High | Concurrent generation requests could increment quota past the limit. | Use a conditional atomic update against the UTC-month counter. A new month starts with a new period key. |
| Medium | Concurrent uploads could pass the document count before either insert committed. | Recheck the count in a serializable transaction and clean up the file on conflict. |
| Medium | Paid Markdown export used `md` in the route but `markdown` in entitlements, and the editor expected a permission object that the route did not return. | Normalize `md`, return the editor permission shape, and test the alias. |
| Medium | Billing and notification mutations parsed unbounded raw JSON without their route schema. | Use bounded `readJsonBody` and strict Zod schemas. |
| Medium | Detached generation jobs could leave a spinner indefinitely. | Polling marks a job failed after 45 minutes without progress and refunds its credit once. |

## Flow review

| Flow | Source review | Runtime proof still needed |
| --- | --- | --- |
| Auth and admin | Google provider only registers with credentials; demo flags gate demo users; admin routes check persisted role. | Google OAuth callback, suspension, and session cookie flags. |
| Intake and upload | Five-step intake; PDF/DOCX/TXT/MD MIME, extension, signature, size and private path checks; bounded form request. | Browser upload/download and real PDF/DOCX extraction. |
| Generation | Summary and 50-page outline/section loop use a hosted chat-completions API, schema validation, retries, quota refund, and job polling. | Real provider output quality, rate limits, process restart, and concurrent PostgreSQL behavior. |
| Editor | Section revision draft/accept/reject, manual edit PATCH, entitlement gate, unique section ids. | Browser acceptance/rejection and live regeneration. |
| Exports | Paid Markdown/DOCX/PDF route, FREE 402; file signatures are unit-tested. | Browser downloads, visual page layout, and quota policy for exports. |
| Billing | Server-owned price mapping, signed Stripe webhook, event idempotency, checkout, portal, sync and local simulation. | Live/test Stripe round trip and duplicate delivery. |
| Entitlements | UTC monthly period, conditional quota update, project serializable cap, FREE preview and export gate. | Real database race test across processes. |

## Security checklist

- Mutating browser routes pass signed CSRF and Origin checks in `src/proxy.ts`; Stripe's signed webhook is the only explicit CSRF exception. The bearer-authenticated retention cron currently mutates data on GET; change it to POST with a scheduler-specific authenticity design before production.
- Private report, project, document, and job GETs check ownership. Admin endpoints check the server-side role. FREE report and job data are scrubbed; new regression tests cover the central visibility helper.
- Model prompts mark project context and existing content as untrusted; model output is rendered as React text rather than raw HTML. Citation and factual accuracy still require human review.
- Upload storage is outside `public`, names are generated, and paths are resolved under a private root. DOCX signature checking only checks ZIP magic; malware scanning and safe extraction remain open.
- Stripe verifies signatures against raw request bytes; price-to-tier mapping is server-owned and webhook event IDs are stored for idempotency.
- API keys occur in server-side code and environment examples only. Proxy applies CSP, request IDs, and security headers. The in-memory per-IP limiter is unsuitable for multi-instance production and currently trusts forwarding headers; add a shared user/IP limiter behind a trusted edge.
- External LLM requests have a configurable timeout. Verify explicit Stripe client timeouts during deployment. A hosted LLM key is required for writing and revision.

## Open production blockers

1. Replace detached report generation with a durable worker and idempotent persistence; the polling watchdog only reports stalled work.
2. Add a shared rate limiter and trusted client-IP handling. Current local limits do not aggregate across instances or authenticated users.
3. Add private object storage, malware scanning, robust DOCX/PDF validation, and text extraction.
4. Test PostgreSQL races, Stripe replay, OAuth, free preview HTTP responses, and browser downloads against configured services.
5. Configure secrets, migrations, backups, monitoring, and a fixed capacity-tested hosted LLM model as described in `DEPLOYMENT.md`.

## Validation record

- `npm run typecheck`: passed, 0 errors.
- `npm run test`: default fork pool failed with Windows sandbox `spawn EPERM`; `npm run test -- --pool=threads --maxWorkers=1` passed 32 tests across 10 files.
- `npm run lint`: passed, 0 errors.
- `npm run build -- --webpack`: passed. The sandbox initially denied access to generated `.next/trace-build`; the required build completed with elevated workspace access.
