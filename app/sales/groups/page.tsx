// app/sales/groups/page.tsx
// Sales › Groups — group bookings pipeline. WIRED to public.groups.

import { supabase } from '@/lib/supabase';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import ArtifactActions from '@/components/page/ArtifactActions';
import GroupsTable, { type GroupRow as GroupRowT } from './_components/GroupsTable';
import { SALES_SUBPAGES } from '../_subpages';

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

  const ctx = (kind: 'panel' | 'table' | 'kpi' | 'brief', title: string) => ({ kind, title, dept: 'sales' as const });

  return (
    <Page
      eyebrow="Sales · Groups"
      title={<>Groups · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>{groups.length} blocks</em></>}
      subPages={SALES_SUBPAGES}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox value={groups.length} unit="count" label="Active blocks" tooltip={`${upcoming} upcoming`} />
        <KpiBox value={totalRn} unit="count" label="Total room nights" tooltip="Sum of block_size across active blocks." />
        <KpiBox value={pickedUp} unit="count" label="Picked up" tooltip={`Pickup rooms confirmed · ${totalRn > 0 ? ((pickedUp / totalRn) * 100).toFixed(0) : 0}% of block. Source: public.groups.pickup.`} />
        <KpiBox value={avgPickupPct} unit="pct" label="Avg pickup" tooltip="Average pickup_pct across active blocks. Watch ≥ 70% for healthy commitment." />
        <KpiBox value={null} unit="usd" label="Margin floor" state="data-needed" needs="revenue + cost join" tooltip="Min margin guard for groups. Needs: contract revenue × cost-of-stay join (TODO)." />
      </div>

      <Panel title={`Group blocks · ${groups.length}`} eyebrow="public.groups" actions={<ArtifactActions context={ctx('table', 'Group blocks')} />}>
        <GroupsTable rows={groups as GroupRowT[]} />
      </Panel>

      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--st-good-bg)', border: '1px solid var(--st-good-bd)', borderRadius: 6, color: 'var(--moss)', fontSize: "var(--t-sm)" }}>
        <strong>✓ Wired.</strong> Reading from <code>public.groups</code> ({groups.length} rows). Margin floor requires revenue + cost join — pending.
      </div>
    </Page>
  );
}
