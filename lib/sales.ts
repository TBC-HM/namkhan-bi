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

// ---------- pre-send room availability gate ----------
// At send time we re-check rate_inventory for every room block on the proposal.
// HARD BLOCK if any room has 0 nights available or min_avail < qty.
// WARN if rate_inventory is stale (>60min) or if min_avail == qty (no buffer).
// GREEN if every room has min_avail > qty AND inventory is fresh.

export interface RoomCheckRow {
  block_id: string;
  room_type_id: number;
  label: string;
  qty: number;
  nights_requested: number;
  nights_available: number;     // 0 = sold out for at least one night in range
  min_avail_in_range: number;
  status: 'green' | 'yellow' | 'red';
  message: string;
}

export interface ProposalCheck {
  proposal_id: string;
  date_in: string | null;
  date_out: string | null;
  inventory_freshness_min: number;
  status: 'green' | 'yellow' | 'red' | 'no_rooms';
  message: string;
  rooms: RoomCheckRow[];
}

export async function checkProposalRoomsAvail(proposalId: string): Promise<ProposalCheck | null> {
  const sb = getSupabaseAdmin();
  const { data: proposal } = await sb
    .schema('sales').from('proposals')
    .select('id, property_id, date_in_snapshot, date_out_snapshot')
    .eq('id', proposalId).maybeSingle();
  if (!proposal) return null;

  const dateIn = (proposal as any).date_in_snapshot as string | null;
  const dateOut = (proposal as any).date_out_snapshot as string | null;
  const propertyId = (proposal as any).property_id as number;

  const { data: blocks } = await sb
    .schema('sales').from('proposal_blocks')
    .select('id, block_type, ref_id, label, qty')
    .eq('proposal_id', proposalId)
    .eq('block_type', 'room');

  const roomBlocks = ((blocks ?? []) as Array<{ id: string; ref_id: string | null; label: string; qty: number }>);

  const freshness = await getInventoryFreshnessMin(propertyId);

  if (!dateIn || !dateOut) {
    return {
      proposal_id: proposalId,
      date_in: dateIn, date_out: dateOut,
      inventory_freshness_min: freshness,
      status: 'red',
      message: 'Proposal has no dates. Set date_in_snapshot and date_out_snapshot before sending.',
      rooms: [],
    };
  }

  if (roomBlocks.length === 0) {
    // No rooms on proposal — that is a YELLOW (some proposals are activity-only,
    // but if you intend to send it without rooms, double-check).
    return {
      proposal_id: proposalId,
      date_in: dateIn, date_out: dateOut,
      inventory_freshness_min: freshness,
      status: freshness > 60 ? 'yellow' : 'no_rooms',
      message: roomBlocks.length === 0
        ? 'No room blocks on this proposal. Send anyway only if this is intentionally activities-only.'
        : '',
      rooms: [],
    };
  }

  const avail = await getAvailableRooms(dateIn, dateOut, propertyId);
  // Map by room_type_id for O(1) lookup
  const availMap = new Map<number, typeof avail[number]>();
  avail.forEach(r => availMap.set(Number(r.room_type_id), r));

  type WorstStatus = 'green' | 'yellow' | 'red';

  const rows: RoomCheckRow[] = roomBlocks.map((b) => {
    const refId = Number(b.ref_id);
    const a = availMap.get(refId);
    const nightsRequested = a?.nights_requested ?? 1;
    const nightsAvailable = a?.nights_available ?? 0;
    const minAvail = a?.min_avail_in_range ?? 0;

    let status: WorstStatus = 'green';
    let message = 'Available across the full date range.';

    if (!a || nightsAvailable < nightsRequested) {
      status = 'red';
      message = `SOLD OUT for at least one night between ${dateIn} and ${dateOut}. Open Cloudbeds → Calendar → ${b.label} to add a block, then re-check.`;
    } else if (minAvail < b.qty) {
      status = 'red';
      message = `Only ${minAvail} room(s) free on the tightest night, you asked for ${b.qty}. Open Cloudbeds to add a block, then re-check.`;
    } else if (minAvail === b.qty) {
      status = 'yellow';
      message = `Tight: exactly ${minAvail} room(s) free on the tightest night, matches qty (${b.qty}). Consider holding a block before sending.`;
    } else if (minAvail <= b.qty + 1) {
      status = 'yellow';
      message = `Tight: ${minAvail} room(s) free, qty ${b.qty}. Recommend a Cloudbeds hold so the guest doesn't double-book a parallel inquiry.`;
    }

    return {
      block_id: b.id,
      room_type_id: refId,
      label: b.label,
      qty: b.qty,
      nights_requested: Number(nightsRequested),
      nights_available: Number(nightsAvailable),
      min_avail_in_range: Number(minAvail),
      status, message,
    };
  });

  // Worst-status reduction in a single pass — TS narrows correctly with reduce.
  const statuses: WorstStatus[] = rows.map(r => r.status);
  let worst: WorstStatus =
    statuses.includes('red') ? 'red' :
    statuses.includes('yellow') ? 'yellow' :
    'green';

  // Stale inventory pulls overall to yellow if otherwise green
  if (freshness > 60 && worst === 'green') worst = 'yellow';

  const overall =
    worst === 'red' ? 'Send is BLOCKED — see the red rooms below.' :
    worst === 'yellow' ? `Send allowed but tight or stale (rate_inventory last synced ${freshness}m ago).` :
    `All rooms confirmed available. rate_inventory fresh (${freshness}m old).`;

  return {
    proposal_id: proposalId,
    date_in: dateIn,
    date_out: dateOut,
    inventory_freshness_min: freshness,
    status: worst,
    message: overall,
    rooms: rows,
  };
}

