/**
 * Compset Nimble scraping agent
 * Ticket #594 — revive Nimble-based competitor rate fetcher
 *
 * Assumptions:
 *  - Nimble Web API (pipeline="serp") is used with a URL-based scrape target
 *    pointing at Booking.com property pages. Adjust NIMBLE_TARGET_BASE_URL
 *    if the account uses a different pipeline.
 *  - revenue.competitor_property has columns: id (comp_id), nimble_url (or
 *    booking_url), name.  Fallback: we build a generic Booking.com URL from
 *    the property name if nimble_url is absent.
 *  - revenue.competitor_set has columns: comp_id, is_active (bool).
 *  - revenue.competitor_rates has columns: comp_id, stay_date, channel, rate,
 *    source, fetched_at — plus UNIQUE(comp_id, stay_date, channel).
 *    If the constraint is missing, run the companion migration first.
 *  - Stay-date horizon: COMPSET_HORIZON_DAYS env var, default 60.
 *  - Nimble returns a price in the page; we parse the first numeric USD/USD-
 *    adjacent figure as the rate. Channel is always 'booking.com' for this
 *    scrape target (extend parseRate() when other channels are added).
 *  - p-limit is NOT available in this repo so we implement a tiny manual
 *    concurrency limiter (maxConcurrent=3) to avoid hitting Nimble rate limits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const NIMBLE_API_KEY   = process.env.NIMBLE_API_KEY ?? '';
const NIMBLE_ENDPOINT  = 'https://api.webit.live/api/v1/realtime/serp'; // Nimble Web API
const CRON_SECRET      = process.env.CRON_SECRET ?? '';
const HORIZON_DAYS     = parseInt(process.env.COMPSET_HORIZON_DAYS ?? '60', 10);
const MAX_CONCURRENT   = 3;
const DEFAULT_CHANNEL  = 'booking.com';
const SOURCE           = 'nimble';

// Supabase admin client (service role, bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CompProperty {
  comp_id:     string;
  nimble_url?: string | null;
  name:        string;
}

interface RateResult {
  comp_id:    string;
  stay_date:  string;   // YYYY-MM-DD
  channel:    string;
  rate:       number | null;
  error?:     string;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  // 1. Auth — Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get('authorization') ?? '';
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!NIMBLE_API_KEY) {
    return NextResponse.json(
      { error: 'NIMBLE_API_KEY not configured' },
      { status: 500 }
    );
  }

  // 2. Load active comps
  const comps = await loadActiveComps();
  if (!comps.length) {
    return NextResponse.json({ fetched: 0, upserted: 0, errors: 0, message: 'No active comps' });
  }

  // 3. Build work items: comp × stay_date
  const stayDates = buildDateRange(HORIZON_DAYS);
  const tasks: Array<{ comp: CompProperty; stay_date: string }> = [];
  for (const comp of comps) {
    for (const stay_date of stayDates) {
      tasks.push({ comp, stay_date });
    }
  }

  console.log(`[compset-agent] ${comps.length} comps × ${stayDates.length} dates = ${tasks.length} tasks`);

  // 4. Fetch with bounded concurrency
  const results = await runWithConcurrency(tasks, MAX_CONCURRENT, fetchRate);

  // 5. Upsert successes
  const successes = results.filter(r => r.rate !== null) as (RateResult & { rate: number })[];
  const failures  = results.filter(r => r.rate === null);

  let upserted = 0;
  if (successes.length) {
    const rows = successes.map(r => ({
      comp_id:    r.comp_id,
      stay_date:  r.stay_date,
      channel:    r.channel,
      rate:       r.rate,
      source:     SOURCE,
      fetched_at: new Date().toISOString(),
    }));

    const { error: upsertError, count } = await supabase
      .from('competitor_rates')
      .upsert(rows, {
        onConflict:        'comp_id,stay_date,channel',
        ignoreDuplicates:  false,
        count:             'exact',
      })
      .select('comp_id');

    if (upsertError) {
      console.error('[compset-agent] upsert error', upsertError);
    } else {
      upserted = count ?? successes.length;
    }
  }

  // 6. Log & return
  const summary = {
    fetched:  successes.length,
    upserted,
    errors:   failures.length,
    horizon:  HORIZON_DAYS,
    comps:    comps.length,
  };
  console.log('[compset-agent] done', summary);
  return NextResponse.json(summary);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadActiveComps(): Promise<CompProperty[]> {
  // JOIN competitor_set (active filter) → competitor_property
  const { data, error } = await supabase
    .from('competitor_set')
    .select('comp_id, competitor_property!inner(id, name, nimble_url)')
    .eq('is_active', true);

  if (error) {
    console.error('[compset-agent] loadActiveComps error', error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    comp_id:    row.comp_id,
    name:       row.competitor_property?.name ?? row.comp_id,
    nimble_url: row.competitor_property?.nimble_url ?? null,
  }));
}

function buildDateRange(horizonDays: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < horizonDays; i++) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() + i);
    dates.push(d.toISOString().slice(0, 10)); // YYYY-MM-DD
  }
  return dates;
}

async function fetchRate(task: { comp: CompProperty; stay_date: string }): Promise<RateResult> {
  const { comp, stay_date } = task;
  const base: RateResult = { comp_id: comp.comp_id, stay_date, channel: DEFAULT_CHANNEL, rate: null };

  try {
    // Build scrape target URL
    const targetUrl = buildTargetUrl(comp, stay_date);

    // Nimble Web API request
    const nimbleRes = await fetch(NIMBLE_ENDPOINT, {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${NIMBLE_API_KEY}:`).toString('base64')}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        parse:   true,
        url:     targetUrl,
        country: 'TH',           // Laos not always available; TH is nearest proxy
        locale:  'en',
        render:  'html',
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!nimbleRes.ok) {
      const txt = await nimbleRes.text();
      return { ...base, error: `Nimble HTTP ${nimbleRes.status}: ${txt.slice(0, 200)}` };
    }

    const payload = await nimbleRes.json();
    const rate    = parseRate(payload);
    if (rate === null) {
      return { ...base, error: 'rate_not_found' };
    }
    return { ...base, rate };
  } catch (err: any) {
    return { ...base, error: String(err?.message ?? err) };
  }
}

/**
 * Build a Booking.com availability URL for the property + check-in date.
 * Uses nimble_url if stored, otherwise falls back to a search URL.
 * ASSUMPTION: nimble_url is a Booking.com property page URL stored without
 * date params; we append check-in/checkout params.
 */
