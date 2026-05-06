import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function GuestInfluencersRedirect() { redirect('/marketing/influencers'); }
