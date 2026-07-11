// app/h/[property_id]/marketing/library/page.tsx
// PBS 2026-07-11 pm — property-scoped library redirect.
// Both /marketing/library and /h/<pid>/marketing/library forward to the Media Hub
// preserving the property scope.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PropertyLibraryRedirect({ params }: { params: Promise<{ property_id: string }> }) {
  const { property_id } = await params;
  redirect(`/h/${property_id}/marketing/media`);
}
