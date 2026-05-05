// POST /api/compset/scoring/draft
// Creates a new draft scoring_config row by calling the
// public.compset_create_scoring_config_draft RPC. Returns { ok, config_id }.
//
// Body shape:
//   {
//     weight_dow: number,
//     weight_event: number,
//     weight_lead_time: number,
//     weight_peak_bonus: number,
//     dow_scores: Record<string, number>,    // keys "0".."6"
//     lead_time_bands: Array<{ label, score, max_days }>,
//     notes?: string | null
//   }
//
// Validation enforces what the editor enforces (weights sum to 1±0.01, scores 0-100).
// The RPC also re-validates on the server side.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  weight_dow?: unknown;
  weight_event?: unknown;
  weight_lead_time?: unknown;
  weight_peak_bonus?: unknown;
  dow_scores?: unknown;
  lead_time_bands?: unknown;
  notes?: unknown;
};

function asNum(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length === 0 ? null : s;
}

const DOW_KEYS = ['0', '1', '2', '3', '4', '5', '6'] as const;

export async function POST(req: Request) {
  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'admin client unavailable' },
      { status: 500 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const wd = asNum(body.weight_dow);
  const we = asNum(body.weight_event);
  const wl = asNum(body.weight_lead_time);
  const wp = asNum(body.weight_peak_bonus);
  if (wd == null || we == null || wl == null || wp == null) {
    return NextResponse.json(
      { ok: false, error: 'All four weights must be numeric.' },
      { status: 400 },
    );
  }
  const sum = wd + we + wl + wp;
  if (Math.abs(sum - 1) > 0.011) {
    return NextResponse.json(
      { ok: false, error: `Weights must sum to 1.00 (got ${sum.toFixed(2)}).` },
      { status: 400 },
    );
  }

  // Validate dow_scores
  const rawDow = body.dow_scores;
  if (
    !rawDow ||
    typeof rawDow !== 'object' ||
    Array.isArray(rawDow)
  ) {
    return NextResponse.json(
      { ok: false, error: 'dow_scores must be an object keyed "0".."6".' },
      { status: 400 },
    );
  }
  const dowMap: Record<string, number> = {};
  for (const k of DOW_KEYS) {
    const n = asNum((rawDow as Record<string, unknown>)[k]);
    if (n == null || n < 0 || n > 100) {
      return NextResponse.json(
        { ok: false, error: `dow_scores["${k}"] must be a number 0–100.` },
        { status: 400 },
      );
    }
    dowMap[k] = n;
  }

  // Validate lead_time_bands
  const rawBands = body.lead_time_bands;
  if (!Array.isArray(rawBands) || rawBands.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'lead_time_bands must be a non-empty array.' },
      { status: 400 },
    );
  }
  const bands: Array<{ label: string; score: number; max_days: number }> = [];
  for (let i = 0; i < rawBands.length; i++) {
    const b = rawBands[i] as Record<string, unknown>;
    const label = asString(b?.label);
    const score = asNum(b?.score);
    const maxDays = asNum(b?.max_days);
    if (!label) {
      return NextResponse.json(
        { ok: false, error: `Band #${i + 1} needs a non-empty label.` },
        { status: 400 },
      );
    }
    if (score == null || score < 0 || score > 100) {
      return NextResponse.json(
        { ok: false, error: `Band #${i + 1} score must be 0–100.` },
        { status: 400 },
      );
    }
    if (maxDays == null || maxDays < 1) {
      return NextResponse.json(
        { ok: false, error: `Band #${i + 1} max_days must be ≥1.` },
        { status: 400 },
      );
    }
    if (i > 0 && maxDays <= bands[i - 1].max_days) {
      return NextResponse.json(
        {
          ok: false,
          error: `Band #${i + 1} max_days (${maxDays}) must be > previous band's (${bands[i - 1].max_days}).`,
        },
        { status: 400 },
      );
    }
    bands.push({ label, score, max_days: maxDays });
  }

  const notes = asString(body.notes);

  const { data, error } = await admin.rpc('compset_create_scoring_config_draft', {
    p_weight_dow: wd,
    p_weight_event: we,
    p_weight_lead_time: wl,
    p_weight_peak_bonus: wp,
    p_dow_scores: dowMap,
    p_lead_time_bands: bands,
    p_notes: notes,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, config_id: data as string });
}