// ---------- /sales/inquiries KPI strip ----------
// Single round-trip helper that returns all 6 KPI tiles + per-tile live flag.
// Tiles whose underlying data isn't yet flowing (no proposals, no agent_runs)
// return live=false so the page can show the data-needed pill.

export type InqKpi = { value: string; label: string; live: boolean; tone?: 'good' | 'warn' | 'bad' | 'brass' };

export interface SalesInquiriesKpis {
  open_sla_at_risk: InqKpi;        // count(new) / count(new past 1h)
  median_first_reply: InqKpi;      // proxy: proposals.created_at − inquiries.created_at
  auto_offer_hit_rate: InqKpi;     // % proposals where brand_voice_check_passed AND no edits
  quote_to_booking_conv: InqKpi;   // % proposals.cb_reservation_id / proposals.sent_at (90d)
  open_pipeline_value: InqKpi;     // sum(total_usd) where status in (draft,sent,viewed)
  sales_revenue_mtd: InqKpi;       // wired separately on page (kpi_daily aggregate)
}

export async function getSalesInquiriesKpis(propertyId: number = PROPERTY_ID): Promise<SalesInquiriesKpis> {
  const sb = getSupabaseAdmin();

  // 1) Open inquiries + SLA at risk
  const { data: inqRows } = await sb
    .schema('sales')
    .from('inquiries')
    .select('id,status,created_at')
    .eq('property_id', propertyId);
  const inqs = (inqRows ?? []) as { status: string; created_at: string }[];
  const openCount = inqs.filter(r => r.status === 'new' || r.status === 'drafted').length;
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const slaAtRisk = inqs.filter(r => (r.status === 'new' || r.status === 'drafted') && new Date(r.created_at).getTime() < oneHourAgo).length;

  // 2/3/4/5) Proposals (one query, 90d window)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
  const { data: propRows } = await sb
    .schema('sales')
    .from('proposals')
    .select('id,status,total_usd,sent_at,signed_at,cb_reservation_id,created_at,updated_at')
    .eq('property_id', propertyId)
    .gte('created_at', ninetyDaysAgo);
  const props = (propRows ?? []) as Array<{
    status: string; total_usd: number | null; sent_at: string | null;
    signed_at: string | null; cb_reservation_id: string | null;
    created_at: string; updated_at: string;
  }>;

  const sentProps = props.filter(p => p.sent_at);
  const wonProps = sentProps.filter(p => p.cb_reservation_id);
  const conv = sentProps.length > 0 ? Math.round((wonProps.length / sentProps.length) * 100) : 0;

  // Auto-offer hit rate: proxy = sent_at within 5 minutes of created_at (≈ no manual edit)
  const autoOfferHits = sentProps.filter(p => {
    if (!p.sent_at) return false;
    const dt = new Date(p.sent_at).getTime() - new Date(p.created_at).getTime();
    return dt < 5 * 60 * 1000;
  });
  const autoHitRate = sentProps.length > 0 ? Math.round((autoOfferHits.length / sentProps.length) * 100) : 0;

  // Open pipeline value
  const openProps = props.filter(p => ['draft','sent','viewed','approved'].includes(p.status));
  const pipelineUsd = openProps.reduce((s, p) => s + Number(p.total_usd ?? 0), 0);

  // Median time to first reply (proxy: minutes between inquiry created and FIRST proposal created)
  let medianFirstReplyMin = 0;
  let medianHasData = false;
  if (props.length > 0) {
    // Get inquiry timestamps for proposals that have inquiry_id
    const inqIds = props.map(p => (p as any).inquiry_id).filter(Boolean) as string[];
    if (inqIds.length > 0) {
      const { data: inqTs } = await sb
        .schema('sales')
        .from('inquiries')
        .select('id,created_at')
        .in('id', inqIds);
      const inqMap = new Map<string, number>(
        ((inqTs ?? []) as { id: string; created_at: string }[]).map(r => [r.id, new Date(r.created_at).getTime()])
      );
      const deltas = props
        .map(p => {
          const iid = (p as any).inquiry_id as string | null;
          if (!iid) return null;
          const inqAt = inqMap.get(iid);
          if (!inqAt) return null;
          return (new Date(p.created_at).getTime() - inqAt) / 60000;
        })
        .filter((v): v is number => typeof v === 'number' && v >= 0)
        .sort((a, b) => a - b);
      if (deltas.length > 0) {
        medianFirstReplyMin = Math.round(deltas[Math.floor(deltas.length / 2)]);
        medianHasData = true;
      }
    }
  }

  return {
    open_sla_at_risk: {
      value: `${openCount} / ${slaAtRisk}`,
      label: slaAtRisk > 0 ? `${slaAtRisk} past 1h target` : 'all within 1h target',
      live: inqs.length > 0,
      tone: slaAtRisk > 0 ? 'bad' : (openCount > 0 ? 'warn' : 'good'),
    },
    median_first_reply: {
      value: medianHasData
        ? (medianFirstReplyMin >= 60
            ? `${Math.floor(medianFirstReplyMin / 60)}h ${medianFirstReplyMin % 60}m`
            : `${medianFirstReplyMin}m`)
        : '—',
      label: medianHasData ? 'target 1h · proposal-create proxy' : 'no proposals yet',
      live: medianHasData,
    },
    auto_offer_hit_rate: {
      value: sentProps.length > 0 ? `${autoHitRate}%` : '—',
      label: sentProps.length > 0 ? `sent without edit · target 75%` : '0 sent · last 90d',
      live: sentProps.length > 0,
      tone: 'brass',
    },
    quote_to_booking_conv: {
      value: sentProps.length > 0 ? `${conv}%` : '—',
      label: sentProps.length > 0 ? `${wonProps.length}/${sentProps.length} sent · last 90d` : '0 sent · last 90d',
      live: sentProps.length > 0,
    },
    open_pipeline_value: {
      value: openProps.length > 0 ? '$' + Math.round(pipelineUsd).toLocaleString('en-US') : '$—',
      label: openProps.length > 0 ? `${openProps.length} open quote${openProps.length === 1 ? '' : 's'}` : '0 open quotes',
      live: openProps.length > 0,
    },
    sales_revenue_mtd: {
      value: '',  // wired by page (kpi_daily aggregate, separate code path)
      label: '',
      live: false,
    },
  };
}

