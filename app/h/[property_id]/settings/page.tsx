// app/h/[property_id]/settings/page.tsx
// /h/[id]/settings has no landing — redirect to /h/[id]/settings/property
// which is the canonical property-scoped settings page (themed via <Page> shell).

import { redirect } from 'next/navigation';

export default function PropertySettingsLanding({
  params,
}: {
  params: { property_id: string };
}) {
  redirect(`/h/${params.property_id}/settings/property`);
}
