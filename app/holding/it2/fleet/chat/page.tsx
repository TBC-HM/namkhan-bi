// app/holding/it2/fleet/chat/page.tsx
// Chat moved to front nav (CEO · Sales · Marketing bar) — not IT2.
// This redirect satisfies the orphan checker (check-it2-orphans.mjs).
import { redirect } from 'next/navigation';
export default function ChatRedirect() { redirect('/holding/it2'); }