// ---------- /sales/inquiries Tactical Alerts ----------
// Derives real alerts from sales.inquiries + sales.proposals + sales.agent_runs.
// Empty list → page renders data-needed banner instead of the alerts grid.

export interface DerivedAlert {
  id: string;
  severity: 'hi' | 'med' | 'low';
  title: string;
  severityLabel: string;
  dims: string;
  reason: string;
  handoffs: { label: string; writesExternal?: boolean; stampLabel?: string }[];
}

export async function getSalesTacticalAlerts(propertyId: number = PROPERTY_ID): Promise<DerivedAlert[]> {
  const sb = getSupabaseAdmin();
  const alerts: DerivedAlert[] = [];

  // 1) SLA breaches — open inquiries (status=new) older than 1h
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: slaRows } = await sb
    .schema('sales')
    .from('inquiries')
    .select('id,guest_name,source,country,triage_kind,triage_conf,party_adults,party_children,date_in,date_out,created_at')
    .eq('property_id', propertyId)
    .eq('status', 'new')
    .lt('created_at', oneHourAgo)
    .order('created_at', { ascending: true })
    .limit(20);
  const slaInqs = (slaRows ?? []) as Array<{
    id: string; guest_name: string|null; source: string; country: string|null;
    triage_kind: string|null; triage_conf: number|null; party_adults: number|null; party_children: number|null;
    date_in: string|null; date_out: string|null; created_at: string;
  }>;

  for (const inq of slaInqs.slice(0, 4)) {
    const ageMin = Math.round((Date.now() - new Date(inq.created_at).getTime()) / 60000);
    const ageH = Math.floor(ageMin / 60);
    const ageStr = ageH > 0 ? `${ageH}h ${ageMin % 60}m` : `${ageMin}m`;
    const conf = inq.triage_conf ? Number(inq.triage_conf).toFixed(2) : '—';
    const pax = (inq.party_adults ?? 0) + (inq.party_children ?? 0);
    alerts.push({
      id: `sla-${inq.id.slice(0,8)}`,
      severity: ageMin > 180 ? 'hi' : 'med',
      severityLabel: ageMin > 180 ? 'SLA HIGH' : 'SLA MED',
      title: `${inq.guest_name ?? 'Unknown'} · ${inq.source} · ${pax}pax · ${inq.date_in ?? '—'} → ${inq.date_out ?? '—'}`,
      dims: `triage_kind × age × source × triage_conf`,
      reason: `Open inquiry sitting ${ageStr} past 1h SLA target. Triage: ${inq.triage_kind ?? 'fit'} (${conf}). Compose draft now or escalate.`,
      handoffs: [
        { label: 'Open inquiry' },
        { label: 'Send to: Auto-Offer Composer' },
      ],
    });
  }

  // 2) Group / retreat inquiries needing rooming-list lock
  const { data: groupRows } = await sb
    .schema('sales')
    .from('inquiries')
    .select('id,guest_name,date_in,date_out,party_adults,party_children,triage_conf')
    .eq('property_id', propertyId)
    .in('triage_kind', ['group', 'retreat', 'wedding'])
    .eq('status', 'new')
    .order('date_in', { ascending: true, nullsFirst: false })
    .limit(5);
  const groupInqs = (groupRows ?? []) as Array<{
    id: string; guest_name: string|null; date_in: string|null; date_out: string|null;
    party_adults: number|null; party_children: number|null; triage_conf: number|null;
  }>;

  for (const inq of groupInqs.slice(0, 3)) {
    const conf = inq.triage_conf ? Number(inq.triage_conf).toFixed(2) : '—';
    const pax = (inq.party_adults ?? 0) + (inq.party_children ?? 0);
    const daysOut = inq.date_in ? Math.round((new Date(inq.date_in).getTime() - Date.now()) / 86400000) : null;
    const sev: 'hi' | 'med' | 'low' = daysOut !== null && daysOut < 21 ? 'hi' : 'med';
    alerts.push({
      id: `grp-${inq.id.slice(0,8)}`,
      severity: sev,
      severityLabel: sev === 'hi' ? 'GROUP HIGH' : 'GROUP MED',
      title: `Group · ${inq.guest_name ?? 'Unknown'} · ${pax}pax · ${inq.date_in ?? '—'} → ${inq.date_out ?? '—'}`,
      dims: `triage_kind × stay_window × group_size × confidence`,
      reason: daysOut !== null && daysOut < 21
        ? `Stay window in ${daysOut}d — hold rooming list before BAR competition tightens. Strategist confidence ${conf}.`
        : `Group inquiry needs rooming-list confirmation. Strategist confidence ${conf}.`,
      handoffs: [
        { label: 'Open inquiry' },
        { label: 'Send to: Group Quote Strategist' },
        { label: 'Cloudbeds room block', writesExternal: true, stampLabel: 'writes Cloudbeds · approval req' },
      ],
    });
  }

  // 3) Stale inquiries — inquiries >24h with no proposal
  const { data: staleRows } = await sb
    .schema('sales')
    .from('inquiries')
    .select('id,guest_name,source,created_at,triage_kind')
    .eq('property_id', propertyId)
    .lt('created_at', new Date(Date.now() - 24*3600*1000).toISOString())
    .in('status', ['new', 'drafted'])
    .order('created_at', { ascending: true })
    .limit(10);
  const staleInqs = ((staleRows ?? []) as Array<{ id: string; guest_name: string|null; source: string; created_at: string; triage_kind: string|null }>);
  if (staleInqs.length >= 3) {
    alerts.push({
      id: 'stale-cluster',
      severity: 'med',
      severityLabel: 'STALE MED',
      title: `${staleInqs.length} inquiries × no proposal × >24h old`,
      dims: `age_hours × status × proposal_count`,
      reason: `${staleInqs.length} inquiries sitting open without a proposal for over 24h. Decay risk on conversion. Run Follow-up Watcher or auto-archive.`,
      handoffs: [
        { label: 'Send to: Follow-up Watcher' },
        { label: 'Open inquiry feed' },
      ],
    });
  }

  // 4) Agent runs cost — sum cost_eur today (info / low alert)
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const { data: runRows } = await sb
    .schema('sales')
    .from('agent_runs')
    .select('cost_eur,status')
    .gte('created_at', todayStart.toISOString());
  const runs = (runRows ?? []) as Array<{ cost_eur: number|null; status: string }>;
  if (runs.length > 0) {
    const totalCost = runs.reduce((s, r) => s + Number(r.cost_eur ?? 0), 0);
    const errors = runs.filter(r => r.status === 'error').length;
    alerts.push({
      id: 'agent-runs-today',
      severity: errors > 0 ? 'med' : 'low',
      severityLabel: errors > 0 ? 'AGENTS MED' : 'AGENTS LOW',
      title: `${runs.length} agent runs today · €${totalCost.toFixed(2)} cost · ${errors} errors`,
      dims: `agent_name × cost_eur × status`,
      reason: errors > 0
        ? `${errors} agent run${errors === 1 ? '' : 's'} errored today. Open agent log to review.`
        : `Sales agents nominal. Cost in budget.`,
      handoffs: [{ label: 'Open agent log' }],
    });
  }

  return alerts;
}

