// app/api/marketing/prospects/scrape/route.ts
// PBS 2026-07-06: Direct Apify integration — pick an actor, feed input, results land in
// web_analytics.subscribers with proper source/tag/country classification.
//
// Auth: token pulled from Supabase Vault via public.fn_read_vault_secret('apify_api_token').
// Runtime: Node (long-running fetch to Apify sync endpoint, up to 4 min).
// Rate: single run per request. Rate-limit protection lives in Apify itself.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Vercel Pro; on Hobby caps to 60s (still works for small scrapes)

// -----------------------------------------------------------------------------
// Actor catalog — add new actors here. Each entry defines input shape + mapper.
// -----------------------------------------------------------------------------
type ActorId =
  | 'gmaps_contacts'      // compass/google-maps-with-contact-details-scraper — emails + Maps
  | 'google_search'       // apify/google-search-scraper — SERP results
  | 'booking'             // voyager/booking-scraper — hotel listings
  | 'email_social';       // poidata/email-and-social-scraper — enrich URLs → emails

interface ScrapeInput {
  actor: ActorId;
  input: Record<string, unknown>;
  property_id?: number;
  tag_hint?: string;
  // Override the actor slug — copy this from Apify Console URL, e.g.
  // https://console.apify.com/actors/lukaskrivka~google-maps-with-contact-details → 'lukaskrivka~google-maps-with-contact-details'.
  // Format: <owner>~<actor-name>. When set, ignores the default `slug` from ACTORS map.
  slug_override?: string;
}

const ACTORS: Record<ActorId, { slug: string; label: string }> = {
  gmaps_contacts: { slug: 'compass~google-maps-with-contact-details-scraper', label: 'Google Maps + Emails' },
  google_search:  { slug: 'apify~google-search-scraper',                     label: 'Google Search SERP' },
  booking:        { slug: 'voyager~booking-scraper',                         label: 'Booking.com Hotels' },
  email_social:   { slug: 'poidata~email-and-social-scraper',                label: 'Website Email Extractor' },
};

// -----------------------------------------------------------------------------
// Output mappers — actor dataset item → web_analytics.subscribers row
// -----------------------------------------------------------------------------
type PendingRow = {
  email: string | null;
  company: string | null;
  website: string | null;
  phone: string | null;
  country: string | null;
  notes: string | null;
  prospect_kind: string;
  import_source_file: string;
};

// Google Maps + Contact Details returns:
//   { title, url (Google Maps URL), website (real business URL), phone, phoneUnformatted,
//     emails[] OR email OR contactDetails{emails[]}, address, city, countryCode,
//     categoryName, totalScore, reviewsCount }
// Actor variations put emails under different keys — check all of them.
function pickEmails(item: Record<string, unknown>): string[] {
  const cands: string[] = [];
  if (Array.isArray(item.emails)) cands.push(...(item.emails as string[]));
  if (typeof item.email === 'string') cands.push(item.email as string);
  if (Array.isArray(item.email)) cands.push(...(item.email as string[]));
  const cd = item.contactDetails as Record<string, unknown> | undefined;
  if (cd && Array.isArray(cd.emails)) cands.push(...(cd.emails as string[]));
  if (cd && typeof cd.email === 'string') cands.push(cd.email as string);
  const contacts = item.contacts as Record<string, unknown> | undefined;
  if (contacts && Array.isArray(contacts.emails)) cands.push(...(contacts.emails as string[]));
  return Array.from(new Set(cands.filter((e) => typeof e === 'string' && /@/.test(e)).map((e) => e.toLowerCase())));
}
function mapGmaps(item: Record<string, unknown>): PendingRow[] {
  const emails = pickEmails(item);
  const realWebsite = (item.website as string) || (item.websiteUrl as string) || null;
  const gmapsUrl    = (item.url as string) || null;
  const base = {
    company: (item.title as string) || (item.name as string) || null,
    // Prefer the real business website; fall back to Google Maps URL as reference
    website: realWebsite || gmapsUrl,
    phone:   (item.phoneUnformatted as string) || (item.phone as string) || null,
    country: ((item.countryCode as string) || '').toUpperCase() || null,
    notes: [
      item.categoryName,
      item.address,
      item.totalScore ? `★${item.totalScore}` : null,
      !realWebsite && gmapsUrl ? 'no website scraped' : null,
    ].filter(Boolean).join(' · '),
    prospect_kind: 'contact_with_email',
    import_source_file: 'apify_gmaps_contacts',
  };
  if (emails.length === 0) return [{ ...base, email: null, prospect_kind: 'company_pending_email' }];
  return emails.map((e) => ({ ...base, email: e }));
}

// Google Search returns: { title, url, displayedUrl, description, position, type }
function mapSerp(item: Record<string, unknown>): PendingRow[] {
  return [{
    email: null,
    company: (item.title as string) || null,
    website: (item.url as string) || null,
    phone: null,
    country: null,
    notes: `SERP · ${(item.description as string || '').slice(0, 200)}`,
    prospect_kind: 'company_pending_email',
    import_source_file: 'apify_google_search',
  }];
}

// Booking returns: { name, address, url, price, rating, reviews, images... }
function mapBooking(item: Record<string, unknown>): PendingRow[] {
  const loc = (item.address as string) || '';
  return [{
    email: null,
    company: (item.name as string) || null,
    website: (item.url as string) || null,
    phone: null,
    country: /luang.?prabang|vientiane|vang.?vieng|laos/i.test(loc) ? 'LA' : null,
    notes: `Booking · ${loc}${item.rating ? ' · ★' + item.rating : ''}`,
    prospect_kind: 'compset_hotel',
    import_source_file: 'apify_booking',
  }];
}

