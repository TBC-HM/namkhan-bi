// app/revenue/rates/page.tsx
// D14 (staged): redirect deprecated /revenue/rates → /revenue/pricing.
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function RatesRedirect() { redirect('/revenue/pricing'); }
