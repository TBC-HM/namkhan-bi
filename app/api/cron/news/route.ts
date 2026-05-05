// app/api/cron/news/route.ts
// GET /api/cron/news — refreshes news.cached_items from RSS sources.
// Triggered by Vercel Cron every 6h.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FEEDS = [
  { name: 'Laotian Times', url: 'https://laotiantimes.com/feed/' },
  { name: 'Vientiane Times', url: 'https://www.vientianetimes.org.la/?format=feed&type=rss' },
];

function parseRss(xml: string, source: string) {
  const items: any[] = [];
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  for (const block of blocks) {
    const get = (tag: string): string | null => {
      const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      if (!m) return null;
      let s = m[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/<[^>]+>/g, '').trim();
      return s || null;
    };
    const title = get('title');
    const link = get('link');
    if (!title || !link) continue;
    const pubDate = get('pubDate') || get('published') || get('dc:date');
    const description = get('description') || get('summary');
    const cats = (block.match(/<category\b[^>]*>([\s\S]*?)<\/category>/gi) || [])
      .map(c => c.replace(/<[^>]+>/g, '').replace(/<!\[CDATA\[|\]\]>/g, '').trim())
      .filter(Boolean);
    items.push({
      source, title, link,
      pub_date: pubDate ? new Date(pubDate).toISOString() : null,
      excerpt: description?.slice(0, 280) || null,
      categories: cats,
    });
  }
  return items;
}

export async function GET(_req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  const all: any[] = [];
  for (const src of FEEDS) {
    try {
      const r = await fetch(src.url, {
        headers: { 'user-agent': 'NamkhanBI/1.0 cron' },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) continue;
      const xml = await r.text();
      all.push(...parseRss(xml, src.name));
    } catch {}
  }

  // Dedupe by link
  const seen = new Set<string>();
  const unique = all.filter(it => {
    if (seen.has(it.link)) return false;
    seen.add(it.link);
    return true;
  });

  // Upsert into news.cached_items (link is the unique key)
  const { error } = await admin.schema('news').from('cached_items')
    .upsert(unique, { onConflict: 'link' });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Trim — keep only last 200 items
  await admin.rpc('news_cache_trim').catch(() => {}); // best-effort if RPC exists

  return NextResponse.json({
    ok: true,
    fetched: unique.length,
    sources: FEEDS.map(f => f.name),
    fetched_at: new Date().toISOString(),
  });
}