// Email scraper returns: { url, email[], phone[], facebook, twitter, ... }
function mapEmailSocial(item: Record<string, unknown>): PendingRow[] {
  const emails = Array.isArray(item.email) ? item.email as string[]
               : Array.isArray(item.emails) ? item.emails as string[]
               : (typeof item.email === 'string' ? [item.email as string] : []);
  const base = {
    company: null,
    website: (item.url as string) || null,
    phone: Array.isArray(item.phone) ? (item.phone as string[])[0] : (item.phone as string) || null,
    country: null,
    notes: 'Website email extraction',
    prospect_kind: 'contact_with_email',
    import_source_file: 'apify_email_social',
  };
  if (emails.length === 0) return [];
  return emails.map((e) => ({ ...base, email: (e as string).toLowerCase() }));
}

function mapItem(actor: ActorId, item: Record<string, unknown>): PendingRow[] {
  switch (actor) {
    case 'gmaps_contacts': return mapGmaps(item);
    case 'google_search':  return mapSerp(item);
    case 'booking':        return mapBooking(item);
    case 'email_social':   return mapEmailSocial(item);
  }
}

// -----------------------------------------------------------------------------
// POST handler
// -----------------------------------------------------------------------------
export async function POST(req: Request) {
  const started = Date.now();
  let body: ScrapeInput;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  const actor = body.actor;
  if (!actor || !(actor in ACTORS)) {
    return NextResponse.json({ ok: false, error: 'unknown_actor', supported: Object.keys(ACTORS) }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // 1. Read Apify token from Vault
  const { data: tokenData, error: tokenErr } = await sb.rpc('fn_read_vault_secret', { p_name: 'apify_api_token' });
  if (tokenErr || !tokenData) {
    return NextResponse.json({ ok: false, error: 'vault_read_failed', detail: tokenErr?.message }, { status: 500 });
  }
  const token = String(tokenData);

  // 2. Call Apify sync-get-dataset-items — waits up to 4min, returns items array
  //    slug_override lets caller paste the exact actor slug from Apify Console.
  const slug = (body.slug_override && /^[a-zA-Z0-9_~-]+$/.test(body.slug_override))
    ? body.slug_override
    : ACTORS[actor].slug;
  const apifyUrl = `https://api.apify.com/v2/acts/${slug}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=240&format=json&clean=1`;
  let items: Array<Record<string, unknown>> = [];
  let apifyStatus = 0;
  try {
    const res = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body.input || {}),
    });
    apifyStatus = res.status;
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({
        ok: false, error: 'apify_error', status: res.status, detail: errText.slice(0, 500),
      }, { status: 502 });
    }
    const parsed = await res.json();
    items = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return NextResponse.json({
      ok: false, error: 'apify_fetch_failed', detail: e instanceof Error ? e.message : String(e),
    }, { status: 502 });
  }

  // 3. Map items → subscriber rows
  const propertyId = body.property_id ?? 260955;
  const rows: PendingRow[] = [];
  for (const it of items) rows.push(...mapItem(actor, it));

  if (rows.length === 0) {
    return NextResponse.json({
      ok: true, actor, items_returned: items.length, inserted: 0, skipped: 0, note: 'no_mappable_rows',
      duration_ms: Date.now() - started, apify_status: apifyStatus,
    });
  }

  // 4. Insert into web_analytics.subscribers (dedup on email UNIQUE via ON CONFLICT DO NOTHING)
  const inserts = rows.map((r) => ({
    email: r.email,
    company: r.company,
    website: r.website,
    phone: r.phone,
    country: r.country,
    notes: r.notes,
    prospect_kind: r.prospect_kind,
    import_source_file: r.import_source_file,
    property_id: propertyId,
    lifecycle_stage: 'new',
    email_verify_status: r.email ? 'unverified' : null,
  }));

  // Bulk-insert via SECURITY DEFINER RPC (bypasses PostgREST's public-schema-only restriction)
  const { data: ingestData, error: ingestErr } = await sb.rpc('fn_apify_ingest_prospects', {
    p_rows: inserts as unknown as object,
  });

  if (ingestErr) {
    return NextResponse.json({
      ok: false, actor, items_returned: items.length,
      error: 'ingest_failed', detail: ingestErr.message,
      duration_ms: Date.now() - started, apify_status: apifyStatus,
    }, { status: 500 });
  }

  const stats = (ingestData ?? {}) as { inserted?: number; skipped?: number };
  // Debug: expose the top-level keys of the first item so we can see what fields the actor returned.
  // Useful when emails come back 0 — helps identify a nested key name.
  const sample_keys = items.length > 0 ? Object.keys(items[0]).sort() : [];
  const sample_first_email = items.length > 0 ? (pickEmails(items[0])[0] ?? null) : null;

  return NextResponse.json({
    ok: true,
    actor,
    items_returned: items.length,
    inserted: stats.inserted ?? 0,
    skipped: stats.skipped ?? 0,
    duration_ms: Date.now() - started,
    apify_status: apifyStatus,
    debug: { sample_keys, sample_first_email, mapped_rows: rows.length },
  });
}