// app/api/marketing/youtube/request-video/route.ts
// PBS 2026-07-11 pm — PBS "make me a video" queue.
// Inserts a marketing.yt_video_requests row via fn_yt_insert_video_request
// + a cockpit_tickets row (public — direct insert OK).
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_STYLES = new Set(['reel','short','long_form','testimonial','retreat_program','room_tour']);
const ALLOWED_VOICE  = new Set(['house','talking_head']);

interface Payload {
  property_id?: number | string;
  angle?: string;
  style?: string;
  duration_seconds?: number | string;
  voice?: string;
  talking_head_person_id?: number | string | null;
  cta?: string;
  source_asset_urls?: string[] | string;
  source_media_ids?: string[];
  notes?: string;
  linked_brief_id?: string | null;
}

async function parseBody(req: Request): Promise<Payload> {
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try { return (await req.json()) as Payload; } catch { return {}; }
  }
  const fd = await req.formData();
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) obj[k] = typeof v === 'string' ? v : String(v);
  return obj as Payload;
}

function splitUrlLines(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

function toIntOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function isRedirectExpected(req: Request): boolean {
  const ct = req.headers.get('content-type') ?? '';
  const accept = req.headers.get('accept') ?? '';
  return ct.includes('application/x-www-form-urlencoded')
      || ct.includes('multipart/form-data')
      || accept.includes('text/html');
}

export async function POST(req: Request) {
  const body = await parseBody(req);
  const sb = getSupabaseAdmin();
  const wantRedirect = isRedirectExpected(req);

  const propertyId = toIntOrNull(body.property_id) ?? 260955;
  const angle      = String(body.angle ?? '').trim();
  const style      = String(body.style ?? '').trim();
  const voice      = String(body.voice ?? 'house').trim();

  if (!angle) return NextResponse.json({ ok: false, error: 'angle_required' }, { status: 400 });
  if (!ALLOWED_STYLES.has(style)) return NextResponse.json({ ok: false, error: 'invalid_style', got: style }, { status: 400 });
  if (!ALLOWED_VOICE.has(voice))  return NextResponse.json({ ok: false, error: 'invalid_voice', got: voice }, { status: 400 });

  const duration = toIntOrNull(body.duration_seconds) ?? 45;
  const assets   = splitUrlLines(body.source_asset_urls);
  const cta      = (body.cta ?? '').toString().trim() || null;
  const notes    = (body.notes ?? '').toString().trim() || null;
  const briefId  = (body.linked_brief_id && String(body.linked_brief_id).trim()) || null;
  const personId = toIntOrNull(body.talking_head_person_id);

  // Insert request via SECURITY DEFINER RPC
  const { data: reqId, error: reqErr } = await sb.rpc('fn_yt_insert_video_request', {
    p_property_id:            propertyId,
    p_requested_by:           'PBS',
    p_angle:                  angle,
    p_style:                  style,
    p_duration_seconds:       duration,
    p_voice:                  voice,
    p_talking_head_person_id: personId,
    p_cta:                    cta,
    p_source_asset_urls:      assets,
    p_notes:                  notes,
    p_linked_brief_id:        briefId,
  });

  if (reqErr || !reqId) {
    return NextResponse.json({ ok: false, error: 'insert_request_failed', detail: reqErr?.message }, { status: 500 });
  }

  const ticketNotes = [
    `PBS requested a ${style} video (${duration}s, voice=${voice}).`,
    `Angle: ${angle}`,
    cta ? `CTA: ${cta}` : null,
    assets.length ? `Assets: ${assets.length} url(s)` : null,
    briefId ? `Linked brief: ${briefId}` : null,
    notes ? `Notes: ${notes}` : null,
    `Request id: ${reqId}`,
  ].filter(Boolean).join('\n');

  // cockpit_tickets is in public schema — direct insert works
  const { data: ticketRow, error: tkErr } = await sb
    .from('cockpit_tickets')
    .insert({
      source:         'pbs_request',
      arm:            'youtube_pipeline',
      intent:         'request_video',
      status:         'open',
      parsed_summary: angle.slice(0, 240),
      notes:          ticketNotes,
      metadata:       { property_id: propertyId, video_request_id: reqId, style, voice, requested_by_role: 'marketing_hod' },
      project_id:     propertyId,
    })
    .select('id')
    .single();

  const ticketId = tkErr ? null : ticketRow?.id ?? null;

  if (wantRedirect) {
    const back = new URL('https://namkhan-bi.vercel.app/marketing/youtube');
    back.searchParams.set('requested', '1');
    if (ticketId) back.searchParams.set('ticket', String(ticketId));
    back.searchParams.set('req', String(reqId));
    return NextResponse.redirect(back.toString(), 303);
  }

  return NextResponse.json({ ok: true, request_id: reqId, ticket_id: ticketId, ticket_warning: tkErr?.message ?? null });
}
