import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function DqPage() {
  const h = PILLAR_HEADER.settings;
  const { data: issues } = await supabase
    .from('dq_known_issues')
    .select('*')
    .order('severity', { ascending: false });

  const active = (issues ?? []).filter((i: any) => i.status !== 'fixed');
  const fixed = (issues ?? []).filter((i: any) => i.status === 'fixed');

  return (
    <>
      <Banner eyebrow={h.eyebrow} title={h.title} titleEmphasis={h.emphasis} meta={<><strong>DQ engine</strong></>} />
      <SubNav items={RAIL_SUBNAV.settings} />
      <div className="panel">
        <PanelHero
          eyebrow="Settings · DQ engine · Read-only"
          title="Data quality"
          emphasis="engine"
          sub="Active issues feed Operations action cards"
          kpis={
            <>
              <KpiCard label="Active Issues" value={active.length} tone={active.length > 0 ? 'warn' : 'pos'} />
              <KpiCard label="Critical / High" value={active.filter((i: any) => i.severity === 'critical' || i.severity === 'high').length} tone="neg" />
              <KpiCard label="Resolved" value={fixed.length} tone="pos" />
              <KpiCard label="Engine" value="Active" kind="text" tone="pos" />
            </>
          }
        />

        <Card title="Active issues" emphasis={`· ${active.length}`} sub="Sorted by severity" source="dq_known_issues">
          <table className="tbl">
            <thead><tr><th>Severity</th><th>Code</th><th>Description</th><th>Action</th></tr></thead>
            <tbody>
              {active.map((d: any) => {
                const tone = (d.severity === 'critical' || d.severity === 'high') ? 'bad' : d.severity === 'medium' ? 'warn' : 'good';
                return (
                  <tr key={d.code || d.id}>
                    <td><span className={`pill ${tone}`}>{d.severity || '—'}</span></td>
                    <td className="lbl text-mono">{d.code || '—'}</td>
                    <td className="lbl"><strong>{d.title || d.description || '—'}</strong></td>
                    <td className="lbl text-mute">{d.action || d.recommendation || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {fixed.length > 0 && (
          <Card title="Resolved" emphasis={`· ${fixed.length}`} sub="Audit trail · last 50" className="mt-22">
            <table className="tbl">
              <thead><tr><th>Code</th><th>Description</th><th>Resolution note</th></tr></thead>
              <tbody>
                {fixed.slice(0, 50).map((d: any) => (
                  <tr key={d.id}>
                    <td className="lbl text-mono">{d.code || '—'}</td>
                    <td className="lbl">{d.title || '—'}</td>
                    <td className="lbl text-mute">{d.notes ? d.notes.slice(0, 80) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </>
  );
}
