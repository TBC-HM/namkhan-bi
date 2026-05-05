// app/api/docs/ask/route.ts
// POST /api/docs/ask
// ----------------------------------------------------------------------------
// Question-answering over the docs corpus.
// Flow: top-k tsv retrieval → Claude Sonnet synthesis with [doc_id] citations.
// No embeddings yet — relies on rich keyword extraction at ingest time.
//
// Body: { question: string }
// Returns: { answer, citations: [...], chunks_used: [...], confidence: number }
// ----------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { loadShared } from '@/lib/prompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const MIN_RANK = 0.05;     // below this → "no clear answer"
const TOP_K = 6;

// Common English stopwords + interrogatives. Anything not in this list is kept.
// Includes possessives, articles, and "do/does/did/can/should/would/could/may/might/will/shall"
// because those break tsv match when tsv config is `simple`.
const STOPWORDS = new Set([
  'a','an','the','and','or','but','if','of','at','by','for','with','about','against',
  'between','into','through','during','before','after','above','below','to','from','up',
  'down','in','out','on','off','over','under','again','further','then','once','here',
  'there','when','where','why','how','what','which','who','whom','whose','this','that',
  'these','those','am','is','are','was','were','be','been','being','have','has','had',
  'having','do','does','did','doing','will','would','should','could','can','may','might',
  'must','shall','i','me','my','myself','we','our','ours','ourselves','you','your',
  'yours','yourself','he','him','his','himself','she','her','hers','herself','it','its',
  'itself','they','them','their','theirs','themselves','as','until','while','because',
  'so','than','too','very','s','t','don','now','d','ll','m','o','re','ve','y','some',
  'any','no','not','only','own','same','also','just','please',
]);
function stripStopwords(q: string): string {
  const tokens = q.toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(w => !STOPWORDS.has(w) && w.length > 1);
  // If everything got stripped (e.g. "what is this?"), fall back to original.
  return tokens.length > 0 ? tokens.join(' ') : q;
}

const SYSTEM_PROMPT = `You answer questions using ONLY the provided document excerpts.
Rules:
- Answer concisely (1-4 sentences). If the answer is a procedure or list, use bullets.
- ALWAYS cite the source(s) inline using the format [#N] where N is the excerpt number.
- If the excerpts don't contain the answer, say exactly: "I don't have a clear answer in your indexed docs." Do NOT guess.
- For chemicals, dosages, safety, or legal/financial advice: only quote verbatim from a [#N] source. Never paraphrase risky instructions.
- Match the language of the question (en/lo/fr/es).`;

