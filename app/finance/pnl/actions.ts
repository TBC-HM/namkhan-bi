// app/finance/pnl/actions.ts
// Server actions for /finance/pnl. Currently: regenerateCommentary calls
// Claude API and inserts a row into gl.commentary_drafts.

'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

interface CommentaryPayload {
  monthLabel: string;
  totalRev: number;
  priorTotalRev: number;
  revVsPriorPct: number;
  gop: number | null;
  gopMomDelta: number | null;
  gopMomPct: number | null;
  revVsLyPct: number | null;
  agTotal: number;
  agPrior: number;
  fbLabour: number;
  fbRev: number;
  fbLabourPct: number | null;
  fbCogsPct: number | null;
  utilCur: number;
  utilPrior: number;
  occPct: number | null;
  adr: number | null;
  topVariances: { dept: string; delta: number }[];
}

export async function regenerateCommentary(formData: FormData) {
  const period = String(formData.get('period') || '');
  const payloadStr = String(formData.get('payload') || '{}');
  if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(period)) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[commentary] ANTHROPIC_API_KEY not set — skipping LLM call');
    return;
  }

  let p: CommentaryPayload;
  try { p = JSON.parse(payloadStr); }
  catch { return; }

  const prompt = buildPrompt(p);

  // Anthropic Messages API call
  let body: string;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('[commentary] Claude API error', res.status, errText);
      return;
    }
    const data = await res.json() as { content: Array<{ type: string; text: string }> };
    body = data.content?.find(c => c.type === 'text')?.text?.trim() ?? '';
  } catch (err) {
    console.error('[commentary] fetch failed', err);
    return;
  }

  if (!body) return;

  // Insert into gl.commentary_drafts
  const sb = getSupabaseAdmin();
  const periodStart = `${period}-01`;
  const [yy, mm] = period.split('-').map(Number);
  const lastDay = new Date(yy, mm, 0).toISOString().slice(0, 10);
  await sb.schema('gl').from('commentary_drafts').insert({
    period_start: periodStart,
    period_end: lastDay,
    tone_preset: 'owner_brief',
    body,
    status: 'draft',
  });

  revalidatePath('/finance/pnl');
}

function buildPrompt(p: CommentaryPayload): string {
  const fmtK = (n: number | null | undefined) => {
    if (n == null || !isFinite(n)) return '—';
    const abs = Math.abs(n);
    const s = n < 0 ? '−' : '';
    return abs >= 1000 ? `${s}$${(abs/1000).toFixed(1)}k` : `${s}$${Math.round(abs)}`;
  };
  const variances = p.topVariances.map(v => `  · ${v.dept}: ${v.delta >= 0 ? '+' : ''}${fmtK(v.delta)}`).join('\n');

  return `You are a senior hospitality CFO writing a monthly variance commentary for a hotel owner. Write 4-6 short paragraphs. Be blunt, action-oriented. No motivational tone. Use numbers from below — do not invent. Reference USALI 11th ed structure.

Context (${p.monthLabel}):
- Total revenue: ${fmtK(p.totalRev)} (${p.revVsPriorPct >= 0 ? '+' : ''}${p.revVsPriorPct.toFixed(1)}% vs prior month ${fmtK(p.priorTotalRev)})
- GOP: ${fmtK(p.gop)} ${p.gopMomDelta != null ? `(${p.gopMomDelta >= 0 ? '+' : '−'}${fmtK(Math.abs(p.gopMomDelta))} MoM, ${p.gopMomPct?.toFixed(0) ?? '—'}%)` : ''}
- Revenue vs LY same month: ${p.revVsLyPct != null ? `${p.revVsLyPct >= 0 ? '+' : ''}${p.revVsLyPct.toFixed(1)}%` : 'no LY comparable'}
- A&G: ${fmtK(p.agTotal)} (prior ${fmtK(p.agPrior)})
- F&B labour ratio: ${p.fbLabourPct?.toFixed(1) ?? '—'}% on ${fmtK(p.fbRev)} revenue (target 28-32%)
- F&B cost of sales: ${p.fbCogsPct?.toFixed(1) ?? '—'}% (target ≤ 32%)
- Utilities: ${fmtK(p.utilCur)} (prior ${fmtK(p.utilPrior)})
- Occupancy: ${p.occPct?.toFixed(1) ?? '—'}% · ADR: ${p.adr != null ? `$${p.adr.toFixed(0)}` : '—'}

Top dept profit variances:
${variances || '  (none)'}

Output sections:
1. **Headline** — one sentence, the most important number this month.
2. **What moved** — top 2-3 dept moves with $ + % + likely cause.
3. **Margin watch** — F&B cost ratio, A&G $, labour %. Flag breaches of norms.
4. **Owner action** — exactly one concrete next step in 1-2 sentences. Specific, measurable.

Plain text. No markdown headers. No emojis. Use bold sparingly via \`**text**\`. Keep total under 280 words.`;
}