// ============================================================================
// EMAIL / INBOX HELPERS — re-added 2026-05-05 after parallel session wipe
// ============================================================================

export interface ThreadSummary {
  thread_id: string;
  property_id: number;
  msg_count: number;
  last_received_at: string;
  last_subject: string | null;
  last_from_email: string | null;
  last_from_name: string | null;
  last_direction: 'inbound' | 'outbound';
  last_mailbox: string;
  intended_mailbox: string | null;
  inquiry_id: string | null;
  inquiry_status: string | null;
  triage_kind: string | null;
}

export interface InboxTab {
  intended_mailbox: string;
  total: number;
  unread: number;
  inbound: number;
  outbound: number;
}

export async function listInboxTabs(propertyId: number = PROPERTY_ID): Promise<InboxTab[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('sales').from('email_messages')
    .select('intended_mailbox,direction,inquiry_id').eq('property_id', propertyId);
  const rows = (data ?? []) as { intended_mailbox: string | null; direction: 'inbound'|'outbound'; inquiry_id: string | null }[];
  const inqIds = Array.from(new Set(rows.map(r => r.inquiry_id).filter(Boolean) as string[]));
  let newInqIds = new Set<string>();
  if (inqIds.length > 0) {
    const { data: inqs } = await sb.schema('sales').from('inquiries').select('id,status').in('id', inqIds);
    newInqIds = new Set(((inqs ?? []) as { id: string; status: string }[]).filter(i => i.status === 'new').map(i => i.id));
  }
  const map = new Map<string, InboxTab>();
  for (const r of rows) {
    const key = r.intended_mailbox || 'unknown';
    const t = map.get(key) ?? { intended_mailbox: key, total: 0, unread: 0, inbound: 0, outbound: 0 };
    t.total += 1;
    if (r.direction === 'inbound') t.inbound += 1;
    else t.outbound += 1;
    if (r.inquiry_id && newInqIds.has(r.inquiry_id)) t.unread += 1;
    map.set(key, t);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export async function listEmailThreads(propertyId: number = PROPERTY_ID, limit = 200, filter?: { intendedMailbox?: string; direction?: 'inbound'|'outbound' }): Promise<ThreadSummary[]> {
  const sb = getSupabaseAdmin();
  let q = sb.schema('sales').from('email_messages')
    .select('thread_id,message_id,subject,from_email,from_name,direction,mailbox,intended_mailbox,received_at,inquiry_id,property_id')
    .eq('property_id', propertyId).order('received_at', { ascending: false }).limit(limit * 5);
  if (filter?.intendedMailbox) q = q.eq('intended_mailbox', filter.intendedMailbox);
  if (filter?.direction) q = q.eq('direction', filter.direction);
  const { data } = await q;
  const rows = (data ?? []) as Array<{
    thread_id: string | null; message_id: string; subject: string | null;
    from_email: string | null; from_name: string | null;
    direction: 'inbound'|'outbound'; mailbox: string;
    intended_mailbox: string | null;
    received_at: string; inquiry_id: string | null; property_id: number;
  }>;
  const byThread = new Map<string, ThreadSummary>();
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = r.thread_id || r.message_id;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const existing = byThread.get(key);
    if (!existing) {
      byThread.set(key, {
        thread_id: key, property_id: r.property_id, msg_count: 1,
        last_received_at: r.received_at, last_subject: r.subject,
        last_from_email: r.from_email, last_from_name: r.from_name,
        last_direction: r.direction, last_mailbox: r.mailbox,
        intended_mailbox: r.intended_mailbox,
        inquiry_id: r.inquiry_id, inquiry_status: null, triage_kind: null,
      });
    } else if (!existing.inquiry_id && r.inquiry_id) existing.inquiry_id = r.inquiry_id;
  }
  for (const [k, t] of byThread) t.msg_count = counts.get(k) ?? 1;
  const inqIds = Array.from(byThread.values()).map(t => t.inquiry_id).filter(Boolean) as string[];
  if (inqIds.length > 0) {
    const { data: inqs } = await sb.schema('sales').from('inquiries').select('id,status,triage_kind').in('id', inqIds);
    const inqMap = new Map(((inqs ?? []) as { id: string; status: string; triage_kind: string|null }[]).map(i => [i.id, i]));
    for (const t of byThread.values()) {
      if (t.inquiry_id) {
        const i = inqMap.get(t.inquiry_id);
        if (i) { t.inquiry_status = i.status; t.triage_kind = i.triage_kind; }
      }
    }
  }
  return Array.from(byThread.values())
    .sort((a, b) => +new Date(b.last_received_at) - +new Date(a.last_received_at))
    .slice(0, limit);
}

export interface ThreadMessage {
  id: string; message_id: string; thread_id: string | null; in_reply_to: string | null;
  direction: 'inbound' | 'outbound'; mailbox: string;
  from_email: string | null; from_name: string | null;
  to_emails: string[]; cc_emails: string[];
  subject: string | null; body_text: string | null; body_html: string | null;
  received_at: string; inquiry_id: string | null;
}

export async function getThreadMessages(threadId: string, propertyId: number = PROPERTY_ID): Promise<ThreadMessage[]> {
  const sb = getSupabaseAdmin();
  const { data: byThread } = await sb.schema('sales').from('email_messages').select('*')
    .eq('property_id', propertyId).eq('thread_id', threadId).order('received_at', { ascending: true });
  if (byThread && byThread.length > 0) return byThread as ThreadMessage[];
  const { data: byMsg } = await sb.schema('sales').from('email_messages').select('*')
    .eq('property_id', propertyId).eq('message_id', threadId).order('received_at', { ascending: true });
  return (byMsg ?? []) as ThreadMessage[];
}

export async function getInquiryEmailThread(inquiryId: string, propertyId: number = PROPERTY_ID): Promise<ThreadMessage[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('sales').from('email_messages').select('*')
    .eq('property_id', propertyId).eq('inquiry_id', inquiryId).order('received_at', { ascending: true });
  return (data ?? []) as ThreadMessage[];
}

export async function countUnreadInquiries(propertyId: number = PROPERTY_ID): Promise<number> {
  const sb = getSupabaseAdmin();
  const { count } = await sb.schema('sales').from('inquiries')
    .select('*', { count: 'exact', head: true }).eq('property_id', propertyId).eq('status', 'new');
  return count ?? 0;
}

export interface MailboxStats {
  intended_mailbox: string; msgs: number; threads: number;
  inbound: number; outbound: number;
  spam: number; important: number; starred: number; bulk_category: number;
  median_response_min: number | null; p95_response_min: number | null;
  unanswered: number;
}
export async function getMailboxStats(propertyId: number = PROPERTY_ID): Promise<MailboxStats[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('sales').from('v_mailbox_stats')
    .select('*').eq('property_id', propertyId).order('msgs', { ascending: false });
  return ((data ?? []) as Array<MailboxStats & { property_id: number }>).map(r => ({
    intended_mailbox: r.intended_mailbox, msgs: r.msgs, threads: r.threads,
    inbound: r.inbound, outbound: r.outbound,
    spam: r.spam, important: r.important, starred: r.starred, bulk_category: r.bulk_category,
    median_response_min: r.median_response_min, p95_response_min: r.p95_response_min,
    unanswered: r.unanswered,
  }));
}

// PBS 2026-05-09: top-senders drill-down for the inbox control center.
// Returns the top N inbound senders over the last `days` window with
// counts, distinct threads, and last activity. Quick-and-dirty aggregation
// done here in JS because there is no v_top_senders view yet.
export interface TopSender {
  sender_email: string;
  sender_name: string | null;
  inbound: number;
  threads: number;
  last_msg: string | null;
  is_automation: boolean;
}

export async function getTopSenders(
  days = 60,
  limit = 20,
  propertyId: number = PROPERTY_ID,
): Promise<TopSender[]> {
  const sb = getSupabaseAdmin();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await sb.schema('sales').from('email_messages')
    .select('from_email,from_name,thread_id,received_at,direction')
    .eq('property_id', propertyId)
    .eq('direction', 'inbound')
    .gte('received_at', since)
    .limit(5000);
  const map = new Map<string, TopSender & { _threads: Set<string> }>();
  for (const r of (data ?? []) as Array<{ from_email: string | null; from_name: string | null; thread_id: string | null; received_at: string }>) {
    const email = (r.from_email || '(unknown)').toLowerCase();
    let s = map.get(email);
    if (!s) {
      s = {
        sender_email: email,
        sender_name: r.from_name ?? null,
        inbound: 0,
        threads: 0,
        last_msg: null,
        is_automation: /noreply|no-reply|donotreply|do-not-reply|notification|mailer-daemon|drive-shares-dm/i.test(email),
        _threads: new Set<string>(),
      };
      map.set(email, s);
    }
    s.inbound += 1;
    if (r.thread_id) s._threads.add(r.thread_id);
    if (!s.last_msg || r.received_at > s.last_msg) s.last_msg = r.received_at;
    if (!s.sender_name && r.from_name) s.sender_name = r.from_name;
  }
  return Array.from(map.values())
    .map((s) => ({
      sender_email: s.sender_email,
      sender_name:  s.sender_name,
      inbound:      s.inbound,
      threads:      s._threads.size,
      last_msg:     s.last_msg,
      is_automation: s.is_automation,
    }))
    .sort((a, b) => b.inbound - a.inbound)
    .slice(0, limit);
}

export async function getThreadResponseTime(threadId: string, propertyId: number = PROPERTY_ID): Promise<number | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('sales').from('v_thread_response')
    .select('response_minutes').eq('property_id', propertyId).eq('thread_id', threadId).maybeSingle();
  return (data as { response_minutes: number | null } | null)?.response_minutes ?? null;
}

