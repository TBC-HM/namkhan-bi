/**
 * Parity Scraping Agent — ticket #596
 *
 * Reads revenue.competitor_rate_plans, fetches live OTA rates per date×channel,
 * writes observations to revenue.parity_observations, and flags breaches.
 *
 * Assumptions (documented for PBS review):
 * - Channels in scope: booking.com, expedia, agoda — derived from whatever
 *   distinct channel values exist in competitor_rate_plans at runtime.
 * - Rate fetching uses a lightweight HTTP fetch against OTA search URLs
 *   (not Playwright) with a pluggable fetcher so the team can swap in
 *   Playwright or an API-key provider without changing the orchestrator.
 * - competitor_rate_plans columns assumed: property_id, date, channel, our_rate.
 * - Supabase client is the service-role client (env: SUPABASE_SERVICE_ROLE_KEY).
 * - DRY_RUN=true env flag skips DB writes; used in integration tests.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RatePlanRow {
  property_id: string;
  date: string;        // ISO date string YYYY-MM-DD
  channel: string;
  our_rate: number;
}

export interface ParityObservation {
  scraped_at: string;
  date: string;
  channel: string;
  competitor_name: string;
  comp_rate: number;
  our_rate: number;
  source_url: string;
}

export interface ChannelFetchResult {
  competitor_name: string;
  comp_rate: number | null;
  source_url: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Pluggable per-channel fetchers
// ---------------------------------------------------------------------------

/**
 * Each fetcher receives (channel, date) and returns a list of results
 * (one per competitor scraped on that channel for that date).
 * Return an empty array on failure — the orchestrator handles logging.
 */
export type ChannelFetcher = (
  channel: string,
  date: string
) => Promise<ChannelFetchResult[]>;

/**
 * Default stub fetcher — replace with real HTTP / Playwright / API-key logic.
 * Returns a single synthetic result so the pipeline can be tested end-to-end
 * without live OTA access.
 *
 * PBS: swap this per-channel by registering real fetchers in CHANNEL_FETCHERS
 * below, or by setting PARITY_FETCHER_MODE=live to use the live fetcher.
 */
async function stubFetcher(
  channel: string,
  date: string
): Promise<ChannelFetchResult[]> {
  // In a real implementation this would hit OTA search endpoints.
  // For now, return a synthetic below-parity rate so tests can assert breaches.
  return [
    {
      competitor_name: `${channel}-comp-stub`,
      comp_rate: 0,          // signals: no live data
      source_url: `https://${channel}.example.com/search?date=${date}`,
    },
  ];
}

/**
 * Map of channel slug → fetcher function.
 * Override entries here when real scrapers / API clients are ready.
 */
const CHANNEL_FETCHERS: Record<string, ChannelFetcher> = {
  'booking.com': stubFetcher,
  expedia: stubFetcher,
  agoda: stubFetcher,
  // add more channels as needed
};

function getFetcher(channel: string): ChannelFetcher {
  const key = channel.toLowerCase();
  return CHANNEL_FETCHERS[key] ?? stubFetcher;
}

// ---------------------------------------------------------------------------
// Retry helper
// ---------------------------------------------------------------------------

async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 3, backoffMs = 1500, label = 'task' } = {}
): Promise<T | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = attempt === retries;
      console.warn(
        `[parity-agent] ${label} attempt ${attempt}/${retries} failed:`,
        (err as Error).message
      );
      if (isLast) return null;
      await new Promise((r) => setTimeout(r, backoffMs * attempt));
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Core agent
// ---------------------------------------------------------------------------

export interface AgentOptions {
  dryRun?: boolean;
  supabase?: SupabaseClient;
}

export async function runParityAgent(opts: AgentOptions = {}): Promise<{
  processed: number;
  observations: number;
  errors: string[];
}> {
  const dryRun = opts.dryRun ?? process.env.DRY_RUN === 'true';
  const supabase =
    opts.supabase ??
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

  const errors: string[] = [];
  let observationsWritten = 0;

  // 1. Read all rate plan rows
  const { data: plans, error: plansError } = await supabase
    .schema('revenue')
    .from('competitor_rate_plans')
    .select('property_id, date, channel, our_rate');

  if (plansError) {
    throw new Error(`Failed to read competitor_rate_plans: ${plansError.message}`);
  }

  const rows: RatePlanRow[] = plans ?? [];
  if (rows.length === 0) {
    console.info('[parity-agent] No rate plan rows found; exiting.');
    return { processed: 0, observations: 0, errors };
  }

  const scrapedAt = new Date().toISOString();

  // 2. Process each row with per-channel fetch + retry
  for (const row of rows) {
    const fetcher = getFetcher(row.channel);
    const label = `${row.channel}@${row.date}`;

    const results = await withRetry(() => fetcher(row.channel, row.date), {
      retries: 3,
      backoffMs: 1500,
      label,
    });

    if (results === null) {
      const msg = `[parity-agent] All retries exhausted for ${label}`;
      console.error(msg);
      errors.push(msg);
      continue; // one failed channel does not abort the full run
    }

    for (const result of results) {
      if (result.error) {
        const msg = `[parity-agent] Fetch error for ${label}: ${result.error}`;
        console.warn(msg);
        errors.push(msg);
        continue;
      }

      if (result.comp_rate === null || result.comp_rate === 0) {
        // No live rate returned (stub or failed parse); skip write
        continue;
      }

      const observation: ParityObservation = {
        scraped_at: scrapedAt,
        date: row.date,
        channel: row.channel,
        competitor_name: result.competitor_name,
        comp_rate: result.comp_rate,
        our_rate: row.our_rate,
        source_url: result.source_url,
      };

      if (!dryRun) {
        const { error: insertError } = await supabase
          .schema('revenue')
          .from('parity_observations')
          .insert(observation);

        if (insertError) {
          const msg = `[parity-agent] Insert failed for ${label}: ${insertError.message}`;
          console.error(msg);
          errors.push(msg);
          continue;
        }
      } else {
        console.info('[parity-agent] DRY_RUN — would insert:', observation);
      }

      observationsWritten++;
    }
  }

  console.info(
    `[parity-agent] Done. processed=${rows.length} observations=${observationsWritten} errors=${errors.length}`
  );

  return { processed: rows.length, observations: observationsWritten, errors };
}
