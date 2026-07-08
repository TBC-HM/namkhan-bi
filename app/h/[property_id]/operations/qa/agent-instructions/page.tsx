// app/h/[property_id]/operations/qa/agent-instructions/page.tsx
// PBS 2026-07-08: Donna delegate for QA · Agent Instructions.

import { notFound } from 'next/navigation';
import AgentInstructionsBody from '@/app/operations/qa/agent-instructions/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyAgentInstructionsPage({
  params,
}: {
  params: { property_id: string };
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <AgentInstructionsBody propertyId={pid} />;
}
