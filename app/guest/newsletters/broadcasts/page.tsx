// app/guest/newsletters/broadcasts/page.tsx
// PBS 2026-07-21 pm (Newsletter Calendar v2): full component (was thin alias).
// Renders one collapsible GroupContainer per marketing.subscriber_groups slug,
// plus a trailing "Unassigned" container for legacy campaigns with no group.
// Draft / Scheduled columns per container. Filters non-lifecycle campaigns.

import type { CSSProperties } from 'react';
import TenantLink from '@/components/nav/TenantLink';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../../_subpages';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import NewslettersSubStrip from '../_components/NewslettersSubStrip';
import ProposeNewsletterButton from '../_components/ProposeNewsletterButton';
import GroupContainer, { type BroadcastRow } from './_components/GroupContainer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CampaignRow = {
  campaign_id: string; property_id: number; name: string; status: string; subject: string;
  schedule_kind: string; scheduled_at: string | null; next_run_at: string | null; last_run_at: string | null;
  template_key: string | null; recipients_count: number; pending_count: number;
  updated_at: string; archived_at: string | null; planned_date: string | null;
  campaign_kind?: string | null; audience_type?: string | null; goal_tag?: string | null;
  director_slot_id?: number | null;
};

// Map campaign to a group slug via the linked director slot, or fall back to audience_type.
function audienceFallbackSlug(audience_type: string | null | undefined): string | null {
  if (!audience_type) return null;
  if (audience_type === 'b2c') return 'guests';
  if (audience_type === 'b2b') return 'dmc-contracted';
  return null;
}

export default async function BroadcastsPage() {
  const pid = PROPERTY_ID;

  const [{ data: campaignData }, { data: groupData }, { data: slotData }] = await Promise.all([
    supabase.from('v_guest_campaigns').select('*').eq('property_id', pid).is('archived_at', null)
      .order('planned_date', { ascending: true, nullsFirst: false })
      .order('updated_at', { ascending: false }),
    supabase.from('subscriber_groups' as never).select('slug,name,color,sort_order').order('sort_order', { ascending: true, nullsFirst: false }),
    // Slot lookup so we can bind campaign → group_slug via director_slot_id
    supabase.from('v_director_calendar').select('id, group_slug').eq('property_id', pid),
  ]);

  const all: CampaignRow[] = (campaignData as CampaignRow[]) ?? [];
  const groups = (groupData as Array<{ slug: string; name: string; color: string | null; sort_order: number | null }> | null) ?? [];
  const slotGroupMap = new Map<number, string | null>();
  for (const s of (slotData as Array<{ id: number; group_slug: string | null }> | null) ?? []) {
    slotGroupMap.set(s.id, s.group_slug);
  }

  // Broadcasts only (not lifecycle)
  const broadcasts: BroadcastRow[] = all
    .filter(r => (r.campaign_kind ?? 'broadcast') !== 'lifecycle')
    .map(r => {
      const slotGroup = r.director_slot_id != null ? slotGroupMap.get(r.director_slot_id) ?? null : null;
      const slug = slotGroup ?? audienceFallbackSlug(r.audience_type ?? null);
      return {
        campaign_id: r.campaign_id, property_id: r.property_id, name: r.name, subject: r.subject,
        status: r.status, planned_date: r.planned_date, scheduled_at: r.scheduled_at,
        updated_at: r.updated_at, audience_type: r.audience_type ?? null, goal_tag: r.goal_tag ?? null,
        director_slot_id: r.director_slot_id ?? null, group_slug: slug,
        recipients_count: r.recipients_count, pending_count: r.pending_count,
      };
    });

  const byGroup = new Map<string, { drafts: BroadcastRow[]; scheduled: BroadcastRow[] }>();
  function bucket(slug: string) {
    if (!byGroup.has(slug)) byGroup.set(slug, { drafts: [], scheduled: [] });
    return byGroup.get(slug)!;
  }
  for (const b of broadcasts) {
    const slug = b.group_slug ?? '__unassigned__';
    const bkt = bucket(slug);
    if (b.status === 'draft') bkt.drafts.push(b);
    else if (b.status === 'scheduled' || b.status === 'sending') bkt.scheduled.push(b);
  }
  // Sort scheduled ascending by scheduled_at
  for (const bkt of byGroup.values()) {
    bkt.scheduled.sort((a,b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''));
  }

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/newsletters',
  }));

  const totalDrafts = broadcasts.filter(b => b.status === 'draft').length;
  const totalScheduled = broadcasts.filter(b => b.status === 'scheduled' || b.status === 'sending').length;
  const subtitle = `${totalDrafts} draft${totalDrafts===1?'':'s'} · ${totalScheduled} scheduled — grouped by audience segment.`;

  // Preserve group order from subscriber_groups (sort_order), then always append Unassigned last
  const orderedGroups = groups.filter(g => byGroup.has(g.slug));
  const unassigned = byGroup.get('__unassigned__');

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage title="Contacts · Broadcasts by Group" subtitle={subtitle} tabs={tabs}>
        <NewslettersSubStrip active="broadcasts" />

        <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end', gap:8, alignItems:'center' }}>
          <TenantLink href="/guest/newsletters/director" style={secondaryButton}>Open Director</TenantLink>
          <TenantLink href="/guest/newsletters/templates" style={secondaryButton}>Manage templates</TenantLink>
          <ProposeNewsletterButton propertyId={pid} defaultKind="broadcast" />
          <TenantLink href="/guest/directory" style={ctaButton}>+ Compose from Directory</TenantLink>
        </div>

        <div style={{ gridColumn:'1 / -1', display:'grid', gap:12 }}>
          {orderedGroups.length === 0 && !unassigned && (
            <div style={emptyState}>No campaigns yet. Generate a plan in the Director, or compose from Directory.</div>
          )}
          {orderedGroups.map(g => {
            const bkt = byGroup.get(g.slug)!;
            return (
              <GroupContainer key={g.slug}
                slug={g.slug} name={g.name} color={g.color ?? '#7A4B2A'}
                drafts={bkt.drafts} scheduled={bkt.scheduled} />
            );
          })}
          {unassigned && (
            <GroupContainer key="__unassigned__"
              slug="__unassigned__" name="Unassigned (legacy)" color="#B0A48C"
              drafts={unassigned.drafts} scheduled={unassigned.scheduled} defaultOpen={false} />
          )}
        </div>
      </DashboardPage>
    </div>
  );
}

const ctaButton: CSSProperties = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#1F3A2E', color:'#FFFFFF', border:'1px solid #1F3A2E', borderRadius:4, textDecoration:'none' };
const secondaryButton: CSSProperties = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#FFFFFF', color:'#1F3A2E', border:'1px solid #E6DFCC', borderRadius:4, textDecoration:'none' };
const emptyState: CSSProperties = { padding:'16px 20px', fontSize:12, color:'#5A5A5A', background:'#FFFFFF', border:'1px solid #E6DFCC', borderRadius:6 };
