// app/h/[property_id]/marketing/audience/page.tsx
// PBS 2026-08-23 · Donna audience — mirrors Namkhan subscriber + prospect pool.
// Passthrough shell: same data, same UI, Donna URL maintained in browser.
import AudienceUnifiedPage from '@/app/marketing/audience/page';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

interface Props {
  params: { property_id: string };
  searchParams?: Promise<{ source?: string; tab?: string }>;
}

export default async function DonnaMarketingAudience({ searchParams }: Props) {
  return AudienceUnifiedPage({ searchParams });
}

