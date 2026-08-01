// LEGACY SURFACE RETIRED — redirects to IT2 fleet/team
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function Page() { redirect('/holding/it2/fleet/team'); }
