// app/revenue/demand/page.tsx
// D14 (staged): redirect deprecated /revenue/demand → /revenue/pace.
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function DemandRedirect() { redirect('/revenue/pace'); }
