// app/sales/groups/page.tsx
// Sales › Groups — group bookings pipeline. WIRED to public.groups.

import { supabase } from '@/lib/supabase';

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
  confirmed: { bg: '#e6f4ec', bd: '#aed6c0', fg: '#1f6f43' },
  tentative: { bg: '#fef3c7', bd: '#f3d57a', fg: '#5e4818' },
  cancelled: { bg: '#f7d9d9', bd: '#e2a8a8', fg: '#7a1f1f' },
  open:      { bg: '#e7eef5', bd: '#aac2db', fg: '#2c4d70' },
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
      <div style={{ fontSize: 11, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 14 }}>
        <strong style={{ color: '#4a4538' }}>Sales</strong> › Groups
      </div>
      <h1 style={{ margin: '4px 0 2px', fontFamily: 'Georgia, serif', fontWeight: 500, fontSize: 30 }}>
        Groups · <em style={{ color: '#a17a4f' }}>{groups.length} blocks</em>
      </h1>
      <div style={{ fontSize: 13, color: '#4a4538' }}>
        Group bookings pipeline from Cloudbeds. MICE, weddings, retreats, family blocks. Strategist agent + margin floor + displacement check.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10, margin: '14px 0' }}>
        <Kpi scope="Active blocks" value={String(groups.length)} sub={`${upcoming} upcoming`} />
        <Kpi scope="Total room nights" value={totalRn.toLocaleString()} sub="across all blocks" />
        <Kpi scope="Picked up" value={pickedUp.toLocaleString()} sub={`${totalRn > 0 ? ((pickedUp / totalRn) * 100).toFixed(0) : 0}% of block`} />
        <Kpi scope="Avg pickup" value={`${avgPickupPct.toFixed(0)}%`} sub="across all blocks" />
        <Kpi scope="Margin floor" value="lorem" sub="needs revenue + cost join" lorem />
      </div>

      {groups.length === 0 ? (
        <div style={{ background: '#fff', border: '1px dashed #d9d2bc', borderRadius: 8, padding: '40px 20px', textAlign: 'center', color: '#8a8170', fontSize: 13 }}>
          No group blocks in <code>public.groups</code>.
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e6dfc9', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#f7f3e7', textAlign: 'left', color: '#8a8170', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
                  <tr key={g.group_id} style={{ borderTop: '1px solid #f0eadb' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{g.group_name ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#8a8170', fontFamily: 'Menlo, monospace', fontSize: 11.5 }}>{g.arrival_date ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#8a8170', fontFamily: 'Menlo, monospace', fontSize: 11.5 }}>{g.departure_date ?? '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>{g.block_size ?? '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>{g.pickup ?? '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace', color: (Number(g.pickup_pct) ?? 0) >= 80 ? '#1f6f43' : (Number(g.pickup_pct) ?? 0) >= 50 ? '#a17a4f' : '#a83232' }}>
                      {g.pickup_pct == null ? '—' : `${Number(g.pickup_pct).toFixed(0)}%`}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#8a8170', fontFamily: 'Menlo, monospace', fontSize: 11.5 }}>{g.cutoff_date ?? '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11.5 }}>{g.contact_name ?? '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: pill.bg, border: `1px solid ${pill.bd}`, color: pill.fg, padding: '2px 8px', borderRadius: 10, fontSize: 10.5, fontWeight: 600, textTransform: 'capitalize' }}>
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

      <div style={{ marginTop: 14, padding: '10px 14px', background: '#e6f4ec', border: '1px solid #aed6c0', borderRadius: 6, color: '#1f5f3a', fontSize: 11.5 }}>
        <strong>✓ Wired.</strong> Reading from <code>public.groups</code> ({groups.length} rows). Margin floor requires revenue + cost join — pending.
      </div>
    </>
  );
}

function Kpi({ scope, value, sub, lorem = false }: { scope: string; value: string; sub: string; lorem?: boolean }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e6dfc9', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 10.5, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{scope}</div>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 500, color: lorem ? '#c5b89a' : '#4a4538', fontStyle: lorem ? 'italic' : 'normal', margin: '2px 0' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#8a8170' }}>{sub}</div>
    </div>
  );
}
