// lib/marketing.ts
// Server-side fetchers for the marketing schema.
// Uses anon Supabase client (already configured in lib/supabase.ts).

import { supabase } from '@/lib/supabase';

// ----- Types -----
export interface Review {
  id: number;
  source: string;
  reviewer_name: string | null;
  reviewer_country: string | null;
  rating_norm: number | null;
  rating_raw: number | null;
  rating_scale: number;
  title: string | null;
  body: string | null;
  language: string | null;
  reviewed_at: string | null;
  received_at: string;
  response_status: 'unanswered' | 'draft' | 'responded' | 'ignored';
  responded_at: string | null;
  is_verified: boolean;
}

export interface SocialAccount {
  id: number;
  platform: string;
  handle: string | null;
  url: string | null;
  display_name: string | null;
  followers: number;
  following: number;
  posts: number;
  last_synced_at: string | null;
  active: boolean;
}

export interface Influencer {
  id: number;
  name: string;
  handle: string | null;
  primary_platform: string | null;
  reach: number | null;
  niche: string | null;
  country: string | null;
  stay_from: string | null;
  stay_to: string | null;
  comp_value_usd: number | null;
  paid_fee_usd: number | null;
  deliverables: string | null;
  delivered: boolean;
  delivered_links: string[] | null;
  estimated_reach: number | null;
}

export interface MediaLink {
  id: number;
  category: string;
  label: string;
  url: string;
  description: string | null;
  added_at: string;
}

// ----- Queries -----

// Latest reviews — default 50, with optional source filter
export async function getReviews(opts: {
  limit?: number;
  source?: string;
  status?: string;
} = {}): Promise<Review[]> {
  const { limit = 50, source, status } = opts;
  let q = supabase
    .schema('marketing')
    .from('reviews')
    .select('id,source,reviewer_name,reviewer_country,rating_norm,rating_raw,rating_scale,title,body,language,reviewed_at,received_at,response_status,responded_at,is_verified')
    .order('received_at', { ascending: false })
    .limit(limit);

  if (source) q = q.eq('source', source);
  if (status) q = q.eq('response_status', status);

  const { data, error } = await q;
  if (error) {
    console.error('getReviews error', error);
    return [];
  }
  return (data ?? []) as Review[];
}

// NPS / rating breakdown by source (last 90 days)
export async function getReviewStatsBySource(days = 90): Promise<Array<{
  source: string;
  count: number;
  avg_rating: number;
  unanswered: number;
}>> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .schema('marketing')
    .from('reviews')
    .select('source,rating_norm,response_status')
    .gte('received_at', since.toISOString());

  if (error) {
    console.error('getReviewStatsBySource error', error);
    return [];
  }

  // Aggregate client-side (small dataset, no need for SQL view yet)
  const groups = new Map<string, { count: number; sum: number; ratings: number; unanswered: number }>();
  for (const r of data ?? []) {
    const g = groups.get(r.source) ?? { count: 0, sum: 0, ratings: 0, unanswered: 0 };
    g.count += 1;
    if (r.rating_norm != null) {
      g.sum += Number(r.rating_norm);
      g.ratings += 1;
    }
    if (r.response_status === 'unanswered') g.unanswered += 1;
    groups.set(r.source, g);
  }

  return Array.from(groups.entries())
    .map(([source, g]) => ({
      source,
      count: g.count,
      avg_rating: g.ratings > 0 ? g.sum / g.ratings : 0,
      unanswered: g.unanswered,
    }))
    .sort((a, b) => b.count - a.count);
}

export async function getReviewSummary(days = 30): Promise<{
  total: number;
  avg_rating: number;
  unanswered: number;
  response_rate: number;
}> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .schema('marketing')
    .from('reviews')
    .select('rating_norm,response_status')
    .gte('received_at', since.toISOString());

  if (error || !data) {
    return { total: 0, avg_rating: 0, unanswered: 0, response_rate: 0 };
  }

  const total = data.length;
  const ratings = data.filter(r => r.rating_norm != null).map(r => Number(r.rating_norm));
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const unanswered = data.filter(r => r.response_status === 'unanswered').length;
  const responded = data.filter(r => r.response_status === 'responded').length;
  const response_rate = total > 0 ? responded / total : 0;

  return { total, avg_rating: avg, unanswered, response_rate };
}

export async function getSocialAccounts(): Promise<SocialAccount[]> {
  const { data, error } = await supabase
    .schema('marketing')
    .from('social_accounts')
    .select('*')
    .eq('active', true)
    .order('platform', { ascending: true });

  if (error) {
    console.error('getSocialAccounts error', error);
    return [];
  }
  return (data ?? []) as SocialAccount[];
}

export async function getInfluencers(opts: { limit?: number } = {}): Promise<Influencer[]> {
  const { limit = 100 } = opts;
  const { data, error } = await supabase
    .schema('marketing')
    .from('influencers')
    .select('*')
    .order('stay_from', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error('getInfluencers error', error);
    return [];
  }
  return (data ?? []) as Influencer[];
}

export async function getMediaLinks(): Promise<MediaLink[]> {
  const { data, error } = await supabase
    .schema('marketing')
    .from('media_links')
    .select('id,category,label,url,description,added_at')
    .eq('active', true)
    .order('category', { ascending: true })
    .order('added_at', { ascending: false });

  if (error) {
    console.error('getMediaLinks error', error);
    return [];
  }
  return (data ?? []) as MediaLink[];
}
