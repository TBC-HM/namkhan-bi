// Legacy route — cockpit moved to /holding/it/cockpit (refactor 2026-07-23).
// Kept as a 307 redirect for old bookmarks, per platform convention for retired routes.
import { redirect } from 'next/navigation';

export default function LegacyCockpitV2Redirect({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  redirect(`/holding/it/cockpit${qs ? `?${qs}` : ''}`);
}
