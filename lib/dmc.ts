// lib/dmc.ts
// Data layer for /sales/b2b (DMC contracts + reconciliation + performance).
// Schema: governance.dmc_contracts (+ v_dmc_contracts_listing view).
// Reconciliation tables not yet applied — those queries return [] for now.

import { supabase } from './supabase';

export interface DmcContract {
  contract_id: string;
  partner_short_name: string;
  partner_legal_name: string | null;
  partner_type: 'DMC' | 'TO' | 'OTA';
  country: string | null;
  country_flag: string | null;
  vat_number: string | null;
  address: string | null;
  contact_name: string | null;
  contact_role: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  signed_date: string | null;
  status: 'active' | 'expiring' | 'expired' | 'draft' | 'suspended';
  computed_status: 'active' | 'expiring' | 'expired' | 'draft' | 'suspended';
  days_to_expiry: number | null;
  auto_renew: boolean;
  pricing_model: string;
  group_surcharge_pct: number | null;
  group_threshold: number | null;
  extra_bed_usd: number | null;
  anti_publication_clause: string | null;
  notes: string | null;
}

export async function getDmcContracts(): Promise<DmcContract[]> {
  const { data, error } = await supabase
    .from('v_dmc_contracts')
    .select('*')
    .order('partner_short_name');
  if (error) {
    console.error('[dmc] getDmcContracts error', error);
    return [];
  }
  return (data ?? []) as DmcContract[];
}

export async function getDmcContract(contractId: string): Promise<DmcContract | null> {
  const { data, error } = await supabase
    .from('v_dmc_contracts')
    .select('*')
    .eq('contract_id', contractId)
    .maybeSingle();
  if (error) {
    console.error('[dmc] getDmcContract error', error);
    return null;
  }
  return (data ?? null) as DmcContract | null;
}

export interface DmcKpis {
  activeCount: number;
  totalCount: number;
  expiringIn90: number;
  expired: number;
}

export async function getDmcKpis(): Promise<DmcKpis> {
  const contracts = await getDmcContracts();
  return {
    activeCount: contracts.filter((c) => c.computed_status === 'active').length,
    totalCount: contracts.length,
    expiringIn90: contracts.filter((c) => c.computed_status === 'expiring').length,
    expired: contracts.filter((c) => c.computed_status === 'expired').length,
  };
}

// Reconciliation queue — schema not yet applied, returns []
export interface DmcQueueRow {
  reservation_id: string;
  guest_name: string;
  rate_plan_name: string;
  detected_at: string;
  hours_in_queue: number;
  suggested_partner_name: string | null;
  mapping_confidence: number | null;
}

export async function getDmcQueue(): Promise<DmcQueueRow[]> {
  // Reconciliation schema not yet applied — returns [] until migration shipped.
  return [];
}

// =====================================================================
// Mapping (minimal phase2_01) — confirms reservation → contract
// =====================================================================

export interface MappingRow {
  reservation_id: string;
  contract_id: string;
  mapping_status: string;
  created_at: string;
}

export async function getMappings(): Promise<MappingRow[]> {
  const { data, error } = await supabase
    .from('v_dmc_reservation_mapping')
    .select('reservation_id, contract_id, mapping_status, created_at');
  if (error) {
    console.error('[dmc] getMappings error', error);
    return [];
  }
  return (data ?? []) as MappingRow[];
}

// Cloudbeds deeplink — opens reservation in Cloudbeds Connect
export function cloudbedsReservationUrl(reservationId: string, propertyId: number): string {
  return `https://hotels.cloudbeds.com/connect/${propertyId}#/reservations/${reservationId}`;
}

// =====================================================================
// Real LPA reservations from public.reservations
// =====================================================================

export interface LpaReservation {
  reservation_id: string;
  guest_name: string | null;
  guest_email: string | null;
  guest_country: string | null;
  source_name: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  nights: number | null;
  total_amount: number | null;
  status: string | null;
  market_segment: string | null;
  room_type_name: string | null;
  is_cancelled: boolean | null;
}

const LPA_RATE_PLANS = [
  'Leisure Partnership Agreement',
  'Corporate Partnership Agreement',
];

export async function getLpaReservations(): Promise<LpaReservation[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select('reservation_id, guest_name, guest_email, guest_country, source_name, check_in_date, check_out_date, nights, total_amount, status, market_segment, room_type_name, is_cancelled')
    .in('rate_plan', LPA_RATE_PLANS)
    .order('check_in_date', { ascending: false });
  if (error) {
    console.error('[dmc] getLpaReservations error', error);
    return [];
  }
  return (data ?? []) as LpaReservation[];
}

export interface PartnerAggregate {
  source_name: string;
  reservation_count: number;
  rns: number;
  revenue: number;
  matched_contract_id: string | null;
  matched_partner_short_name: string | null;
}

