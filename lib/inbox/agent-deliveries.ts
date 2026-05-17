// lib/inbox/agent-deliveries.ts
// Reads cockpit_tickets rows produced by agent skills (legal memos,
// investigation briefs, etc.) and renders them as inbox deliveries for
// the receiving HoD. Source-of-truth: cockpit_tickets where
// source='agent_delivery'. Property scope comes from metadata.property_id
// (because cockpit_tickets.project_id is a cockpit-internal FK, not a
// property_id — see claude_md v2.26 §0.1).

import { createClient } from '@/lib/supabase/server';

export interface AgentDelivery {
  id: number;
  status: string;
  subject: string;
  memo_md: string;
  memo_type: string | null;
  from_agent: string | null;
  to_hod: string | null;
  source_doc_id: string | null;
  case_ref: string | null;
  priority: string | null;
  created_at: string;
}

export async function listAgentDeliveries(
  propertyId: number,
  limit = 50,
): Promise<AgentDelivery[]> {
  const supabase = createClient();

  // PostgREST JSONB equality: metadata->>property_id is text, propertyId
  // arrives as number. We cast on the caller side. limit guards against
  // runaway result sets.
  const { data, error } = await supabase
    .from('cockpit_tickets')
    .select('id, status, email_subject, parsed_summary, metadata, created_at')
    .eq('source', 'agent_delivery')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as Array<{
    id: number;
    status: string;
    email_subject: string | null;
    parsed_summary: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>)
    .filter((r) => {
      const meta = r.metadata ?? {};
      const pid = meta.property_id;
      if (pid == null) return false;
      return String(pid) === String(propertyId);
    })
    .map((r) => {
      const meta = (r.metadata ?? {}) as Record<string, unknown>;
      // Two key conventions over time:
      //   legacy skill deliveries → meta.delivered_by_agent (e.g. "toga"),
      //                             meta.assigned_role only (no display name)
      //   new memos               → meta.from_agent ("Carla"), meta.to_hod ("Cifra")
      // Prefer the explicit display names when present, fall back to legacy.
      const fromAgent =
        (meta.from_agent as string | null | undefined) ??
        (meta.delivered_by_agent as string | null | undefined) ??
        null;
      const toHod =
        (meta.to_hod as string | null | undefined) ??
        (meta.assigned_role as string | null | undefined) ??
        null;
      return {
        id: r.id,
        status: r.status,
        subject: r.email_subject ?? '(no subject)',
        memo_md: r.parsed_summary ?? '',
        memo_type: (meta.memo_type as string | null) ?? null,
        from_agent: fromAgent,
        to_hod: toHod,
        source_doc_id: (meta.source_doc_id as string | null) ?? null,
        case_ref: (meta.case_ref as string | null) ?? null,
        priority: (meta.priority as string | null) ?? null,
        created_at: r.created_at,
      };
    });
}

export function deliveryRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
