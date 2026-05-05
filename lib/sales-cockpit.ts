// lib/sales-cockpit.ts
// Server helpers powering the Email Cockpit on /sales/inquiries.
// All reads bypass RLS via service_role. Writes go through the API route.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export type CockpitStatus = 'all' | 'unanswered' | 'drafted' | 'sent_today';
export type CockpitDirection = 'all' | 'in' | 'out';
export type CockpitCategory = string;       // dynamic — values come from sales.email_categories
export type CockpitSince = '7d' | '30d' | '90d' | '365d' | 'all';

// ── Category model (driven by sales.email_categories + sales.email_category_rules) ──
export interface CategoryDef {
  key: string;
  label: string;
  display_order: number;
  active: boolean;
  default_category: boolean;
  description: string | null;
}
export interface CategoryRule {
  id: string;
  category_key: string;
  match_field: 'from_email' | 'from_domain' | 'subject' | 'body' | 'intended_mailbox';
  match_op: 'ilike' | 'endswith' | 'equals' | 'regex';
  pattern: string;
  priority: number;
  active: boolean;
  notes: string | null;
}

export async function listCategories(): Promise<CategoryDef[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('sales').from('email_categories')
    .select('key,label,display_order,active,default_category,description')
    .eq('active', true).order('display_order');
  return (data ?? []) as CategoryDef[];
}

export async function listCategoryRules(): Promise<CategoryRule[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('sales').from('email_category_rules')
    .select('id,category_key,match_field,match_op,pattern,priority,active,notes')
    .eq('active', true).order('priority');
  return (data ?? []) as CategoryRule[];
}

export interface CockpitFilters {
  scope?: string;             // intended_mailbox or 'all'
  direction?: CockpitDirection;
  status?: CockpitStatus;
  category?: CockpitCategory;
  since?: CockpitSince;
  search?: string;            // ILIKE on subject + from_email + from_name + body_text
  page?: number;              // 0-indexed
  pageSize?: number;          // default 25
}

