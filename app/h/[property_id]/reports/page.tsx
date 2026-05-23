// app/h/[property_id]/reports/page.tsx
//
// Cross-dept reports landing. Reached from every HoD's subPages strip
// (rightmost "Reports" tab). Two sections:
//   1. Recent reports — public.report_runs scoped to this property
//      (every viewed report from ReportBuilder lands here via task #79).
//   2. Agent deliveries — cockpit_tickets where source='agent_delivery'
//      (memos pushed by agents via deliverMemoToHod).
//
// ?dept= param picks the right subPages strip so the entry tab stays lit.

import Link from 'next/link';
import ReportActions from './_components/ReportActions';
import { notFound } from 'next/navigation';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import AgentDeliveriesPanel from '@/components/inbox/AgentDeliveriesPanel';
import { listAgentDeliveries } from '@/lib/inbox/agent-deliveries';
import { supabase } from '@/lib/supabase';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_PROPERTIES: Record<number, string> = {
  260955:  'The Namkhan',
  1000001: 'Donna Portals',
};

const DEPT_KEYS = new Set([
  'revenue', 'sales', 'marketing', 'operations', 'guest', 'finance',
]);

const TITLE_BY_TEMPLATE: Record<string, string> = {
  pulse:     'Pulse',
  pace:      'Pace',
  channels:  'Channels',
  pricing:   'Pricing',
  comp_set:  'Comp Set',
  compset:   'Comp Set',
  forecast:  'Forecast',
  'pl-month':'P&L · month',
  pl_month:  'P&L · month',
};

interface ReportRun {
  id: number;
  template_code: string;
  property_id: number | null;
  params: Record<string, unknown> | null;
  output_summary: string | null;
  status: string;
  created_at: string;
}

interface Props {
  params: { property_id: string };
  searchParams: { delivery?: string; dept?: string };
}

function buildReopenHref(propertyId: number, run: ReportRun): string {
  const params = (run.params ?? {}) as Record<string, unknown>;
  const raw = (params.raw ?? {}) as Record<string, unknown>;
  const qs = new URLSearchParams();
  // Prefer raw original params, fall back to logged scalars
  const type = String(params.type ?? raw.type ?? run.template_code);
  qs.set('type', type);
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'type') continue;
    if (v == null) continue;
    qs.set(k, String(v));
  }
  if (!qs.has('property_id') && propertyId !== 260955) {
    qs.set('property_id', String(propertyId));
  }
  const base = propertyId === 260955
    ? '/revenue/reports/render'
    : `/h/${propertyId}/revenue/reports/render`;
  return `${base}?${qs.toString()}`;
}

function relTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toISOString().slice(0, 10);
}

