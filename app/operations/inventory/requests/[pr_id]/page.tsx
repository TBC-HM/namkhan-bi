// app/operations/inventory/requests/[pr_id]/page.tsx
// PR detail view. Header tile, items, business justification, approval log.
// Approve / Send back / Reject actions wired via proc_pr_decide RPC.
// (Action buttons are server-rendered shells; wire to a client component
// for the actual user.role check + RPC call.)

import Link from 'next/link';
import Card from '@/components/sections/Card';
import { getRequestDetail } from '@/lib/inv-data';
import { fmtMoney } from '@/lib/format';
import PrDecideButtons from '../../_components/PrDecideButtons';

export const revalidate = 30;
export const dynamic = 'force-dynamic';

interface Props { params: { pr_id: string } }

export default async function RequestDetailPage({ params }: Props) {
  const { pr, items, log } = await getRequestDetail(params.pr_id);

  if (!pr) {
    return (
      <Card title="PR" emphasis="not found">
        <p>This PR does not exist or you don't have read permission.</p>
        <p><Link href="/operations/inventory/requests">← Back to requests</Link></p>
      </Card>
    );
  }

  const inApprovalState = ['submitted', 'pending_gm', 'pending_owner', 'sent_back'].includes(pr.status);

  return (
    <>
      <Card
        title={pr.pr_number ?? 'PR'}
        emphasis={pr.pr_title}
        sub={`Submitted ${pr.submitted_at?.slice(0, 10) ?? '—'} · ${pr.requesting_dept ?? '—'} · status: ${pr.status.replace(/_/g, ' ')}`}
      >
        <dl className="inv-dl">
          <dt>Required approver</dt>
          <dd>{pr.required_approver_role ?? '—'}</dd>
          <dt>Priority</dt>
          <dd className={`priority-${pr.priority}`}>{pr.priority}</dd>
          <dt>Needed by</dt>
          <dd>{pr.needed_by_date ?? '—'}</dd>
          <dt>Delivery location</dt>
          <dd>{pr.location?.location_name ?? '—'}</dd>
          <dt>Total estimated</dt>
          <dd>{fmtMoney(Number(pr.total_estimated_usd ?? 0))}</dd>
        </dl>
        {pr.business_justification && (
          <div className="inv-justification">
            <strong>Justification:</strong>
            <p>{pr.business_justification}</p>
          </div>
        )}
      </Card>

      <Card title="Line items" emphasis={`${items.length}`}>
        <table className="inv-table">
          <thead>
            <tr>
              <th>Item</th><th>SKU</th>
              <th style={{ textAlign: 'right' }}>Qty</th>
              <th style={{ textAlign: 'right' }}>Unit cost</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th>Vendor</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.pr_item_id}>
                <td>{it.item?.item_name ?? it.proposed_item_name ?? '—'}</td>
                <td>{it.item?.sku ?? <em>new item proposal</em>}</td>
                <td style={{ textAlign: 'right' }}>{it.quantity}</td>
                <td style={{ textAlign: 'right' }}>{fmtMoney(Number(it.unit_cost_usd ?? 0))}</td>
                <td style={{ textAlign: 'right' }}>{fmtMoney(Number(it.total_usd ?? 0))}</td>
                <td>{it.supplier?.name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {inApprovalState && (
        <Card title="Approval" emphasis="actions" sub="Owner-role under password gate. Add per-user roles before delegating.">
          <PrDecideButtons prId={pr.pr_id} />
        </Card>
      )}

      <Card title="Approval log" emphasis="audit trail" sub={`${log.length} entries`}>
        {log.length === 0 ? (
          <p className="empty-state">No actions yet.</p>
        ) : (
          <table className="inv-table">
            <thead>
              <tr><th>When</th><th>Action</th><th>By</th><th>Decision</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.log_id}>
                  <td>{l.occurred_at.slice(0, 16).replace('T', ' ')}</td>
                  <td>{l.action}</td>
                  <td>{l.actor_role ?? l.actor_id?.slice(0, 8) ?? '—'}</td>
                  <td>{l.decision ?? '—'}</td>
                  <td>{l.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
