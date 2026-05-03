import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import Insight from '@/components/sections/Insight';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';
import { getCurrentUser, canEdit, roleLabel } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const user = await getCurrentUser();
  const h = PILLAR_HEADER.settings;
  const canSee = canEdit(user.role, 'owner');

  return (
    <>
      <Banner eyebrow={h.eyebrow} title={h.title} titleEmphasis={h.emphasis} meta={<><strong>Reports</strong></>} />
      <SubNav items={RAIL_SUBNAV.settings} />
      <div className="panel">
        {!canSee ? (
          <Insight tone="alert" eye="Access denied">
            <strong>Owner only.</strong> You're signed in as <strong>{roleLabel(user.role)}</strong>.
          </Insight>
        ) : (
          <>
            <PanelHero
              eyebrow="Settings · Reports & schedules · Owner only"
              title="Scheduled"
              emphasis="reports"
              sub="Daily pickup · weekly revenue · monthly P&L · custom"
            />

            <Card title="Active schedules" sub="Email dispatch ships Phase 2">
              <table className="tbl">
                <thead><tr><th>Report</th><th>Frequency</th><th>Recipients</th><th>Status</th></tr></thead>
                <tbody>
                  <tr><td className="lbl"><strong>Daily pickup</strong></td><td className="lbl">Every day · 07:00 ICT</td><td className="lbl text-mute">paul@thenamkhan.com</td><td><span className="pill">Configured</span></td></tr>
                  <tr><td className="lbl"><strong>Weekly revenue</strong></td><td className="lbl">Mondays · 08:00 ICT</td><td className="lbl text-mute">paul@thenamkhan.com</td><td><span className="pill">Configured</span></td></tr>
                  <tr><td className="lbl"><strong>Monthly P&L</strong></td><td className="lbl">1st of month · 09:00 ICT</td><td className="lbl text-mute">paul@thenamkhan.com</td><td><span className="pill">Configured</span></td></tr>
                </tbody>
              </table>
            </Card>

            <Card title="Create custom report" sub="Pick KPIs · timeframe · format · recipients · cadence" className="mt-22">
              <div className="stub" style={{ padding: 32 }}>
                <h3>Coming Phase 2</h3>
                <p>Report builder — pick from 40+ KPIs, choose CSV / PDF / inline-email format, set cadence, define recipients.</p>
                <button type="button" className="btn btn-primary" disabled>+ New scheduled report</button>
              </div>
            </Card>

            <Insight tone="info" eye="Note">
              Reports are <strong>not</strong> a Settings concept long-term — they should be a top-level Reports menu when the builder ships. Listed here for now since the schedule is part of property config.
            </Insight>
          </>
        )}
      </div>
    </>
  );
}
