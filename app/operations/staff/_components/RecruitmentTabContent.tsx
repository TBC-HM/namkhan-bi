// Server-rendered shell for the Recruitment tab. Loads position options +
// per-property config, then hands off to the client wizard.

import { supabase } from '@/lib/supabase';
import Page from '@/components/page/Page';
import StaffTabStrip from './StaffTabStrip';
import RecruitmentWizard from './RecruitmentWizard';
import { OPERATIONS_SUBPAGES } from '../../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

interface Props {
  propertyId: number;
  propertyLabel?: string;
  subPagesOverride?: { label: string; href: string }[];
}

type Lang = 'en' | 'lo' | 'th' | 'es' | 'de' | 'ca';

interface Channel { name: string; audience: string; cost: 'free' | 'paid' | 'referral'; tip: string }

const PROP_CONFIG: Record<number, { standards: string; languages: Lang[]; channels: Channel[] }> = {
  260955: {
    standards: 'SLH 5-star · Lao Labour Law (Law No. 43/NA 2014)',
    languages: ['en', 'lo', 'th'],
    channels: [
      { name: 'Facebook — Luang Prabang Job Board groups', audience: '~25k local hospitality workers', cost: 'free', tip: 'Post in Lao + English, pin contact details in first line.' },
      { name: '108Job.la',                                 audience: 'Lao national job-board',         cost: 'paid', tip: 'Premium listing reaches ~3k applicants/month in hospitality.' },
      { name: 'Hosco',                                     audience: 'International hospitality',      cost: 'paid', tip: 'Best for management + skilled roles; English ad.' },
      { name: 'LinkedIn',                                  audience: 'Mid-senior + expat talent',      cost: 'paid', tip: 'Premium-job slot; English ad with SLH branding.' },
      { name: 'Instagram (Namkhan handle)',                audience: '~12k followers',                 cost: 'free', tip: 'Story + carousel; tag #LuangPrabangJobs.' },
      { name: 'Employee referral',                         audience: 'Current staff network',          cost: 'referral', tip: 'LAK 500k bounty per hired referral kept >90 days.' },
    ],
  },
  1000001: {
    standards: 'Balears Hostelería · XVII Convenio 2025-2028 (35-day vacation, fijo-discontinuo common)',
    languages: ['es', 'en', 'de', 'ca'],
    channels: [
      { name: 'Facebook — Mallorca Hostelería + expat groups', audience: '~40k seasonal + permanent', cost: 'free',     tip: 'Post in Spanish + English, mention temporada if seasonal.' },
      { name: 'Infojobs',                                      audience: 'Spanish national job-board', cost: 'paid',     tip: 'Premium destacada listing; ~5k views/month for Mallorca hostelería.' },
      { name: 'Hosteltur',                                     audience: 'Spanish hospitality trade',  cost: 'paid',     tip: 'Best for management + revenue / sales roles.' },
      { name: 'Hosco',                                         audience: 'International hospitality',  cost: 'paid',     tip: 'Multilingual ad reaches Northern European seasonal pool.' },
      { name: 'LinkedIn',                                      audience: 'Mid-senior + multilingual',  cost: 'paid',     tip: 'Tag with #MallorcaJobs #BoutiqueHotel; ES+EN+DE description.' },
      { name: 'Instagram (Donna handle)',                      audience: '~8k followers',              cost: 'free',     tip: 'Reel showing kitchen / housekeeping team; #MallorcaJobs.' },
      { name: 'Employee referral',                             audience: 'Current staff network',      cost: 'referral', tip: '€500 bounty per hired referral kept >90 days.' },
    ],
  },
};

const FACTORIAL_PLACEHOLDER = /^Job level \d+$/i;

export default async function RecruitmentTabContent({ propertyId, propertyLabel, subPagesOverride }: Props) {
  const cfg = PROP_CONFIG[propertyId] ?? PROP_CONFIG[260955];

  // Distinct position titles on the live roster, filtered.
  const { data: posRows } = await supabase
    .schema('ops')
    .from('staff_employment')
    .select('position_title')
    .eq('property_id', propertyId)
    .eq('is_active', true)
    .not('position_title', 'is', null);

  const seen = new Set<string>();
  for (const r of (posRows as Array<{ position_title: string }> | null) ?? []) {
    const t = (r.position_title ?? '').trim();
    if (!t) continue;
    if (FACTORIAL_PLACEHOLDER.test(t)) continue; // hide "Job level 539858" noise
    seen.add(t);
  }
  const positionOptions = [...seen].sort((a, b) => a.localeCompare(b));

  const eyebrow = propertyLabel
    ? `Operations · Staff · Recruitment · ${propertyLabel}`
    : 'Operations · Staff · Recruitment';

  return (
    <Page
      eyebrow={eyebrow}
      title={<>Recruitment <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>wizard</em></>}
      subPages={subPagesOverride ?? rewriteSubPagesForProperty(OPERATIONS_SUBPAGES, propertyId)}
    >
      <StaffTabStrip propertyId={propertyId} />
      <RecruitmentWizard
        propertyId={propertyId}
        propertyLabel={propertyLabel ?? `Property ${propertyId}`}
        positionOptions={positionOptions}
        standardsLabel={cfg.standards}
        languages={cfg.languages}
        channels={cfg.channels}
      />
    </Page>
  );
}
