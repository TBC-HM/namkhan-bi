// app/api/live/news/route.ts
// GET /api/live/news?lim=10&q=tourism
// Aggregates Lao-relevant news from Laotian Times RSS (free, public).
// No DB caching — fetched on demand. Rate-limit-friendly enough for portal use.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FEEDS = [
  // primary — Laotian Times publishes a WordPress feed
  { name: 'Laotian Times', url: 'https://laotiantimes.com/feed/' },
  // backup — Vientiane Times runs Joomla, RSS is at /index.php?format=feed&type=rss
  { name: 'Vientiane Times', url: 'https://www.vientianetimes.org.la/?format=feed&type=rss' },
];

type NewsItem = {
  source: string;
  title: string;
  link: string;
  pub_date: string | null;
  excerpt: string | null;
  categories: string[];
};

// Tiny RSS parser — no xml2js dependency. Handles standard RSS 2.0 + simple Atom.
function parseRss(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item\b[\s\S]*?<\/item>/gi;
  const blocks = xml.match(itemRegex) || [];
  for (const block of blocks) {
    const get = (tag: string): string | null => {
      const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const m = block.match(re);
      if (!m) return null;
      // strip CDATA + html tags from text fields
      let s = m[1];
      s = s.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');
      s = s.replace(/<[^>]+>/g, '').trim();
      return s || null;
    };
    const title = get('title');
    const link = get('link');
    if (!title || !link) continue;
    const description = get('description') || get('summary');
    const pubDate = get('pubDate') || get('published') || get('dc:date');
    const cats = (block.match(/<category\b[^>]*>([\s\S]*?)<\/category>/gi) || [])
      .map(c => (c.replace(/<[^>]+>/g, '').replace(/<!\[CDATA\[|\]\]>/g, '').trim()))
      .filter(Boolean);
    items.push({
      source,
      title,
      link,
      pub_date: pubDate ? new Date(pubDate).toISOString() : null,
      excerpt: description ? description.slice(0, 280) : null,
      categories: cats,
    });
  }
  return items;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lim = Math.min(50, parseInt(searchParams.get('lim') || '15'));
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const skipCache = searchParams.get('fresh') === '1';

  // 1. Try cache first (populated by /api/cron/news every 6h)
  if (!skipCache) {
    try {
      const admin = getSupabaseAdmin();
      let qb = admin.schema('news').from('cached_items')
        .select('source, title, link, pub_date, excerpt, categories, fetched_at')
        .order('pub_date', { ascending: false, nullsFirst: false })
        .limit(lim);
      const { data, error } = await qb;
      if (!error && data && data.length > 0) {
        const filtered = q
          ? data.filter((it: any) =>
              (it.title?.toLowerCase().includes(q)) ||
              (it.excerpt?.toLowerCase().includes(q)))
          : data;
        return NextResponse.json({
          ok: true,
          count: filtered.length,
          items: filtered,
          sources: ['Laotian Times','Vientiane Times'],
          fetched_at: data[0].fetched_at,
          source_mode: 'cache',
        });
      }
    } catch {}
  }

  const fetchOne = async (src: { name: string; url: string }) => {
    try {
      const r = await fetch(src.url, {
        headers: { 'user-agent': 'NamkhanBI/1.0 (+https://namkhan-bi.vercel.app)' },
        // best-effort fetch with short timeout
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return [];
      const xml = await r.text();
      return parseRss(xml, src.name);
    } catch {
      return [];
    }
  };

  const all = (await Promise.all(FEEDS.map(fetchOne))).flat();

  // optional keyword filter (case-insensitive on title or excerpt)
  const filtered = q
    ? all.filter(it =>
        (it.title && it.title.toLowerCase().includes(q)) ||
        (it.excerpt && it.excerpt.toLowerCase().includes(q)))
    : all;

  // sort newest first
  filtered.sort((a, b) => {
    const aT = a.pub_date ? new Date(a.pub_date).getTime() : 0;
    const bT = b.pub_date ? new Date(b.pub_date).getTime() : 0;
    return bT - aT;
  });

  return NextResponse.json({
    ok: true,
    count: filtered.length,
    items: filtered.slice(0, lim),
    sources: FEEDS.map(f => f.name),
    fetched_at: new Date().toISOString(),
    source_mode: 'live',
  });
}
