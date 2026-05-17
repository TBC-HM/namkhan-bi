// app/sales/accounts/page.tsx
//
// PBS 2026-05-16: Mini-CRM for the relationships behind the leads.
// DMCs · Retreat organizers · Repeat customers · Wholesale partners ·
// Influencers (when promoted from sales.leads via conversion or manual).
//
// Pattern: list of accounts → click → drawer (re-uses the leads-cockpit
// shape) showing leads-by-account + bookings history + contract custody.

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import Link from 'next/link';
import { SALES_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface AccountRow {
  id: string;
  name: string;
  account_type: string;
  status: string;
  country: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_role: string | null;
  first_contact_at: string | null;
  last_contact_at: string | null;
  next_touch_at: string | null;
  contact_cadence_days: number | null;
  total_bookings: number;
  total_revenue_eur: number;
  lifetime_value_eur: number;
  last_booking_at: string | null;
  commission_pct: number | null;
  payment_terms: string | null;
  icp_key: string | null;
  icp_name: string | null;
  lead_count: number;
}

async function getAccounts(propertyId: number): Promise<AccountRow[]> {
  const sb = getSupabaseAdmin();
  const { data: rows } = await sb.schema('sales').from('accounts')
    .select('id, name, account_type, status, country, primary_contact_name, primary_contact_email, primary_contact_role, first_contact_at, last_contact_at, next_touch_at, contact_cadence_days, total_bookings, total_revenue_eur, lifetime_value_eur, last_booking_at, commission_pct, payment_terms, icp_segment_id')
    .eq('property_id', propertyId)
    .order('lifetime_value_eur', { ascending: false, nullsFirst: false })
    .order('next_touch_at', { ascending: true, nullsFirst: false });

  const { data: icps } = await sb.schema('sales').from('icp_segments').select('id, key, name');
  const icpMap = new Map<string, { key: string; name: string }>();
  for (const r of (icps ?? []) as any[]) icpMap.set(String(r.id), { key: String(r.key), name: String(r.name) });

  const { data: leadAgg } = await sb.schema('sales').from('leads')
    .select('account_id', { count: 'exact' })
    .eq('property_id', propertyId)
    .not('account_id', 'is', null);
  const leadCountByAccount = new Map<string, number>();
  for (const r of (leadAgg ?? []) as any[]) {
    if (!r.account_id) continue;
    leadCountByAccount.set(String(r.account_id), (leadCountByAccount.get(String(r.account_id)) ?? 0) + 1);
  }

  return ((rows ?? []) as any[]).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    account_type: String(r.account_type),
    status: String(r.status),
    country: r.country ?? null,
    primary_contact_name: r.primary_contact_name ?? null,
    primary_contact_email: r.primary_contact_email ?? null,
    primary_contact_role: r.primary_contact_role ?? null,
    first_contact_at: r.first_contact_at ?? null,
    last_contact_at: r.last_contact_at ?? null,
    next_touch_at: r.next_touch_at ?? null,
    contact_cadence_days: r.contact_cadence_days != null ? Number(r.contact_cadence_days) : null,
    total_bookings: Number(r.total_bookings ?? 0),
    total_revenue_eur: Number(r.total_revenue_eur ?? 0),
    lifetime_value_eur: Number(r.lifetime_value_eur ?? 0),
    last_booking_at: r.last_booking_at ?? null,
    commission_pct: r.commission_pct != null ? Number(r.commission_pct) : null,
    payment_terms: r.payment_terms ?? null,
    icp_key: r.icp_segment_id ? icpMap.get(String(r.icp_segment_id))?.key ?? null : null,
    icp_name: r.icp_segment_id ? icpMap.get(String(r.icp_segment_id))?.name ?? null : null,
    lead_count: leadCountByAccount.get(String(r.id)) ?? 0,
  }));
}

interface PageProps { searchParams?: { type?: string; status?: string; q?: string } }