// Category classifier — applies operator-managed rules from sales.email_category_rules.
// Rules are evaluated in priority order (lower first); first match wins.
// Falls back to the category flagged `default_category=true` (seeded as 'people').
export function categorizeThread(
  t: { last_from_email: string | null; last_subject: string | null; intended_mailbox: string | null; body_sample?: string | null },
  rules: CategoryRule[],
  defaultKey: string = 'people',
): CockpitCategory {
  const from = (t.last_from_email ?? '').toLowerCase();
  const subj = (t.last_subject ?? '').toLowerCase();
  const body = (t.body_sample ?? '').toLowerCase();
  const mb   = (t.intended_mailbox ?? '').toLowerCase();
  const dom  = from.includes('@') ? from.split('@')[1] : '';

  const fieldVal = (f: CategoryRule['match_field']): string => {
    switch (f) {
      case 'from_email':       return from;
      case 'from_domain':      return dom;
      case 'subject':          return subj;
      case 'body':             return body;
      case 'intended_mailbox': return mb;
    }
  };

  const ilikeMatch = (val: string, pattern: string): boolean => {
    // Postgres ILIKE: % = any seq, _ = single char. Implement on the JS side.
    const p = pattern.toLowerCase();
    if (!p.includes('%') && !p.includes('_')) return val.includes(p);
    // Build a regex equivalent
    let re = '';
    for (const ch of p) {
      if (ch === '%') re += '.*';
      else if (ch === '_') re += '.';
      else re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(`^${re}$`, 'i').test(val);
  };

  for (const r of rules) {
    const v = fieldVal(r.match_field);
    if (!v) continue;
    const p = r.pattern.toLowerCase();
    let hit = false;
    switch (r.match_op) {
      case 'equals':   hit = v === p; break;
      case 'endswith': hit = v.endsWith(p); break;
      case 'ilike':    hit = ilikeMatch(v, r.pattern); break;
      case 'regex':
        try { hit = new RegExp(r.pattern, 'i').test(v); } catch { hit = false; }
        break;
    }
    if (hit) return r.category_key;
  }
  return defaultKey;
}

function sinceCutoff(since: CockpitSince | undefined): Date | null {
  const now = new Date();
  switch (since) {
    case '7d':   return new Date(now.getTime() - 7 * 86400_000);
    case '30d':  return new Date(now.getTime() - 30 * 86400_000);
    case '90d':  return new Date(now.getTime() - 90 * 86400_000);
    case '365d': return new Date(now.getTime() - 365 * 86400_000);
    case 'all':  return null;
    default:     return null;
  }
}

export interface CockpitThread {
  thread_id: string;
  property_id: number;
  msg_count: number;
  last_received_at: string;
  last_subject: string | null;
  last_from_email: string | null;
  last_from_name: string | null;
  last_direction: 'inbound' | 'outbound';
  intended_mailbox: string | null;
  inquiry_id: string | null;
  inquiry_status: string | null;
  triage_kind: string | null;
  has_draft: boolean;
  draft_status: string | null;
  unanswered: boolean;        // last message in this thread is inbound
  category: CockpitCategory;
}

export interface CockpitMessage {
  id: string;
  message_id: string;
  thread_id: string | null;
  direction: 'inbound' | 'outbound';
  intended_mailbox: string | null;
  from_email: string | null;
  from_name: string | null;
  to_emails: string[];
  cc_emails: string[];
  subject: string | null;
  body_text: string | null;
  received_at: string;
}

export interface CockpitDraft {
  id: string;
  thread_id: string | null;
  to_emails: string[];
  cc_emails: string[];
  subject: string | null;
  body_md: string | null;
  generator: 'human' | 'agent' | 'template';
  agent_name: string | null;
  template_key: string | null;
  status: 'draft' | 'approved' | 'sent' | 'discarded';
  created_at: string;
  created_by: string | null;
}

export interface CockpitTemplate {
  key: string;
  name: string;
  subject: string;
  body_md: string;
  description: string | null;
  variables: string[];
  applies_to: string | null;
}

export interface CockpitMailbox {
  intended_mailbox: string;
  total: number;
  unanswered: number;
  inbound: number;
  outbound: number;
  last_received_at: string | null;
}

export interface CockpitKpis {
  total_threads: number;
  unanswered: number;
  unanswered_24h: number;
  drafts_pending: number;
  sent_today: number;
  oldest_unanswered_hours: number | null;
}

const PAGE_SIZE_DEFAULT = 25;

export async function listMailboxes(propertyId: number = PROPERTY_ID): Promise<CockpitMailbox[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.schema('sales').from('email_messages')
    .select('intended_mailbox,direction,received_at')
    .eq('property_id', propertyId);
  if (error) { console.error('[listMailboxes]', error); return []; }
  const rows = (data ?? []) as { intended_mailbox: string | null; direction: 'inbound'|'outbound'; received_at: string }[];
  const map = new Map<string, CockpitMailbox>();
  for (const r of rows) {
    const k = r.intended_mailbox || 'unknown';
    const t = map.get(k) ?? { intended_mailbox: k, total: 0, unanswered: 0, inbound: 0, outbound: 0, last_received_at: null };
    t.total += 1;
    if (r.direction === 'inbound') t.inbound += 1; else t.outbound += 1;
    if (!t.last_received_at || r.received_at > t.last_received_at) t.last_received_at = r.received_at;
    map.set(k, t);
  }

  // Patch unanswered counts from view
  const { data: ua } = await sb.schema('sales').from('v_unanswered_threads')
    .select('intended_mailbox').eq('property_id', propertyId);
  for (const r of (ua ?? []) as { intended_mailbox: string | null }[]) {
    const k = r.intended_mailbox || 'unknown';
    const t = map.get(k);
    if (t) t.unanswered += 1;
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export async function getCockpitKpis(propertyId: number, scope?: string): Promise<CockpitKpis> {
  const sb = getSupabaseAdmin();

  // Counts via the view + filtered email_messages
  let unansweredQ = sb.schema('sales').from('v_unanswered_threads').select('thread_id, received_at', { count: 'exact' }).eq('property_id', propertyId);
  if (scope && scope !== 'all') unansweredQ = unansweredQ.eq('intended_mailbox', scope);
  const { data: uaRows, count: unanswered } = await unansweredQ;

  const now = Date.now();
  const cutoff24 = new Date(now - 24 * 3600 * 1000).toISOString();
  let oldestHours: number | null = null;
  let unanswered24h = 0;
  for (const r of (uaRows ?? []) as { received_at: string }[]) {
    const ageH = (now - new Date(r.received_at).getTime()) / 3600000;
    if (ageH > 24) unanswered24h += 1;
    if (oldestHours == null || ageH > oldestHours) oldestHours = ageH;
  }

  // Total threads (rough — count distinct threads across messages with the scope)
  let totalQ = sb.schema('sales').from('email_messages').select('thread_id', { count: 'exact', head: false }).eq('property_id', propertyId);
  if (scope && scope !== 'all') totalQ = totalQ.eq('intended_mailbox', scope);
  const { data: tRows } = await totalQ;
  const totalThreads = new Set(((tRows ?? []) as { thread_id: string | null }[]).map(r => r.thread_id ?? '').filter(Boolean)).size;

  // Drafts pending (status='draft' or 'approved')
  let dQ = sb.schema('sales').from('email_drafts').select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId).in('status', ['draft','approved']);
  const { count: draftsPending } = await dQ;

  // Sent today
  const todayStart = new Date(); todayStart.setUTCHours(0,0,0,0);
  let sQ = sb.schema('sales').from('email_messages').select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId).eq('direction','outbound').gte('received_at', todayStart.toISOString());
  if (scope && scope !== 'all') sQ = sQ.eq('intended_mailbox', scope);
  const { count: sentToday } = await sQ;

  return {
    total_threads: totalThreads,
    unanswered: unanswered ?? 0,
    unanswered_24h: unanswered24h,
    drafts_pending: draftsPending ?? 0,
    sent_today: sentToday ?? 0,
    oldest_unanswered_hours: oldestHours,
  };
}

export async function searchThreads(filters: CockpitFilters, propertyId: number = PROPERTY_ID): Promise<{ threads: CockpitThread[]; hasMore: boolean }> {
  const sb = getSupabaseAdmin();
  const pageSize = filters.pageSize ?? PAGE_SIZE_DEFAULT;
  const page = filters.page ?? 0;
  const fetchLimit = (page + 1) * pageSize * 4 + 200;  // fetch more raw rows than needed because we group

  // Load category rules + default once per request
  const [rules, cats] = await Promise.all([listCategoryRules(), listCategories()]);
  const defaultCat = cats.find(c => c.default_category)?.key ?? 'people';

  let q = sb.schema('sales').from('email_messages')
    .select('thread_id,message_id,subject,from_email,from_name,direction,intended_mailbox,received_at,inquiry_id,property_id,body_text')
    .eq('property_id', propertyId)
    .order('received_at', { ascending: false })
    .limit(fetchLimit);

  if (filters.scope && filters.scope !== 'all') q = q.eq('intended_mailbox', filters.scope);
  if (filters.direction === 'in') q = q.eq('direction', 'inbound');
  if (filters.direction === 'out') q = q.eq('direction', 'outbound');
  const cutoff = sinceCutoff(filters.since);
  if (cutoff) q = q.gte('received_at', cutoff.toISOString());
  if (filters.search && filters.search.trim().length > 0) {
    const s = `%${filters.search.trim().replace(/%/g, '\\%')}%`;
    q = q.or(`subject.ilike.${s},from_email.ilike.${s},from_name.ilike.${s},body_text.ilike.${s}`);
  }

  const { data, error } = await q;
  if (error) { console.error('[searchThreads]', error); return { threads: [], hasMore: false }; }
  const rows = (data ?? []) as Array<{
    thread_id: string | null; message_id: string; subject: string | null;
    from_email: string | null; from_name: string | null;
    direction: 'inbound'|'outbound';
    intended_mailbox: string | null;
    received_at: string; inquiry_id: string | null; property_id: number;
    body_text: string | null;
  }>;

  // Group by thread, take latest msg attributes
  const byThread = new Map<string, CockpitThread>();
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = r.thread_id || r.message_id;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!byThread.has(key)) {
      const cat = categorizeThread({
        last_from_email: r.from_email,
        last_subject: r.subject,
        intended_mailbox: r.intended_mailbox,
        body_sample: (r.body_text ?? '').slice(0, 400),
      }, rules, defaultCat);
      byThread.set(key, {
        thread_id: key,
        property_id: r.property_id,
        msg_count: 1,
        last_received_at: r.received_at,
        last_subject: r.subject,
        last_from_email: r.from_email,
        last_from_name: r.from_name,
        last_direction: r.direction,
        intended_mailbox: r.intended_mailbox,
        inquiry_id: r.inquiry_id,
        inquiry_status: null,
        triage_kind: null,
        has_draft: false,
        draft_status: null,
        unanswered: r.direction === 'inbound',
        category: cat,
      });
    }
  }
  for (const [k, t] of byThread) t.msg_count = counts.get(k) ?? 1;

  // Patch inquiry status + triage
  const inqIds = Array.from(byThread.values()).map(t => t.inquiry_id).filter(Boolean) as string[];
  if (inqIds.length > 0) {
    const { data: inqs } = await sb.schema('sales').from('inquiries').select('id,status,triage_kind').in('id', inqIds);
    const inqMap = new Map(((inqs ?? []) as { id: string; status: string; triage_kind: string|null }[]).map(i => [i.id, i]));
    for (const t of byThread.values()) {
      if (t.inquiry_id) {
        const i = inqMap.get(t.inquiry_id);
        if (i) { t.inquiry_status = i.status; t.triage_kind = i.triage_kind; }
      }
    }
  }

  // Patch draft presence
  const threadKeys = Array.from(byThread.keys());
  if (threadKeys.length > 0) {
    const { data: drafts } = await sb.schema('sales').from('email_drafts')
      .select('thread_id,status').in('thread_id', threadKeys).eq('property_id', propertyId)
      .neq('status', 'discarded');
    for (const d of (drafts ?? []) as { thread_id: string | null; status: string }[]) {
      if (!d.thread_id) continue;
      const t = byThread.get(d.thread_id);
      if (t && (!t.draft_status || ['draft','approved'].includes(d.status))) {
        t.has_draft = true;
        t.draft_status = d.status;
      }
    }
  }

  let all = Array.from(byThread.values()).sort((a,b) => +new Date(b.last_received_at) - +new Date(a.last_received_at));

  // Category filter (people / ota / reviews / reports / promo / internal)
  if (filters.category && filters.category !== 'all') {
    all = all.filter(t => t.category === filters.category);
  }

  // Status filters that operate on the grouped view
  if (filters.status === 'unanswered') {
    all = all.filter(t => t.unanswered);
  } else if (filters.status === 'drafted') {
    all = all.filter(t => t.has_draft);
  } else if (filters.status === 'sent_today') {
    const todayStart = new Date(); todayStart.setUTCHours(0,0,0,0);
    all = all.filter(t => t.last_direction === 'outbound' && new Date(t.last_received_at) >= todayStart);
  }

  const start = page * pageSize;
  const end = start + pageSize;
  const slice = all.slice(start, end);
  return { threads: slice, hasMore: all.length > end };
}

export async function getThreadDetail(threadId: string, propertyId: number = PROPERTY_ID): Promise<{ messages: CockpitMessage[]; drafts: CockpitDraft[] }> {
  const sb = getSupabaseAdmin();
  const [{ data: msgs }, { data: drafts }] = await Promise.all([
    sb.schema('sales').from('email_messages').select('id,message_id,thread_id,direction,intended_mailbox,from_email,from_name,to_emails,cc_emails,subject,body_text,received_at')
      .eq('property_id', propertyId).eq('thread_id', threadId).order('received_at', { ascending: true }),
    sb.schema('sales').from('email_drafts').select('id,thread_id,to_emails,cc_emails,subject,body_md,generator,agent_name,template_key,status,created_at,created_by')
      .eq('property_id', propertyId).eq('thread_id', threadId).neq('status','discarded').order('created_at', { ascending: false }),
  ]);
  return {
    messages: (msgs ?? []) as CockpitMessage[],
    drafts: (drafts ?? []) as CockpitDraft[],
  };
}

export async function listTemplates(): Promise<CockpitTemplate[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('sales').from('email_templates')
    .select('key,name,subject,body_md,description,variables,applies_to')
    .eq('active', true).order('name');
  return (data ?? []) as CockpitTemplate[];
}
