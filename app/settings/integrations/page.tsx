import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import Insight from '@/components/sections/Insight';
import KpiCard from '@/components/kpi/KpiCard';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';
import { getCurrentUser, canEdit, roleLabel } from '@/lib/currentUser';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage() {
  const user = await getCurrentUser();
  const h = PILLAR_HEADER.settings;
  const canSee = canEdit(user.role, 'owner');

  let supabaseOk = false;
  try {
    const { error } = await supabase.from('app_settings').select('key', { count: 'exact', head: true }).limit(1);
    supabaseOk = !error;
  } catch { supabaseOk = false; }

  return (
    <>
      <Banner eyebrow={h.eyebrow} title={h.title} titleEmphasis={h.emphasis} meta={<><strong>Integrations</strong></>} />
      <SubNav items={RAIL_SUBNAV.settings} />
      <div className="panel">
        {!canSee ? (
          <Insight tone="alert" eye="Access denied">
            <strong>Owner only.</strong> You're signed in as <strong>{roleLabel(user.role)}</strong>.
          </Insight>
        ) : (
          <>
            <PanelHero
              eyebrow="Settings · Integrations · Owner only"
              title="API"
              emphasis="integrations"
              sub="Cloudbeds · Supabase · email parser · Vertex"
              kpis={
                <>
                  <KpiCard label="Cloudbeds" value="Connected" kind="text" tone="pos" hint="property_id 260955" />
                  <KpiCard label="Supabase" value={supabaseOk ? 'Connected' : 'Error'} kind="text" tone={supabaseOk ? 'pos' : 'neg'} />
                  <KpiCard label="Email parser" value="Phase 2" kind="text" greyed hint="reviews intake" />
                  <KpiCard label="Vertex AI" value="Phase 4" kind="text" greyed hint="action engine" />
                </>
              }
            />

            <Card title="Active connections" sub="Read-only · API keys live in Vercel env vars">
              <table className="tbl">
                <thead><tr><th>Service</th><th>Status</th><th>Scope</th><th>Notes</th></tr></thead>
                <tbody>
                  <tr>
                    <td className="lbl"><strong>Cloudbeds API</strong></td>
                    <td><span className="pill good">Connected</span></td>
                    <td className="lbl text-mute">read · reservations, transactions, rate plans</td>
                    <td className="lbl text-mute">housekeeping:read scope blocked — see DQ #4</td>
                  </tr>
                  <tr>
                    <td className="lbl"><strong>Supabase</strong></td>
                    <td><span className={`pill ${supabaseOk ? 'good' : 'bad'}`}>{supabaseOk ? 'Connected' : 'Error'}</span></td>
                    <td className="lbl text-mute">project kpenyneooigsyuuomgct (eu-central-1)</td>
                    <td className="lbl text-mute">anon key in env · service role for write paths Phase 2</td>
                  </tr>
                  <tr>
                    <td className="lbl"><strong>Vercel</strong></td>
                    <td><span className="pill good">Connected</span></td>
                    <td className="lbl text-mute">deploy + env</td>
                    <td className="lbl text-mute">project pbsbase-2825s-projects/namkhan-bi</td>
                  </tr>
                </tbody>
              </table>
            </Card>

            <Insight tone="info" eye="Why no edit UI">
              API keys live in Vercel env vars for security. Editing them here would either need a write-back API (security risk) or duplicate the value (drift risk). Update via Vercel dashboard once a year.
            </Insight>
          </>
        )}
      </div>
    </>
  );
}