export async function getThreadResponseMap(threadIds: string[], propertyId: number = PROPERTY_ID): Promise<Map<string, number | null>> {
  if (threadIds.length === 0) return new Map();
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('sales').from('v_thread_response')
    .select('thread_id,response_minutes').eq('property_id', propertyId).in('thread_id', threadIds);
  const m = new Map<string, number | null>();
  for (const r of (data ?? []) as Array<{ thread_id: string; response_minutes: number | null }>) {
    m.set(r.thread_id, r.response_minutes);
  }
  return m;
}

export async function getInboxVolumeByDay(propertyId: number = PROPERTY_ID, days = 30): Promise<Array<{ date: string; inbound: number; outbound: number }>> {
  const sb = getSupabaseAdmin();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await sb.schema('sales').from('email_messages')
    .select('received_at,direction').eq('property_id', propertyId).gte('received_at', since);
  const buckets = new Map<string, { inbound: number; outbound: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    buckets.set(d, { inbound: 0, outbound: 0 });
  }
  for (const r of (data ?? []) as Array<{ received_at: string; direction: 'inbound'|'outbound' }>) {
    const d = r.received_at.slice(0, 10);
    if (buckets.has(d)) buckets.get(d)![r.direction]++;
  }
  return Array.from(buckets, ([date, v]) => ({ date, ...v }));
}

