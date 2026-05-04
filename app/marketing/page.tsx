// app/marketing/page.tsx
// Marketing snapshot — redesigned 2026-05-04 to match the canonical
// /operations/staff visual language (PageHeader + 5-tile KpiBox strip +
// 3-chart panel row + table sections).
//
// Data reality check (run before redesigning):
//   reviews              = 0
//   social.followers     = 0 across 8 channels (handles claimed)
//   influencers          = 0
//   media_links          = 0
//   media_assets         = 36 (ingested)
//   factsheet            = rich (10 rooms, 20 facilities, 20 activities,
//                                4 certifications, 4 meeting rooms, 3 retreats,
//                                13 open todos, 1 LOREM placeholder)
//
// Result: lead with what's populated (factsheet content + photo library +
// channel handles); mark scrape-dependent metrics (reviews, followers) as
// DATA NEEDED with explainer per the canonical KpiBox state.

import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getReviewSummary, getSocialAccounts } from '@/lib/marketing';
import { countPlaceholders, PROPERTY_ID } from '@/lib/settings';
import {
  inventoryByTierSvg,
  categoryBarsSvg,
  channelMatrixSvg,
  type InventoryTierRow,
  type CategoryCountRow,
  type ChannelStatusRow,
} from '@/lib/marketingCharts';
import { fmtIsoDate, EMPTY } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// ─────────────────────────────────────────────────────────────────────────────
// Server-side data layer
// ─────────────────────────────────────────────────────────────────────────────

interface FactsheetSnapshot {
  ok: boolean;
  errorMsg?: string;
  todos: string[];
  placeholders: number;
  identity: any;
  rooms: any[];
  facilities: Record<string, any[]>;
  activities: Record<string, any[]>;
  certifications: any[];
  meetingsCount: number;
  retreatsCount: number;
  generated_at: string | null;
}

async function getFactsheet(): Promise<FactsheetSnapshot> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .schema('marketing')
      .from('v_namkhan_factsheet')
      .select('*')
      .eq('property_id', PROPERTY_ID)
      .maybeSingle();

    if (error || !data) {
      return {
        ok: false,
        errorMsg: error?.message ?? 'No factsheet row',
        todos: [],
        placeholders: 0,
        identity: {},
        rooms: [],
        facilities: {},
        activities: {},
        certifications: [],
        meetingsCount: 0,
        retreatsCount: 0,
        generated_at: null,
      };
    }

    return {
      ok: true,
      todos: Array.isArray((data as any).todos) ? (data as any).todos : [],
      placeholders: countPlaceholders(data),
      identity: (data as any).identity ?? {},
      rooms: Array.isArray((data as any).rooms) ? (data as any).rooms : [],
      facilities: ((data as any).facilities as Record<string, any[]>) ?? {},
      activities: ((data as any).activities as Record<string, any[]>) ?? {},
      certifications: Array.isArray((data as any).certifications) ? (data as any).certifications : [],
      meetingsCount: Array.isArray((data as any).meetings?.rooms) ? (data as any).meetings.rooms.length : 0,
      retreatsCount: Array.isArray((data as any).retreats) ? (data as any).retreats.length : 0,
      generated_at: (data as any).factsheet_generated_at ?? null,
    };
  } catch (e: any) {
    return {
      ok: false,
      errorMsg: e?.message ?? 'admin client unavailable',
      todos: [],
      placeholders: 0,
      identity: {},
      rooms: [],
      facilities: {},
      activities: {},
      certifications: [],
      meetingsCount: 0,
      retreatsCount: 0,
      generated_at: null,
    };
  }
}

