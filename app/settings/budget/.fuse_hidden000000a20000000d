import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import Insight from '@/components/sections/Insight';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';
import { getCurrentUser, canEdit, roleLabel } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

export default async function BudgetPage() {
  const user = await getCurrentUser();
  const h = PILLAR_HEADER.settings;
  const canSee = canEdit(user.role, 'finance');

  return (
    <>
      <Banner eyebrow={h.eyebrow} title={h.title} titleEmphasis={h.emphasis} meta={<><strong>Budget</strong></>} />
      <SubNav items={RAIL_SUBNAV.settings} />
      <div className="panel">
        {!canSee ? (
          <Insight tone="alert" eye="Access denied">
            <strong>Finance + Owner only.</strong> You're signed in as <strong>{roleLabel(user.role)}</strong>.
          </Insight>
        ) : (
          <>
            <PanelHero
              eyebrow="Settings · Budget · Finance + Owner"
              title="Budget"
              emphasis="upload"
              sub="CSV by USALI line · unblocks GOP · variance · GOPPAR · pace-to-target"
            />

            <Card title="Upload annual budget" sub="Schema: month, usali_dept, usali_subdept, amount_lak">
              <div className="stub" style={{ padding: 32 }}>
                <h3>Drop CSV here</h3>
                <p>Expected columns: <code>month</code> (YYYY-MM), <code>usali_dept</code>, <code>usali_subdept</code>, <code>amount_lak</code>.</p>
                <button type="button" className="btn btn-primary" disabled>Choose file (Phase 2)</button>
              </div>
            </Card>

            <Insight tone="info" eye="Why it matters">
              Unlocks 4 greyed-out KPIs across Finance and Revenue: GOP, GOP variance %, GOPPAR, pace-to-target. Owner provides the budget once per fiscal year. 1-2 hours one-time. Full P&L view as a result.
            </Insight>
          </>
        )}
      </div>
    </>
  );
}
