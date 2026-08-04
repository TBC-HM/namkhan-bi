// app/holding/it2/fleet/tasks/page.tsx
// KILLED by action-center-inbox-v1 (PBS 2026-08-04: Tasks page "kind of crap
// ... no cta"). Tickets are backend-only; anything awaiting the owner renders
// in the Action Center response strip with a dismiss CTA. This redirect stub
// satisfies the orphan checker (check-it2-orphans.mjs) and catches old links.
import { redirect } from 'next/navigation';
export default function TasksKilledRedirect() { redirect('/holding/it2'); }
