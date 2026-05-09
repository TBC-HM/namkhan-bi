// app/sales/btb/page.tsx
// PBS 2026-05-09: "IN BTB DMC AREA WE SHOULD BE ABLE TO DIFFERENTIATE BETWEEN
// MICE, DMC, RETREATS, GROUPS, MAKE ONE NEW SMART PAGE WHERE YOU COMBINE
// DROPDOWNS, CONTAINERS … WANT TO AVOID TOO MUCH CLICKING".
//
// One page, four tabs. Each tab pulls its own source:
//   - DMC      → governance.dmc_contracts
//   - Retreats → marketing.retreat_programs
//   - Groups   → public.groups
//   - MICE     → public.groups WHERE block_size <= 20 AND notes/raw mentions offsite/leadership
//                (no dedicated table yet; flagged as DATA_NEEDED if empty)
//
// Switching segment is a URL param (?seg=dmc|retreats|groups|mice|all),
// so deep links work and the tabs stay sticky on refresh.

import Link from 'next/link';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import ArtifactActions from '@/components/page/ArtifactActions';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fmtUSD, fmtIsoDate } from '@/lib/format';
import { SALES_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

type Seg = 'all' | 'dmc' | 'retreats' | 'groups' | 'mice';

interface DmcRow {
  contract_id: string;
  partner_name: string;
  status: string | null;
  commission_pct: number | null;
  effective_from: string | null;
  effective_to: string | null;
  contract_url: string | null;
}

interface RetreatRow {
  retreat_id: string;
  code: string | null;
  display_name: string;
  short_pitch: string | null;
  ideal_for: string | null;
  min_nights: number | null;
  max_nights: number | null;
  is_active: boolean | null;
}

interface GroupRow {
  group_id: string;
  group_name: string;
  contact_name: string | null;
  block_size: number | null;
  pickup: number | null;
  pickup_pct: number | null;
  arrival_date: string | null;
  departure_date: string | null;
  status: string | null;
}

const SEGMENTS: Array<{ key: Seg; label: string; description: string }> = [
  { key: 'all',      label: 'All',      description: 'Every BTB partner / cohort across the four segments.' },
  { key: 'dmc',      label: 'DMC',      description: 'Travel agencies, tour operators, luxury advisors. governance.dmc_contracts.' },
  { key: 'retreats', label: 'Retreats', description: 'Wellness / yoga / curated retreats. marketing.retreat_programs.' },
  { key: 'groups',   label: 'Groups',   description: 'Block bookings ≥ 5 rooms. public.groups (Cloudbeds).' },
  { key: 'mice',     label: 'MICE',     description: 'Meetings, incentives, conferences, exhibitions. Sub-set of groups; small leadership offsites.' },
];

async function getDmcRows(): Promise<DmcRow[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .schema('governance')
    .from('dmc_contracts')
    .select('contract_id,partner_name,status,commission_pct,effective_from,effective_to,contract_url')
    .order('partner_name', { ascending: true });
  return (data ?? []) as DmcRow[];
}

async function getRetreatRows(): Promise<RetreatRow[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .schema('marketing')
    .from('retreat_programs')
    .select('retreat_id,code,display_name,short_pitch,ideal_for,min_nights,max_nights,is_active')
    .order('display_name', { ascending: true });
  return (data ?? []) as RetreatRow[];
}

async function getGroupRows(): Promise<GroupRow[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('groups')
    .select('group_id,group_name,contact_name,block_size,pickup,pickup_pct,arrival_date,departure_date,status')
    .order('arrival_date', { ascending: true, nullsFirst: false });
  return (data ?? []) as GroupRow[];
}

interface Props {
  searchParams?: { seg?: Seg };
}

export default async function BtbPage({ searchParams }: Props) {
  const seg: Seg = (searchParams?.seg as Seg) ?? 'all';

  const [dmc, retreats, groups] = await Promise.all([getDmcRows(), getRetreatRows(), getGroupRows()]);

  // MICE = subset of groups: block_size 5-20 (small) and group_name hints at corporate/offsite/leadership.
  const isMICE = (g: GroupRow): boolean => {
    if ((g.block_size ?? 0) > 25) return false;
    const t = `${g.group_name ?? ''} ${g.contact_name ?? ''}`.toLowerCase();
    return /offsite|leadership|board|founders?|exec|incentive|conference|meeting|mice|corporate|workshop/.test(t);
  };
  const mice = groups.filter(isMICE);

  // Headline KPIs — across everything.
  const dmcActive = dmc.filter(d => (d.status ?? '').toLowerCase() === 'active').length;
  const retreatsActive = retreats.filter(r => r.is_active !== false).length;
  const next90 = (() => {
    const today = new Date(); const cutoff = new Date(today.getTime() + 90 * 86_400_000);
    return groups.filter(g => g.arrival_date && new Date(g.arrival_date) >= today && new Date(g.arrival_date) <= cutoff);
  })();
  const totalBlock = groups.reduce((s, g) => s + Number(g.block_size ?? 0), 0);

  return (
    <Page
      eyebrow="Sales · BTB"
      title={<>Partners, <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>cohorts</em>, and groups in one place</>}
      subPages={SALES_SUBPAGES}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox value={dmc.length}      unit="count" label="DMC partners"       tooltip={`${dmcActive} active contracts. Source: governance.dmc_contracts.`} />
        <KpiBox value={retreats.length} unit="count" label="Retreat programs"   tooltip={`${retreatsActive} active. Source: marketing.retreat_programs.`} />
        <KpiBox value={groups.length}   unit="count" label="Group blocks"       tooltip={`${next90.length} arriving next 90d, ${totalBlock} total room-nights blocked. Source: public.groups.`} />
        <KpiBox value={mice.length}     unit="count" label="MICE leads"         tooltip="Subset of groups: small leadership / offsite / corporate / incentive / conference signals." />
        <KpiBox value={next90.length}   unit="count" label="Arrivals next 90d"  tooltip="Group blocks with arrival_date within 90 days of today." />
        <KpiBox value={totalBlock}      unit="count" label="Total RN blocked"   tooltip="Sum of block_size across all group records." />
      </div>

      {/* Segment chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {SEGMENTS.map((s) => {
          const isActive = seg === s.key;
          return (
            <Link
              key={s.key}
              href={`/sales/btb?seg=${s.key}`}
              style={{
                padding: '6px 12px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase',
                fontWeight: 700,
                background: isActive ? '#a8854a' : 'transparent',
                color: isActive ? '#0a0a0a' : '#d8cca8',
                border: '1px solid #2a2520',
                borderRadius: 4, textDecoration: 'none',
              }}
              prefetch={false}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      <div style={{ marginBottom: 14, fontSize: 12, color: '#7d7565', maxWidth: 760 }}>
        {SEGMENTS.find(s => s.key === seg)?.description}
      </div>

      {(seg === 'all' || seg === 'dmc') && (
        <Panel
          title="DMC partners"
          eyebrow={`${dmc.length} contracts`}
          actions={<ArtifactActions context={{ kind: 'table', title: 'DMC partners', dept: 'sales' }} />}
        >
          {dmc.length === 0 ? <Empty msg="No DMC contracts on file." /> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Partner</th>
                    <th>Status</th>
                    <th className="num">Commission</th>
                    <th>Effective</th>
                    <th>Contract</th>
                  </tr>
                </thead>
                <tbody>
                  {dmc.map((d) => (
                    <tr key={d.contract_id}>
                      <td className="lbl"><strong>{d.partner_name}</strong></td>
                      <td className="lbl text-mute">{d.status ?? '—'}</td>
                      <td className="num">{d.commission_pct != null ? `${d.commission_pct}%` : '—'}</td>
                      <td className="lbl text-mute">
                        {d.effective_from ? fmtIsoDate(d.effective_from) : '—'} → {d.effective_to ? fmtIsoDate(d.effective_to) : 'open'}
                      </td>
                      <td className="lbl">
                        {d.contract_url ? <a href={d.contract_url} target="_blank" rel="noopener noreferrer" style={S.link}>view ↗</a> : <span className="text-mute">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {(seg === 'all' || seg === 'retreats') && (
        <>
          <div style={{ height: 12 }} />
          <Panel
            title="Retreat programs"
            eyebrow={`${retreats.length} programs`}
            actions={<ArtifactActions context={{ kind: 'table', title: 'Retreat programs', dept: 'sales' }} />}
          >
            {retreats.length === 0 ? <Empty msg="No retreat programs configured." /> : (
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Program</th>
                      <th>Pitch</th>
                      <th>Ideal for</th>
                      <th className="num">Nights</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retreats.map((r) => (
                      <tr key={r.retreat_id}>
                        <td className="lbl">
                          <strong>{r.display_name}</strong>
                          {r.code && <span style={S.codeBadge}>{r.code}</span>}
                        </td>
                        <td className="lbl text-mute" style={{ maxWidth: 360 }}>{r.short_pitch ?? '—'}</td>
                        <td className="lbl text-mute">{r.ideal_for ?? '—'}</td>
                        <td className="num">{r.min_nights ?? '—'}–{r.max_nights ?? '—'}</td>
                        <td className="lbl">{r.is_active === false ? 'inactive' : 'active'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      {(seg === 'all' || seg === 'groups' || seg === 'mice') && (
        <>
          <div style={{ height: 12 }} />
          <Panel
            title={seg === 'mice' ? 'MICE leads' : 'Group blocks'}
            eyebrow={seg === 'mice' ? `${mice.length} matches` : `${groups.length} blocks · ${next90.length} next 90d`}
            actions={<ArtifactActions context={{ kind: 'table', title: seg === 'mice' ? 'MICE leads' : 'Group blocks', dept: 'sales' }} />}
          >
            {(seg === 'mice' ? mice : groups).length === 0 ? <Empty msg={seg === 'mice' ? 'No MICE-flagged blocks. Tag corporate/offsite groups in the group_name to surface them here.' : 'No groups blocked.'} /> : (
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Group</th>
                      <th>Contact</th>
                      <th className="num">Block</th>
                      <th className="num">Pickup</th>
                      <th>Arrival</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(seg === 'mice' ? mice : groups).map((g) => (
                      <tr key={g.group_id}>
                        <td className="lbl"><strong>{g.group_name}</strong></td>
                        <td className="lbl text-mute">{g.contact_name ?? '—'}</td>
                        <td className="num">{g.block_size ?? '—'}</td>
                        <td className="num">{g.pickup ?? 0} {g.pickup_pct != null && <span style={{ color: 'var(--ink-mute)' }}>({g.pickup_pct}%)</span>}</td>
                        <td className="lbl text-mute">
                          {g.arrival_date ? fmtIsoDate(g.arrival_date) : '—'}
                          {g.departure_date && <span style={{ color: 'var(--ink-mute)' }}> → {fmtIsoDate(g.departure_date)}</span>}
                        </td>
                        <td className="lbl">{g.status ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </Page>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div style={{ padding: 24, color: '#7d7565', fontStyle: 'italic', textAlign: 'center' }}>
      {msg}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  link: { color: 'var(--brass)', textDecoration: 'none', fontWeight: 600 },
  codeBadge: { marginLeft: 6, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' },
};
