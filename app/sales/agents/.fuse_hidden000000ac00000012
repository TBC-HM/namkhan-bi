// app/sales/agents/page.tsx
// Sales · Agents — pillar agent governance hub.
// Reuses existing /lib/agents/sales/* roster.

import AgentsHub from '@/components/agents/AgentsHub';

import { inquiryTriager }       from '@/lib/agents/sales/inquiryTriager';
import { autoOfferComposer }    from '@/lib/agents/sales/autoOfferComposer';
import { groupQuoteStrategist } from '@/lib/agents/sales/groupQuoteStrategist';
import { packageBuilder }       from '@/lib/agents/sales/packageBuilder';
import { pricingValidator }     from '@/lib/agents/sales/pricingValidator';
import { dmcSpecialist }        from '@/lib/agents/sales/dmcSpecialist';
import { followUpWatcher }      from '@/lib/agents/sales/followUpWatcher';
import { conversionCoach }      from '@/lib/agents/sales/conversionCoach';

export const dynamic = 'force-dynamic';

export default function SalesAgentsPage() {
  return (
    <AgentsHub
      pillarKey="sales"
      pillarLabel="Sales"
      intro="Inbound funnel agents — classify, quote, route, and chase. Idle until sales.inquiries + email-ingest webhook ship."
      agents={[
        inquiryTriager,
        autoOfferComposer,
        groupQuoteStrategist,
        packageBuilder,
        pricingValidator,
        dmcSpecialist,
        followUpWatcher,
        conversionCoach,
      ]}
      brandRules={[
        'No quote auto-send · human approves every outbound to a guest',
        'B2B / DMC pricing always uses contracted rate floor',
        'Group quote ADR floor = published BAR · -10% (negotiable above)',
        'No discount > 15% without RM + GM sign-off',
      ]}
    />
  );
}
