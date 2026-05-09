// app/sales/btb/page.tsx
//
// Sales · BTB — one smart page that unifies MICE / DMC / Retreats / Groups.
//
// PBS 2026-05-09: "IN BTB DMC AREA WE SHOULD BE ABLE TO DIFFERENTIATE BETWEEN
// MICE, DMC, RETREATS, GROUPS, MAKE ONE NEW SMART PAGE WHERE YOU COMBINE
// DROPDOWNS, CONTAINERS … WANT TO AVOID TOO MUCH CLICKING".
//
// Architecture:
//   • Server component fetches three sources and projects each into a unified
//     `Account` row with a derived `type` column (no `type` column exists in
//     any single source — DMC contracts are typed via `partner_type`, retreats
//     via the table's nature, groups split into MICE vs Group via name regex).
//   • Client component owns: type pills, country/status/channel dropdowns,
//     search box, sortable <DataTable>, slide-in drawer.
//   • Empty tabs render with a CTA pointing at the relevant creation flow.
//
// Sources (all queried via service-role admin):
//   • governance.dmc_contracts          → type = DMC  (partner_type ∈ DMC/TO/OTA)
//   • marketing.retreat_programs        → type = Retreat
//   • public.groups                     → type = MICE | Group (regex on name)

import Page from '@/components/page/Page';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { SALES_SUBPAGES } from '../_subpages';
import SmartBtbClient, { type Account, type AccountType } from './_components/SmartBtbClient';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface DmcRow {
  contract_id: string;
  partner_short_name: string;
  partner_legal_name: string | null;
  partner_type: string | null;
  country: string | null;
  country_flag: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  signed_date: string | null;
  status: string | null;
  pricing_model: string | null;
  group_surcharge_pct: number | null;
  notes: string | null;
}

interface RetreatRow {
  retreat_id: number;
  code: string | null;
  display_name: string;
  short_pitch: string | null;
  ideal_for: string[] | null;
  min_nights: number | null;
  max_nights: number | null;
  pricing_basis: string | null;
  is_active: boolean | null;
  notes: string | null;
}

interface GroupRow {
  group_id: string;
  group_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  block_size: number | null;
  pickup: number | null;
  pickup_pct: number | null;
  arrival_date: string | null;
  departure_date: string | null;
  cutoff_date: string | null;
  status: string | null;
}

// Regex used to split groups into MICE vs general Group. We don't fabricate;
// if a group has no MICE-flag tokens it stays as type=Group.
const MICE_RE = /\b(mice|offsite|leadership|board|founders?|exec|incentive|conference|conf|meeting|corporate|workshop|summit|company|team\s*build)\b/i;
const RETREAT_RE = /\b(retreat|yoga)\b/i;

async function fetchAll(): Promise<{ dmc: DmcRow[]; retreats: RetreatRow[]; groups: GroupRow[] }> {
  const sb = getSupabaseAdmin();
  const [dmcRes, retreatsRes, groupsRes] = await Promise.all([
    sb.schema('governance')
      .from('dmc_contracts')
      .select('contract_id,partner_short_name,partner_legal_name,partner_type,country,country_flag,contact_name,contact_email,contact_phone,effective_date,expiry_date,signed_date,status,pricing_model,group_surcharge_pct,notes')
      .order('partner_short_name', { ascending: true }),
    sb.schema('marketing')
      .from('retreat_programs')
      .select('retreat_id,code,display_name,short_pitch,ideal_for,min_nights,max_nights,pricing_basis,is_active,notes')
      .order('display_name', { ascending: true }),
    sb.from('groups')
      .select('group_id,group_name,contact_name,contact_email,contact_phone,block_size,pickup,pickup_pct,arrival_date,departure_date,cutoff_date,status')
      .order('arrival_date', { ascending: false, nullsFirst: false }),
  ]);

  if (dmcRes.error) console.error('[btb] dmc_contracts', dmcRes.error);
  if (retreatsRes.error) console.error('[btb] retreat_programs', retreatsRes.error);
  if (groupsRes.error) console.error('[btb] groups', groupsRes.error);

  return {
    dmc: (dmcRes.data ?? []) as DmcRow[],
    retreats: (retreatsRes.data ?? []) as RetreatRow[],
    groups: (groupsRes.data ?? []) as GroupRow[],
  };
}

