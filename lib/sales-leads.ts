// lib/sales-leads.ts
// Server helpers for /sales/leads — cold prospects + warm guest cohorts.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export type ProspectStatus = 'new' | 'enriched' | 'drafted' | 'sent' | 'replied' | 'bounced' | 'suppressed' | 'converted' | 'dismissed';
export type ProspectSource = 'manual' | 'apollo' | 'linkedin' | 'csv' | 'referral';

export interface Prospect {
  id: string;
  name: string | null;
  company: string | null;
  role: string | null;
  country: string | null;
  email: string | null;
  linkedin_url: string | null;
  website: string | null;
  source: ProspectSource;
  source_ref: string | null;
  icp_segment_id: string | null;
  score: number | null;
  status: ProspectStatus;
  context_summary: string | null;
  last_outreach_draft_id: string | null;
  created_at: string;
  contacted_at: string | null;
  replied_at: string | null;
}

export interface IcpSegment {
  id: string;
  key: string;
  name: string;
  description: string | null;
  daily_quota: number;
  source: string;
  active: boolean;
}

export interface GuestCohort {
  id: string;
  key: string;
  name: string;
  description: string | null;
  criteria: Record<string, unknown>;
  active: boolean;
  member_count?: number;
  member_emails?: number;
  sample_names?: string[];
}

const FX_LAK_PER_USD = parseFloat(process.env.NEXT_PUBLIC_FX_LAK_USD ?? '21800');

export async function listProspects(opts: { status?: ProspectStatus; limit?: number; q?: string } = {}): Promise<Prospect[]> {
  const sb = getSupabaseAdmin();
  let q = sb.schema('sales').from('prospects').select('*')
    .eq('property_id', PROPERTY_ID)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.q && opts.q.trim().length > 0) {
    const s = `%${opts.q.trim().replace(/%/g, '\\%')}%`;
    q = q.or(`name.ilike.${s},company.ilike.${s},email.ilike.${s},role.ilike.${s},country.ilike.${s}`);
  }
  const { data, error } = await q;
  if (error) { console.error('[listProspects]', error); return []; }
  return (data ?? []) as Prospect[];
}

export async function getProspectKpis(): Promise<Record<ProspectStatus | 'total', number>> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('sales').from('prospects').select('status').eq('property_id', PROPERTY_ID);
  const rows = (data ?? []) as { status: ProspectStatus }[];
  const out: Record<string, number> = { total: rows.length };
  for (const r of rows) out[r.status] = (out[r.status] ?? 0) + 1;
  return out as Record<ProspectStatus | 'total', number>;
}

export async function listIcpSegments(): Promise<IcpSegment[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('sales').from('icp_segments').select('id,key,name,description,daily_quota,source,active').order('name');
  return (data ?? []) as IcpSegment[];
}

export async function listGuestCohortsWithCounts(): Promise<GuestCohort[]> {
  const sb = getSupabaseAdmin();
  const { data: cohorts } = await sb.schema('sales').from('guest_cohorts').select('*').eq('active', true).order('name');
  const list = (cohorts ?? []) as GuestCohort[];

  // For each cohort, run a count + sample query against guest.mv_guest_profile.
  await Promise.all(list.map(async (c) => {
    const stats = await countCohortMembers(c.criteria);
    c.member_count = stats.total;
    c.member_emails = stats.with_email;
    c.sample_names = stats.sample_names;
  }));

  return list;
}

