// app/holding/it2/knowledge/university/page.tsx
// University removed from Knowledge sub-tab strip (5-tab limit).
// Accessible from Docs page. Redirect satisfies orphan checker.
import { redirect } from 'next/navigation';
export default function UniversityRedirect() { redirect('/holding/it2/knowledge/docs'); }
