// lib/sales.ts
// Server-only data layer for the sales schema (proposal builder).
// All staff queries go through getSupabaseAdmin() (service_role) — bypasses RLS.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

// ---------- types ----------
export interface Inquiry {
  id: string;
  property_id: number;
  source: string;
  channel_ref: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  country: string | null;
  language: string;
  party_adults: number | null;
  party_children: number | null;
  date_in: string | null;
  date_out: string | null;
  status: string;
  raw_payload: { body?: string; [k: string]: unknown } | null;
  triage_kind: string | null;
  triage_conf: number | null;
  created_at: string;
  updated_at: string;
}

export interface Proposal {
  id: string;
  inquiry_id: string | null;
  template_id: string | null;
  property_id: number;
  status: string;
  public_token: string | null;
  expires_at: string | null;
  fx_rate_lak_usd: number | null;
  total_lak: number | null;
  total_usd: number | null;
  guest_name_snapshot: string | null;
  date_in_snapshot: string | null;
  date_out_snapshot: string | null;
  sent_at: string | null;
  signed_at: string | null;
  cb_reservation_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalBlock {
  id: string;
  proposal_id: string;
  block_type: 'room' | 'activity' | 'fnb' | 'spa' | 'transfer' | 'note';
  ref_table: string | null;
  ref_id: string | null;
  label: string;
  note: string | null;
  qty: number;
  nights: number;
  unit_price_lak: number;
  total_lak: number;
  removable: boolean;
  ics_url: string | null;
  hero_asset_id: string | null;
  sort_order: number;
}

export interface Activity {
  id: string;
  property_id: number;
  kind: 'internal' | 'external';
  partner_id: string | null;
  category_id: string | null;
  slug: string;
  title: string;
  short_summary: string | null;
  description_md: string | null;
  duration_min: number | null;
  capacity_max: number | null;
  sell_lak: number;
  cost_lak: number | null;
  margin_pct: number | null;
  is_signature: boolean;
  popularity_score: number | null;
  status: string;
  partner_name?: string | null;
  category_slug?: string | null;
  category_name?: string | null;
  category_glyph?: string | null;
}

export interface RoomAvail {
  room_type_id: number;
  room_type_name: string;
  nights_available: number;
  nights_requested: number;
  avg_nightly_lak: number;
  min_avail_in_range: number;
  base_rate_lak: number;
  hero_asset_url: string | null;
}

// ---------- inquiries ----------
export async function listInquiries(propertyId: number = PROPERTY_ID, limit = 50): Promise<Inquiry[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .schema('sales')
    .from('inquiries')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[sales.listInquiries]', error);
    return [];
  }
  return (data ?? []) as Inquiry[];
}

export async function getInquiry(id: string): Promise<Inquiry | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .schema('sales')
    .from('inquiries')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[sales.getInquiry]', error);
    return null;
  }
  return (data as Inquiry) ?? null;
}

// ---------- proposals ----------
export async function getProposal(id: string): Promise<Proposal | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.schema('sales').from('proposals').select('*').eq('id', id).maybeSingle();
  if (error) { console.error('[sales.getProposal]', error); return null; }
  return (data as Proposal) ?? null;
}