export default async function SalesAccountsPage({ searchParams }: PageProps) {
  let accounts = await getAccounts(PROPERTY_ID);

  const typeFilter   = searchParams?.type   ?? 'all';
  const statusFilter = searchParams?.status ?? 'all';
  const qFilter      = (searchParams?.q ?? '').toLowerCase().trim();
  const filtered = accounts.filter((a) =>
    (typeFilter === 'all'   || a.account_type === typeFilter) &&
    (statusFilter === 'all' || a.status === statusFilter) &&
    (qFilter === '' || a.name.toLowerCase().includes(qFilter) || (a.country?.toLowerCase().includes(qFilter)))
  );

  // KPIs
  const kpi = {
    total: accounts.length,
    active: accounts.filter((a) => a.status === 'active').length,
    prospect: accounts.filter((a) => a.status === 'prospect').length,
    ltv_total: accounts.reduce((s, a) => s + a.lifetime_value_eur, 0),
    next_touch_overdue: accounts.filter((a) => a.next_touch_at && new Date(a.next_touch_at) < new Date()).length,
    bookings_total: accounts.reduce((s, a) => s + a.total_bookings, 0),
  };

  return (
    <Page
      eyebrow={`Sales · Accounts · ${accounts.length} relationships`}
      title={<>Accounts — <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>relationships</em></>}
      subPages={SALES_SUBPAGES}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
        <KpiBox value={kpi.total}             unit="count" label="Total accounts" tooltip="DMCs + retreat organizers + corporate + wholesale partners + influencers" />
        <KpiBox value={kpi.active}            unit="count" label="Active" tooltip="Currently transacting" />
        <KpiBox value={kpi.prospect}          unit="count" label="Prospect" tooltip="Qualified but not yet booked" />
        <KpiBox value={kpi.bookings_total}    unit="count" label="Bookings · all time" />
        <KpiBox value={kpi.ltv_total}         unit="eur" dp={0} label="LTV · all accounts" tooltip="Sum of lifetime_value_eur across all accounts" />
        <KpiBox value={kpi.next_touch_overdue} unit="count" label="Touch overdue" tooltip="Accounts with next_touch_at in the past — re-engage now" />
      </div>

      {/* Filter chip strip */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--paper-deep, rgba(0,0,0,0.12))' }}>
        <FilterGroup label="Type" current={typeFilter} options={[
          { key: 'all', label: 'All' },
          { key: 'dmc', label: 'DMC' },
          { key: 'retreat_organizer', label: 'Retreat org' },
          { key: 'group_lead', label: 'Group' },
          { key: 'corporate', label: 'Corporate' },
          { key: 'wholesale_partner', label: 'Wholesale' },
          { key: 'influencer', label: 'Influencer' },
        ]} paramKey="type" />
        <FilterGroup label="Status" current={statusFilter} options={[
          { key: 'all', label: 'All' },
          { key: 'active', label: 'Active' },
          { key: 'qualified', label: 'Qualified' },
          { key: 'prospect', label: 'Prospect' },
          { key: 'dormant', label: 'Dormant' },
        ]} paramKey="status" />
      </div>

      <Panel
        title={`${filtered.length} of ${accounts.length} accounts`}
        eyebrow="ranked by LTV · then upcoming touch"
        actions={<button style={btnPrimary}>+ Add account</button>}
      >
        <div style={{ padding: 14, overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 'var(--t-sm)', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--paper-deep, rgba(0,0,0,0.18))' }}>
                <th style={th}>Account</th>
                <th style={th}>Type</th>
                <th style={th}>Status</th>
                <th style={th}>Country</th>
                <th style={th}>Contact</th>
                <th style={{ ...th, textAlign: 'right' }}>Leads</th>
                <th style={{ ...th, textAlign: 'right' }}>Bookings</th>
                <th style={{ ...th, textAlign: 'right' }}>LTV €</th>
                <th style={{ ...th, textAlign: 'right' }}>Commission</th>
                <th style={th}>Next touch</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const overdue = a.next_touch_at && new Date(a.next_touch_at) < new Date();
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--paper-deep, rgba(0,0,0,0.06))' }}>
                    <td style={tdStrong}>{a.name}</td>
                    <td style={tdMute}>{prettifyType(a.account_type)}</td>
                    <td style={tdNum}><StatusPill status={a.status} /></td>
                    <td style={tdMute}>{a.country ?? '—'}</td>
                    <td style={tdMute}>
                      {a.primary_contact_name ?? '—'}
                      {a.primary_contact_role ? <span style={{ display: 'block', fontSize: 10, color: 'var(--ink-mute)' }}>{a.primary_contact_role}</span> : null}
                    </td>
                    <td style={{ ...tdNum, textAlign: 'right' }}>{a.lead_count}</td>
                    <td style={{ ...tdNum, textAlign: 'right' }}>{a.total_bookings}</td>
                    <td style={{ ...tdNum, textAlign: 'right', color: a.lifetime_value_eur > 0 ? 'var(--moss, #2D6A4F)' : 'var(--ink-mute)' }}>
                      {a.lifetime_value_eur > 0 ? `€${a.lifetime_value_eur.toLocaleString('en-US')}` : '—'}
                    </td>
                    <td style={{ ...tdNum, textAlign: 'right' }}>{a.commission_pct != null ? `${a.commission_pct}%` : '—'}</td>
                    <td style={{ ...tdNum, color: overdue ? 'var(--st-bad, #B23B3B)' : 'var(--ink)' }}>
                      {a.next_touch_at ?? '—'}
                      {overdue && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600 }}>OVERDUE</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div style={{ marginTop: 18, padding: '10px 12px', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
        Source: <code>sales.accounts</code> · joined to <code>sales.icp_segments</code> + <code>sales.leads</code> count.
        When a lead in <code>/sales/pipeline</code> converts or replies positive, an account auto-promotes. Contract custody links to <code>dms.documents</code> (next iteration adds the picker).
      </div>
    </Page>
  );
}

function prettifyType(t: string): string {
  return {
    dmc: 'DMC',
    retreat_organizer: 'Retreat org',
    group_lead: 'Group',
    corporate: 'Corporate',
    individual: 'Individual',
    wholesale_partner: 'Wholesale',
    influencer: 'Influencer',
  }[t] ?? t;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'var(--moss, #2D6A4F)',
    qualified: 'var(--brass, #a8854a)',
    prospect: 'var(--ink-mute, #7d7565)',
    dormant: 'var(--st-warn, #C28F2C)',
    churned: 'var(--st-bad, #B23B3B)',
    do_not_contact: 'var(--st-bad, #B23B3B)',
  };
  const color = map[status] ?? 'var(--ink-mute, #7d7565)';
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em',
      textTransform: 'uppercase', color, border: `1px solid ${color}`,
      padding: '2px 6px', borderRadius: 3,
    }}>{status}</span>
  );
}

