// Legacy route — deploys page moved to /holding/it/cockpit/deploys (refactor 2026-07-23).
// Kept as a 307 redirect for old bookmarks, per platform convention for retired routes.
import { redirect } from 'next/navigation';

export default function LegacyCockpitV2DeploysRedirect() {
  redirect('/holding/it/cockpit/deploys');
}
