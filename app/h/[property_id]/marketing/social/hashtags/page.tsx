// app/h/[property_id]/marketing/social/hashtags/page.tsx
// Tenant delegate — mounts the shared hashtag/keyword hub.
// Content lives at app/marketing/social/hashtags/page.tsx.
import HashtagTaxonomyPage from '@/app/marketing/social/hashtags/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function TenantHashtagsPage() {
  return <HashtagTaxonomyPage />;
}
