import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import Insight from '@/components/sections/Insight';
import KpiCard from '@/components/kpi/KpiCard';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';
import { getCurrentUser, canEdit } from '@/lib/currentUser';
import { supabase, PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function PropertyPage() {
  const user = await getCurrentUser();
  const canEditThis = canEdit(user.role, 'owner');
  const h = PILLAR_HEADER.settings;

  const { data: settings } = await supabase
    .from('app_settings')
    .select('key, value, updated_at')
    .eq('property_id', PROPERTY_ID)
    .like('key', 'property.%');

  const lookup = (key: string) => settings?.find((s: any) => s.key === key)?.value;
  const cleanStr = (v: any) => String(v ?? '').replace(/^"|"$/g, '');

  return (
    <>
      <Banner eyebrow={h.eyebrow} title={h.title} titleEmphasis={h.emphasis}
        meta={<><strong>Property profile</strong></>} />
      <SubNav items={RAIL_SUBNAV.settings} />
      <div className="panel">
        <PanelHero
          eyebrow={`Settings · Property${canEditThis ? '' : ' · read-only'}`}
          title="Property"
          emphasis="profile"
          sub={canEditThis ? 'Owner-editable' : `Read-only for ${user.role}`}
          kpis={
            <>
              <KpiCard label="Property Name" value={cleanStr(lookup('property.name')) || 'Namkhan'} kind="text" />
              <KpiCard label="Active Rooms" value={Number(lookup('property.active_rooms') ?? 19)} hint="Tent 7 retired" />
              <KpiCard label="FX (LAK/USD)" value={String(lookup('property.fx_lak_usd') ?? 21800)} kind="text" />
              <KpiCard label="Timezone" value={cleanStr(lookup('property.timezone')) || 'Asia/Vientiane'} kind="text" />
            </>
          }
        />

        <Card title="Property identity" sub="Cloudbeds property_id 260955" source="app_settings">
          <table className="tbl">
            <thead><tr><th>Setting</th><th>Value</th><th>Last updated</th><th></th></tr></thead>
            <tbody>
              {(settings ?? []).map((s: any) => (
                <tr key={s.key}>
                  <td className="lbl"><strong>{s.key.replace('property.', '')}</strong></td>
                  <td className="lbl">{JSON.stringify(s.value)}</td>
                  <td className="lbl text-mute">{new Date(s.updated_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</td>
                  <td>{canEditThis ? <button type="button" className="btn btn-ghost" disabled>Edit</button> : <span className="text-mute text-xs">read-only</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Insight tone="info" eye="Phase 2">
          Edit handlers ship in Phase 2. Today the values are seeded into <code>app_settings</code>; once the inline editor is built, owner changes will write back and propagate to all KPIs within 60 seconds.
        </Insight>
      </div>
    </>
  );
}
