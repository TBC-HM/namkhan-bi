// lib/marketing-social.ts
// spec-social-media-module (2026-07-25, run 2) · A3/A6 — social calendar loop
// fetchers. Kept separate from lib/marketing.ts (shared, high-traffic file) so
// the social loop owns its own module. Slots live in marketing.social_calendar
// (read via public.v_social_calendar_slots); accepted slots become draft rows
// in marketing.social_posts (read via public.v_social_posts). Writes go
// through SECURITY DEFINER RPCs (fn_social_slot_upsert / accept / reject +
// fn_social_post_set_status) — PostgREST exposes only public (claude_md §0.5).

import { supabase } from '@/lib/supabase';

export type SocialSlotStatus = 'proposed' | 'accepted' | 'rejected' | 'drafted' | 'scheduled' | 'published';

export interface SocialCalendarSlot {
  slot_id: number;
  property_id: number;
  slot_date: string;               // YYYY-MM-DD
  platform: string;
  program_id: number | null;
  category_code: string | null;
  program_label: string | null;
  format: string | null;
  title: string | null;
  hook: string | null;
  brief_md: string | null;
  status: SocialSlotStatus;
  linked_post_id: string | null;
  ai_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type SocialPostStatus = 'draft' | 'ready' | 'scheduled' | 'pushed' | 'failed' | 'cancelled';

export interface SocialPostRow {
  post_id: string;
  property_id: number;
  social_account_id: number | null;
  platform: string;
  title: string | null;
  caption: string | null;
  hashtags: string[] | null;
  media_urls: string[] | null;
  link_url: string | null;
  scheduled_at: string | null;
  status: SocialPostStatus;
  ai_generated: boolean | null;
  ai_notes: string | null;
  push_channel: string | null;
  external_post_url: string | null;
  pushed_at: string | null;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Calendar slots for one property in [fromIso, toIso). Rejected slots included — callers filter. */
export async function getSocialCalendarSlots(propertyId: number, fromIso: string, toIso: string): Promise<SocialCalendarSlot[]> {
  const { data, error } = await supabase
    .from('v_social_calendar_slots')
    .select('*')
    .eq('property_id', propertyId)
    .gte('slot_date', fromIso)
    .lt('slot_date', toIso)
    .order('slot_date', { ascending: true });
  if (error) {
    console.error('getSocialCalendarSlots error', error);
    return [];
  }
  return (data ?? []) as SocialCalendarSlot[];
}

/** All posts for one property (draft queue + scheduled + pushed history). */
export async function getSocialPostsForProperty(propertyId: number): Promise<SocialPostRow[]> {
  const { data, error } = await supabase
    .from('v_social_posts')
    .select('*')
    .eq('property_id', propertyId)
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) {
    console.error('getSocialPostsForProperty error', error);
    return [];
  }
  return (data ?? []) as SocialPostRow[];
}
