// app/operations/inventory/counts/page.tsx
// Page 9 — Stock Take. Mobile-first count entry.
// Mode A: list of recent counts (?mode=list, default)
// Mode B: new count entry for a specific location (?mode=new&location=N)

import Link from 'next/link';
import Card from '@/components/sections/Card';
import { getRecentCounts, getInvLocations, getOpenCountsForLocation } from '@/lib/inv-data';
import CountForm, { type CountRow } from '../_components/CountForm';

export const revalidate = 30;
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: { mode?: string; location?: string };
}

export default async function CountsPage({ searchParams }: Props) {
  const mode = searchParams.mode ?? 'list';
  const locId = searchParams.location ? parseInt(searchParams.location, 10) : null;

  if (mode === 'new' && locId) {
    return <NewCountFormCard locationId={locId} />;
  }

  const [recent, locations] = await Promise.all([
    getRecentCounts().catch(() => []),
    getInvLocations().catch(() => []),
  ]);

  return (
    <>
      <Card title="Start a new count" emphasis="select a location" sub="Mobile-first count entry · saves a draft you can submit later">
        <div className="inv-loc-grid">
          {(locations as any[]).map((l) => (
            <Link key={l.location_id} href={`?mode=new&location=${l.location_id}`} className="inv-loc-card">
              <div className="inv-loc-name">{l.location_name}</div>
              <div className="inv-loc-meta">{l.area_type}{l.responsible_dept ? ` · ${l.responsible_dept}` : ''}</div>
            </Link>
          ))}
        </div>
      </Card>

      <Card title="Recent counts" emphasis={`${recent.length}`}>
        {recent.length === 0 ? (
          <p className="empty-state">No counts yet.</p>
        ) : (
          <table className="inv-table">
            <thead>
              <tr><th>Date</th><th>Location</th><th>Type</th><th>Status</th></tr>
            </thead>
            <tbody>
              {(recent as any[]).map((c) => (
                <tr key={c.count_id}>
                  <td>{c.count_date}</td>
                  <td>{c.location?.location_name ?? '—'}</td>
                  <td>{c.count_type}</td>
                  <td className={`status-${c.status}`}>{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

async function NewCountFormCard({ locationId }: { locationId: number }) {
  const items = await getOpenCountsForLocation(locationId).catch(() => []);

  const rows: CountRow[] = (items as any[]).map((row) => ({
    item_id: row.item_id,
    sku: row.item?.sku ?? '',
    item_name: row.item?.item_name ?? '',
    category_name: row.item?.category?.name ?? '—',
    expected: Number(row.balance?.[0]?.quantity_on_hand ?? 0),
    unit_cost_usd: row.item?.last_unit_cost_usd != null ? Number(row.item.last_unit_cost_usd) : null,
  }));

  return (
    <Card
      title="New stock count"
      emphasis={`location #${locationId}`}
      sub={`${rows.length} item${rows.length === 1 ? '' : 's'} expected at this location`}
    >
      <p>
        <Link href="/operations/inventory/counts">← Back to counts list</Link>
      </p>

      {rows.length === 0 ? (
        <p className="empty-state">
          No items have a par level set for this location yet. Set par in <Link href="/operations/inventory/catalog">/catalog</Link> first.
        </p>
      ) : (
        <CountForm locationId={locationId} rows={rows} />
      )}
    </Card>
  );
}
