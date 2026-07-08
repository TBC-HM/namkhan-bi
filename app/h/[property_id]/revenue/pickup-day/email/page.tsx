// app/h/[property_id]/revenue/pickup-day/email/page.tsx
// PBS 2026-07-08: Donna delegate for the day-report email page.

import { notFound } from 'next/navigation';
import EmailDayReportBody from '@/app/revenue/pickup-day/email/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyEmailDayReportPage({
  params,
}: {
  params: { property_id: string };
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <EmailDayReportBody propertyId={pid} />;
}
