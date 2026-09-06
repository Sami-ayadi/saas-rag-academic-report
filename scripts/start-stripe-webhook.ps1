# Launch the Stripe CLI webhook listener for local development.
# Run this in a SEPARATE terminal while the Next.js server is running.
#
# Prerequisites:
#   1. winget install Stripe.StripeCLI
#   2. stripe login
#
# IMPORTANT:
# - The CLI prints a fresh webhook signing secret (whsec_...) on every launch.
#   Copy it into .env.local as STRIPE_WEBHOOK_SECRET, then RESTART the Next.js
#   server so the new secret is loaded. Keep this terminal open while you test
#   payments — the plan only switches when the event reaches the server.
# - If a payment ever succeeds while this listener is down, do not panic:
#     a) click "Synchroniser mon abonnement" on the pricing page, or
#     b) replay the missed events with:
#        node --env-file=.env.local scripts/replay-stripe-events.mjs --recent 10

stripe listen --forward-to localhost:3001/api/webhooks/stripe --events checkout.session.completed,customer.subscription.updated,customer.subscription.deleted
