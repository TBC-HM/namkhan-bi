// app/sales/accounts/page.tsx
// PBS 2026-07-11 pm — Sales · Accounts page (Design System rebuild).
// Server component wraps AccountsList (client). Accepts optional propertyId.

import { DashboardPage } from '@/app/(cockpit)/_design';
import { SALES_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import AccountsList from './_components/AccountsList';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const NAMKHAN = 260955;

interface PageProps {
  propertyId?: number;
}

async function loadAccountsBundle(propertyId: number) {
  const sb = getSupabaseAdmin();
  const [contacts, contracts, deals, activities, channels, consents] = await Promise.all([
    sb.from('v_contacts').select('id,property_id,account_id,account_name,account_type,full_name,title,role,decision_role,is_primary,email,country,language,owner,tags,status,created_at,updated_at').eq('property_id', propertyId).order('is_primary', { ascending: false }).limit(500),
    sb.from('v_contracts').select('id,account_id,property_id,season_label,season_start,season_end,commission_pct,net_rate_terms,allotment,release_days,currency,status,notes,account_name,account_type').eq('property_id', propertyId).order('season_start', { ascending: false }),
    sb.from('v_deals').select('id,property_id,account_id,contract_id,primary_contact_id,name,deal_type,pipeline_stage,amount,currency,probability,expected_close,status,source,owner_user,stage_changed_at,won_at,created_at,account_name,primary_contact_name').eq('property_id', propertyId).order('updated_at', { ascending: false }).limit(500),
    sb.from('v_activities').select('id,property_id,contact_id,account_id,deal_id,type,direction,subject,body,occurred_at,owner_user').order('occurred_at', { ascending: false }).limit(500),
    sb.from('v_contact_channels').select('id,contact_id,property_id,kind,value,is_primary,verified,created_at'),
    sb.from('v_contact_consents').select('id,contact_id,property_id,channel,basis,status,captured_at,source,expires_at,notes,created_at'),
  ]);

  return {
    contacts:   contacts.data   ?? [],
    contracts:  contracts.data  ?? [],
    deals:      deals.data      ?? [],
    activities: activities.data ?? [],
    channels:   channels.data   ?? [],
    consents:   consents.data   ?? [],
  };
}

export default async function AccountsPage({ propertyId }: PageProps = {}) {
  const pid = propertyId ?? NAMKHAN;
  const bundle = await loadAccountsBundle(pid);
  const tabs = SALES_SUBPAGES.map((s) => ({ label: s.label, href: s.href }));

  return (
    <DashboardPage
      title="Accounts"
      subtitle="Contracted partners · row → drawer · Contracts / Business / Activity"
      tabs={tabs}
    >
      <AccountsList bundle={bundle} propertyId={pid} />
    </DashboardPage>
  );
}
