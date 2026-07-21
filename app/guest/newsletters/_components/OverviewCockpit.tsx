// app/guest/newsletters/_components/OverviewCockpit.tsx
// PBS 2026-07-22 · Newsletter marketing-ops cockpit — the default landing on /guest/newsletters.
//
// Server component. Reads:
//   * v_email_analytics_daily          → AnalyticsStrip (Today / L7d / L30d)
//   * v_email_recent_errors            → error list under strip (retry buttons live in client child)
//   * v_guest_campaigns                → month-cal chips (broadcasts)
//   * v_director_calendar              → month-cal chips (director slots)
//   * v_sequence_enrollment_summary    → SequenceBars
//
// All reads go through public bridge views (PostgREST public-only rule).

import type { CSSProperties } from 'react';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import MonthlyCalendar, { type CalCampaign, type CalSlot, type CalLifecycle } from './MonthlyCalendar';
import AnalyticsStrip, { type AnalyticsRow, type ErrorRow } from './AnalyticsStrip';
import SequenceBars, { type SeqRow } from './SequenceBars';

const HAIR = '#E6DFCC';
const INK  = '#1B1B1B';
const INK_M = '#5A5A5A';

interface Props {
  propertyId?: number;
  month?: string;                // 'YYYY-MM' — MonthlyCalendar navigator uses URL param
}

export default async function OverviewCockpit({ propertyId, month }: Props) {
  const pid = propertyId ?? PROPERTY_ID;

  // ---------- month range ----------
  const now = new Date();
  const [ymY, ymM] = (month && /^\d{4}-\d{2}$/.test(month))
    ? month.split('-').map(Number) as [number, number]
    : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  const monthStart = new Date(Date.UTC(ymY, ymM - 1, 1));
  const monthEnd   = new Date(Date.UTC(ymY, ymM, 1));

  // ---------- parallel fetch ----------
  const analyticsFromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 30));
  const analyticsFrom = analyticsFromDate.toISOString().slice(0, 10);

  const [
    analyticsRes,
    errorsRes,
    campaignsRes,
    slotsRes,
    lifecycleRes,
    sequencesRes,
  ] = await Promise.all([
    supabase.from('v_email_analytics_daily').select('*').eq('property_id', pid).gte('day', analyticsFrom),
    supabase.from('v_email_recent_errors').select('*').eq('property_id', pid).limit(10),
    supabase.from('v_guest_campaigns').select('campaign_id, name, subject, scheduled_at, status, campaign_kind, audience_type, planned_date').eq('property_id', pid).is('archived_at', null),
    supabase.from('v_director_calendar').select('id, slot_date, title, subject, status, audience_type, goal_tag, linked_campaign_id, body_md, hero_asset_id').eq('property_id', pid).gte('slot_date', monthStart.toISOString().slice(0, 10)).lt('slot_date', monthEnd.toISOString().slice(0, 10)),
    supabase.from('v_marketing_funnels').select('funnel_id, name').eq('property_id', pid),
    supabase.from('v_sequence_enrollment_summary').select('*').eq('property_id', pid),
  ]);

  const analytics = ((analyticsRes.data as AnalyticsRow[] | null) ?? []);
  const errors    = ((errorsRes.data as ErrorRow[] | null) ?? []);
  const sequences = ((sequencesRes.data as SeqRow[] | null) ?? []);

  // Campaigns → chips in the calendar
  type CampaignRow = { campaign_id: string; name: string; subject: string | null; scheduled_at: string | null; status: string; campaign_kind: string | null; audience_type: string | null; planned_date: string | null };
  const rawCampaigns = ((campaignsRes.data as CampaignRow[] | null) ?? []).filter(c => (c.campaign_kind ?? 'broadcast') === 'broadcast');
  const campaignsInMonth: CalCampaign[] = rawCampaigns
    .map((c): CalCampaign | null => {
      const iso = c.scheduled_at || (c.planned_date ? `${c.planned_date}T10:00:00Z` : null);
      if (!iso) return null;
      const d = new Date(iso);
      if (d < monthStart || d >= monthEnd) return null;
      return {
        campaign_id: c.campaign_id,
        name: c.name,
        subject: c.subject,
        day_iso: iso.slice(0, 10),
        status: c.status,
        audience_type: c.audience_type ?? 'b2c',
      };
    })
    .filter((x): x is CalCampaign => x !== null);

  const slots: CalSlot[] = ((slotsRes.data as Record<string, unknown>[] | null) ?? []).map((s) => ({
    slot_id: Number(s.id),
    slot_date: String(s.slot_date),
    title: String(s.title ?? ''),
    subject: (s.subject as string | null) ?? null,
    body_md: (s.body_md as string | null) ?? null,
    hero_asset_id: (s.hero_asset_id as string | null) ?? null,
    status: String(s.status ?? 'proposed'),
    audience_type: String(s.audience_type ?? 'b2c'),
    goal_tag: String(s.goal_tag ?? ''),
    linked_campaign_id: (s.linked_campaign_id as string | null) ?? null,
  }));

  // Lifecycle count per day: proxy via funnels sends per day is out of scope;
  // instead we show funnel-count on the day cell as an "expected lifecycle" hint
  // using upcoming enrollments next_step_at::date (best-effort, not required for cockpit).
  const lifecycle: CalLifecycle[] = ((lifecycleRes.data as { funnel_id: string; name: string }[] | null) ?? [])
    .map((f) => ({ funnel_id: f.funnel_id, name: f.name, day_iso: '' }));  // unused day-mapping (see chip aggregation)

  const err = analyticsRes.error || errorsRes.error || campaignsRes.error || slotsRes.error || sequencesRes.error;

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {err && (
        <div style={errorBox}>Some panels failed to load: {err.message}</div>
      )}

      {/* 1 · Analytics strip + recent errors */}
      <AnalyticsStrip rows={analytics} errors={errors} />

      {/* 2 · Monthly calendar */}
      <section>
        <div style={sectionHead}>Monthly calendar</div>
        <MonthlyCalendar
          year={ymY}
          month={ymM}
          campaigns={campaignsInMonth}
          slots={slots}
          lifecycle={lifecycle}
        />
      </section>

      {/* 3 · Sequences visual */}
      <section>
        <div style={sectionHead}>Sequences (live)</div>
        <SequenceBars rows={sequences} />
      </section>
    </div>
  );
}

const sectionHead: CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: INK_M, marginBottom: 8,
};
const errorBox: CSSProperties = {
  padding: '10px 12px', fontSize: 12, color: '#8A2419',
  background: '#FBE8E4', border: `1px solid #E8B7AB`, borderRadius: 4,
};
