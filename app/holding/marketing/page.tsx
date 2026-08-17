import { redirect } from 'next/navigation';
// Force Node.js runtime — prevents Edge bundle pollution (middleware crash fix)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default function Page() { redirect('/holding/marketing/socials'); }
