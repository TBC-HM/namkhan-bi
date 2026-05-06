// app/settings/cockpit/page.tsx
// Cockpit landing page — surfaces the autonomous IT department's state:
// recent weekly audits (cockpit_kpi_snapshots), open incidents, and links
// to the runbooks + GitHub Actions + Supabase tables that power it.

import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import { PILLAR_HEADER, RAIL_SUBNAV } from '@/components/nav/subnavConfig';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const REPO = 'TBC-HM/namkhan-bi';
const SUPABASE_PROJECT_REF = 'kpenyneooigsyuuomgct';
const VERCEL_TEAM = 'pbsbase-2825s-projects';
const VERCEL_PROJECT = 'namkhan-bi';

interface KpiRow {
  date: string;
  security_red: number | null;
  security_warn: number | null;
}
interface IncidentRow {
  id: number;
  severity: number;
  symptom: string;
  detected_at: string;
  resolved_at: string | null;
}

async function loadCockpit() {
  try {
    const sb = getSupabaseAdmin();
    const since24h = new Date(Date.now() - 86400_000).toISOString();
    const [kpiRes, incRes, ticketsRes, agentRunsRes, agentsRes, kbRes] = await Promise.all([
      sb
        .from('cockpit_kpi_snapshots')
        .select('date, security_red, security_warn')
        .order('date', { ascending: false })
        .limit(8),
      sb
        .from('cockpit_incidents')
        .select('id, severity, symptom, detected_at, resolved_at')
        .order('detected_at', { ascending: false })
        .limit(5),
      sb
        .from('cockpit_tickets')
        .select('id, status')
        .gte('created_at', since24h),
      sb
        .from('cockpit_audit_log')
        .select('agent, success, cost_usd_milli')
        .gte('created_at', since24h),
      sb
        .from('cockpit_agent_prompts')
        .select('role', { count: 'exact', head: true })
        .eq('active', true),
      sb
        .from('cockpit_knowledge_base')
        .select('id', { count: 'exact', head: true })
        .eq('active', true),
    ]);
    const tickets = (ticketsRes.data ?? []) as { id: number; status: string }[];
    const runs = (agentRunsRes.data ?? []) as { agent: string; success: boolean; cost_usd_milli: number | null }[];
    const totalCostMilli = runs.reduce((s, r) => s + (r.cost_usd_milli ?? 0), 0);
    return {
      kpi: (kpiRes.data ?? []) as KpiRow[],
      incidents: (incRes.data ?? []) as IncidentRow[],
      err: kpiRes.error?.message || incRes.error?.message || null,
      tickets24h: tickets.length,
      ticketsAwaiting: tickets.filter((t) => ['awaits_user', 'new', 'triaging', 'triaged', 'working'].includes(t.status)).length,
      runs24h: runs.length,
      cost24hUsd: (totalCostMilli / 1000).toFixed(4),
      agentCount: agentsRes.count ?? 0,
      kbCount: kbRes.count ?? 0,
    };
  } catch (e) {
    return {
      kpi: [] as KpiRow[],
      incidents: [] as IncidentRow[],
      err: e instanceof Error ? e.message : 'unknown',
      tickets24h: 0,
      ticketsAwaiting: 0,
      runs24h: 0,
      cost24hUsd: '0.0000',
      agentCount: 0,
      kbCount: 0,
    };
  }
}

const EMPTY = '—'; // em-dash