export async function POST(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  let body: { question?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  const question = (body.question || '').trim();
  if (question.length < 3) return NextResponse.json({ ok: false, error: 'question_too_short' }, { status: 400 });

  // tsv was built with `simple` config (no stopwords) so plainto_tsquery
  // AND-joins every word including "what / should / I / the / a", which
  // causes natural-language questions to match zero docs. Strip common
  // English stopwords + question-words before retrieval.
  const queryTerms = stripStopwords(question);

  // --- 1. Try chunk-level retrieval FIRST (paragraph precision)
  const { data: chunkRows, error: chunkErr } = await admin.rpc('docs_ask_chunks', {
    q: queryTerms,
    lim: TOP_K,
  });

  let hits: Array<{
    doc_id: string;
    title: string;
    doc_type: string;
    external_party: string | null;
    valid_from: string | null;
    valid_until: string | null;
    importance: string;
    summary: string | null;
    body_excerpt: string | null;
    rank: number;
    page_num?: number | null;
    chunk_idx?: number | null;
  }> = [];

  if (!chunkErr && chunkRows && chunkRows.length > 0) {
    // Map chunk rows → hits format (chunk content becomes body_excerpt)
    hits = (chunkRows as any[]).map(c => ({
      doc_id: c.doc_id,
      title: c.doc_title,
      doc_type: c.doc_type,
      external_party: c.external_party,
      valid_from: null,
      valid_until: null,
      importance: c.importance,
      summary: null,
      body_excerpt: c.content,
      rank: c.rank,
      page_num: c.page_num,
      chunk_idx: c.chunk_idx,
    }));
  } else {
    // Fallback to doc-level retrieval (e.g. for docs that have no chunks yet)
    const { data: chunks, error: rpcErr } = await admin.rpc('docs_topk', {
      q: queryTerms,
      lim: TOP_K,
    });
    if (rpcErr) {
      return NextResponse.json({
        ok: false, stage: 'retrieval', error: rpcErr.message,
      }, { status: 500 });
    }
    hits = (chunks || []) as typeof hits;
  }

  // No matches at all → graceful skip
  if (hits.length === 0) {
    return NextResponse.json({
      ok: true,
      answer: "I don't have a clear answer in your indexed docs. Try uploading more docs or rephrasing.",
      citations: [],
      chunks_used: [],
      confidence: 0,
    });
  }

  // Confidence gate: top result must be at least MIN_RANK
  const topRank = hits[0].rank;
  if (topRank < MIN_RANK) {
    return NextResponse.json({
      ok: true,
      answer: "I don't have a clear answer in your indexed docs.",
      citations: hits.map(h => ({
        doc_id: h.doc_id, title: h.title, doc_type: h.doc_type,
        external_party: h.external_party, importance: h.importance, rank: h.rank,
      })),
      chunks_used: [],
      confidence: topRank,
    });
  }

  // --- 2. Build context for Claude
  const numbered = hits.map((h, i) => {
    const meta = [
      h.doc_type,
      h.external_party || null,
      h.page_num ? `p.${h.page_num}` : null,
      h.importance,
    ].filter(Boolean).join(' · ');
    return `[#${i + 1}] ${h.title}\n  (${meta})\n  EXCERPT: ${(h.body_excerpt || h.summary || '').slice(0, 2000)}`;
  }).join('\n\n---\n\n');

  const userMsg =
    `QUESTION: ${question}\n\n` +
    `DOCUMENT EXCERPTS:\n\n${numbered}\n\n` +
    `Answer the question using ONLY the excerpts above. Cite sources as [#N].`;

  // --- 3. Call Claude Sonnet
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });
  }

  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      temperature: 0.2,
      system: await (async () => {
        const shared = await loadShared();
        return [
          SYSTEM_PROMPT,
          '\n---\n## Output style (shared)\n', shared.output_style,
          '\n## Version policy (shared) — always say which version you cite\n', shared.version_policy,
        ].join('\n');
      })(),
      messages: [{ role: 'user', content: userMsg }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return NextResponse.json({
      ok: false, stage: 'synthesis', error: `Anthropic ${resp.status}: ${err}`,
    }, { status: 500 });
  }

  const data = await resp.json() as { content: { type: string; text: string }[] };
  const answer = data.content.find(c => c.type === 'text')?.text ?? '';

  // --- 4. Extract which [#N] citations the model actually used
  const citedNums = new Set<number>();
  for (const m of answer.matchAll(/\[#(\d+)\]/g)) citedNums.add(parseInt(m[1]));

  const citations = Array.from(citedNums)
    .filter(n => n >= 1 && n <= hits.length)
    .map(n => {
      const h = hits[n - 1];
      return {
        ref: `#${n}`,
        doc_id: h.doc_id,
        title: h.title,
        doc_type: h.doc_type,
        external_party: h.external_party,
        valid_from: h.valid_from,
        valid_until: h.valid_until,
        importance: h.importance,
      };
    });

  return NextResponse.json({
    ok: true,
    answer,
    citations,
    chunks_used: hits.map((h, i) => ({
      ref: `#${i + 1}`,
      doc_id: h.doc_id,
      title: h.title,
      doc_type: h.doc_type,
      rank: h.rank,
    })),
    confidence: topRank,
  });
}