async function getMediaCount(): Promise<number | null> {
  try {
    const admin = getSupabaseAdmin();
    const { count, error } = await admin
      .schema('marketing')
      .from('media_assets')
      .select('asset_id', { count: 'exact', head: true })
      .eq('status', 'ingested');
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function MarketingPage() {
  const [reviews30d, socials, factsheet, mediaCount] = await Promise.all([
    getReviewSummary(30),
    getSocialAccounts(),
    getFactsheet(),
    getMediaCount(),
  ]);

  // ── KPI 1 · Profile completeness ───────────────────────────────────────────
  const TOTAL_FACTSHEET_FIELDS = 184; // from v_settings_field_schema audit
  const gapPenalty = factsheet.todos.length + factsheet.placeholders;
  const completenessPct = factsheet.ok
    ? Math.max(0, Math.min(100, ((TOTAL_FACTSHEET_FIELDS - gapPenalty) / TOTAL_FACTSHEET_FIELDS) * 100))
    : null;

  // ── KPI 2 · Photo library (real) ───────────────────────────────────────────
  // mediaCount is the live count of ingested media_assets

  // ── KPI 3 · Channels claimed ───────────────────────────────────────────────
  const totalChannels = socials.length;
  const claimedChannels = socials.filter((s: any) => Boolean(s.handle)).length;

  // ── KPI 4 · Reviews 30d (likely 0 → DATA NEEDED) ───────────────────────────
  const noReviewData = reviews30d.total === 0;

  // ── KPI 5 · Total followers (likely 0 → DATA NEEDED) ───────────────────────
  const totalFollowers = socials.reduce((s: number, a: any) => s + (a.followers ?? 0), 0);
  const noFollowerData = totalFollowers === 0;

  // ── Chart 1 · Room inventory by tier ───────────────────────────────────────
  const tierMap = new Map<string, { units: number; types: number }>();
  for (const r of factsheet.rooms) {
    const t = String(r.tier ?? 'unknown').toLowerCase();
    const cur = tierMap.get(t) ?? { units: 0, types: 0 };
    cur.units += Number(r.units ?? 0);
    cur.types += 1;
    tierMap.set(t, cur);
  }
  const tierOrder = ['premium', 'signature', 'entry', 'unknown'];
  const inventoryRows: InventoryTierRow[] = tierOrder
    .filter((t) => tierMap.has(t))
    .map((t) => ({ tier: t, units: tierMap.get(t)!.units, room_types: tierMap.get(t)!.types }));
  const inventorySvg = inventoryByTierSvg(inventoryRows);
  const totalUnits = inventoryRows.reduce((s, r) => s + r.units, 0);
  const totalRoomTypes = factsheet.rooms.length;

  // ── Chart 2 · Facilities & activities by category ──────────────────────────
  const facilityRows: CategoryCountRow[] = Object.entries(factsheet.facilities)
    .map(([cat, items]) => ({
      label: cat,
      count: Array.isArray(items) ? items.length : 0,
      tone: 'good' as const,
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  const facilitiesSvg = categoryBarsSvg(facilityRows);
  const totalFacilities = facilityRows.reduce((s, r) => s + r.count, 0);

  const activityRows: CategoryCountRow[] = Object.entries(factsheet.activities)
    .map(([cat, items]) => ({
      label: cat,
      count: Array.isArray(items) ? items.length : 0,
      tone: 'neutral' as const,
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  const activitiesSvg = categoryBarsSvg(activityRows);
  const totalActivities = activityRows.reduce((s, r) => s + r.count, 0);

  // ── Chart 3 · Channel presence matrix ──────────────────────────────────────
  const channelRows: ChannelStatusRow[] = socials.map((s: any) => ({
    platform: String(s.platform),
    has_handle: Boolean(s.handle),
    followers: typeof s.followers === 'number' ? s.followers : null,
  }));
  const channelSvg = channelMatrixSvg(channelRows);

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        pillar="Marketing"
        tab="Snapshot"
        title={<>Brand reach, told by the <em style={{ color: 'var(--brass)' }}>factsheet</em>.</>}
        lede={
          <>
            {totalRoomTypes} room types · {totalFacilities} facilities ·{' '}
            {totalActivities} activities · {factsheet.certifications.length} certifications ·{' '}
            {totalChannels} channels · {mediaCount ?? '—'} photos
          </>
        }
        rightSlot={
          <Link
            href="/settings/property"
            className="t-eyebrow"
            style={{
              display: 'inline-block',
              padding: '8px 14px',
              border: '1px solid var(--moss)',
              background: 'var(--moss)',
              color: 'var(--paper-warm)',
              borderRadius: 4,
              letterSpacing: 'var(--ls-extra)',
              textTransform: 'uppercase',
              fontSize: 'var(--t-xs)',
            }}
          >
            + Edit factsheet
          </Link>
        }
      />

      {/* KPI strip — 5 tiles */}
      <section className="kpi-strip cols-5">
        <KpiBox
          value={completenessPct}
          unit="pct"
          label="Profile completeness"
          state={completenessPct == null ? 'data-needed' : 'live'}
          needs={
            completenessPct == null
              ? 'Connect service-role key to read factsheet.'
              : undefined
          }
          tooltip={`(${TOTAL_FACTSHEET_FIELDS} editable fields − ${factsheet.todos.length} todos − ${factsheet.placeholders} LOREM placeholders) / ${TOTAL_FACTSHEET_FIELDS}`}
        />
        <KpiBox
          value={mediaCount}
          unit="count"
          label="Photo library"
          state={mediaCount == null ? 'data-needed' : 'live'}
          tooltip="Ingested media_assets · /marketing/upload"
        />
        <KpiBox
          value={claimedChannels}
          unit="count"
          label={`Channels claimed · ${claimedChannels}/${totalChannels}`}
          state={totalChannels === 0 ? 'data-needed' : 'live'}
          tooltip={`Of ${totalChannels} configured channels, ${claimedChannels} have a handle on file.`}
        />
        <KpiBox
          value={noReviewData ? null : reviews30d.total}
          unit="count"
          label="Reviews · last 30d"
          state={noReviewData ? 'data-needed' : 'live'}
          needs={noReviewData ? 'No OTA review scrape connected — wire BDC/Google/TripAdvisor agent.' : undefined}
          tooltip="marketing.reviews · received_at within 30d"
        />
        <KpiBox
          value={factsheet.todos.length}
          unit="count"
          label="Open todos"
          state={factsheet.todos.length === 0 ? 'live' : 'data-needed'}
          needs={factsheet.todos.length === 0 ? undefined : 'Edit in /settings/property to clear.'}
          tooltip="Auto-generated from blank required fields + LOREM placeholders + manual TODOs"
        />
      </section>

      {/* 3-chart row — Inventory · Facilities · Channels */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div className="panel">
          <div className="panel-head">
            <div className="panel-head-title">Inventory · <em>by tier</em></div>
            <span className="panel-head-meta">marketing.room_type_content</span>
          </div>
          {inventorySvg
            ? <div dangerouslySetInnerHTML={{ __html: inventorySvg }} />
            : <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>No room content yet.</div>}
          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginTop: 6 }}>
            {totalUnits} sellable units across {totalRoomTypes} room types · italic = units, plain = type count
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-head-title">Facilities · <em>by category</em></div>
            <span className="panel-head-meta">marketing.facilities</span>
          </div>
          {facilitiesSvg
            ? <div dangerouslySetInnerHTML={{ __html: facilitiesSvg }} />
            : <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>No facilities catalogued.</div>}
          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginTop: 6 }}>
            {totalFacilities} on-site facilities · {totalActivities} catalogued activities (overflow below)
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-head-title">Channel presence · <em>handle vs followers</em></div>
            <span className="panel-head-meta">marketing.social_accounts</span>
          </div>
          {channelSvg
            ? <div dangerouslySetInnerHTML={{ __html: channelSvg }} />
            : <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>No channels configured.</div>}
          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 9, background: 'var(--moss-glow)', marginRight: 4, verticalAlign: 'middle' }} />claimed / has data</span>
            <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 9, background: '#a14b3a', marginRight: 4, verticalAlign: 'middle' }} />no data</span>
          </div>
        </div>
      </section>

      {/* Activities (full-width bars) */}
      <section>
        <div className="panel-head">
          <div>
            <div className="panel-head-title">
              Activities catalogue · <em>by category</em>
            </div>
            <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginTop: 2 }}>
              {totalActivities} curated guest experiences across {activityRows.length} categories — feeds AI proposal builder + sales decks.
            </div>
          </div>
          <span className="panel-head-meta">marketing.activities_catalog</span>
        </div>
        <div className="panel">
          {activitiesSvg
            ? <div dangerouslySetInnerHTML={{ __html: activitiesSvg }} />
            : <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>No activities catalogued yet.</div>}
        </div>
      </section>

      {/* Channels detail table */}
      <section>
        <div className="panel-head">
          <div>
            <div className="panel-head-title">
              Channel handles · <em>{claimedChannels}/{totalChannels} claimed</em>
            </div>
            <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginTop: 2 }}>
              Manual entry today. Follower auto-pull arrives with the social-scrape agent.
            </div>
          </div>
          <span className="panel-head-meta">marketing.social_accounts</span>
        </div>
        <div className="panel flush">
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Platform</th>
                <th style={{ textAlign: 'left' }}>Handle</th>
                <th style={{ textAlign: 'right' }}>Followers</th>
                <th style={{ textAlign: 'left' }}>Last sync</th>
                <th style={{ textAlign: 'left' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {socials.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 24, fontStyle: 'italic', color: 'var(--ink-mute)', textAlign: 'center' }}>
                    No channels configured. <Link href="/settings/property/social" style={{ color: 'var(--brass)', textDecoration: 'underline' }}>Add one.</Link>
                  </td>
                </tr>
              )}
              {socials.map((s: any) => {
                const claimed = Boolean(s.handle);
                const hasFollowers = (s.followers ?? 0) > 0;
                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500, textTransform: 'uppercase', letterSpacing: 'var(--ls-loose)', fontSize: 'var(--t-sm)' }}>
                      {s.platform}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: claimed ? 'var(--ink)' : 'var(--ink-mute)' }}>
                      {s.handle ?? EMPTY}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: hasFollowers ? 'var(--ink)' : 'var(--ink-mute)' }}>
                      {hasFollowers ? Number(s.followers).toLocaleString('en-US') : EMPTY}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                      {s.last_synced_at ? fmtIsoDate(s.last_synced_at) : EMPTY}
                    </td>
                    <td>
                      <span
                        className="status-pill"
                        style={{
                          background: claimed ? 'var(--st-good-bg, #e8efe2)' : 'var(--st-bad-bg, #f3e0db)',
                          color: claimed ? 'var(--moss)' : 'var(--st-bad, #8e3a35)',
                          padding: '3px 10px',
                          borderRadius: 12,
                          fontFamily: 'var(--mono)',
                          fontSize: 'var(--t-xs)',
                          textTransform: 'uppercase',
                          letterSpacing: 'var(--ls-loose)',
                        }}
                      >
                        {claimed ? 'Claimed' : 'Missing'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Open todos + LOREM placeholders */}
      <section>
        <div className="panel-head">
          <div>
            <div className="panel-head-title">
              Profile gaps · <em>{factsheet.todos.length} todo{factsheet.todos.length === 1 ? '' : 's'}{factsheet.placeholders ? ` · ${factsheet.placeholders} placeholder${factsheet.placeholders === 1 ? '' : 's'}` : ''}</em>
            </div>
            <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginTop: 2 }}>
              Auto-extracted from blank required fields + LOREM IPSUM markers + owner-flagged TODOs in the factsheet.
            </div>
          </div>
          <span className="panel-head-meta">marketing.v_namkhan_factsheet.todos</span>
        </div>
        <div className="panel flush">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: 'left' }}>#</th>
                <th style={{ textAlign: 'left' }}>Action</th>
                <th style={{ textAlign: 'left' }}>Where to fix</th>
              </tr>
            </thead>
            <tbody>
              {factsheet.todos.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: 24, fontStyle: 'italic', color: 'var(--ink-mute)', textAlign: 'center' }}>
                    No open todos. Profile is clean.
                  </td>
                </tr>
              )}
              {factsheet.todos.map((todo: string, i: number) => {
                const where = inferSection(todo);
                return (
                  <tr key={i}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                      {String(i + 1).padStart(2, '0')}
                    </td>
                    <td style={{ fontSize: 'var(--t-sm)' }}>{todo}</td>
                    <td>
                      <Link
                        href={`/settings/property/${where.section}`}
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: 'var(--t-xs)',
                          color: 'var(--brass)',
                          textDecoration: 'underline',
                          letterSpacing: 'var(--ls-loose)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {where.label}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {factsheet.generated_at && (
        <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', textAlign: 'right' }}>
          Factsheet generated {fmtIsoDate(factsheet.generated_at)} · regenerates on each Settings save
        </div>
      )}
    </div>
  );
}

// Best-effort routing of a todo string to its Settings section + label.
function inferSection(todo: string): { section: string; label: string } {
  const t = todo.toLowerCase();
  if (t.includes('street') || t.includes('plus_code') || t.includes('google')) return { section: 'location_climate', label: 'Location & Climate' };
  if (t.includes('logo') || t.includes('hero_image') || t.includes('brand')) return { section: 'brand', label: 'Brand Identity' };
  if (t.includes('business_license')) return { section: 'property_identity', label: 'Property Identity' };
  if (t.includes('gm') || t.includes('owner') || t.includes('emergency') || t.includes('phone') || t.includes('email')) return { section: 'contacts', label: 'Contacts' };
  if (t.includes('agoda') || t.includes('listing url') || t.includes('handle')) return { section: 'social', label: 'Social Media' };
  if (t.includes('retreat') || t.includes('pricing')) return { section: 'retreat_pricing', label: 'Retreat Pricing' };
  if (t.includes('pool') || t.includes('facility')) return { section: 'facilities', label: 'Facilities' };
  if (t.includes('room') || t.includes('hero_image_url')) return { section: 'rooms', label: 'Rooms' };
  return { section: 'property_identity', label: 'Property Identity' };
}