function FilterGroup({ label, current, options, paramKey }: {
  label: string; current: string; options: { key: string; label: string }[]; paramKey: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginRight: 4 }}>{label}</span>
      {options.map((opt) => {
        const active = current === opt.key;
        const href = opt.key === 'all'
          ? `/sales/accounts`
          : `/sales/accounts?${paramKey}=${opt.key}`;
        return (
          <Link
            key={opt.key}
            href={href}
            style={{
              padding: '3px 9px',
              fontFamily: 'var(--mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: active ? 700 : 500,
              color: active ? 'var(--brass)' : 'var(--ink-soft, #4a443c)',
              background: active ? 'rgba(168,133,74,0.12)' : 'transparent',
              border: `1px solid ${active ? 'var(--brass)' : 'var(--paper-deep, rgba(0,0,0,0.15))'}`,
              borderRadius: 3,
              textDecoration: 'none',
            }}
          >{opt.label}</Link>
        );
      })}
    </div>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-mute, #7d7565)', fontWeight: 600 };
const tdStrong: React.CSSProperties = { padding: '8px 8px', color: 'var(--ink, var(--tbl-fg, #1A1A1A))', fontWeight: 600 };
const tdMute: React.CSSProperties = { padding: '8px 8px', color: 'var(--ink-mute, #7d7565)' };
const tdNum: React.CSSProperties = { padding: '8px 8px', fontFamily: 'var(--mono)', color: 'var(--ink, var(--tbl-fg, #1A1A1A))', fontVariantNumeric: 'tabular-nums' };
const btnPrimary: React.CSSProperties = { background: 'var(--brass, #a8854a)', color: 'var(--surf-0, #0a0a0a)', border: '1px solid var(--brass, #a8854a)', padding: '4px 10px', borderRadius: 3, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer' };