// Fuzzy match a Cloudbeds source_name to a contract.partner_short_name.
// Strategy:
//  1. Strip punctuation (dots, parens, commas) but keep spaces — handles "O.R.L.A" → "ORLA"
//  2. Tokenize on whitespace; drop noise words & stem plurals (lao/laos, trail/trails)
//  3. Match if ≥2 token overlap OR all tokens on shorter side overlap (1-token names)
//  4. Honor explicit alias map for known rebrands (EXO ↔ Exotissimo)

const SOURCE_ALIASES: Record<string, string> = {
  // booking source_name (lowercase) → canonical contract partner_short_name match key
  'exo travel': 'exotissimo',
  'exo': 'exotissimo',
  'arza travel (lao challenger travel)': 'arza',
  'discover laos.today': 'discoverlaostoday',
  'discoverlaos.today': 'discoverlaostoday',
};

const STOPWORDS = new Set([
  'travel', 'tours', 'tour', 'co', 'ltd', 'limited', 'inc', 'sole', 'company',
  'the', 'and', 'group', 'agency', 'agencies', 'lao', 'laos',
  'sarl', 'sa', 'pte', 'llc', 'llp', 'gmbh',
]);

function stem(t: string): string {
  if (!t) return '';
  if (t === 'laos') return 'lao';
  if (t.endsWith('s') && t.length > 4) return t.slice(0, -1);
  return t;
}

function tokens(s: string | null | undefined): string[] {
  if (!s) return [];
  // Strip dots/parens/commas, lowercase, then split on whitespace
  const cleaned = s.toLowerCase().replace(/[.,()/\\]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned
    .split(' ')
    .map((w) => stem(w.replace(/[^a-z0-9]/g, '')))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export function matchSourceToContract(
  sourceName: string | null,
  contracts: DmcContract[],
): { contract_id: string | null; partner_short_name: string | null } {
  if (!sourceName) return { contract_id: null, partner_short_name: null };

  const aliasKey = sourceName.toLowerCase().trim();
  const aliasTarget = SOURCE_ALIASES[aliasKey];

  const srcTokens = aliasTarget ? [aliasTarget] : tokens(sourceName);
  if (srcTokens.length === 0) return { contract_id: null, partner_short_name: null };
  const srcSet = new Set(srcTokens);

  let best: { score: number; c: DmcContract } | null = null;
  for (const c of contracts) {
    const contractTokens = tokens(c.partner_short_name);
    // Stopword-stripped joined form — handles dotted acronyms like "O.R.L.A Tours" → "orla"
    const stripped = c.partner_short_name
      .toLowerCase()
      .replace(/[.,()/\\]/g, ' ')
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ''))
      .filter((w) => w && !STOPWORDS.has(w))
      .join('');
    const contractFull = c.partner_short_name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const candidateSet = new Set([...contractTokens, contractFull, stripped].filter(Boolean));
    if (candidateSet.size === 0) continue;
    const overlap = [...candidateSet].filter((t) => srcSet.has(t)).length;
    if (overlap === 0) continue;
    const denom = contractTokens.length || 1;
    const minLen = Math.min(srcTokens.length, denom);
    if (overlap >= 2 || overlap === minLen) {
      const score = overlap / Math.max(srcTokens.length, denom);
      if (!best || score > best.score) best = { score, c };
    }
  }
  if (best) return { contract_id: best.c.contract_id, partner_short_name: best.c.partner_short_name };
  return { contract_id: null, partner_short_name: null };
}

export async function getDmcKpisLive(): Promise<{
  contractCount: number;
  activeContracts: number;
  expiringIn90: number;
  reservationCount: number;
  totalRevenue: number;
  totalRns: number;
  unmatchedSources: number;
  matchedReservations: number;
}> {
  const [contracts, lpaRes] = await Promise.all([getDmcContracts(), getLpaReservations()]);
  const reservations = lpaRes.filter((r) => !r.is_cancelled);

  const sourceSet = new Set(reservations.map((r) => r.source_name ?? '(unknown)'));
  const matchedSources = new Set<string>();
  let matchedRes = 0;
  for (const src of sourceSet) {
    const m = matchSourceToContract(src, contracts);
    if (m.contract_id) matchedSources.add(src);
  }
  for (const r of reservations) {
    const m = matchSourceToContract(r.source_name, contracts);
    if (m.contract_id) matchedRes++;
  }

  return {
    contractCount: contracts.length,
    activeContracts: contracts.filter((c) => c.computed_status === 'active').length,
    expiringIn90: contracts.filter((c) => c.computed_status === 'expiring').length,
    reservationCount: reservations.length,
    totalRevenue: reservations.reduce((s, r) => s + (Number(r.total_amount) || 0), 0),
    totalRns: reservations.reduce((s, r) => s + (Number(r.nights) || 0), 0),
    unmatchedSources: sourceSet.size - matchedSources.size,
    matchedReservations: matchedRes,
  };
}
