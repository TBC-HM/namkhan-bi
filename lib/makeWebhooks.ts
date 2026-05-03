// lib/makeWebhooks.ts
// Centralised Make.com webhook firer with graceful degrade.
// If a webhook env var isn't set, the call logs to console and returns
// success — keeps the deploy alive while PBS imports the Make scenarios.

const WEBHOOKS = {
  proposal_sent:         process.env.MAKE_WEBHOOK_PROPOSAL_SENT,
  proposal_viewed:       process.env.MAKE_WEBHOOK_PROPOSAL_VIEWED,
  proposal_guest_edited: process.env.MAKE_WEBHOOK_PROPOSAL_GUEST_EDITED,
  proposal_signed:       process.env.MAKE_WEBHOOK_PROPOSAL_SIGNED,
  proposal_expired:      process.env.MAKE_WEBHOOK_PROPOSAL_EXPIRED,
} as const;

export type MakeEvent = keyof typeof WEBHOOKS;

export async function fireMakeWebhook(event: MakeEvent, payload: Record<string, unknown>): Promise<{ ok: boolean; reason?: string }> {
  const url = WEBHOOKS[event];
  if (!url) {
    console.log(`[make:${event}] no webhook URL set — would have sent`, JSON.stringify(payload).slice(0, 200));
    return { ok: true, reason: 'no_webhook_url' };
  }
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      console.error(`[make:${event}] HTTP ${r.status}`);
      return { ok: false, reason: `http_${r.status}` };
    }
    return { ok: true };
  } catch (e: any) {
    console.error(`[make:${event}] fetch error`, e?.message);
    return { ok: false, reason: 'fetch_error' };
  }
}
