# Deployment preparation (inactive)

This file is a launch plan. `.env.production.example` contains commented placeholders only. The current local and demo configuration is unchanged.

## Architecture decisions before launch

- **Database:** provision PostgreSQL with TLS, a connection pooler for application traffic, and a direct migration connection. Store credentials in the host's secret manager. Run `npx prisma migrate deploy` against the direct connection in a controlled release step. Take automated backups, test a restore, and publish a retention policy. Review the current Prisma connection setting and query logging before using a pooler.
- **Authentication:** set `NEXTAUTH_URL` to the final HTTPS origin, use a new long `NEXTAUTH_SECRET`, and create a production Google OAuth client. Configure the consent-screen domain and the exact redirect URI `https://reports.example.com/api/auth/callback/google`. Disable both demo flags. Verify Secure, HttpOnly, and SameSite cookie behavior in the deployed browser; NextAuth chooses cookie defaults from the deployment URL, and an explicit override should be added only if verification shows it necessary.
- **Stripe:** create live Starter and Pro recurring prices, set live keys and price IDs, and register `https://reports.example.com/api/webhooks/stripe` for the events handled in `src/app/api/webhooks/stripe/route.ts`. Set the endpoint's signing secret. Test signed replay and duplicate delivery before enabling checkout.
- **LLM:** set a server-only OpenRouter key and a capacity-tested model. The local default `openrouter/free` is suitable for development but has a limited free allowance and variable models. A ~50-page report needs roughly 15–23 model requests plus retries; the free allowance can exhaust before a report finishes. Select a paid, fixed model and set its actual input/output price rates before offering production generation. A missing key now returns a clear 503, with no local text fallback.
- **Worker:** `maxDuration = 300` on the report route is a platform hint, not a durable job runner. The current report task continues after the response only while its server process survives. Before serverless or multi-instance deployment, move it to a durable queue/worker with lease renewal, idempotent output, retry limits, and cancellation. The polling watchdog marks a job stale after 45 minutes without a progress update; it cannot recover work after a crash.
- **Rate limiting:** `src/proxy.ts` currently uses a per-process in-memory map and an IP header. Replace it with a shared Redis-backed limiter keyed by a trusted proxy IP and authenticated user ID before horizontal scaling. Configure trusted forwarding at the edge. Keep the current request size and CSRF checks.
- **Observability:** send request IDs, server errors, and admin audit events to a managed collector such as Sentry or Axiom. Redact prompts, uploaded text, secrets, OAuth data, payment identifiers, and report bodies. Add uptime, job failure, quota, provider latency, and backup alerts. No monitoring package is installed yet.
- **Storage:** local private `storage/uploads` is outside `public`, but it is not shared between instances. Before scaling, use private object storage with authenticated retrieval, malware scanning, and deletion/retention rules.

## Pre-launch checklist

1. **Environment variables:** add the commented placeholders from `.env.production.example` to the secret manager with real values. Keep demo flags false, verify the LLM key is server-only, and set model pricing and application origin.
2. **OAuth configuration:** configure the consent-screen domain and exact production redirect URI; test login, logout, suspension, session cookie flags, and admin boundaries.
3. **Stripe products, prices, and webhook:** create live recurring prices, install the webhook endpoint and signing secret, then test checkout, portal, replay, duplicate events, failed payment, cancellation, and sync.
4. **Database migration:** take a backup, test restoration, run `npx prisma migrate deploy` through the direct connection, and verify pooled application access.
5. **Build:** run `npm run typecheck`, `npm run test -- --pool=threads --maxWorkers=1`, `npm run lint`, and `npm run build -- --webpack`. Confirm the durable worker and shared limiter are in place before deploying more than one instance.
6. **Smoke tests:** exercise auth, project intake and upload, summary and report generation, polling, section revision and accept/reject, paid exports, FREE preview scoping, quota exhaustion and refund, and admin audit logs.
7. **DNS and SSL:** point the final domain at the host, enable HTTPS/HSTS at the edge, and confirm callback and webhook URLs.
8. **Post-launch monitoring:** watch request IDs, failed jobs, Stripe delivery, LLM rate limits and spend, database pool saturation, and backups. Run a restore drill.

## Deferred product work and rough effort

| Work | Estimate |
| --- | --- |
| Real vector embeddings, chunk retrieval, and source attribution | 1–2 weeks |
| Safe PDF/DOCX text extraction with size and malware controls | 3–5 days |
| Professional cover page, pagination, references, and export layout | 4–7 days |
| CI gates and release pipeline | 2–3 days |
| Monitoring, alerts, backup automation, and restore drill | 3–5 days |

See `AUDIT.md` for the current verification and open findings.
