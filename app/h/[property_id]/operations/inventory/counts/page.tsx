// app/h/[property_id]/operations/inventory/counts/page.tsx
//
// Stock counts — inv.counts (1 row today, ready for growth).

import { redirect } from 'next/navigation';
import { DashboardPage, Container, MetricRow, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import CountsList, { type CountRow } from './CountsList';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string } }

const fmtInt = (n: number): string => Math.round(Number(n) || 0).toLocaleString('en-US');

interface CountRaw {
  count_id: string;
  count_date: string | null;
  count_type: string | null;
  status: string | null;
  location_id: number | null;
}

async function fetchCounts(propertyId: number): Promise<{ counts: CountRaw[]; locNames: Map<number, string> }> {
  const sb = getSupabaseAdmin();
  const [countsRes, locsRes] = await Promise.all([
    sb.schema('inv').from('counts')
      .select('count_id, count_date, count_type, status, location_id')
      .eq('property_id', propertyId)
      .order('count_date', { ascending: false })
      .limit(500),
    sb.schema('inv').from('locations')
      .select('location_id, location_name')
      .eq('property_id', propertyId),
  ]);
  if (countsRes.error) {
    // eslint-disable-next-line no-console
    console.error('[inventory/counts] inv.counts fetch failed', countsRes.error);
  }
  const locNames = new Map<number, string>();
  (locsRes.data ?? []).forEach((l: Record<string, unknown>) => {
    locNames.set(Number(l.location_id), String(l.location_name ?? ''));
  });
  return { counts: (countsRes.data ?? []) as CountRaw[], locNames };
}

export default async function CountsPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    redirect(`/h/${NAMKHAN_PROPERTY_ID}/operations/inventory/counts`);
  }

  const { counts, locNames } = await fetchCounts(propertyId);

  const rows: CountRow[] = counts.map((c) => ({
    count_id: String(c.count_id ?? ''),
    count_date: c.count_date ?? '—',
    location_name: c.location_id != null ? (locNames.get(Number(c.location_id)) ?? '—') : '—',
    count_type: c.count_type ?? '—',
    status: c.status ?? '—',
  }));

  const total = counts.length;
  const submitted = counts.filter((c) => (c.status ?? '').toLowerCase() === 'submitted').length;
  const draft = counts.filter((c) => (c.status ?? '').toLowerCase() === 'draft').length;
  const openLocs = locNames.size;

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.endsWith('/inventory'),
  }));

  return (
    <DashboardPage title="Stock counts" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow
          size="sm"
          tiles={[
            { label: 'Counts on file',   value: fmtInt(total),      footnote: 'Rows in inv.counts' },
            { label: 'Submitted',        value: fmtInt(submitted),  footnote: 'Ready for posting' },
            { label: 'Draft',            value: fmtInt(draft),      footnote: 'In progress on mobile' },
            { label: 'Countable locations', value: fmtInt(openLocs), footnote: 'Distinct inv.locations' },
          ]}
        />
      </div>

      {total === 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="No counts yet" expandable={false}>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: '#1B1B1B' }}>
              Start a new count from a mobile device — pick a location, walk the shelves, submit.
              Recent counts land here in reverse-chronological order.
            </div>
          </Container>
        </div>
      )}

      {total > 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <CountsList title="Recent counts" data={rows} />
        </div>
      )}
    </DashboardPage>
  );
}
