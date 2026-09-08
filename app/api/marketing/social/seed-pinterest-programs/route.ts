// app/api/marketing/social/seed-pinterest-programs/route.ts
// Seeds one social_program row per Pinterest board, so the standard
// generate-plan engine can create board-specific calendar slots.
// Idempotent: matches existing programs by notes=board_id; creates new rows
// only for boards that don't already have a program.
//
// POST { property_id }
// → { ok, seeded, existing, errors }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Default schedule: Mon + Wed + Fri (ISO 1=Mon..7=Sun)
const DEFAULT_WEEKDAY_SLOTS = [1, 3, 5];
const DEFAULT_POSTS_PER_WEEK = 3;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.property_id) {
    return NextResponse.json({ ok: false, error: 'property_id required' }, { status: 400 });
  }
  const propertyId = await requirePropertyAccess(req, body.property_id);
  const sb = getSupabaseAdmin();

  // 1. Get boards
  const { data: boards, error: bErr } = await sb.rpc('fn_pinterest_boards_for_property', {
    p_property_id: propertyId,
  });
  if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });
  const boardList = (boards ?? []) as Array<{ board_id: string; board_name: string | null; pin_count: number | null }>;
  if (boardList.length === 0) {
    return NextResponse.json({ ok: false, error: 'no_boards — sync boards from Pinterest first (fix API key in vault, then Sync)' }, { status: 400 });
  }

  // 2. Get existing Pinterest programs to avoid duplicates
  const { data: existing } = await sb
    .from('v_social_programs')
    .select('id, notes')
    .eq('property_id', propertyId)
    .eq('platform', 'pinterest')
    .eq('active', true);
  const existingBoardIds = new Set((existing ?? []).map((p: { notes: string | null }) => p.notes).filter(Boolean));

  let seeded = 0;
  let skipped = 0;
  const errors: string[] = [];

  // 3. Seed one program per board not yet represented
  for (const board of boardList) {
    if (existingBoardIds.has(board.board_id)) { skipped++; continue; }
    const label = board.board_name ?? board.board_id;
    const { error } = await sb.rpc('fn_social_program_upsert', {
      p_property_id:    propertyId,
      p_platform:       'pinterest',
      p_category_code:  'board',
      p_label:          label,
      p_weekday_slots:  DEFAULT_WEEKDAY_SLOTS,
      p_posts_per_week: DEFAULT_POSTS_PER_WEEK,
      p_notes:          board.board_id,
      p_active:         true,
      p_id:             null,
    });
    if (error) errors.push(`${label}: ${error.message}`);
    else seeded++;
  }

  return NextResponse.json({ ok: errors.length === 0, seeded, existing: skipped, errors: errors.slice(0, 5) });
}
