// app/settings/property/audience/page.tsx
// PBS 2026-07-21 · Audience Settings tab.
// 5 stacked panels (v2 2026-07-21 pm — added EmailChromePanel):
//   1. SenderIdentityPanel        — property_email_settings upsert
//   2. BlocklistPanel             — subscriber_blocklist CRUD + preview + apply
//   3. GroupsRulesPanel           — subscriber_group_rules editor per group
//   4. ImportRoutingRulesPanel    — import_routing_rules editor
//   5. EmailChromePanel           — header logo/tagline + footer address/social/disclaimer/unsub
// Reads via public.v_marketing_* bridge views (PostgREST public-only rule).
// Writes via SECURITY DEFINER RPCs (public.fn_*).

import Page from '@/components/page/Page';
import Card from '@/components/sections/Card';
import Insight from '@/components/sections/Insight';
import SectionSidebar from '@/components/settings/SectionSidebar';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { SETTINGS_SUBPAGES } from '../../_subpages';
import { PROPERTY_ID, type SectionRow } from '@/lib/settings';
import AudienceSettingsClient, {
  type BlocklistRow, type GroupRow, type GroupRuleRow,
  type EmailSettingsRow, type RoutingRuleRow,
} from './_components/AudienceSettingsClient';
import type { EmailChromeSettings } from './_components/EmailChromePanel';

export const dynamic = 'force-dynamic';

export default async function AudienceSettingsPage() {
  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e: any) {
    return (
      <Page
        eyebrow="Settings · Property · Audience"
        title={<>Property <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>configuration</em>.</>}
        subPages={SETTINGS_SUBPAGES}
      >
        <Insight tone="alert" eye="config error">
          {e?.message ?? 'Service-role key missing'}.
        </Insight>
      </Page>
    );
  }

  const [sectionsRes, blocklistRes, groupsRes, groupRulesRes, emailRes, routingRes, chromeRes] = await Promise.all([
    admin.schema('marketing').from('v_settings_sections_live').select('*').order('display_order'),
    admin.from('v_marketing_subscriber_blocklist').select('*').limit(500),
    admin.from('v_subscriber_groups').select('id, slug, name, description, color, is_system, sort_order, member_count').order('sort_order'),
    admin.from('v_marketing_subscriber_group_rules').select('*').limit(1000),
    admin.from('v_marketing_property_email_settings').select('*').eq('property_id', PROPERTY_ID).maybeSingle(),
    admin.from('v_marketing_import_routing_rules').select('*').limit(500),
    admin.from('v_marketing_property_email_settings')
      .select('property_id, header_logo_asset_id, header_logo_public_url, header_tagline, default_hero_asset_id, default_hero_public_url, footer_address_lines, footer_social_links, footer_disclaimer_text, footer_unsubscribe_wording')
      .eq('property_id', PROPERTY_ID).maybeSingle(),
  ]);

  const sections: SectionRow[] = (sectionsRes.data ?? []) as SectionRow[];
  const blocklist: BlocklistRow[] = (blocklistRes.data ?? []) as BlocklistRow[];
  const groups: GroupRow[] = (groupsRes.data ?? []) as GroupRow[];
  const groupRules: GroupRuleRow[] = (groupRulesRes.data ?? []) as GroupRuleRow[];
  const emailSettings: EmailSettingsRow | null = (emailRes.data ?? null) as EmailSettingsRow | null;
  const routingRules: RoutingRuleRow[] = (routingRes.data ?? []) as RoutingRuleRow[];
  const chrome: EmailChromeSettings | null = (chromeRes.data ?? null) as EmailChromeSettings | null;

  const dbErr = blocklistRes.error || groupsRes.error || groupRulesRes.error || emailRes.error || routingRes.error || chromeRes.error;

  return (
    <Page
      eyebrow="Settings · Property · Audience"
      title={<>Property <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>configuration</em>.</>}
      subPages={SETTINGS_SUBPAGES}
    >
      {dbErr && (
        <Insight tone="alert" eye="db error">
          {dbErr.message}
        </Insight>
      )}

      <div className="settings-layout">
        <SectionSidebar sections={sections} active="audience" />
        <Card
          title="Audience"
          sub={`${blocklist.length} blocklist rules · ${groups.length} groups · ${groupRules.length} group rules · ${routingRules.length} routing rules · email chrome`}
          source="marketing.subscriber_blocklist + subscriber_group_rules + property_email_settings + import_routing_rules"
        >
          <AudienceSettingsClient
            propertyId={PROPERTY_ID}
            initialBlocklist={blocklist}
            initialGroups={groups}
            initialGroupRules={groupRules}
            initialEmailSettings={emailSettings}
            initialRoutingRules={routingRules}
            initialEmailChrome={chrome}
          />
        </Card>
      </div>
    </Page>
  );
}
