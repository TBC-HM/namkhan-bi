// app/api/mail/ai/search/route.ts
// POST { prompt } → { ok: true, query: string }
// Converts natural-language query to a Gmail search operator string.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { callAnthropic } from '@/lib/mail/anthropic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body { prompt?: string }

const SEARCH_SYSTEM = `You convert natural-language email search prompts into Gmail search queries. Use ONLY Gmail search operators (from:, to:, cc:, bcc:, subject:, has:attachment, has:drive, filename:, in:, is:unread, is:starred, is:important, label:, list:, newer_than:Nd, older_than:Nd, after:YYYY/MM/DD, before:YYYY/MM/DD, larger:, smaller:, category:, "quoted phrase", OR, -exclude). Return ONLY the query string on a single line. No explanation. No markdown. No quotes around the whole thing.`;

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  const p = (b.prompt || '').trim();
  if (!p) return NextResponse.json({ ok: false, error: 'missing_prompt' }, { status: 400 });

  try {
    const out = await callAnthropic({ system: SEARCH_SYSTEM, prompt: p, maxTokens: 200 });
    // Sanitize: single line, strip surrounding quotes/backticks.
    const query = out.split('\n')[0].trim().replace(/^["`']|["`']$/g, '').trim();
    if (!query) return NextResponse.json({ ok: true, query: p }); // fallback to raw
    return NextResponse.json({ ok: true, query });
  } catch (e: unknown) {
    // Graceful fallback: return the raw prompt so caller can still search.
    return NextResponse.json({ ok: true, query: p, fallback: true, error: e instanceof Error ? e.message : 'ai_search_failed' });
  }
}