export async function countCohortMembers(criteria: Record<string, unknown>): Promise<{ total: number; with_email: number; sample_names: string[] }> {
  const sb = getSupabaseAdmin();
  let q = sb.schema('guest').from('mv_guest_profile').select('full_name,email,country,language,is_repeat,stays_count,lifetime_revenue,last_stay_date,top_segment', { count: 'exact' })
    .eq('property_id', PROPERTY_ID);

  // Apply known criteria fields. Unknown keys are ignored.
  const c = criteria || {};
  if (Array.isArray(c.countries) && c.countries.length > 0) q = q.in('country', c.countries as string[]);
  if (Array.isArray(c.languages) && c.languages.length > 0) q = q.in('language', c.languages as string[]);
  if (typeof c.min_stays === 'number') q = q.gte('stays_count', c.min_stays);
  if (typeof c.max_stays === 'number') q = q.lte('stays_count', c.max_stays);
  if (typeof c.min_lifetime_usd === 'number') {
    const lakMin = (c.min_lifetime_usd as number) * FX_LAK_PER_USD;
    q = q.gte('lifetime_revenue', lakMin);
  }
  if (c.has_email === true) q = q.not('email', 'is', null);
  if (typeof c.last_stay_min_days === 'number') {
    const cutoff = new Date(Date.now() - (c.last_stay_min_days as number) * 86400_000).toISOString().slice(0,10);
    q = q.lte('last_stay_date', cutoff);
  }
  if (typeof c.last_stay_max_days === 'number') {
    const cutoff = new Date(Date.now() - (c.last_stay_max_days as number) * 86400_000).toISOString().slice(0,10);
    q = q.gte('last_stay_date', cutoff);
  }
  if (Array.isArray(c.tags) && c.tags.length > 0) {
    // top_segment heuristic for retreat cohort etc
    q = q.in('top_segment', c.tags as string[]);
  }

  const { data, count } = await q.limit(50);
  const rows = (data ?? []) as Array<{ full_name: string | null; email: string | null }>;
  const withEmail = rows.filter(r => !!r.email).length;
  const sample = rows.slice(0, 6).map(r => r.full_name ?? '—').filter(Boolean);
  // count is exact across the whole filtered set; sample/with_email is from the first 50
  return { total: count ?? rows.length, with_email: withEmail, sample_names: sample };
}

export async function listCohortMembers(criteria: Record<string, unknown>, limit = 200): Promise<Array<{ guest_id: string; full_name: string | null; email: string | null; country: string | null; language: string | null; last_stay_date: string | null; lifetime_revenue: number | null; is_repeat: boolean | null }>> {
  const sb = getSupabaseAdmin();
  let q = sb.schema('guest').from('mv_guest_profile')
    .select('guest_id,full_name,email,country,language,last_stay_date,lifetime_revenue,is_repeat')
    .eq('property_id', PROPERTY_ID)
    .order('lifetime_revenue', { ascending: false })
    .limit(limit);
  const c = criteria || {};
  if (Array.isArray(c.countries) && c.countries.length > 0) q = q.in('country', c.countries as string[]);
  if (Array.isArray(c.languages) && c.languages.length > 0) q = q.in('language', c.languages as string[]);
  if (typeof c.min_stays === 'number') q = q.gte('stays_count', c.min_stays);
  if (typeof c.min_lifetime_usd === 'number') {
    const lakMin = (c.min_lifetime_usd as number) * FX_LAK_PER_USD;
    q = q.gte('lifetime_revenue', lakMin);
  }
  if (c.has_email === true) q = q.not('email', 'is', null);
  if (typeof c.last_stay_min_days === 'number') {
    const cutoff = new Date(Date.now() - (c.last_stay_min_days as number) * 86400_000).toISOString().slice(0,10);
    q = q.lte('last_stay_date', cutoff);
  }
  if (typeof c.last_stay_max_days === 'number') {
    const cutoff = new Date(Date.now() - (c.last_stay_max_days as number) * 86400_000).toISOString().slice(0,10);
    q = q.gte('last_stay_date', cutoff);
  }
  if (Array.isArray(c.tags) && c.tags.length > 0) q = q.in('top_segment', c.tags as string[]);
  const { data } = await q;
  return (data ?? []) as Array<{ guest_id: string; full_name: string | null; email: string | null; country: string | null; language: string | null; last_stay_date: string | null; lifetime_revenue: number | null; is_repeat: boolean | null }>;
}
