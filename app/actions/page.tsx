// app/actions/page.tsx
// Recommendations & action plans.
// Phase 4 will pull from Vertex; today we surface DQ issues as actionable items.

import Banner from '@/components/nav/Banner';
import FilterStrip from '@/components/nav/FilterStrip';
import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import Insight from '@/components/sections/Insight';
import { PILLAR_HEADER } from '@/components/nav/subnavConfig';
import { getDqIssues } from '@/lib/data';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function ActionsPage() {
  const dq = await getDqIssues().catch(() => []);

  const critical = dq.filter((d: any) => d.severity === 'critical' || d.severity === 'high');
  const medium = dq.filter((d: any) => d.severity === 'medium');
  const low = dq.filter((d: any) => d.severity === 'low' || d.severity === 'info');

  const h = PILLAR_HEADER.actions;
  const t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Vientiane' });

  return (
    <>
      <Banner
        eyebrow={h.eyebrow}
        title={h.title}
        titleEmphasis={h.emphasis}
        meta={
          <>
            <strong>Recommendations</strong><br />
            Refreshed {t} ICT
          </>
        }
      />

      <FilterStrip baseHref="/actions" liveSource="DQ engine · live · Vertex pending" currentWin="today" />

      <div className="panel">
        <PanelHero
          eyebrow="Action plan"
          title="Operator"
          emphasis="recommendations"
          sub="Phase 1: data-quality issues · Phase 4: Vertex AI agent recommendations"
          kpis={
            <>
              <KpiCard
                label="Critical"
                value={critical.length}
                tone={critical.length > 0 ? 'neg' : 'pos'}
                hint="Immediate action"
              />
              <KpiCard
                label="Medium"
                value={medium.length}
                tone={medium.length > 0 ? 'warn' : 'pos'}
                hint="This week"
              />
              <KpiCard
                label="Informational"
                value={low.length}
                hint="Track / document"
              />
              <KpiCard label="Resolved 30d" value={null} greyed hint="Resolution log pending" />
            </>
          }
        />

        {dq.length === 0 ? (
          <Card title="All clear" sub="No active issues">
            <div className="stub" style={{ padding: 32 }}>
              <h3>All clear</h3>
              <p>No active data-quality issues. Vertex recommendation engine arrives in Phase 4.</p>
            </div>
          </Card>
        ) : (
          <Card title="Open issues" emphasis={`· ${dq.length}`} sub="Sorted by severity" source="dq_known_issues">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Recommended action</th>
                </tr>
              </thead>
              <tbody>
                {dq.map((d: any) => {
                  const tone =
                    d.severity === 'critical' || d.severity === 'high'
                      ? 'bad'
                      : d.severity === 'medium'
                      ? 'warn'
                      : 'good';
                  return (
                    <tr key={d.code || d.id}>
                      <td>
                        <span className={`pill ${tone}`}>{d.severity || '—'}</span>
                      </td>
                      <td className="lbl text-mono">{d.code || '—'}</td>
                      <td className="lbl"><strong>{d.title || d.description || '—'}</strong></td>
                      <td className="lbl text-mute">{d.action || d.recommendation || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}

        <Insight tone="info" eye="Phase 4">
          <strong>Vertex AI recommendation engine</strong> is the long-term home for this tab.
          Pickup-predictor, pricing coach, F&B capture coach, and DQ-fix-suggester will produce
          ranked actions per department with one-click approve/dismiss in the toolbar.
        </Insight>
      </div>
    </>
  );
}
