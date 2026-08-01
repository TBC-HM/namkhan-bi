// LEGACY SURFACE RETIRED — it-area-reorg-v1 final slice (2026-08-01).
// Sitemap is it2-native under Knowledge → Data.
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function LegacyRedirect() { redirect('/holding/it2/knowledge/data/sitemap'); }
