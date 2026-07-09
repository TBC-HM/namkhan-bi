// app/h/[property_id]/revenue/compset/[comp_id]/page.tsx
// PBS 2026-07-10: Donna variant of the deep-scrape competitor landing.
// Single source of truth = /app/revenue/compset/[comp_id]/page.tsx.
// That page derives the host property from the comp_id lookup (v_competitor_property_deep.property_id),
// so nav-strip + currency + sub-tabs auto-adapt to whichever tenant hosts the comp.

import CompetitorLandingBody from '@/app/revenue/compset/[comp_id]/page';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Props { params: Promise<{ property_id: string; comp_id: string }> }

export default async function PropertyCompLandingPage({ params }: Props) {
  const { comp_id } = await params;
  return <CompetitorLandingBody params={Promise.resolve({ comp_id })} />;
}
