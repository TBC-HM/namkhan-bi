// app/sales/proposals/page.tsx
// PBS 2026-07-15 — Proposals index. Lists every sales.proposals row for the
// active property, with a link to the composer at /sales/proposals/{id}/edit.
// Additive: previously only /sales/proposals/[id]/edit existed. Adding the
// index unblocks the new "Proposals" tab in SALES_SUBPAGES.
//
// Reads via sb.schema('sales') (service role) to mirror the existing
// createProposalFromInquiry pattern in lib/sales.ts. No PostgREST public view
// exists for sales.proposals yet; add one later if RLS-scoped anon reads are needed.

import Link from 'next/link';
import { DashboardPage } from '@/app/(cockpit)/_design';
import { SALES_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import DeleteProposalButton from './_components/DeleteProposalButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN = 260955;

interface PageProps {
  propertyId?: number;
}

interface ProposalRow {
  id: string;
  status: string;
  guest_name_snapshot: string | null;
  date_in_snapshot: string | null;
  date_out_snapshot: string | null;
  template_id: string | null;
  lead_id: number | null;
  inquiry_id: string | null;
  created_at: string;
  sent_at: string | null;
  total_lak: number | null;
}

async function loadProposals(propertyId: number): Promise<ProposalRow[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .schema('sales')
    .from('proposals')
    .select('id, status, guest_name_snapshot, date_in_snapshot, date_out_snapshot, template_id, lead_id, inquiry_id, created_at, sent_at, total_lak')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(200);
  return (data ?? []) as ProposalRow[];
}

const T = {
  WHITE: '#FFFFFF', HAIR: '#E6DFCC', INK: '#1B1B1B', INK_M: '#5A5A5A',
  CREAM: '#F5F0E1', FOREST: '#084838', AMBER: '#B48A3A', MOSS: '#4C7A5E', RED: '#B03826',
};

function statusColor(s: string): string {
  switch (s) {
    case 'draft':      return T.INK_M;
    case 'sent':       return T.AMBER;
    case 'viewed':     return T.MOSS;
    case 'signed':     return T.FOREST;
    case 'converted':  return T.FOREST;
    case 'declined':   return T.RED;
    case 'expired':    return T.RED;
    default:           return T.INK_M;
  }
}

export default async function SalesProposalsIndexPage({ propertyId }: PageProps = {}) {
  const pid = propertyId ?? NAMKHAN;
  const rows = await loadProposals(pid);
  const tabs = SALES_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/sales/proposals',
  }));

  return (
    <DashboardPage
      title="Proposals"
      subtitle="Every guest quote and B2B offer built through the composer."
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <div style={{
          background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 4, overflowX: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: T.INK }}>
            <thead>
              <tr style={{ background: T.CREAM }}>
                {['Guest', 'Status', 'Dates', 'Origin', 'Total (LAK)', 'Created', ''].map((h) => (
                  <th key={h} style={{
                    padding: '8px 10px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase',
                    letterSpacing: 0.5, color: T.INK_M, fontWeight: 600, borderBottom: '1px solid ' + T.HAIR,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: T.INK_M }}>
                  No proposals yet. Create one from a lead via the Leads tab.
                </td></tr>
              ) : rows.map((p) => {
                const origin = p.lead_id != null ? 'lead #' + p.lead_id
                  : p.inquiry_id ? 'inquiry'
                  : 'manual';
                const dates = [p.date_in_snapshot, p.date_out_snapshot].filter(Boolean).join(' → ');
                return (
                  <tr key={p.id}>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid ' + T.HAIR, fontWeight: 600 }}>
                      {p.guest_name_snapshot ?? '(untitled)'}
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid ' + T.HAIR }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 10,
                        background: statusColor(p.status), color: T.WHITE, fontWeight: 600, textTransform: 'capitalize',
                      }}>{p.status}</span>
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid ' + T.HAIR, color: T.INK_M }}>{dates}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid ' + T.HAIR, color: T.INK_M }}>{origin}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid ' + T.HAIR, textAlign: 'right' }}>
                      {p.total_lak != null ? Number(p.total_lak).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid ' + T.HAIR, color: T.INK_M, whiteSpace: 'nowrap' }}>
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid ' + T.HAIR, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Link href={'/sales/proposals/' + p.id + '/edit'} style={{
                        padding: '4px 10px', fontSize: 11, borderRadius: 4, border: '1px solid ' + T.FOREST,
                        color: T.FOREST, textDecoration: 'none', fontWeight: 600,
                      }}>Open →</Link>
                      <DeleteProposalButton proposalId={p.id} label={p.guest_name_snapshot ?? undefined} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardPage>
  );
}
