/**
 * cockpit-queries.ts
 * Centralised, column-explicit Supabase queries for the /cockpit route.
 * Replaces all SELECT * calls — only the columns each component actually
 * renders are fetched, reducing network payload and Postgres I/O.
 *
 * Perf marathon #229 child — Reduce SELECT * — only needed columns
 */

import { createClient } from '@supabase/supabase-js';

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── Tickets ─────────────────────────────────────────────────────────────────
// Was: .from('cockpit_tickets').select('*')
// Now: only the columns rendered in the ticket table + expandable row
export async function fetchTickets(limit = 100) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('cockpit_tickets')
    .select(
      'id, created_at, updated_at, source, arm, intent, status, parsed_summary, pr_url, preview_url, github_issue_url, iterations, closed_at'
    )
    .order('id', { ascending: false })
    .limit(limit);
  if (error) console.error('[cockpit-queries] fetchTickets:', error.message);
  return data ?? [];
}

// ─── Audit log ────────────────────────────────────────────────────────────────
// Was: .from('cockpit_audit_log').select('*')
// Now: only columns displayed in the Logs tab table
export async function fetchAuditLog(limit = 200) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('cockpit_audit_log')
    .select('id, created_at, agent, action, detail, ticket_id')
    .order('id', { ascending: false })
    .limit(limit);
  if (error) console.error('[cockpit-queries] fetchAuditLog:', error.message);
  return data ?? [];
}

// ─── Incidents ────────────────────────────────────────────────────────────────
// Was: .from('cockpit_incidents').select('*')
// Now: only columns rendered in the incident list
export async function fetchIncidents(limit = 50) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('cockpit_incidents')
    .select('id, created_at, title, severity, status, resolved_at, notes')
    .order('id', { ascending: false })
    .limit(limit);
  if (error) console.error('[cockpit-queries] fetchIncidents:', error.message);
  return data ?? [];
}

// ─── PBS Notifications ────────────────────────────────────────────────────────
// Was: .from('cockpit_pbs_notifications').select('*')
// Now: only columns shown in the notifications panel
export async function fetchNotifications(limit = 50) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('cockpit_pbs_notifications')
    .select('id, created_at, message, type, read, ticket_id')
    .order('id', { ascending: false })
    .limit(limit);
  if (error)
    console.error('[cockpit-queries] fetchNotifications:', error.message);
  return data ?? [];
}

// ─── Agent identity ───────────────────────────────────────────────────────────
// Was: .from('cockpit_agent_identity').select('*')
// Now: only columns rendered in the team roster
export async function fetchAgentIdentities() {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('cockpit_agent_identity')
    .select('id, name, role, arm, status, avatar_url, description')
    .order('name', { ascending: true });
  if (error)
    console.error('[cockpit-queries] fetchAgentIdentities:', error.message);
  return data ?? [];
}

// ─── DQ open issues ───────────────────────────────────────────────────────────
// Was: view select('*')  — now explicit
export async function fetchDqOpen(limit = 50) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('v_dq_open')
    .select('id, created_at, table_name, column_name, issue_type, detail, status')
    .limit(limit);
  if (error) console.error('[cockpit-queries] fetchDqOpen:', error.message);
  return data ?? [];
}
