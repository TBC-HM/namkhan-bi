// app/holding/it/cockpit/_lib/data-port.ts
// Server-side fetchers for the V1 → V2 cockpit feature port (#58).
// Read-only; service role; never imported from 'use client'. Each fetcher
// degrades to a sane empty default if its source is missing or RLS denies.
//
// Sources (verified 2026-05-13):
//   public.cockpit_tickets             — tasks list / detail
//   public.cockpit_pbs_notifications   — notify feed (view of cockpit_notifications)
//   public.cockpit_incidents           — health (resolved_at IS NULL = open)
//   public.cockpit_audit_log           — health + cost (cost_usd_milli)
//   public.workspace_users             — RBAC admin
//   cockpit.cap_skill_calls            — cost (cost_usd_milli)
//   public.scheduled_task_runs         — health crons
//   public.v_scheduled_task_cost_burn  — health daily burn
//
// Author: IT-team agent · 2026-05-13 · #58.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sbCockpit } from './supabase-cockpit';

// --- task / notify counts (used by the V2 layout tab bar) --------------

const TERMINAL_TASK_STATUSES = new Set([
  'completed',
  'archived',
  'triage_failed',
  'done',
]);

export async function fetchOpenTaskCount(): Promise<number> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('cockpit_tickets')
      .select('status');
    if (error || !data) return 0;
    let n = 0;
    for (const r of data as Array<{ status: string | null }>) {
      if (!r.status) continue;
      if (!TERMINAL_TASK_STATUSES.has(r.status)) n += 1;
    }
    return n;
  } catch {
    return 0;
  }
}

