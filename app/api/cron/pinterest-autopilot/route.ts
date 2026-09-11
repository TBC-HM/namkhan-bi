// app/api/cron/pinterest-autopilot/route.ts
// Pinterest runs unattended: top up the plan, write the pins, queue them, and say so when
// the library runs dry. PBS 2026-09-11 — "ongoing endless run until I get message that no
// more pics exist".
//
// Why this exists as its own route rather than reusing accept-slot: accept-slot is gated by
// requirePropertyAccess and needs a browser session, so it can never run on a cron. This
// route is cron-secret authenticated and self-contained.
//
// Each pin is assembled from three sources that already exist, none of them invented here:
//   marketing.social_board_rules   which photos may go to which board, and what it links to
//   social_programs.content_brief  the editorial instruction for that board
//   fn_social_assets_on_cooldown   what has been used recently, so nothing repeats
//
// EXHAUSTION is the point of the whole thing. When a board has no eligible photo left, the
// run does NOT fail and does NOT silently skip — it writes a governance.owner_action_signals
// row so PBS is told the library is dry for that board.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropic, isLlmOk } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SHARED_SECRET ?? process.env.CRON_SECRET ?? '';
const MODEL = 'claude-sonnet-5';
const STORAGE_RENDERS =
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media-renders`;

// Pinterest limits, mirrored from marketing.social_platform_specs.
const TITLE_MAX = 100;
const DESC_MAX = 500;
const HASHTAG_MAX = 5;

// How many slots one run will fill. Keeps a single invocation inside maxDuration and caps
// spend per run; the cron simply comes back for the rest.
const PER_RUN = 6;

type Rule = {
  board_id: string; board_label: string | null;
  categories: string[]; sub_category_patterns: string[]; tag_slugs: string[];
  min_quality: number; link_section: string | null; link_title: string | null;
};

function clean(s: string, max: number): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Strip banned phrases, enforce the hashtag cap, and require a location keyword. */
function vet(title: string, body: string, banned: string[]): { ok: boolean; why?: string } {
  const hay = `${title}\n${body}`.toLowerCase();
  for (const b of banned) {
    if (b && hay.includes(b.toLowerCase())) return { ok: false, why: `banned phrase: ${b}` };
  }
  if (title.length > TITLE_MAX) return { ok: false, why: 'title too long' };
  if (body.length > DESC_MAX) return { ok: false, why: 'description too long' };
  if ((body.match(/#/g) ?? []).length > HASHTAG_MAX) return { ok: false, why: 'too many hashtags' };
  if (!/luang prabang|laos/i.test(hay)) return { ok: false, why: 'no location keyword' };
  return { ok: true };
}

export async function POST(req: NextRequest) { return run(req); }
export async function GET(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  if (CRON_SECRET) {
    if ((req.headers.get('x-cron-secret') ?? '') !== CRON_SECRET) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }
  // Property scope must FAIL CLOSED (L22). A default here would quietly run one tenant's
  // autopilot against whoever called it; the cron passes ?property_id explicitly.
  const rawPid = req.nextUrl.searchParams.get('property_id');
  const propertyId = Number(rawPid);
  if (!rawPid || !Number.isFinite(propertyId) || propertyId <= 0) {
    return NextResponse.json({ ok: false, error: 'property_id required' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();

  // ── 1. Due slots ─────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const { data: slots, error: slotErr } = await sb
    .from('v_social_calendar_slots')
    .select('slot_id, slot_date, platform, program_id, title, brief_md, status')
    .eq('property_id', propertyId)
    .eq('platform', 'pinterest')
    .eq('status', 'proposed')
    .lte('slot_date', today)
    .order('slot_date')
    .limit(PER_RUN);
  if (slotErr) return NextResponse.json({ ok: false, error: slotErr.message }, { status: 500 });
  if (!slots?.length) {
    return NextResponse.json({ ok: true, due: 0, published: 0, note: 'no pinterest slots due' });
  }

  // ── 2. Reference data ────────────────────────────────────────────────────────
  const [{ data: rules }, { data: programs }, { data: cooling }, { data: links }] = await Promise.all([
    sb.from('v_social_board_rules').select('*').eq('property_id', propertyId).eq('active', true),
    sb.from('v_social_programs').select('id, notes, label, content_brief, banned_phrases, asset_cooldown_days')
      .eq('property_id', propertyId).eq('platform', 'pinterest'),
    sb.rpc('fn_social_assets_on_cooldown', { p_property_id: propertyId, p_days: 30 }),
    sb.from('v_marketing_internal_link_catalog').select('title, url, section')
      .eq('property_id', propertyId).eq('active', true),
  ]);

  const ruleByBoard = new Map<string, Rule>((rules ?? []).map((r: any) => [r.board_id, r as Rule]));
  const progById = new Map<number, any>((programs ?? []).map((p: any) => [p.id, p]));
  const onCooldown = new Set<string>(((cooling ?? []) as Array<{ asset_id: string }>).map(r => r.asset_id));

  const results: Array<Record<string, unknown>> = [];
  const exhausted: string[] = [];
  let published = 0;

  for (const slot of slots) {
    const prog = progById.get(slot.program_id as number);
    const boardId = prog?.notes as string | undefined;
    const rule = boardId ? ruleByBoard.get(boardId) : undefined;
    if (!prog || !rule) {
      results.push({ slot: slot.slot_id, skipped: 'no board rule for programme' });
      continue;
    }

    // ── 3. Pick a photo: board categories, quality floor, never recently used ──
    // Route by the board's CATEGORIES — without this the picker returns whatever ranks
    // highest overall and boards get unrelated subjects. category is 97.8% populated;
    // tags are 9.4% and are used below only to RANK, never to gate.
    const { data: candidates } = await sb.from('mkt_v_media_ready')
      .select('asset_id, caption, alt_text, renders, width_px, height_px, quality_index, property_area, category, sub_category, tags')
      .eq('property_id', propertyId)
      .eq('asset_type', 'photo')
      .contains('usage_rights', ['social_organic'])
      .in('category', rule.categories)
      .gt('quality_index', rule.min_quality)
      .order('quality_index', { ascending: false })
      .limit(60);

    const eligible = (candidates ?? []).filter((a: any) => {
      if (onCooldown.has(a.asset_id)) return false;
      if (!a.renders?.web_2k) return false;
      // sub_category patterns carve a board out of a broad category (yoga out of Lifestyle).
      if (rule.sub_category_patterns?.length) {
        const sc = (a.sub_category ?? '').toLowerCase();
        const hit = rule.sub_category_patterns.some(pat =>
          sc.includes(pat.replace(/%/g, '').toLowerCase()));
        if (!hit) return false;
      }
      return true;
    });

    // Prefer an asset whose tags match the board, when tags happen to exist. Ranking only.
    const pick = eligible.find((a: any) =>
      rule.tag_slugs?.length && (a.tags ?? []).some((t: string) => rule.tag_slugs.includes(t))
    ) ?? eligible[0];

    if (!pick) {
      // THE MESSAGE PBS ASKED FOR. Not a silent skip and not a failure: the library is dry
      // for this board, which is a content decision for a human, not an error to retry.
      exhausted.push(rule.board_label ?? rule.board_id);
      await sb.from('owner_action_signals').insert({
        kind: 'pinterest_library_exhausted',
        ref_table: 'marketing.social_board_rules',
        ref_id: rule.board_id,
        payload: {
          board: rule.board_label,
          categories: rule.categories,
          min_quality: rule.min_quality,
          cooldown_days: prog.asset_cooldown_days ?? 30,
          message: `No photo left for "${rule.board_label}". Every asset in ${rule.categories.join('/')} `
                 + `above quality ${rule.min_quality} has been used within the last `
                 + `${prog.asset_cooldown_days ?? 30} days. Shoot more, lower the bar, or shorten the cooldown.`,
        },
      }).select().maybeSingle();
      results.push({ slot: slot.slot_id, board: rule.board_label, exhausted: true });
      continue;
    }

    // ── 4. Write the pin from the brief ──────────────────────────────────────
    const banned = (prog.banned_phrases ?? []) as string[];
    const link = (links ?? []).find((l: any) => l.title === rule.link_title)
              ?? (links ?? []).find((l: any) => l.section === rule.link_section);

    const llm = await callAnthropic({
      systemPrompt:
        'You write Pinterest pins for a luxury eco-resort in Luang Prabang, Laos. Pinterest is a '
      + 'SEARCH engine: the title and description carry the keywords people search on. Write plainly '
      + 'and concretely — name the thing in the photograph. Never invent facilities, prices or awards. '
      + `Return STRICT JSON only: {"title": string (max ${TITLE_MAX}), "description": string (max ${DESC_MAX}), `
      + `"hashtags": string[] (max ${HASHTAG_MAX}, no # prefix)}.`,
      userPrompt:
        `${slot.brief_md}\n\n`
      + `THE PHOTOGRAPH SHOWS: ${pick.caption ?? pick.alt_text ?? 'an image from the property'}\n`
      + `Area: ${pick.property_area ?? 'n/a'}\n\n`
      + (banned.length ? `These phrases are exhausted and must NOT appear: ${banned.join(', ')}.\n` : '')
      + 'The title must contain "Luang Prabang" or "Laos".',
      maxTokens: 700,
      model: MODEL,
    });

    if (!isLlmOk(llm)) {
      results.push({ slot: slot.slot_id, board: rule.board_label, error: llm.error });
      continue;
    }

    // Metering is best effort and must never block publishing — but it must be ATTEMPTED,
    // because an unmetered model call is invisible spend (see media-qa before v11).
    try {
      await sb.rpc('fn_meter_ai_call', {
        p_property_id: propertyId,
        p_agent_handle: 'pinterest_autopilot',
        p_model: MODEL,
        p_tokens_in: llm.usage?.in ?? 0,
        p_tokens_cached: 0,
        p_tokens_out: llm.usage?.out ?? 0,
        p_source: 'pinterest-autopilot',
        p_run_ref: `pin:${slot.slot_id}`,
      });
    } catch { /* never block on metering */ }

    let parsed: { title?: string; description?: string; hashtags?: string[] };
    try {
      parsed = JSON.parse(llm.text.replace(/^```json\s*|\s*```$/g, '').trim());
    } catch {
      results.push({ slot: slot.slot_id, board: rule.board_label, error: 'model returned non-JSON' });
      continue;
    }

    const title = clean(parsed.title ?? '', TITLE_MAX);
    const body = clean(parsed.description ?? '', DESC_MAX);
    const tags = (parsed.hashtags ?? []).slice(0, HASHTAG_MAX).map(t => t.replace(/^#/, ''));

    const check = vet(title, body, banned);
    if (!check.ok) {
      results.push({ slot: slot.slot_id, board: rule.board_label, rejected: check.why, title });
      continue;
    }

    // ── 5. Create the post and queue it ──────────────────────────────────────
    const { data: postId, error: createErr } = await sb.rpc('fn_social_post_create', {
      p: {
        property_id: propertyId,
        platform: 'pinterest',
        title,
        caption: body,
        hashtags: tags,
        media_urls: [`${STORAGE_RENDERS}/${pick.renders.web_2k}`],
        link_url: link?.url ?? 'https://www.thenamkhan.com',
        pinterest_board_id: rule.board_id,
        created_by: 'pinterest_autopilot',
        ai_notes: JSON.stringify({
          slot_id: slot.slot_id, board: rule.board_label, asset_id: pick.asset_id,
          quality_index: pick.quality_index, model: MODEL,
        }),
      },
    });
    if (createErr || !postId) {
      results.push({ slot: slot.slot_id, board: rule.board_label, error: createErr?.message ?? 'create failed' });
      continue;
    }

    await sb.rpc('fn_social_post_set_status', { p_post_id: postId, p_status: 'ready' });
    await sb.rpc('fn_social_slot_accept', { p_slot_id: slot.slot_id }).then(() => null, () => null);
    await sb.from('social_calendar').update({ status: 'accepted', linked_post_id: postId })
      .eq('slot_id', slot.slot_id);

    onCooldown.add(pick.asset_id);   // so two slots in ONE run cannot take the same photo
    published++;
    results.push({ slot: slot.slot_id, board: rule.board_label, post_id: postId, title });
  }

  return NextResponse.json({
    ok: true,
    due: slots.length,
    published,
    exhausted_boards: exhausted,
    results,
  });
}
