// app/api/marketing/scrape-web-contact/route.ts
// Universal web-scrape endpoint. Called by the bookmarklet popup.
// POST { url, title, html_snippet, target: 'lead'|'subscriber', tags? }
// - extracts + dedupes emails (regex, filters generic/system addresses)
// - Anthropic 2-sentence summary of the org
// - target=lead → fn_lead_upsert (best-guess primary email)
// - target=subscriber → fn_subscriber_bulk_upsert (all emails)
// - logs a marketing.web_scrape_events row via fn_web_scrape_event_insert
// Response includes edit_url (where PBS should land).
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropic, VECTOR_SYSTEM } from '@/lib/mail/anthropic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface Body {
  url?: string;
  title?: string;
  html_snippet?: string;
  target?: 'lead' | 'subscriber';
  tags?: string[];
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const GENERIC_LOCAL_PARTS = new Set([
  'noreply','no-reply','donotreply','do-not-reply',
  'postmaster','mailer-daemon','mailerdaemon',
  'bounce','bounces','abuse','root','daemon',
]);
const BLOCK_DOMAINS = new Set([
  'example.com','example.org','example.net','test.com',
  'sentry.io','sentry-next.wixpress.com',
  'localhost',
]);

function isCidLike(email: string): boolean {
  // CID-embedded (image1@a1b2c3d4.abcdef01) or numeric hex tail
  const local = email.split('@')[0];
  const domain = email.split('@')[1] ?? '';
  if (/@\d+x\d+/i.test(email)) return true;
  if (/^image\d/i.test(local) && /[0-9a-f]{6,}/i.test(domain)) return true;
  if (local.length > 40) return true;
  return false;
}

function extractEmails(html: string): string[] {
  if (!html) return [];
  // Strip <script> and <style> before regex — they often contain false-positive addresses.
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const matches = clean.match(EMAIL_RE) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    const e = raw.toLowerCase().trim();
    const [local, domain] = e.split('@');
    if (!local || !domain) continue;
    if (GENERIC_LOCAL_PARTS.has(local)) continue;
    if (BLOCK_DOMAINS.has(domain)) continue;
    if (isCidLike(e)) continue;
    if (seen.has(e)) continue;
    seen.add(e);
    out.push(e);
    if (out.length >= 20) break;
  }
  return out;
}

// Pick primary email: prefer non-generic, prefer @<page-domain> match, then first.
function pickPrimary(emails: string[], pageUrl: string): string | null {
  if (!emails.length) return null;
  let pageHost = '';
  try { pageHost = new URL(pageUrl).hostname.replace(/^www\./, ''); } catch { /* noop */ }
  const generics = new Set(['info','hello','contact','sales','office','admin','marketing','support']);
  const scored = emails.map((e) => {
    const [local, domain] = e.split('@');
    const isGeneric = generics.has(local);
    const domainMatch = pageHost && (domain === pageHost || domain.endsWith('.' + pageHost));
    let score = 0;
    if (domainMatch) score += 5;
    if (!isGeneric) score += 3;
    if (!/gmail\.com|yahoo\.com|hotmail\.com|outlook\.com/.test(domain)) score += 1;
    return { e, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].e;
}

async function summarise(url: string, title: string | undefined, html: string): Promise<string> {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
  const prompt = [
    'URL: ' + url,
    'TITLE: ' + (title ?? '(none)'),
    '',
    'PAGE TEXT (first 4000 chars):',
    '"""',
    text,
    '"""',
    '',
    'Write exactly two sentences: (1) what this organisation / person does; ',
    '(2) why they might be interesting to a boutique retreat hotel in Luang Prabang, Laos ',
    '(e.g. audience alignment, potential partnership, referral fit). Be specific, ',
    'never generic. No preamble.',
  ].join('\n');
  try {
    return await callAnthropic({
      system: VECTOR_SYSTEM + ' You are producing an internal note for the sales team.',
      prompt,
      maxTokens: 300,
    });
  } catch (e) {
    return 'Auto-summary unavailable · ' + (e instanceof Error ? e.message.slice(0, 100) : 'error');
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b.url || !b.html_snippet) {
    return NextResponse.json({ ok: false, error: 'url_and_html_snippet_required' }, { status: 400 });
  }
  const target: 'lead' | 'subscriber' = b.target === 'lead' ? 'lead' : 'subscriber';
  const emails = extractEmails(b.html_snippet.slice(0, 40000));
  const tags = Array.isArray(b.tags) ? b.tags.filter((t) => typeof t === 'string').slice(0, 10) : [];

  // Summarise in parallel — non-blocking on emails.
  const summary = await summarise(b.url, b.title, b.html_snippet.slice(0, 20000));

  const admin = getSupabaseAdmin();

  let lead_id: number | null = null;
  let subscriber_ids: number[] = [];

  if (target === 'lead') {
    const primary = pickPrimary(emails, b.url);
    const notes = summary + '\n\nScraped from ' + b.url + '\nEmails found: ' + emails.join(', ');
    const companyName =
      (b.title && b.title.length < 120 && b.title) ||
      (primary ? primary.split('@')[1] : 'Web scrape · ' + new URL(b.url).hostname);
    const leadRpc = await admin.rpc('fn_lead_upsert', {
      p: {
        company_name: companyName,
        email: primary ?? null,
        website: b.url,
        source: 'web_scrape',
        origin: 'scraped',
        notes,
      },
    });
    if (leadRpc.error) {
      return NextResponse.json({ ok: false, error: 'lead_upsert_failed: ' + leadRpc.error.message }, { status: 500 });
    }
    lead_id = ((leadRpc.data as { lead_id?: number } | null)?.lead_id ?? null);
  } else {
    if (emails.length > 0) {
      const subRpc = await admin.rpc('fn_subscriber_bulk_upsert', {
        p: {
          source: 'web_scrape',
          tags: ['from_scrape', ...tags],
          notes: summary,
          created_by: user.id,
          rows: emails.map((e) => ({ email: e, tags: ['from_scrape', ...tags] })),
        },
      });
      if (subRpc.error) {
        return NextResponse.json({ ok: false, error: 'subscriber_upsert_failed: ' + subRpc.error.message }, { status: 500 });
      }
      subscriber_ids = ((subRpc.data as { ids?: number[] } | null)?.ids ?? []);
    }
  }

  // Log the scrape event (always, even if 0 emails — useful for audit)
  await admin.rpc('fn_web_scrape_event_insert', {
    p: {
      url: b.url,
      title: b.title ?? null,
      target,
      tags,
      emails_found: emails,
      summary,
      lead_id,
      subscriber_ids,
      created_by: user.id,
    },
  });

  const editUrl = target === 'lead' && lead_id
    ? '/sales/leads/' + lead_id
    : '/marketing/subscribers';

  return NextResponse.json({
    ok: true,
    target,
    count_emails: emails.length,
    emails,
    lead_id,
    subscriber_ids,
    summary,
    edit_url: editUrl,
  });
}
