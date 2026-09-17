# Current state and next steps

Updated 2026-09-17. See `AUDIT.md` for verification results and `DEPLOYMENT.md` for the inactive launch plan.

## What works locally

- Google OAuth when credentials are configured; demo sessions only when both demo flags are enabled. Admin routes check the persisted role.
- Five-step intake, bounded uploads for PDF/DOCX/TXT/MD, and private local file storage. TXT/MD text is chunked; PDF/DOCX text extraction is not yet implemented.
- Hosted OpenAI-compatible generation for summaries, long report sections, and section revision. OpenRouter `openrouter/free` is the default; `LLM_API_KEY` is required. There is no local prose fallback. The report is generated as an outline plus one API call per section, with schema validation and retries.
- Section revision returns an API-generated draft that is saved only after acceptance. Inline manual edits use the report PATCH route. Usage rows persist token counts and configured USD cost rates.
- Server-owned entitlements and UTC month counters. The period key changes at the UTC month boundary, so new monthly credit accounting starts lazily without a reset cron. Quota increments are conditional and atomic; failed generation and revision refund credits.
- FREE report responses contain only a bounded preview assembled from visible sections. The protected outline and locked titles stay server-side. FREE exports return 402. Starter and Pro support Markdown, DOCX, and PDF exports.
- Stripe Checkout, portal, signed and idempotent webhook handling, subscription sync, and a local demo simulator. Tier mapping uses configured price IDs. Admin actions and billing tier changes write audit events visible through the admin logs endpoint.
- Report polling marks a job failed after 45 minutes without an update. `/api/health` reports database and LLM connectivity without secrets.

## Important limitations

1. Report generation still runs in a detached process after the HTTP response. A process restart can lose in-flight work. Move it to a durable worker before production.
2. OpenRouter free routing changes models and has a limited daily request allowance. A 50-page report can exceed the allowance, especially after retries. Use a fixed, capacity-tested hosted model for production.
3. Uploaded PDF/DOCX documents are stored but not parsed into retrieval text. The current embedding rows are placeholder text chunks, not semantic vector search.
4. The in-memory IP limiter is local only. A shared user/IP limiter and trusted edge forwarding are needed for multiple instances.
5. Local upload storage is private but not shared or scanned. Use private object storage and malware scanning before scaling.
6. Export layout lacks professional cover, pagination, references, and visual QA.
7. Live OAuth, Stripe, provider generation, and full browser download flows require configured external credentials and a running database; the static/unit gates do not prove them.

## Priority order

1. Durable generation queue with lease heartbeats, idempotent report persistence, and cancellation.
2. Real document extraction and semantic retrieval with source attribution.
3. Integration tests against PostgreSQL for concurrent quotas, FREE scoping, generation recovery, and Stripe replay.
4. Shared rate limiting and private object storage.
5. CI, monitoring, backups, and export layout improvements.

No production configuration is active in this worktree. Use `DEPLOYMENT.md` to prepare a release.