export async function getProposalWithBlocks(id: string): Promise<{ proposal: Proposal | null; blocks: ProposalBlock[]; email: any | null }> {
  const sb = getSupabaseAdmin();
  const [{ data: proposal }, { data: blocks }, { data: email }] = await Promise.all([
    sb.schema('sales').from('proposals').select('*').eq('id', id).maybeSingle(),
    sb.schema('sales').from('proposal_blocks').select('*').eq('proposal_id', id).order('sort_order'),
    sb.schema('sales').from('proposal_emails').select('*').eq('proposal_id', id).order('version', { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    proposal: (proposal as Proposal) ?? null,
    blocks: ((blocks ?? []) as ProposalBlock[]),
    email: email ?? null,
  };
}

export async function getProposalByToken(token: string): Promise<{ proposal: Proposal | null; blocks: ProposalBlock[] }> {
  const sb = getSupabaseAdmin();
  const { data: proposal } = await sb.schema('sales').from('proposals').select('*').eq('public_token', token).maybeSingle();
  if (!proposal) return { proposal: null, blocks: [] };
  const { data: blocks } = await sb.schema('sales').from('proposal_blocks').select('*').eq('proposal_id', (proposal as Proposal).id).order('sort_order');
  return { proposal: proposal as Proposal, blocks: (blocks ?? []) as ProposalBlock[] };
}

export async function createProposalFromInquiry(inquiryId: string): Promise<{ id: string } | null> {
  const sb = getSupabaseAdmin();
  const inq = await getInquiry(inquiryId);
  if (!inq) return null;
  const { data, error } = await sb
    .schema('sales')
    .from('proposals')
    .insert({
      inquiry_id: inq.id,
      property_id: inq.property_id,
      status: 'draft',
      guest_name_snapshot: inq.guest_name,
      date_in_snapshot: inq.date_in,
      date_out_snapshot: inq.date_out,
    })
    .select('id')
    .single();
  if (error) { console.error('[sales.createProposalFromInquiry]', error); return null; }

  await sb.schema('sales').from('proposal_emails').insert({
    proposal_id: (data as { id: string }).id,
    version: 1,
    subject: `Your stay at The Namkhan, ${inq.date_in ?? ''}`,
    intro_md: `Dear ${inq.guest_name ?? 'guest'},\n\nWe drew up something quiet for you. Take what you like, leave what you don't — the page lets you adjust.`,
    outro_md: `If anything wants changing, write back. We sit on the river and we have time.`,
    ps_md: `P.S. The boat leaves at 06:30. The light is the reason.`,
  });

  return data as { id: string };
}

export async function addBlock(proposalId: string, block: Partial<ProposalBlock> & { block_type: ProposalBlock['block_type']; label: string; unit_price_lak: number; }): Promise<ProposalBlock | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .schema('sales')
    .from('proposal_blocks')
    .insert({
      proposal_id: proposalId,
      block_type: block.block_type,
      ref_table: block.ref_table ?? null,
      ref_id: block.ref_id ?? null,
      label: block.label,
      note: block.note ?? null,
      qty: block.qty ?? 1,
      nights: block.nights ?? 1,
      unit_price_lak: block.unit_price_lak,
      sort_order: block.sort_order ?? 100,
    })
    .select('*')
    .single();
  if (error) { console.error('[sales.addBlock]', error); return null; }
  return data as ProposalBlock;
}

export async function updateBlock(id: string, patch: Partial<ProposalBlock>): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.schema('sales').from('proposal_blocks').update(patch).eq('id', id);
  if (error) { console.error('[sales.updateBlock]', error); return false; }
  return true;
}

export async function deleteBlock(id: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.schema('sales').from('proposal_blocks').delete().eq('id', id);
  if (error) { console.error('[sales.deleteBlock]', error); return false; }
  return true;
}

// ---------- activities ----------
export async function listActivities(opts: { kind?: 'internal' | 'external' | 'all'; cat?: string; q?: string } = {}): Promise<Activity[]> {
  const sb = getSupabaseAdmin();
  let q = sb
    .schema('sales')
    .from('activity_catalog')
    .select('*, partner:activity_partners(name), category:activity_categories(slug, name, glyph)')
    .eq('status', 'active');
  if (opts.kind && opts.kind !== 'all') q = q.eq('kind', opts.kind);
  if (opts.q) q = q.or(`title.ilike.%${opts.q}%,short_summary.ilike.%${opts.q}%`);

  const { data, error } = await q.order('is_signature', { ascending: false }).order('title');
  if (error) {
    console.error('[sales.listActivities]', error);
    return [];
  }
  let rows = (data ?? []) as any[];
  if (opts.cat && opts.cat !== 'all') {
    rows = rows.filter(r => r.category?.slug === opts.cat);
  }
  return rows.map(r => ({
    ...r,
    partner_name: r.partner?.name ?? null,
    category_slug: r.category?.slug ?? null,
    category_name: r.category?.name ?? null,
    category_glyph: r.category?.glyph ?? null,
  })) as Activity[];
}

export async function listCategories() {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('sales').from('activity_categories').select('*').order('sort_order');
  return data ?? [];
}

// ---------- room availability (Cloudbeds bridge) ----------
export async function getAvailableRooms(from: string, to: string, propId: number = PROPERTY_ID): Promise<RoomAvail[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('proposal_available_rooms', {
    from_date: from,
    to_date: to,
    prop_id: propId,
  });
  if (error) { console.error('[sales.getAvailableRooms]', error); return []; }
  return (data ?? []) as RoomAvail[];
}

export async function getInventoryFreshnessMin(propId: number = PROPERTY_ID): Promise<number> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.rpc('proposal_inventory_freshness', { prop_id: propId });
  return typeof data === 'number' ? data : 9999;
}

// ---------- send / token ----------
export async function generatePublicToken(): Promise<string> {
  const u = crypto.randomUUID().replace(/-/g, '');
  return Buffer.from(u, 'hex').toString('base64url').slice(0, 22);
}

export async function markProposalSent(proposalId: string): Promise<{ token: string } | null> {
  const sb = getSupabaseAdmin();
  const token = await generatePublicToken();
  const ttlDays = Number(process.env.PROPOSAL_TOKEN_TTL_DAYS ?? '14');
  const expires = new Date(Date.now() + ttlDays * 86400000).toISOString();
  const { error } = await sb
    .schema('sales')
    .from('proposals')
    .update({
      status: 'sent',
      public_token: token,
      sent_at: new Date().toISOString(),
      expires_at: expires,
      rate_locked_at: new Date().toISOString(),
    })
    .eq('id', proposalId);
  if (error) { console.error('[sales.markProposalSent]', error); return null; }
  return { token };
}

// ---------- agent runs ----------
export async function logAgentRun(row: {
  inquiry_id?: string | null;
  proposal_id?: string | null;
  agent_name: string;
  model: string;
  tokens_in?: number;
  tokens_out?: number;
  cost_eur?: number;
  status: string;
  error?: string | null;
  duration_ms?: number;
}) {
  const sb = getSupabaseAdmin();
  await sb.schema('sales').from('agent_runs').insert(row);
}
