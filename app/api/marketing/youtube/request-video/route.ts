// app/api/marketing/youtube/request-video/route.ts
// PBS 2026-07-11 pm — PBS "make me a video" queue.
// Accepts POST (JSON body or form-encoded), inserts a marketing.yt_video_requests
// row + a cockpit_tickets row addressed to Lumen (marketing_hod).
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
  // form-encoded fallback (server-rendered form)
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
  // Native form submits send urlencoded/multipart + Accept text/html
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

  const insertRow = {
    property_id:            propertyId,
    requested_by:           'PBS',
    angle,
    style,
    duration_seconds:       toIntOrNull(body.duration_seconds) ?? 45,
    voice,
    talking_head_person_id: toIntOrNull(body.talking_head_person_id),
    cta:                    (body.cta ?? '').toString().trim() || null,
    source_asset_urls:      splitUrlLines(body.source_asset_urls),
    source_media_ids:       Array.isArray(body.source_media_ids) ? body.source_media_ids : [],
    notes:                  (body.notes ?? '').toString().trim() || null,
    linked_brief_id:        (body.linked_brief_id && String(body.linked_brief_id).trim()) || null,
    status:                 'queued' as const,
  };

  const { data: reqRow, error: reqErr } = await sb
    .schema('marketing')
    .from('yt_video_requests')
    .insert(insertRow)
    .select('id')
    .single();

  if (reqErr || !reqRow) {
    return NextResponse.json({ ok: false, error: 'insert_request_failed', detail: reqErr?.message }, { status: 500 });
  }

  const ticketNotes = [
    `PBS requested a ${style} video (${insertRow.duration_seconds}s, voice=${voice}).`,
    `Angle: ${angle}`,
    insertRow.cta ? `CTA: ${insertRow.cta}` : null,
    insertRow.source_asset_urls.length ? `Assets: ${insertRow.source_asset_urls.length} url(s)` : null,
    insertRow.linked_brief_id ? `Linked brief: ${insertRow.linked_brief_id}` : null,
    insertRow.notes ? `Notes: ${insertRow.notes}` : null,
    `Request id: ${reqRow.id}`,
  ].filter(Boolean).join('\n');

  const { data: ticketRow, error: tkErr } = await sb
    .from('cockpit_tickets')
    .insert({
      source:         'pbs_request',
      arm:            'youtube_pipeline',
      intent:         'request_video',
      status:         'open',
      parsed_summary: angle.slice(0, 240),
      notes:          ticketNotes,
      metadata:       { property_id: propertyId, video_request_id: reqRow.id, style, voice, requested_by_role: 'marketing_hod' },
      project_id:     propertyId,
    })
    .select('id')
    .single();

  const ticketId = tkErr ? null : ticketRow?.id ?? null;

  if (wantRedirect) {
    const back = new URL('https://namkhan-bi.vercel.app/marketing/youtube');
    back.searchParams.set('requested', '1');
    if (ticketId) back.searchParams.set('ticket', String(ticketId));
    back.searchParams.set('req', String(reqRow.id));
    return NextResponse.redirect(back.toString(), 303);
  }

  return NextResponse.json({ ok: true, request_id: reqRow.id, ticket_id: ticketId, ticket_warning: tkErr?.message ?? null });
}
