import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import Insight from '@/components/sections/Insight';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';
import { getCurrentUser } from '@/lib/currentUser';
import { supabase, PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  const h = PILLAR_HEADER.settings;

  const { data: settings } = await supabase
    .from('app_settings')
    .select('key, value')
    .eq('property_id', PROPERTY_ID)
    .like('key', 'notifications.%');

  const get = (k: string) => settings?.find((s: any) => s.key === k)?.value === true;

  return (
    <>
      <Banner eyebrow={h.eyebrow} title={h.title} titleEmphasis={h.emphasis} meta={<><strong>Notifications</strong></>} />
      <SubNav items={RAIL_SUBNAV.settings} />
      <div className="panel">
        <PanelHero
          eyebrow={`Settings · Notifications · ${user.display_name}`}
          title="Notifications"
          emphasis="& alerts"
          sub="Email + in-app · per-user preferences"
        />

        <Card title="Email notifications" sub="Sent to your registered email">
          <table className="tbl">
            <thead><tr><th>Type</th><th>Description</th><th>Email</th></tr></thead>
            <tbody>
              <tr>
                <td className="lbl"><strong>Daily digest</strong></td>
                <td className="lbl text-mute">Yesterday's KPIs · arrivals tonight · open action cards</td>
                <td><span className={`pill ${get('notifications.daily_digest_email') ? 'good' : ''}`}>{get('notifications.daily_digest_email') ? 'On' : 'Off'}</span></td>
              </tr>
              <tr>
                <td className="lbl"><strong>Review alerts</strong></td>
                <td className="lbl text-mute">New review under 4.0 stars or response SLA breach</td>
                <td><span className={`pill ${get('notifications.review_alerts_email') ? 'good' : ''}`}>{get('notifications.review_alerts_email') ? 'On' : 'Off'}</span></td>
              </tr>
              <tr>
                <td className="lbl"><strong>DQ alerts</strong></td>
                <td className="lbl text-mute">New high-severity data quality issue detected</td>
                <td><span className={`pill ${get('notifications.dq_alerts_email') ? 'good' : ''}`}>{get('notifications.dq_alerts_email') ? 'On' : 'Off'}</span></td>
              </tr>
            </tbody>
          </table>
        </Card>

        <Insight tone="info" eye="Phase 2">
          Notification dispatch (cron + email service) ships Phase 2. Toggles are stored today; emails will start once SendGrid or Resend is wired.
        </Insight>
      </div>
    </>
  );
}