export async function fetchUnseenNotifyCount(): Promise<number> {
  try {
    const admin = getSupabaseAdmin();
    const { count, error } = await admin
      .from('cockpit_pbs_notifications')
      .select('id', { count: 'exact', head: true })
      .is('seen_at', null);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

// --- tasks --------------------------------------------------------------

export type V2Ticket = {
  id: number;
  status: string;
  arm: string | null;
  intent: string | null;
  source: string | null;
  email_subject: string | null;
  email_body: string | null;
  parsed_summary: string | null;
  pr_url: string | null;
  preview_url: string | null;
  github_issue_url: string | null;
  iterations: number | null;
  closed_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export async function fetchTickets(filterStatus?: string): Promise<{
  tickets: V2Ticket[];
  countByStatus: Record<string, number>;
}> {
  const admin = getSupabaseAdmin();
  let q = admin
    .from('cockpit_tickets')
    .select(
      'id, status, arm, intent, source, email_subject, email_body, parsed_summary, pr_url, preview_url, github_issue_url, iterations, closed_at, notes, metadata, created_at, updated_at',
    )
    .order('updated_at', { ascending: false })
    .limit(200);
  if (filterStatus && filterStatus !== 'all') q = q.eq('status', filterStatus);

  const [{ data: rows }, { data: counts }] = await Promise.all([
    q,
    admin.from('cockpit_tickets').select('status'),
  ]);

  const countByStatus: Record<string, number> = {};
  for (const r of counts ?? []) {
    const s = (r as { status: string | null }).status ?? 'unknown';
    countByStatus[s] = (countByStatus[s] ?? 0) + 1;
  }
  return { tickets: (rows as V2Ticket[]) ?? [], countByStatus };
}

export async function fetchTicket(id: number): Promise<{
  ticket: V2Ticket | null;
  audit: Array<{
    created_at: string;
    agent: string | null;
    action: string | null;
    success: boolean | null;
    reasoning: string | null;
    metadata: Record<string, unknown> | null;
  }>;
}> {
  const admin = getSupabaseAdmin();
  const { data: t } = await admin
    .from('cockpit_tickets')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  const { data: audit } = await admin
    .from('cockpit_audit_log')
    .select('created_at, agent, action, success, reasoning, metadata')
    .eq('ticket_id', id)
    .order('created_at', { ascending: false })
    .limit(50);
  return {
    ticket: (t as V2Ticket | null) ?? null,
    audit:
      (audit as Array<{
        created_at: string;
        agent: string | null;
        action: string | null;
        success: boolean | null;
        reasoning: string | null;
        metadata: Record<string, unknown> | null;
      }>) ?? [],
  };
}

// --- notify -------------------------------------------------------------

export type V2Notification = {
  id: number;
  created_at: string;
  kind: string;
  title: string;
  url: string | null;
  ticket_id: number | null;
  pr_number: number | null;
  branch: string | null;
  seen_at: string | null;
};

export async function fetchNotifications(limit = 80): Promise<V2Notification[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('cockpit_pbs_notifications')
      .select('id, created_at, kind, title, url, ticket_id, pr_number, branch, seen_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('[cockpit-v2] fetchNotifications error', error);
      return [];
    }
    return (data as V2Notification[]) ?? [];
  } catch (e) {
    console.error('[cockpit-v2] fetchNotifications threw', e);
    return [];
  }
}

// --- users (workspace_users) --------------------------------------------

export type V2WorkspaceUser = {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  role_level: string | null;
  property_ids: number[] | null;
  dept_ids: number[] | null;
  is_owner: boolean | null;
  active: boolean | null;
  last_login_at: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string;
  // legacy access flags (still in schema)
  access_revenue: boolean | null;
  access_sales: boolean | null;
  access_marketing: boolean | null;
  access_operations: boolean | null;
  access_finance: boolean | null;
};

export async function fetchWorkspaceUsers(): Promise<V2WorkspaceUser[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('workspace_users')
      .select(
        'id, email, display_name, phone, role_level, property_ids, dept_ids, is_owner, active, last_login_at, invited_at, accepted_at, created_at, access_revenue, access_sales, access_marketing, access_operations, access_finance',
      )
      .order('is_owner', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[cockpit-v2] fetchWorkspaceUsers error', error);
      return [];
    }
    return (data as V2WorkspaceUser[]) ?? [];
  } catch (e) {
    console.error('[cockpit-v2] fetchWorkspaceUsers threw', e);
    return [];
  }
}

// --- health (incidents + audit + webhooks + crons) ----------------------

export type V2Incident = {
  id: number;
  detected_at: string;
  resolved_at: string | null;
  severity: number | null;
  symptom: string | null;
  root_cause: string | null;
  source: string | null;
};

export type V2AuditRow = {
  id: number;
  created_at: string;
  agent: string | null;
  action: string | null;
  target: string | null;
  success: boolean | null;
};

export type V2CronRow = {
  task_name: string;
  cost_class: string | null;
  started_at: string | null;
  status: string | null;
  cost_usd: number | null;
};

export async function fetchHealth(): Promise<{
  openIncidents: V2Incident[];
  recentAudit: V2AuditRow[];
  webhookRecent: V2AuditRow[];
  crons: V2CronRow[];
  burn: Array<{ day: string; runs: number; spend_usd: number; failures: number }>;
}> {
  const admin = getSupabaseAdmin();
  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const webhookAgents = [
    'github-webhook',
    'supabase-webhook',
    'vercel-webhook',
    'deploy-prod-workflow',
  ];

  const [inc, audit, webhooks, crons, burn] = await Promise.all([
    admin
      .from('cockpit_incidents')
      .select('id, detected_at, resolved_at, severity, symptom, root_cause, source')
      .is('resolved_at', null)
      .order('detected_at', { ascending: false })
      .limit(40),
    admin
      .from('cockpit_audit_log')
      .select('id, created_at, agent, action, target, success')
      .gte('created_at', since24h)
      .order('created_at', { ascending: false })
      .limit(40),
    admin
      .from('cockpit_audit_log')
      .select('id, created_at, agent, action, target, success')
      .in('agent', webhookAgents)
      .order('created_at', { ascending: false })
      .limit(30),
    admin
      .from('scheduled_task_runs')
      .select('task_name, cost_class, started_at, status, cost_usd')
      .order('started_at', { ascending: false })
      .limit(120),
    admin.from('v_scheduled_task_cost_burn').select('*').limit(7),
  ]);

  // Latest run per task only.
  const latestByTask = new Map<string, V2CronRow>();
  for (const r of (crons.data as V2CronRow[] | null) ?? []) {
    if (!latestByTask.has(r.task_name)) latestByTask.set(r.task_name, r);
  }

  return {
    openIncidents: (inc.data as V2Incident[]) ?? [],
    recentAudit: (audit.data as V2AuditRow[]) ?? [],
    webhookRecent: (webhooks.data as V2AuditRow[]) ?? [],
    crons: Array.from(latestByTask.values()),
    burn:
      (burn.data as Array<{
        day: string;
        runs: number;
        spend_usd: number;
        failures: number;
      }>) ?? [],
  };
}

// --- cost (cap_skill_calls + cockpit_audit_log) -------------------------

export type V2CostTotals = {
  cost_usd: number;
  runs: number;
  tokens_in: number;
  tokens_out: number;
};

export type V2CostBreakdown = {
  totals: {
    h24: V2CostTotals;
    d7: V2CostTotals;
    d30: V2CostTotals;
  };
  topTickets24h: Array<{
    ticket_id: number;
    cost_usd: number;
    runs: number;
    agents: string[];
  }>;
  topAgents7d: Array<{
    agent: string;
    cost_usd: number;
    runs: number;
    avg_cost_usd: number;
  }>;
};

export async function fetchCostBreakdown(): Promise<V2CostBreakdown> {
  const admin = getSupabaseAdmin();
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();
  const since7d = Date.now() - 7 * 86400_000;
  const since24h = Date.now() - 86400_000;

  // Pull from BOTH sources: cockpit.cap_skill_calls + public.cockpit_audit_log.
  const [auditRes, callsRes] = await Promise.all([
    admin
      .from('cockpit_audit_log')
      .select('ticket_id, agent, cost_usd_milli, input_tokens, output_tokens, created_at')
      .gte('created_at', since30d)
      .not('cost_usd_milli', 'is', null)
      .limit(5000),
    sbCockpit
      .from('cap_skill_calls')
      .select('ticket_id, role, cost_usd_milli, created_at')
      .gte('created_at', since30d)
      .not('cost_usd_milli', 'is', null)
      .limit(5000),
  ]);

  type Row = {
    ticket_id: number | null;
    agent: string;
    cost_milli: number;
    tok_in: number;
    tok_out: number;
    t: number;
  };

  const rows: Row[] = [];
  for (const r of (auditRes.data as Array<{
    ticket_id: number | null;
    agent: string | null;
    cost_usd_milli: number | null;
    input_tokens: number | null;
    output_tokens: number | null;
    created_at: string;
  }> | null) ?? []) {
    rows.push({
      ticket_id: r.ticket_id,
      agent: r.agent ?? 'unknown',
      cost_milli: r.cost_usd_milli ?? 0,
      tok_in: r.input_tokens ?? 0,
      tok_out: r.output_tokens ?? 0,
      t: new Date(r.created_at).getTime(),
    });
  }
  for (const r of (callsRes.data as Array<{
    ticket_id: number | null;
    role: string;
    cost_usd_milli: number | null;
    created_at: string;
  }> | null) ?? []) {
    rows.push({
      ticket_id: r.ticket_id,
      agent: r.role,
      cost_milli: r.cost_usd_milli ?? 0,
      tok_in: 0,
      tok_out: 0,
      t: new Date(r.created_at).getTime(),
    });
  }

  const totals = (predicate: (r: Row) => boolean): V2CostTotals => {
    let cost_milli = 0;
    let runs = 0;
    let tok_in = 0;
    let tok_out = 0;
    for (const r of rows) {
      if (!predicate(r)) continue;
      cost_milli += r.cost_milli;
      runs += 1;
      tok_in += r.tok_in;
      tok_out += r.tok_out;
    }
    return { cost_usd: cost_milli / 1000, runs, tokens_in: tok_in, tokens_out: tok_out };
  };

  const h24 = totals((r) => r.t >= since24h);
  const d7 = totals((r) => r.t >= since7d);
  const d30 = totals(() => true);

  // Top tickets in 24h
  const byTicket = new Map<number, { cost_milli: number; runs: number; agents: Set<string> }>();
  for (const r of rows) {
    if (r.t < since24h || !r.ticket_id) continue;
    const cur = byTicket.get(r.ticket_id) ?? {
      cost_milli: 0,
      runs: 0,
      agents: new Set<string>(),
    };
    cur.cost_milli += r.cost_milli;
    cur.runs += 1;
    cur.agents.add(r.agent);
    byTicket.set(r.ticket_id, cur);
  }
  const topTickets24h = Array.from(byTicket.entries())
    .map(([ticket_id, v]) => ({
      ticket_id,
      cost_usd: v.cost_milli / 1000,
      runs: v.runs,
      agents: Array.from(v.agents),
    }))
    .sort((a, b) => b.cost_usd - a.cost_usd)
    .slice(0, 10);

  // Top agents in 7d
  const byAgent = new Map<string, { cost_milli: number; runs: number }>();
  for (const r of rows) {
    if (r.t < since7d) continue;
    const cur = byAgent.get(r.agent) ?? { cost_milli: 0, runs: 0 };
    cur.cost_milli += r.cost_milli;
    cur.runs += 1;
    byAgent.set(r.agent, cur);
  }
  const topAgents7d = Array.from(byAgent.entries())
    .map(([agent, v]) => ({
      agent,
      cost_usd: v.cost_milli / 1000,
      runs: v.runs,
      avg_cost_usd: v.runs ? v.cost_milli / 1000 / v.runs : 0,
    }))
    .sort((a, b) => b.cost_usd - a.cost_usd)
    .slice(0, 15);

  return { totals: { h24, d7, d30 }, topTickets24h, topAgents7d };
}
