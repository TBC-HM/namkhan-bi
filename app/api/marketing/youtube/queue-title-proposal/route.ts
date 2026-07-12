// app/api/marketing/youtube/queue-title-proposal/route.ts
// PBS 2026-07-12 — Queue one title proposal into yt_video_requests.
// Calls SECURITY DEFINER RPC public.fn_yt_title_proposal_queue which:
//   • inserts a marketing.yt_video_requests row (mapped from proposal length bucket)
//   • updates the proposal.status='queued' + stores video_request_id
// Also inserts a cockpit_tickets row (public schema — direct insert OK).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { ok, err } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAMKHAN = 260955;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const proposalId = String((body as { proposal_id?: string }).proposal_id ?? '').trim();
  if (!proposalId) return err('proposal_id_required', 400);

  const sb = getSupabaseAdmin();

  // Look up the proposal for the ticket summary (before the RPC flips it to 'queued')
  const { data: prop, error: propErr } = await sb
    .from('v_yt_title_proposals')
    .select('id,property_id,playlist_id,pillar_key,scheduled_month,rank,proposed_title,proposed_angle,proposed_length_bucket,status')
    .eq('id', proposalId)
    .maybeSingle();
  if (propErr) return err('proposal_lookup_failed', 500, { detail: propErr.message });
  if (!prop)   return err('proposal_not_found', 404);

  const { data: reqId, error: rpcErr } = await sb.rpc('fn_yt_title_proposal_queue', {
    p_proposal_id: proposalId,
  });
  if (rpcErr || !reqId) {
    return err('queue_rpc_failed', 500, { detail: rpcErr?.message ?? 'no_request_id' });
  }

  // Cockpit ticket so PBS can track the request from the standard queue.
  const ticketNotes = [
    `Queued from 12-month title calendar.`,
    `Playlist: ${prop.playlist_id}`,
    prop.pillar_key ? `Pillar: ${prop.pillar_key}` : null,
    `Month: ${String(prop.scheduled_month).slice(0, 7)} · rank ${prop.rank}`,
    `Title: ${prop.proposed_title}`,
    prop.proposed_angle ? `Angle: ${prop.proposed_angle}` : null,
    `Length bucket: ${prop.proposed_length_bucket ?? '(unset)'}`,
    `Video request id: ${reqId}`,
    `Proposal id: ${proposalId}`,
  ].filter(Boolean).join('\n');

  const { data: ticketRow, error: tkErr } = await sb
    .from('cockpit_tickets')
    .insert({
      source:         'title_calendar',
      arm:            'youtube_pipeline',
      intent:         'request_video',
      status:         'open',
      parsed_summary: (prop.proposed_title ?? '').slice(0, 240),
      notes:          ticketNotes,
      metadata:       {
        property_id:       prop.property_id ?? NAMKHAN,
        video_request_id:  reqId,
        proposal_id:       proposalId,
        playlist_id:       prop.playlist_id,
        pillar_key:        prop.pillar_key,
        scheduled_month:   prop.scheduled_month,
        requested_by_role: 'marketing_hod',
      },
      project_id:     prop.property_id ?? NAMKHAN,
    })
    .select('id')
    .single();

  return ok({
    video_request_id: reqId,
    proposal_id:      proposalId,
    ticket_id:        tkErr ? null : ticketRow?.id ?? null,
    ticket_warning:   tkErr?.message ?? null,
  });
}
