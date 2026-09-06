#!/usr/bin/env node
/**
 * Replay missed Stripe webhook events against the local server.
 *
 * A payment can succeed while the webhook listener is down (`stripe listen`
 * stopped, dev server restarting, network hiccup). Stripe stores events for
 * days, so nothing is lost — they just need to be re-delivered. This script
 * re-sends the exact event payload with a valid Stripe signature (same path the
 * CLI/dashboard webhook uses), and the server applies the verified tier.
 *
 * Usage (from the repo root, with the Next.js server running):
 *
 *   node --env-file=.env.local scripts/replay-stripe-events.mjs                # replay the 5 most recent relevant events
 *   node --env-file=.env.local scripts/replay-stripe-events.mjs --recent 10    # replay the 10 most recent
 *   node --env-file=.env.local scripts/replay-stripe-events.mjs --event evt_xxx# replay a specific event id
 *   node --env-file=.env.local scripts/replay-stripe-events.mjs --all          # replay every relevant event
 *
 * Replaying is safe: the server's idempotency guard (ProcessedWebhookEvent)
 * makes duplicates no-ops that still return 200.
 */

const STRIPE_EVENT_TYPES = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]

function parseArgs(argv) {
  const args = argv.slice(2)
  if (args[0] === '--event' && args[1]) return { mode: 'event', value: args[1] }
  if (args[0] === '--all') return { mode: 'all' }
  if (args[0] === '--recent') return { mode: 'recent', value: Math.max(1, Number(args[1] ?? 5)) }
  return { mode: 'recent', value: 5 }
}

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secretKey || !webhookSecret) {
    console.error('Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET.')
    console.error('Run with: node --env-file=.env.local scripts/replay-stripe-events.mjs [--recent N | --event evt_xxx | --all]')
    process.exit(1)
  }

  const baseUrl = process.env.NEXTAUTH_URL?.trim() || process.env.APP_URL?.trim() || 'http://localhost:3001'
  const { default: Stripe } = await import('stripe')
  const stripe = new Stripe(secretKey)
  const opts = parseArgs(process.argv)

  let eventIds = []
  if (opts.mode === 'event') {
    eventIds = [opts.value]
  } else {
    const list = await stripe.events.list({ limit: 100 })
    const candidates = list.data
      .filter(
        (e) =>
          STRIPE_EVENT_TYPES.includes(e.type) &&
          (e.data.object?.metadata?.userId || e.data.object?.client_reference_id),
      )
      .sort((a, b) => b.created - a.created)
    const take = opts.mode === 'all' ? candidates.length : Math.min(opts.value, candidates.length)
    eventIds = candidates.slice(0, take).map((e) => e.id)
  }

  console.log(`Replaying ${eventIds.length} event(s) to ${baseUrl}/api/webhooks/stripe`)
  if (eventIds.length === 0) {
    console.log('Nothing to replay.')
    return
  }

  let ok = 0
  let failed = 0
  for (const eventId of eventIds) {
    try {
      const event = await stripe.events.retrieve(eventId)
      const payload = JSON.stringify(event)
      const signature = stripe.webhooks.generateTestHeaderString({
        payload,
        secret: webhookSecret,
      })
      const res = await fetch(`${baseUrl}/api/webhooks/stripe`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': signature,
        },
        body: payload,
      })
      const body = await res.text().catch(() => '')
      if (res.ok) {
        ok += 1
        console.log(`  ${res.status} ${eventId} ${event.type}`)
      } else {
        failed += 1
        console.error(`  ${res.status} ${eventId} ${event.type}: ${body.slice(0, 160)}`)
      }
    } catch (error) {
      failed += 1
      console.error(`  ERROR ${eventId}: ${error instanceof Error ? error.message : error}`)
    }
  }

  console.log(`Done. ok=${ok} failed=${failed}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})