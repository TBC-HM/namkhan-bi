// app/sales/groups/page.tsx
// Sales › Groups — group bookings pipeline. WIRED to public.groups.

import { supabase } from '@/lib/supabase';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface GroupRow {
  group_id: string;
  group_name: string | null;
  arrival_date: string | null;
  departure_date: string | null;
  block_size: number | null;
  pickup: number | null;
  pickup_pct: number | null;
  cutoff_date: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: string | null;
}

async function getGroups() {
  const { data, error } = await supabase
    .from('groups')
    .select('group_id, group_name, arrival_date, departure_date, block_size, pickup, pickup_pct, cutoff_date, contact_name, contact_email, contact_phone, status')
    .order('arrival_date', { ascending: true });
  if (error) {
    console.error('[groups] error', error);
    return [];
  }
  return (data ?? []) as GroupRow[];
}

const STATUS_PILL: Record<string, { bg: string; bd: string; fg: string }> = {
  confirmed: { bg: 'var(--st-good-bg)', bd: 'var(--st-good-bd)', fg: 'var(--moss-glow)' },
  tentative: { bg: 'var(--st-warn-bg)', bd: 'var(--st-warn-bd)', fg: 'var(--brass)' },
  cancelled: { bg: 'var(--st-bad-bg)', bd: 'var(--st-bad-bd)', fg: 'var(--st-bad)' },
  open:      { bg: 'var(--st-info-bg)', bd: 'var(--st-info-bd)', fg: 'var(--st-info-tx)' },
};

export default async function GroupsPage() {
  const groups = await getGroups();

  const totalRn = groups.reduce((s, g) => s + (g.block_size ?? 0), 0);
  const pickedUp = groups.reduce((s, g) => s + (g.pickup ?? 0), 0);
  const upcoming = groups.filter((g) => g.arrival_date && new Date(g.arrival_date) >= new Date()).length;
  const avgPickupPct = groups.length > 0
    ? groups.reduce((s, g) => s + (Number(g.pickup_pct) || 0), 0) / groups.length
    : 0;

  return (
    <>
      <PageHeader
        pillar="Sales"
        tab="Groups"
        title={<>Groups · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>{groups.length} blocks</em></>}
        lede="Group bookings pipeline from Cloudbeds. MICE, weddings, retreats, family blocks. Strategist agent + margin floor + displacement check."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10, margin: '14px 0' }}>
        <Kpi scope="Active blocks" value={String(groups.length)} sub={`${upcoming} upcoming`} />
        <Kpi scope="Total room nights" value={totalRn.toLocaleString()} sub="across all blocks" />
        <Kpi scope="Picked up" value={pickedUp.toLocaleString()} sub={`${totalRn > 0 ? ((pickedUp / totalRn) * 100).toFixed(0) : 0}% of block`} />
        <Kpi scope="Avg pickup" value={`${avgPickupPct.toFixed(0)}%`} sub="across all blocks" />
        <Kpi scope="Margin floor" value="lorem" sub="needs revenue + cost join" lorem />
      </div>

      {groups.length === 0 ? (
        <div style={{ background: 'var(--paper-warm)', border: '1px dashed var(--line-soft)', borderRadius: 8, padding: '40px 20px', textAlign: 'center', color: 'var(--ink-mute)', fontSize: "var(--t-md)" }}>
          No group blocks in <code>public.groups</code>.
        </div>
      ) : (
        <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: "var(--t-base)" }}>
            <thead>
              <tr style={{ background: 'var(--paper-warm)', textAlign: 'left', color: 'var(--ink-mute)', fontSize: "var(--t-xs)", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '10px 12px' }}>Group</th>
                <th style={{ padding: '10px 12px' }}>Arrival</th>
                <th style={{ padding: '10px 12px' }}>Departure</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Block</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Pickup</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>%</th>
                <th style={{ padding: '10px 12px' }}>Cut-off</th>
                <th style={{ padding: '10px 12px' }}>Contact</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const pillKey = (g.status ?? 'open').toLowerCase();
                const pill = STATUS_PILL[pillKey] ?? STATUS_PILL.open;
                return (
                  <tr key={g.group_id} style={{ borderTop: '1px solid var(--paper-warm)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{g.group_name ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--ink-mute)', fontFamily: 'var(--mono)', fontSize: "var(--t-sm)" }}>{g.arrival_date ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--ink-mute)', fontFamily: 'var(--mono)', fontSize: "var(--t-sm)" }}>{g.departure_date ?? '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{g.block_size ?? '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{g.pickup ?? '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)', color: (Number(g.pickup_pct) ?? 0) >= 80 ? 'var(--moss-glow)' : (Number(g.pickup_pct) ?? 0) >= 50 ? 'var(--brass)' : 'var(--st-bad)' }}>
                      {g.pickup_pct == null ? '—' : `${Number(g.pickup_pct).toFixed(0)}%`}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--ink-mute)', fontFamily: 'var(--mono)', fontSize: "var(--t-sm)" }}>{g.cutoff_date ?? '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: "var(--t-sm)" }}>{g.contact_name ?? '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: pill.bg, border: `1px solid ${pill.bd}`, color: pill.fg, padding: '2px 8px', borderRadius: 10, fontSize: "var(--t-xs)", fontWeight: 600, textTransform: 'capitalize' }}>
                        {g.status ?? 'open'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--st-good-bg)', border: '1px solid var(--st-good-bd)', borderRadius: 6, color: 'var(--moss)', fontSize: "var(--t-sm)" }}>
        <strong>✓ Wired.</strong> Reading from <code>public.groups</code> ({groups.length} rows). Margin floor requires revenue + cost join — pending.
      </div>
    </>
  );
}

function Kpi({ scope, value, sub, lorem = false }: { scope: string; value: string; sub: string; lorem?: boolean }) {
  return (
    <div className="kpi-tile" data-tooltip={`${scope} · ${sub}`}>
      <div className="kpi-tile-scope">{scope}</div>
      <div className={`kpi-tile-value${lorem ? ' lorem' : ''}`}>{value}</div>
      <div className="kpi-tile-sub">{sub}</div>
    </div>
  );
}