function statusFromDmc(s: string | null): Account['status'] {
  if (!s) return 'inactive';
  const lc = s.toLowerCase();
  if (lc === 'active') return 'active';
  if (lc === 'expiring' || lc === 'pending' || lc === 'draft') return 'pending';
  if (lc === 'expired') return 'expired';
  if (lc === 'suspended' || lc === 'inactive') return 'inactive';
  return 'info';
}

function statusFromGroup(s: string | null): Account['status'] {
  if (!s) return 'inactive';
  const lc = s.toLowerCase();
  if (lc === 'open' || lc === 'confirmed' || lc === 'active') return 'active';
  if (lc === 'tentative' || lc === 'pending') return 'pending';
  if (lc === 'closed') return 'inactive';
  if (lc === 'cancelled' || lc === 'canceled') return 'expired';
  return 'info';
}

function classifyGroup(g: GroupRow): { type: AccountType; channel: string } {
  const name = `${g.group_name ?? ''} ${g.contact_name ?? ''}`;
  if (MICE_RE.test(name)) return { type: 'MICE', channel: 'MICE inbound' };
  if (RETREAT_RE.test(name)) return { type: 'Group', channel: 'Retreat group' };
  return { type: 'Group', channel: 'Group block' };
}

export default async function BtbPage() {
  const { dmc, retreats, groups } = await fetchAll();

  // ── DMC rows ──────────────────────────────────────────────────────────
  const dmcRows: Account[] = dmc.map((d) => {
    const detail: Array<{ k: string; v: string | null }> = [
      { k: 'Partner type',  v: d.partner_type ?? null },
      { k: 'Legal name',    v: d.partner_legal_name },
      { k: 'Country',       v: d.country },
      { k: 'Effective',     v: d.effective_date },
      { k: 'Expiry',        v: d.expiry_date },
      { k: 'Signed',        v: d.signed_date },
      { k: 'Pricing model', v: d.pricing_model },
      { k: 'Group surcharge', v: d.group_surcharge_pct != null ? `${d.group_surcharge_pct}%` : null },
      { k: 'Contact name',  v: d.contact_name },
      { k: 'Contact email', v: d.contact_email },
      { k: 'Contact phone', v: d.contact_phone },
      { k: 'Status (raw)',  v: d.status },
      { k: 'Notes',         v: d.notes },
    ];
    return {
      key: `DMC:${d.contract_id}`,
      type: 'DMC',
      name: d.partner_short_name,
      country: d.country,
      flag: d.country_flag,
      status: statusFromDmc(d.status),
      statusLabel: d.status ?? 'unknown',
      value: d.group_surcharge_pct != null ? Number(d.group_surcharge_pct) : null,
      valueKind: d.group_surcharge_pct != null ? 'pct' : null,
      anchorDate: d.effective_date,
      contact: d.contact_name,
      leadSource: d.partner_type ?? 'DMC',
      detail,
      deepLink: `/sales/b2b/partner/${d.contract_id}`,
    };
  });

  // ── Retreat rows ──────────────────────────────────────────────────────
  const retreatRows: Account[] = retreats.map((r) => {
    const idealFor = r.ideal_for && r.ideal_for.length ? r.ideal_for.join(', ') : null;
    const detail: Array<{ k: string; v: string | null }> = [
      { k: 'Code',           v: r.code },
      { k: 'Pitch',          v: r.short_pitch },
      { k: 'Ideal for',      v: idealFor },
      { k: 'Min nights',     v: r.min_nights != null ? String(r.min_nights) : null },
      { k: 'Max nights',     v: r.max_nights != null ? String(r.max_nights) : null },
      { k: 'Pricing basis',  v: r.pricing_basis },
      { k: 'Active',         v: r.is_active === false ? 'no' : 'yes' },
      { k: 'Notes',          v: r.notes },
    ];
    return {
      key: `Retreat:${r.retreat_id}`,
      type: 'Retreat',
      name: r.display_name,
      country: null,
      flag: null,
      status: r.is_active === false ? 'inactive' : 'active',
      statusLabel: r.is_active === false ? 'inactive' : 'active',
      value: r.max_nights ?? null,
      valueKind: r.max_nights != null ? 'count' : null,
      anchorDate: null,
      contact: null,
      leadSource: 'Wellness program',
      detail,
      deepLink: null,
    };
  });

  // ── Group + MICE rows ─────────────────────────────────────────────────
  const groupRows: Account[] = groups.map((g) => {
    const cls = classifyGroup(g);
    const detail: Array<{ k: string; v: string | null }> = [
      { k: 'Group ID',       v: g.group_id },
      { k: 'Block size',     v: g.block_size != null ? String(g.block_size) : null },
      { k: 'Pickup',         v: g.pickup != null ? String(g.pickup) : null },
      { k: 'Pickup %',       v: g.pickup_pct != null ? `${g.pickup_pct}%` : null },
      { k: 'Arrival',        v: g.arrival_date },
      { k: 'Departure',      v: g.departure_date },
      { k: 'Cutoff',         v: g.cutoff_date },
      { k: 'Contact name',   v: g.contact_name },
      { k: 'Contact email',  v: g.contact_email },
      { k: 'Contact phone',  v: g.contact_phone },
      { k: 'Status (raw)',   v: g.status },
    ];
    const valueIsBlock = g.block_size != null && g.block_size > 0;
    return {
      key: `${cls.type}:${g.group_id}`,
      type: cls.type,
      name: g.group_name?.trim() || g.group_id,
      country: null,
      flag: null,
      status: statusFromGroup(g.status),
      statusLabel: g.status ?? 'unknown',
      value: valueIsBlock ? g.block_size : null,
      valueKind: valueIsBlock ? 'count' : null,
      anchorDate: g.arrival_date,
      contact: g.contact_name,
      leadSource: cls.channel,
      detail,
      deepLink: null,
    };
  });

  const allRows: Account[] = [...dmcRows, ...retreatRows, ...groupRows];

  // Skipped report — what we did not infer.
  const skipped = {
    dmcWithoutCountry: dmc.filter((d) => !d.country).length,
    groupsUnclassified: groups.filter((g) => !classifyGroup(g).type).length, // always 0 — defensive
    groupsWithoutBlock: groups.filter((g) => g.block_size == null).length,
    retreatsInactive:   retreats.filter((r) => r.is_active === false).length,
  };

  return (
    <Page
      eyebrow="Sales · BTB"
      title={<>Partners, <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>cohorts</em>, and groups in one place</>}
      subPages={SALES_SUBPAGES}
    >
      <SmartBtbClient rows={allRows} />

      <div style={{
        marginTop: 16, padding: '10px 14px',
        background: 'var(--st-good-bg)', border: '1px solid var(--st-good-bd)',
        borderRadius: 6, color: 'var(--moss)',
        fontSize: 'var(--t-sm)',
      }}>
        <strong>✓ Wired.</strong> {dmcRows.length} DMC · {retreatRows.length} retreats · {groupRows.filter(r => r.type === 'MICE').length} MICE · {groupRows.filter(r => r.type === 'Group').length} groups.
        Sources: <code>governance.dmc_contracts</code>, <code>marketing.retreat_programs</code>, <code>public.groups</code>.
        Type column derived: DMC from <code>partner_type</code>; MICE/Group split via name regex (offsite/leadership/incentive/conference/etc).
        Skipped: {skipped.dmcWithoutCountry} DMC with no country; {skipped.groupsWithoutBlock} groups with no block_size (Cloudbeds sync gap).
      </div>
    </Page>
  );
}
