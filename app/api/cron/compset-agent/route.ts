/**
 * Cron: compset-agent  (runs at :43 — see vercel.json)
 * Fetches competitor rates via Nimble API and upserts into revenue.competitor_rates.
 *
 * Assumptions (ticket #614):
 * - NIMBLE_API_KEY env var holds a Bearer token
 * - Nimble endpoint: POST https://api.webit.live/api/v1/realtime/serp  (web-unlocker / hotel-rates flavour)
 *   Payload: { url, render, country } — we build a booking-style URL per comp property_url
 * - revenue.competitor_property has columns: id (comp_id), property_url, name, is_active
 * - revenue.competitor_set has columns: comp_id (FK), stay_date (date)
 *   OR we synthesise a rolling window of today + 30 days if no stay_date rows exist
 * - revenue.competitor_rates has a unique constraint on (comp_id, stay_date, channel)
 *   channel defaults to 'direct' when Nimble returns a single rate
 * - CRON_SECRET env var guards the route (Vercel standard pattern)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const NIMBLE_ENDPOINT = 'https://api.webit.live/api/v1/realtime/serp';
const WINDOW_DAYS = 30;       // stay-date lookahead
const BATCH_SIZE = 3;         // comps processed in parallel per batch
const RETRY_DELAY_MS = 2000;  // backoff on 429

// ── helpers ────────────────────────────────────────────────────────────────

function dateRange(days: number): string[] {
  const dates: string[] = [];
  const base = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

/** Fetch a single rate from Nimble for (propertyUrl, checkIn). */
async function nimbleFetchRate(
  nimbleKey: string,
  propertyUrl: string,
  checkIn: string,
): Promise<{ rate: number | null; channel: string; rawError?: string }> {
  // Build a representative OTA URL or use Nimble's hotel-rates endpoint.
  // If the property URL is already a bookable URL template, interpolate the date;
  // otherwise embed check-in as a query param placeholder.
  const targetUrl = propertyUrl.includes('{{check_in}}')
    ? propertyUrl.replace('{{check_in}}', checkIn)
    : `${propertyUrl}?checkin=${checkIn}&checkout=${nextDay(checkIn)}&adults=2`;

  const body = {
    url: targetUrl,
    render: 'html',
    country: 'TH', // closest Nimble PoP to Laos
  };

  let attempt = 0;
  while (attempt < 3) {
    attempt++;
    const resp = await fetch(NIMBLE_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(nimbleKey).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (resp.status === 429) {
      console.warn(`[compset-agent] Nimble 429 — backing off ${RETRY_DELAY_MS}ms (attempt ${attempt})`);
      await sleep(RETRY_DELAY_MS * attempt);
      continue;
    }

    if (!resp.ok) {
      const txt = await resp.text().catch(() => resp.statusText);
      return { rate: null, channel: 'direct', rawError: `HTTP ${resp.status}: ${txt.slice(0, 200)}` };
    }

    const json = await resp.json().catch(() => null);
    // Nimble SERP / web-unlocker returns { html_content } or { results }.
    // We parse a naive price from the page; PBS can refine the selector later.
    const rate = extractRate(json);
    return { rate, channel: 'direct' };
  }

  return { rate: null, channel: 'direct', rawError: 'max retries exceeded' };
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Naive rate extractor — looks for the first USD/LAK/THB price pattern
 * in the Nimble response body.  PBS should replace this with a proper
 * CSS/regex selector once they confirm the Nimble response shape.
 */
function extractRate(nimbleJson: unknown): number | null {
  const text = JSON.stringify(nimbleJson ?? '');
  // Match patterns like "$120", "USD 120", "120.00" etc.
  const m = text.match(/(?:USD|\$|THB|LAK)?\s*([0-9]{2,6}(?:\.[0-9]{1,2})?)/);
  if (m) {
    const v = parseFloat(m[1]);
    return isNaN(v) ? null : v;
  }
  return null;
}

// ── main handler ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth guard
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const nimbleKey = process.env.NIMBLE_API_KEY;
  if (!nimbleKey) {
    console.error('[compset-agent] NIMBLE_API_KEY not set — aborting');
    return NextResponse.json({ error: 'NIMBLE_API_KEY not configured' }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 1. Load active competitors
  const { data: comps, error: compsErr } = await supabase
    .from('competitor_property')
    .select('id, name, property_url')
    .eq('is_active', true);

  if (compsErr || !comps) {
    console.error('[compset-agent] Failed to load competitor_property:', compsErr);
    return NextResponse.json({ error: 'db read failed' }, { status: 500 });
  }

  const stayDates = dateRange(WINDOW_DAYS);
  console.log(`[compset-agent] comps=${comps.length}  dates=${stayDates.length}`);

  let upsertCount = 0;
  let errorCount = 0;

  // 2. Process comps in small batches
  for (let b = 0; b < comps.length; b += BATCH_SIZE) {
    const batch = comps.slice(b, b + BATCH_SIZE);

    await Promise.all(
      batch.map(async (comp) => {
        for (const stayDate of stayDates) {
          const { rate, channel, rawError } = await nimbleFetchRate(
            nimbleKey,
            comp.property_url,
            stayDate,
          );

          if (rawError) {
            console.warn(
              `[compset-agent] nimble error comp=${comp.id} date=${stayDate}: ${rawError}`,
            );
            errorCount++;
            continue;
          }

          if (rate === null) {
            // No rate found — could be sold-out; still record null so we know we tried
          }

          const { error: upsertErr } = await supabase
            .from('competitor_rates')
            .upsert(
              {
                comp_id: comp.id,
                stay_date: stayDate,
                channel,
                rate_usd: rate,
                source: 'nimble',
                fetched_at: new Date().toISOString(),
              },
              { onConflict: 'comp_id,stay_date,channel' },
            );

          if (upsertErr) {
            console.error(
              `[compset-agent] upsert failed comp=${comp.id} date=${stayDate}:`,
              upsertErr.message,
            );
            errorCount++;
          } else {
            upsertCount++;
          }
        }
      }),
    );

    // Small pause between batches to avoid hammering Nimble
    if (b + BATCH_SIZE < comps.length) {
      await sleep(500);
    }
  }

  const summary = {
    comps: comps.length,
    dates: stayDates.length,
    attempted: comps.length * stayDates.length,
    upserted: upsertCount,
    errors: errorCount,
  };
  console.log('[compset-agent] done', summary);
  return NextResponse.json(summary);
}
