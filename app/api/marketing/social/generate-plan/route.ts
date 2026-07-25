// app/api/marketing/social/generate-plan/route.ts
// spec-social-media-module (2026-07-25, run 2) · A3/A6 — social plan generator.
// Rule-based v1 (deterministic, no AI): expands the weekly content programs in
// marketing.social_programs (weekday_slots use ISO 1=Mon..7=Sun) into proposed
// slots in marketing.social_calendar for a date range. Mirrors the newsletter
// director generate-plan API shape; slot writes go through
// public.fn_social_slot_upsert (SECURITY DEFINER — marketing.* is not
// PostgREST-writable, claude_md §0.5).
//
// Body: { property_id?, start_date?, end_date?, regenerate_empty_only? }
// Defaults: Namkhan 260955 · today .. +28d · regenerate_empty_only=true
// (existing non-rejected slots for the same (date, platform, program) are
// left untouched — fn_social_slot_upsert matches on that identity, and with
// regenerate_empty_only we skip them client-side too so statuses survive).

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NAMKHAN_PID = 260955;

type Body = {
  property_id?: number;
  start_date?: string;
  end_date?: string;
  regenerate_empty_only?: boolean;
};

type ProgramRow = {
  id: number;
  platform: string;
  category_code: string;
  label: string;
  weekday_slots: number[] | null;
  posts_per_week: number | null;
  notes: string | null;
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isoWeekday(d: Date): number {
  const w = d.getUTCDay(); // Sun=0..Sat=6
  return w === 0 ? 7 : w;  // ISO Mon=1..Sun=7
}

// Default format per platform — refined later per marketing.social_channel_rules.
const DEFAULT_FORMAT: Record<string, string> = {
  instagram: 'Reel', tiktok: 'Reel', facebook: 'Photo', google_business: 'Photo',
  pinterest: 'Photo', linkedin: 'Photo', x: 'Photo',
};

export async function POST(req: NextRequest) {
  const body: Body = await req.json().catch(() => ({}));
  const propertyId = Number(body.property_id ?? NAMKHAN_PID);
  const start = body.start_date ?? ymd(new Date());
  const end = body.end_date ?? ymd(new Date(Date.now() + 28 * 86400000));
  const emptyOnly = body.regenerate_empty_only !== false;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start >= end) {
    return NextResponse.json({ ok: false, error: 'invalid date range' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  const [programsRes, existingRes] = await Promise.all([
    sb.from('v_social_programs').select('id, platform, category_code, label, weekday_slots, posts_per_week, notes')
      .eq('property_id', propertyId).eq('active', true),
    sb.from('v_social_calendar_slots').select('slot_date, platform, program_id, status')
      .eq('property_id', propertyId).gte('slot_date', start).lt('slot_date', end),
  ]);
  if (programsRes.error) return NextResponse.json({ ok: false, error: programsRes.error.message }, { status: 500 });
  if (existingRes.error) return NextResponse.json({ ok: false, error: existingRes.error.message }, { status: 500 });

  const programs = (programsRes.data ?? []) as ProgramRow[];
  if (programs.length === 0) {
    return NextResponse.json({ ok: false, error: `no active programs for property ${propertyId} — seed marketing.social_programs first` }, { status: 400 });
  }

  const existing = new Set(
    (existingRes.data ?? [])
      .filter((s: any) => s.status !== 'rejected')
      .map((s: any) => `${s.slot_date}|${s.platform}|${s.program_id ?? 'null'}`),
  );

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  const startD = new Date(start + 'T00:00:00Z');
  const endD = new Date(end + 'T00:00:00Z');

  for (let t = startD.getTime(); t < endD.getTime(); t += 86400000) {
    const day = new Date(t);
    const dow = isoWeekday(day);
    const iso = ymd(day);
    for (const prog of programs) {
      const slots = prog.weekday_slots ?? [];
      if (!slots.includes(dow)) continue;
      const key = `${iso}|${prog.platform}|${prog.id}`;
      if (emptyOnly && existing.has(key)) { skipped++; continue; }

      const title = `${prog.label} — ${day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })}`;
      const brief = [
        `Program: ${prog.label} (${prog.category_code})`,
        prog.notes ? `Direction: ${prog.notes}` : null,
        `Channel: ${prog.platform} · respect guardrails in marketing.social_channel_rules.`,
      ].filter(Boolean).join('\n');

      const { error } = await sb.rpc('fn_social_slot_upsert', {
        p_property_id: propertyId,
        p_slot_date: iso,
        p_platform: prog.platform,
        p_program_id: prog.id,
        p_format: DEFAULT_FORMAT[prog.platform] ?? 'Photo',
        p_title: title,
        p_hook: prog.label,
        p_brief_md: brief,
        p_status: 'proposed',
        p_ai_notes: `rule-based plan ${start}..${end}`,
      });
      if (error) errors.push(`${key}: ${error.message}`);
      else created++;
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    created, skipped,
    range: { start, end },
    programs: programs.length,
    errors: errors.slice(0, 10),
  });
}
