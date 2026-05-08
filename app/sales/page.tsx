// app/sales/page.tsx — Sales dept landing = chat with Mercer.
// 2026-05-08 PBS directive. Sub-pages remain at /sales/inquiries, /sales/b2b,
// /sales/bookings, /sales/pipeline.

import ChatShell from '@/components/chat/ChatShell';

export const dynamic = 'force-dynamic';

export default function SalesLanding() {
  return (
    <ChatShell
      role="sales_hod"
      displayName="Mercer"
      dept="Sales"
      emoji="$"
      mentionNickname="mercer"
      placeholder="Ask Mercer about inquiries, B2B contracts, pipeline…"
    />
  );
}
