// LEGACY SURFACE RETIRED — PBS 2026-07-30: "kill all the orphan pages, all
// chats — we only want ONE chat / ONE cockpit." Redirects to the IT2 target.
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function LegacyRedirect() { redirect('/holding/it2/knowledge/data'); }
