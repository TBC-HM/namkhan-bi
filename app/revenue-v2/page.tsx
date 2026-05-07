// app/revenue-v2/page.tsx
// /revenue-v2 → /revenue-v2/pulse (canonical landing tab)
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function RevenueV2IndexPage() {
  redirect('/revenue-v2/pulse');
}