export default async function CockpitSettingsPage() {
  const h = PILLAR_HEADER.settings;
  const data = await loadCockpit();
  const { kpi, incidents, err, tickets24h, ticketsAwaiting, runs24h, cost24hUsd, agentCount, kbCount } = data;
  const latest = kpi[0];
  const openIncidents = incidents.filter((i) => !i.resolved_at).length;

  return (
    <>
      <Banner
        eyebrow={h.eyebrow}
        title={h.title}
        titleEmphasis={h.emphasis}
        meta={
          <>
            <strong>Cockpit</strong>
          </>
        }
      />
      <SubNav items={RAIL_SUBNAV.settings} />
      <div className="panel">
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderLeft: '3px solid var(--brass)', borderRadius: 8, padding: '14px 18px', marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 'var(--t-xs)', color: 'var(--brass)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', fontWeight: 600 }}>Cockpit · live workspace</div>
            <div style={{ fontSize: 'var(--t-md)', marginTop: 4 }}>This is the <em>status page</em>. The live chat-driven cockpit (where you talk to the IT Manager) is at <a href="/cockpit" style={{ color: 'var(--brass)' }}>/cockpit</a>.</div>
          </div>
          <a href="/cockpit" style={{ background: 'var(--brass)', color: 'white', padding: '8px 16px', borderRadius: 6, textDecoration: 'none', fontSize: 'var(--t-sm)', fontWeight: 600, whiteSpace: 'nowrap' }}>Open cockpit →</a>
        </div>
        <PanelHero
          eyebrow="Settings · Cockpit"
          title="IT Department"
          emphasis="cockpit"
          sub="Autonomous health · weekly audit · agent guardrails · runbooks"
          kpis={
            <>
              <KpiCard
                label="Active agents"
                value={agentCount}
                hint={`${kbCount} knowledge entries`}
                tone="neutral"
              />
              <KpiCard
                label="Tickets / 24h"
                value={tickets24h}
                hint={ticketsAwaiting > 0 ? `${ticketsAwaiting} awaiting` : 'queue clear'}
                tone={ticketsAwaiting > 0 ? 'warn' : 'neutral'}
              />
              <KpiCard
                label="Agent runs / 24h"
                value={runs24h}
                hint={`$${cost24hUsd} spend`}
                tone="neutral"
              />
              <KpiCard
                label="Open incidents"
                value={openIncidents}
                hint={
                  incidents.length
                    ? `${incidents.length} tracked · last ${latest?.date ?? EMPTY}`
                    : 'logger pending'
                }
                tone={openIncidents > 0 ? 'warn' : 'neutral'}
              />
            </>
          }
        />

        {err && (
          <Card title="Connection issue" sub="cockpit_* tables not reachable">
            <div className="stub" style={{ padding: 32 }}>
              <h3>Cannot read cockpit tables</h3>
              <p>
                Supabase admin client returned an error. Check that{' '}
                <strong>SUPABASE_SERVICE_ROLE_KEY</strong> is set on this
                deployment. Detail: <code>{err}</code>
              </p>
            </div>
          </Card>
        )}

        <div className="card-grid-2">
          <Card title="Recent weekly" emphasis="snapshots" sub="cockpit_kpi_snapshots · last 8">
            <div style={{ padding: 24 }}>
              {kpi.length === 0 ? (
                <p className="muted">
                  No snapshots yet. The first one lands after the next manual or
                  Monday 06:00 UTC run of the <strong>Weekly Audit</strong> workflow.
                </p>
              ) : (
                <table className="cockpit-mini">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th style={{ textAlign: 'right' }}>Red</th>
                      <th style={{ textAlign: 'right' }}>Warn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpi.map((r) => (
                      <tr key={r.date}>
                        <td>{r.date}</td>
                        <td style={{ textAlign: 'right' }}>
                          {r.security_red ?? EMPTY}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {r.security_warn ?? EMPTY}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          <Card title="Recent" emphasis="incidents" sub="cockpit_incidents · last 5">
            <div style={{ padding: 24 }}>
              {incidents.length === 0 ? (
                <p className="muted">
                  No incidents recorded. Incident logger (Make scenario 05 or
                  GH-Actions equivalent) is not yet wired — see runbook below.
                </p>
              ) : (
                <table className="cockpit-mini">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'right' }}>Sev</th>
                      <th>Symptom</th>
                      <th>Detected</th>
                      <th>Resolved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((i) => (
                      <tr key={i.id}>
                        <td style={{ textAlign: 'right' }}>S{i.severity}</td>
                        <td>{i.symptom}</td>
                        <td>{i.detected_at.slice(0, 10)}</td>
                        <td>
                          {i.resolved_at ? i.resolved_at.slice(0, 10) : EMPTY}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>

        <div className="card-grid-2" style={{ marginTop: 22 }}>
          <Card title="Runbooks" emphasis="& docs" sub="repo-tracked, version-controlled">
            <div style={{ padding: 24 }}>
              <ul className="cockpit-links">
                <li>
                  <a
                    href={`https://github.com/${REPO}/blob/main/cockpit/HANDOFF.md`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    HANDOFF.md
                  </a>{' '}
                  <span className="muted">— at-a-glance daily/weekly reference</span>
                </li>
                <li>
                  <a
                    href={`https://github.com/${REPO}/blob/main/cockpit/setup-log.md`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    setup-log.md
                  </a>{' '}
                  <span className="muted">— full audit trail of cockpit setup</span>
                </li>
                <li>
                  <a
                    href={`https://github.com/${REPO}/blob/main/cockpit/runbooks/vercel-hardening.md`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    vercel-hardening.md
                  </a>{' '}
                  <span className="muted">— spending cap · firewall · agent</span>
                </li>
                <li>
                  <a
                    href={`https://github.com/${REPO}/blob/main/cockpit/runbooks/site-down.md`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    site-down.md
                  </a>{' '}
                  <span className="muted">— S1 response runbook</span>
                </li>
                <li>
                  <a
                    href={`https://github.com/${REPO}/tree/main/cockpit`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    cockpit/ folder
                  </a>{' '}
                  <span className="muted">— full tree (standards · decisions · runbooks)</span>
                </li>
              </ul>
            </div>
          </Card>

          <Card title="External" emphasis="surfaces" sub="dashboards · audit issues · workflows">
            <div style={{ padding: 24 }}>
              <ul className="cockpit-links">
                <li>
                  <a
                    href={`https://github.com/${REPO}/issues?q=is%3Aissue+%22Weekly+Cockpit+Audit%22`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Audit issues
                  </a>{' '}
                  <span className="muted">— each Monday's digest as a GitHub issue</span>
                </li>
                <li>
                  <a
                    href={`https://github.com/${REPO}/actions`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    GitHub Actions
                  </a>{' '}
                  <span className="muted">— workflow runs + manual dispatch</span>
                </li>
                <li>
                  <a
                    href={`https://github.com/${REPO}/actions/workflows/weekly-audit.yml`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Weekly Audit workflow
                  </a>{' '}
                  <span className="muted">— "Run workflow" to fire on demand</span>
                </li>
                <li>
                  <a
                    href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/editor`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Supabase tables
                  </a>{' '}
                  <span className="muted">— filter cockpit_*</span>
                </li>
                <li>
                  <a
                    href={`https://vercel.com/${VERCEL_TEAM}/${VERCEL_PROJECT}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Vercel project
                  </a>{' '}
                  <span className="muted">— deploys · firewall · analytics · agent</span>
                </li>
                <li>
                  <a
                    href={`https://github.com/${REPO}/settings/secrets/actions`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    GitHub Secrets
                  </a>{' '}
                  <span className="muted">— manage SUPABASE_*, ANTHROPIC_API_KEY</span>
                </li>
              </ul>
            </div>
          </Card>
        </div>

        <div className="card-grid-2" style={{ marginTop: 22 }}>
          <Card title="Kill" emphasis="switches" sub="when something goes wrong">
            <div style={{ padding: 24 }}>
              <p className="muted" style={{ marginBottom: 12 }}>
                Disable any arm without code changes. Full list in{' '}
                <a
                  href={`https://github.com/${REPO}/blob/main/cockpit/HANDOFF.md#3-kill-switches-how-to-disable-any-arm`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  HANDOFF.md § 3
                </a>
                .
              </p>
              <ul className="cockpit-links">
                <li>
                  Weekly Audit:{' '}
                  <code>gh workflow disable weekly-audit.yml --repo {REPO}</code>
                </li>
                <li>
                  Anthropic spend: revoke{' '}
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    cockpit-gh-actions
                  </a>{' '}
                  key
                </li>
                <li>
                  Vercel runtime: pause project at Vercel → namkhan-bi →
                  Settings → General
                </li>
                <li>
                  DB writes: rotate JWT in Supabase → Project Settings → API
                </li>
              </ul>
            </div>
          </Card>

          <Card title="Schedule" emphasis="& cadence" sub="what fires when">
            <div style={{ padding: 24 }}>
              <ul className="cockpit-links">
                <li>
                  <strong>Weekly Audit + Digest</strong> — every Monday 06:00 UTC
                </li>
                <li>
                  <strong>Daily Dependency Check</strong> — every day 05:00 UTC
                </li>
                <li>
                  <strong>Lighthouse on PR</strong> — every PR to main
                </li>
                <li>
                  <strong>CI</strong> — every push + PR to main (existing)
                </li>
                <li>
                  <strong>Design doc check</strong> — every PR touching app/
                  components/ styles/ (existing)
                </li>
              </ul>
            </div>
          </Card>
        </div>
      </div>

      <style>{`
        .cockpit-mini {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--t-sm);
        }
        .cockpit-mini th {
          font-size: var(--t-xs);
          letter-spacing: var(--ls-extra);
          color: var(--brass);
          text-transform: uppercase;
          font-weight: 500;
          text-align: left;
          padding: 8px 12px;
          border-bottom: 1px solid var(--line);
        }
        .cockpit-mini td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--line-faint);
        }
        .cockpit-mini tr:last-child td {
          border-bottom: none;
        }
        .cockpit-links {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-size: var(--t-sm);
        }
        .cockpit-links a {
          color: var(--moss);
          text-decoration: none;
          font-weight: 500;
        }
        .cockpit-links a:hover {
          text-decoration: underline;
        }
        .cockpit-links code {
          font-size: var(--t-xs);
          background: var(--paper-warm);
          padding: 2px 6px;
          border-radius: 3px;
        }
        .muted {
          color: var(--ink-muted);
          font-size: var(--t-sm);
        }
      `}</style>
    </>
  );
}