function buildTargetUrl(comp: CompProperty, stay_date: string): string {
  const [year, month, day] = stay_date.split('-');
  const params = new URLSearchParams({
    checkin_year:  year,
    checkin_month: month,
    checkin_monthday: day,
    checkout_year:  year,
    checkout_month: String(parseInt(month, 10) + (parseInt(day, 10) >= 28 ? 1 : 0)).padStart(2, '0'),
    checkout_monthday: String((parseInt(day, 10) % 28) + 1).padStart(2, '0'),
    no_rooms: '1',
    group_adults: '2',
    selected_currency: 'USD',
  });

  if (comp.nimble_url) {
    const base = comp.nimble_url.split('?')[0];
    return `${base}?${params.toString()}`;
  }

  // Fallback: Booking.com search (less precise; update nimble_url in DB for accuracy)
  const slug = encodeURIComponent(comp.name);
  return `https://www.booking.com/searchresults.en-gb.html?ss=${slug}&${params.toString()}`;
}

/**
 * Extract a numeric rate from the Nimble parsed payload.
 * Nimble's parsed output varies by pipeline. We walk common fields:
 *   payload.parsing_result.price
 *   payload.parsing_result.data.price
 *   payload.parsing_result.results[0].price
 * Then fall back to a regex on the raw HTML (payload.html_content).
 */
function parseRate(payload: any): number | null {
  // Structured parsed paths
  const candidates = [
    payload?.parsing_result?.price,
    payload?.parsing_result?.data?.price,
    payload?.parsing_result?.results?.[0]?.price,
    payload?.parsing_result?.results?.[0]?.min_price,
  ];
  for (const c of candidates) {
    const n = toNumber(c);
    if (n !== null) return n;
  }

  // Regex fallback on raw HTML
  const html: string = payload?.html_content ?? payload?.content ?? '';
  // Look for USD price patterns like "$142" or "USD 142" or "142 USD"
  const match = html.match(/(?:USD|\$)\s*(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s*USD/);
  if (match) {
    const raw = (match[1] ?? match[2]).replace(/,/g, '');
    const n   = parseFloat(raw);
    if (!isNaN(n) && n > 0 && n < 100_000) return n;
  }

  return null;
}

function toNumber(val: unknown): number | null {
  if (typeof val === 'number' && !isNaN(val) && val > 0) return val;
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(/[^\d.]/g, ''));
    if (!isNaN(n) && n > 0) return n;
  }
  return null;
}

/**
 * Run tasks with bounded concurrency without an external library.
 */
async function runWithConcurrency<T, R>(
  items:      T[],
  limit:      number,
  fn:         (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i    = idx++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}