export async function getResponseTimeHistogram(propertyId: number = PROPERTY_ID): Promise<Array<{ bucket: string; threads: number }>> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('sales').from('v_thread_response')
    .select('response_minutes').eq('property_id', propertyId).not('response_minutes', 'is', null);
  const counts: Record<string, number> = { '<1h': 0, '1-4h': 0, '4-12h': 0, '12-24h': 0, '1-3d': 0, '3d+': 0 };
  for (const r of (data ?? []) as Array<{ response_minutes: number }>) {
    const m = r.response_minutes;
    if (m < 60) counts['<1h']++;
    else if (m < 240) counts['1-4h']++;
    else if (m < 720) counts['4-12h']++;
    else if (m < 1440) counts['12-24h']++;
    else if (m < 4320) counts['1-3d']++;
    else counts['3d+']++;
  }
  return Object.entries(counts).map(([bucket, threads]) => ({ bucket, threads }));
}

export async function getLiveFxRate(): Promise<number> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('gl').from('fx_rates').select('rate')
    .eq('from_currency', 'USD').eq('to_currency', 'LAK')
    .order('rate_date', { ascending: false }).limit(1).maybeSingle();
  if (!data) return Number(process.env.NEXT_PUBLIC_FX_LAK_USD || 21800);
  const r = Number((data as { rate: number | string }).rate);
  return r > 0 ? r : Number(process.env.NEXT_PUBLIC_FX_LAK_USD || 21800);
}

export interface DraftSummary {
  id: string; guest_name: string | null;
  date_in: string | null; date_out: string | null;
  total_lak: number | null; total_usd: number | null;
  status: string; created_at: string;
}
export async function listDraftProposals(propertyId: number = PROPERTY_ID, limit = 6): Promise<DraftSummary[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('sales').from('proposals')
    .select('id,guest_name_snapshot,date_in_snapshot,date_out_snapshot,total_lak,total_usd,status,created_at')
    .eq('property_id', propertyId).in('status', ['draft','approved','sent'])
    .order('created_at', { ascending: false }).limit(limit);
  return ((data ?? []) as Array<{
    id: string; guest_name_snapshot: string | null;
    date_in_snapshot: string | null; date_out_snapshot: string | null;
    total_lak: number | null; total_usd: number | null;
    status: string; created_at: string;
  }>).map(r => ({
    id: r.id, guest_name: r.guest_name_snapshot,
    date_in: r.date_in_snapshot, date_out: r.date_out_snapshot,
    total_lak: r.total_lak, total_usd: r.total_usd,
    status: r.status, created_at: r.created_at,
  }));
}
