// app/revenue/promotions/page.tsx
// D14 (staged): redirect deprecated /revenue/promotions → /revenue/pulse (decisions queue absorbs this).
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function PromotionsRedirect() { redirect('/revenue/pulse'); }
