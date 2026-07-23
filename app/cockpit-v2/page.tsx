// Legacy route — cockpit moved to /holding/it/cockpit (refactor 2026-07-23).
// Kept as a 307 redirect for old bookmarks, per platform convention for retired routes.
import { redirect } from 'next/navigation';

export default function LegacyCockpitV2Redirect() {
  redirect('/holding/it/cockpit');
}
