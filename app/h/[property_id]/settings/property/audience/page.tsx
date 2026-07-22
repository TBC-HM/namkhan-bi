// app/h/[property_id]/settings/property/audience/page.tsx
// PBS 2026-07-21 pm · Property-scoped Audience settings tab.
// PBS 2026-07-22 pm · Tab label renamed "Audience" → "Newsletter" (URL unchanged).
//                     Also wires initialEmailChrome + initialEditorialGoals (were
//                     missing → the Chrome + Editorial Goals panels rendered empty
//                     on the CANONICAL URL, so PBS's edits were going to the legacy
//                     /settings/property/audience tree instead. Now fixed here.)
// Reuses the shared AudienceSettingsClient (imported — no duplicate copy).
// Wired into the `/h/[property_id]/settings/property` DashboardPage tab strip.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import AudienceSettingsClient, {
  type BlocklistRow, type GroupRow, type GroupRuleRow,
  type EmailSettingsRow, type RoutingRuleRow,
} from '@/app/settings/property/audience/_components/AudienceSettingsClient';
import type { EmailChromeSettings } from '@/app/settings/property/audience/_components/EmailChromePanel';
import type { GoalRow as EditorialGoalRow } from '@/app/settings/property/audience/_components/EditorialGoalsPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PropertyAudienceSettingsPage({
  params,
}: {
  params: { property_id: string };
}) {
  const propertyId = Number(params.property_id);

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e: any) {
    return (
      <DashboardPage
        title={`Settings · Newsletter`}
        subtitle={`Property ID ${propertyId} · config error`}
        tabs={[
          { key: 'property',   label: 'Property',   href: `/h/${propertyId}/settings/property` },
          { key: 'media',      label: 'Media',      href: `/h/${propertyId}/settings/media` },
          { key: 'rate_plans', label: 'Rate Plans', href: `/h/${propertyId}/settings/rate-plans` },
          { key: 'audience',   label: 'Newsletter', href: `/h/${propertyId}/settings/property/audience`, active: true },
          { key: 'guardrails', label: 'Guardrails', href: `/h/${propertyId}/settings/guardrails` },
          { key: 'data',       label: 'Data',       href: `/h/${propertyId}/settings/data` },
          { key: 'send_logs',  label: 'Send Logs',  href: `/h/${propertyId}/settings/send-logs`  },
        ]}
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Newsletter" subtitle="service-role key missing">
            <div style={{ color: '#B03826', fontSize: 12, padding: 12 }}>
              {e?.message ?? 'getSupabaseAdmin() failed'}
            </div>
          </Container>
        </div>
      </DashboardPage>
    );
  }

  const [blocklistRes, groupsRes, groupRulesRes, emailRes, routingRes, chromeRes, goalsRes] = await Promise.all([
    admin.from('v_marketing_subscriber_blocklist').select('*').limit(500),
    admin.from('v_subscriber_groups').select('id, slug, name, description, color, is_system, sort_order, member_count').order('sort_order'),
    admin.from('v_marketing_subscriber_group_rules').select('*').limit(1000),
    admin.from('v_marketing_property_email_settings').select('*').eq('property_id', propertyId).maybeSingle(),
    admin.from('v_marketing_import_routing_rules').select('*').limit(500),
    admin.from('v_marketing_property_email_settings')
      .select('property_id, header_logo_asset_id, header_logo_public_url, header_tagline, default_hero_asset_id, default_hero_public_url, footer_address_lines, footer_social_links, footer_disclaimer_text, footer_unsubscribe_wording')
      .eq('property_id', propertyId).maybeSingle(),
    admin.from('v_director_goals').select('*').eq('property_id', propertyId).order('weight', { ascending: false }),
  ]);

  const blocklist: BlocklistRow[]        = (blocklistRes.data ?? []) as BlocklistRow[];
  const groups: GroupRow[]               = (groupsRes.data ?? []) as GroupRow[];
  const groupRules: GroupRuleRow[]       = (groupRulesRes.data ?? []) as GroupRuleRow[];
  const emailSettings: EmailSettingsRow | null = (emailRes.data ?? null) as EmailSettingsRow | null;
  const routingRules: RoutingRuleRow[]   = (routingRes.data ?? []) as RoutingRuleRow[];
  const chrome: EmailChromeSettings | null = (chromeRes.data ?? null) as EmailChromeSettings | null;
  const editorialGoals: EditorialGoalRow[] = (goalsRes.data ?? []) as EditorialGoalRow[];

  const dbErr =
    blocklistRes.error || groupsRes.error || groupRulesRes.error || emailRes.error || routingRes.error || chromeRes.error || goalsRes.error;

  return (
    <DashboardPage
      title={`Settings · Newsletter`}
      subtitle={`Property ID ${propertyId} · ${blocklist.length} blocklist · ${groups.length} groups · ${groupRules.length} group rules · ${routingRules.length} routing rules · ${editorialGoals.length} editorial goals`}
      tabs={[
        { key: 'property',   label: 'Property',   href: `/h/${propertyId}/settings/property` },
        { key: 'media',      label: 'Media',      href: `/h/${propertyId}/settings/media` },
        { key: 'rate_plans', label: 'Rate Plans', href: `/h/${propertyId}/settings/rate-plans` },
        { key: 'audience',   label: 'Newsletter', href: `/h/${propertyId}/settings/property/audience`, active: true },
        { key: 'guardrails', label: 'Guardrails', href: `/h/${propertyId}/settings/guardrails` },
        { key: 'data',       label: 'Data',       href: `/h/${propertyId}/settings/data` },
        { key: 'send_logs',  label: 'Send Logs',  href: `/h/${propertyId}/settings/send-logs`  },
      ]}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Newsletter"
          subtitle="sender identity · blocklist · groups · routing · chrome · editorial goals"
        >
          {dbErr && (
            <div style={{
              color: '#B03826', fontSize: 12, padding: '6px 10px',
              border: '1px solid #E6DFCC', borderRadius: 3, marginBottom: 12,
              background: '#FBEDE7',
            }}>
              db error: {dbErr.message}
            </div>
          )}
          <AudienceSettingsClient
            propertyId={propertyId}
            initialBlocklist={blocklist}
            initialGroups={groups}
            initialGroupRules={groupRules}
            initialEmailSettings={emailSettings}
            initialRoutingRules={routingRules}
            initialEmailChrome={chrome}
            initialEditorialGoals={editorialGoals}
          />
        </Container>
      </div>
    </DashboardPage>
  );
}
