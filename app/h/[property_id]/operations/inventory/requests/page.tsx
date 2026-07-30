// app/h/[property_id]/operations/inventory/requests/page.tsx
//
// Purchase requests — procurement.requests with links to the PR detail page
// (PrDecideButtons live there). List view revived 2026-07-30 (inventory
// completion brief).

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DashboardPage, Container, MetricRow, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string } }

const fmtInt = (n: number): string => Math.round(Number(n) || 0).toLocaleString('en-US');
const fmtUsd = (n: number): string => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

interface PrRaw {
  pr_id: string;
  pr_number: string | null;
  pr_title: string | null;
  requesting_dept: string | null;
  needed_by_date: string | null;
  priority: string | null;
  total_estimated_usd: number | null;
  status: string | null;
  submitted_at: string | null;
}

async function fetchRequests(): Promise<PrRaw[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .schema('procurement')
    .from('requests')
    .select('pr_id, pr_number, pr_title, requesting_dept, needed_by_date, priority, total_estimated_usd, status, submitted_at')
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .limit(500);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[inventory/requests] procurement.requests fetch failed', error);
    return [];
  }
  return (data ?? []) as PrRaw[];
}

export default async function RequestsPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    redirect(`/h/${NAMKHAN_PROPERTY_ID}/operations/inventory/requests`);
  }

  const rows = await fetchRequests();
  const basePath = `/h/${propertyId}/operations/inventory`;
  const closedStates = ['approved', 'closed', 'rejected', 'converted_to_po', 'cancelled'];
  const open = rows.filter((r) => !closedStates.includes(r.status ?? ''));
  const totalOpen = open.reduce((s, r) => s + Number(r.total_estimated_usd ?? 0), 0);
  const urgent = open.filter((r) => r.priority === 'urgent').length;
  const now = Date.now();
  const overdue = open.filter((r) => r.needed_by_date && new Date(r.needed_by_date).getTime() < now).length;

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.endsWith('/inventory'),
  }));

  return (
    <DashboardPage title="Purchase requests" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow
          size="sm"
          tiles={[
            { label: 'Open requests',    value: fmtInt(open.length), footnote: 'Not approved / closed / rejected / converted' },
            { label: 'Total est. value', value: fmtUsd(totalOpen),   footnote: 'Sum of total_estimated_usd on open PRs' },
            { label: 'Urgent priority',  value: fmtInt(urgent),      footnote: 'priority=urgent and still open' },
            { label: 'Past needed-by',   value: fmtInt(overdue),     footnote: 'needed_by_date in the past and still open' },
          ]}
        />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={rows.length === 0 ? 'No purchase requests' : 'Purchase requests'} expandable={false}>
          {rows.length === 0 ? (
            <div style={{ fontSize: 13, lineHeight: 1.5, color: '#1B1B1B' }}>
              No requests in the queue. HODs raise requests via the Shop sub-tab; auto-approved
              items convert to POs instantly, others route to GM / owner for a decision here.
            </div>
          ) : (
            <table className="inv-table">
              <thead>
                <tr>
                  <th>PR</th><th>Title</th><th>Dept</th><th>Priority</th>
                  <th style={{ textAlign: 'right' }}>Est. USD</th><th>Status</th><th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.pr_id}>
                    <td>
                      <Link href={`${basePath}/requests/${r.pr_id}`} style={{ textDecoration: 'underline' }}>
                        {r.pr_number ?? r.pr_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td>{r.pr_title ?? '—'}</td>
                    <td>{r.requesting_dept ?? '—'}</td>
                    <td>{r.priority ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>{fmtUsd(Number(r.total_estimated_usd ?? 0))}</td>
                    <td>{(r.status ?? '—').replace(/_/g, ' ')}</td>
                    <td>{r.submitted_at?.slice(0, 10) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Container>
      </div>
    </DashboardPage>
  );
}
