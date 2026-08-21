// app/marketing/social/[platform]/page.tsx
// PBS 2026-08-21: bare Namkhan URL now redirects to the tenant-scoped route
// so the full DashboardPage chrome (top strip + Marketing sub-strip + tenant
// theme) renders correctly. Real page body lives in ./_impl.tsx and is
// mounted by both tenant delegates (Namkhan 260955 + Donna 1000001+).
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function BarePlatformRedirect({
  params,
}: {
  params: { platform: string };
}) {
  redirect(`/h/260955/marketing/social/${encodeURIComponent(params.platform)}`);
}