export default async function ReportsPage({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || !KNOWN_PROPERTIES[propertyId]) {
    notFound();
  }
  const propertyLabel = KNOWN_PROPERTIES[propertyId];

  const deptParam = (searchParams.dept ?? 'revenue').toLowerCase();
  const dept = DEPT_KEYS.has(deptParam) ? (deptParam as keyof typeof DEPT_CFG) : 'revenue';
  const cfg = DEPT_CFG[dept];

  const subPages = rewriteSubPagesForProperty(cfg.subPages, propertyId);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.label === 'Reports',
  }));

  // Parallel: report runs + agent deliveries
  const [runsRes, deliveries] = await Promise.all([
    supabase
      .from('report_runs')
      .select('id, template_code, property_id, params, output_summary, status, created_at')
      .neq('status', 'deleted')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(100),
    listAgentDeliveries(propertyId, 100).catch(() => []),
  ]);
  const runs = ((runsRes.data ?? []) as ReportRun[]);
  const deptLabel = dept.charAt(0).toUpperCase() + dept.slice(1);

  return (
    <DashboardPage
      title={`Reports · ${propertyLabel}`}
      subtitle={`${deptLabel} · ${runs.length} generated · ${deliveries.length} agent deliveries`}
      tabs={tabs}
    >
      {/* Recent reports — every viewed render is logged */}
      <div style={fullRow}>
        <Container
          title="Recent reports"
          subtitle={`${runs.length} run${runs.length === 1 ? '' : 's'} · click "Reopen" to print or send again`}
          density="compact"
        >
          {runs.length === 0 ? (
            <div style={emptyStyle}>
              No reports run yet for this property. Open one from the Revenue HoD page
              (Build a report → pick type → Open report →) and it will land here.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={theadRow}>
                    <th style={th}>Type</th>
                    <th style={th}>Summary</th>
                    <th style={th}>Status</th>
                    <th style={th}>When</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => {
                    const params = (run.params ?? {}) as Record<string, unknown>;
                    const type = String(params.type ?? run.template_code);
                    const title = TITLE_BY_TEMPLATE[type] ?? type;
                    return (
                      <tr key={run.id} style={trRow}>
                        <td style={tdLeft}>
                          <span style={typePill}>{title}</span>
                        </td>
                        <td style={tdLeft}>{run.output_summary ?? '—'}</td>
                        <td style={tdLeft}>
                          <span style={{
                            ...statusPill,
                            color: run.status === 'ok' ? 'var(--primary, #1F3A2E)'
                                 : run.status === 'viewed' ? 'var(--ink, #1B1B1B)'
                                 : 'var(--terracotta, #B8542A)',
                          }}>{run.status}</span>
                        </td>
                        <td style={tdLeft}>
                          <span title={run.created_at}>{relTime(run.created_at)}</span>
                        </td>
                        <td style={tdRight}>
                          <ReportActions
                            runId={run.id}
                            reopenHref={buildReopenHref(propertyId, run)}
                            reportType={String((run.params ?? {}).type ?? run.template_code ?? '')}
                            reportUrl={buildReopenHref(propertyId, run)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>

      {/* Agent deliveries — unchanged from prior version */}
      <div style={fullRow}>
        <Container
          title="Agent deliveries"
          subtitle={`${deliveries.length} item${deliveries.length === 1 ? '' : 's'} · cockpit_tickets where source='agent_delivery'`}
          density="compact"
        >
          {deliveries.length === 0 ? (
            <div style={emptyStyle}>
              No agent deliveries yet. When an agent (Mira / Vector / Mercer / Lumen /
              Forge / Intel) sends a memo via <code>deliverMemoToHod()</code> with{' '}
              <code>requested_by_role={`${dept}_hod`}</code>, it will appear here.
            </div>
          ) : (
            <AgentDeliveriesPanel
              deliveries={deliveries}
              propertyId={propertyId}
              selectedIdParam={searchParams.delivery}
              basePath={`/h/${propertyId}/reports`}
            />
          )}
        </Container>
      </div>
    </DashboardPage>
  );
}

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };
const emptyStyle: React.CSSProperties = {
  padding: 20,
  color: 'var(--ink-soft, #5A5A5A)',
  fontStyle: 'italic',
  fontSize: 13,
};
const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
};
const theadRow: React.CSSProperties = {
  background: 'var(--paper, #FFFFFF)',
  borderBottom: '1px solid var(--hairline, #E6DFCC)',
};
const th: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--ink-soft, #5A5A5A)',
  textAlign: 'left',
};
const trRow: React.CSSProperties = {
  borderBottom: '1px solid var(--hairline, #E6DFCC)',
};
const tdLeft: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  color: 'var(--ink, #1B1B1B)',
  verticalAlign: 'top',
};
const tdRight: React.CSSProperties = {
  ...tdLeft,
  textAlign: 'right',
};
const typePill: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 99,
  background: 'var(--paper, #FFFFFF)',
  border: '1px solid var(--hairline, #E6DFCC)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  color: 'var(--ink, #1B1B1B)',
  whiteSpace: 'nowrap',
};
const statusPill: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  fontVariantNumeric: 'tabular-nums',
};
const reopenLink: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--brass, #B8A878)',
  textDecoration: 'none',
  padding: '4px 10px',
  border: '1px solid var(--hairline, #E6DFCC)',
  borderRadius: 4,
  whiteSpace: 'nowrap',
};
