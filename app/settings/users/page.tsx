import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import Insight from '@/components/sections/Insight';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';
import { getCurrentUser, canEdit, roleLabel } from '@/lib/currentUser';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const user = await getCurrentUser();
  const h = PILLAR_HEADER.settings;
  const canSee = canEdit(user.role, 'owner');

  if (!canSee) {
    return (
      <>
        <Banner eyebrow={h.eyebrow} title={h.title} titleEmphasis={h.emphasis} meta={<><strong>Users & roles</strong></>} />
        <SubNav items={RAIL_SUBNAV.settings} />
        <div className="panel">
          <Insight tone="alert" eye="Access denied">
            <strong>Owner-only section.</strong> You're signed in as <strong>{roleLabel(user.role)}</strong>.
          </Insight>
        </div>
      </>
    );
  }

  const { data: users } = await supabase
    .from('app_users')
    .select('id, email, display_name, role, initials, active, last_seen_at, created_at')
    .order('created_at');

  return (
    <>
      <Banner eyebrow={h.eyebrow} title={h.title} titleEmphasis={h.emphasis} meta={<><strong>Users & roles</strong></>} />
      <SubNav items={RAIL_SUBNAV.settings} />
      <div className="panel">
        <PanelHero
          eyebrow="Settings · Users & roles · Owner only"
          title="Who has"
          emphasis="access"
          sub="Phase 2 RBAC: Supabase auth + per-pillar gates"
        />

        <Card title="Active users" emphasis={`· ${users?.length ?? 0}`} sub="UI-gated · single password gate is the real boundary today" source="app_users">
          <table className="tbl">
            <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Last seen</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {(users ?? []).map((u: any) => (
                <tr key={u.id}>
                  <td className="lbl"><strong>{u.display_name}</strong></td>
                  <td className="lbl text-mute">{u.email}</td>
                  <td><span className="pill">{roleLabel(u.role)}</span></td>
                  <td className="lbl text-mute">{u.last_seen_at ? new Date(u.last_seen_at).toLocaleDateString() : '—'}</td>
                  <td><span className={`pill ${u.active ? 'good' : ''}`}>{u.active ? 'Active' : 'Inactive'}</span></td>
                  <td><button type="button" className="btn btn-ghost" disabled>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Insight tone="warn" eye="Auth model">
          UI-only gating. A staff member can still reach <code>/settings/users</code> by typing the URL. Real RBAC arrives in Phase 2 with Supabase auth + RLS.
        </Insight>
      </div>
    </>
  );
}
