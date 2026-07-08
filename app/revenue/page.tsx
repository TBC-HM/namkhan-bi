// app/revenue/page.tsx
// Revenue HoD landing — rev-manager morning brief.
// 2026-07-07 v4: Conclusions container reframed for FORWARD outlook (14/30/60/90d
// windows + country pace + rate plan mix + LOS trend) rather than tonight only.

import TenantLink from '@/components/nav/TenantLink';
import {
  DashboardPage, Container, KpiTile,
  type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';
import type { DeptCfg } from '@/lib/dept-cfg/types';
import { REVENUE_SUBPAGES } from './_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { getDeptCfg } from '@/lib/dept-cfg/by-property';
import { PROPERTY_ID, supabase } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import ReportBuilder from './_components/ReportBuilder';
import ReportsList from './_components/ReportsList';
import BugsList from './_components/BugsList';
import HodTasksList from './_components/HodTasksList';
import AttentionList from './_components/AttentionList';
import { getPulseTodayPickup, getPulseTodayCancellations } from '@/lib/data-pulse';
import BookingActivity from '@/app/(cockpit)/_design/BookingActivity';
import ConclusionBlock from '@/app/_components/ConclusionBlock';
import {
  evaluateRevenueRules,
  type RevenueContext, type RevenueTargets,
  type PaceNight, type CountryPickup,
} from '@/lib/rules/revenue';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Props {
  propertyId?: number;
  searchParams?: Record<string, string | string[] | undefined>;
}

// Namkhan capacity constant — same value referenced across pace/pulse pages.
const CAPACITY = 30;

function shiftYear(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + delta);
  return d.toISOString().slice(0, 10);
}

export default async function RevenueHoDPage({ propertyId, searchParams }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  const cfg: DeptCfg = pid === PROPERTY_ID ? DEPT_CFG.revenue : getDeptCfg('revenue', pid);
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const sections = subPages;

  const todayIso = new Date().toISOString().slice(0, 10);
  const in90Iso = new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10);
  const in30Iso = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const in14Iso = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
  const lyFromIso = shiftYear(todayIso, -1);
  const lyToIso = shiftYear(in90Iso, -1);
  const l14FromIso = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
  const l14FromLyIso = shiftYear(l14FromIso, -1);
  const l14ToLyIso = shiftYear(todayIso, -1);

  const sbAdmin = getSupabaseAdmin();

  const [
    pickupToday, cancellationsToday, bugsRes, dueTasksRes,
    todayKpiRes, guardrailsRes,
    paceRes, stlyRes,
    l14PickupRes, l14LyPickupRes,
    next30ArrivalsRes,
    attnRes,
  ] = await Promise.all([
    getPulseTodayPickup(pid, todayIso).catch(() => [] as Array<unknown>),
    getPulseTodayCancellations(pid, todayIso).catch(() => [] as Array<unknown>),
    supabase.from('cockpit_bugs').select('id, body, status, created_at, page_url').not('status','in','(closed,resolved,wontfix,done)').order('created_at', { ascending: false }).limit(5),
    supabase.from('v_hod_tasks_due').select('id', { count: 'exact', head: true }).eq('dept_slug', 'revenue').eq('property_id', pid).eq('is_due', true),
    supabase.rpc('fn_revenue_hod_today_kpi', { p_property_id: pid }),
    sbAdmin.from('guardrails').select('rule_key, threshold_val').eq('property_id', pid).eq('domain', 'revenue').eq('active', true),
    supabase.from('v_otb_pace').select('night_date, confirmed_rooms').eq('property_id', pid).gte('night_date', todayIso).lte('night_date', in90Iso).order('night_date'),
    supabase.from('mv_kpi_daily').select('night_date, rooms_sold').eq('property_id', pid).gte('night_date', lyFromIso).lte('night_date', lyToIso),
    supabase.from('v_reservations_unified').select('reservation_id, booking_date, check_in_date, check_out_date, guest_country_iso2, rate_plan_name').eq('property_id', pid).eq('is_cancelled', false).gte('booking_date', l14FromIso).lte('booking_date', todayIso),
    supabase.from('v_reservations_unified').select('reservation_id, guest_country_iso2').eq('property_id', pid).eq('is_cancelled', false).gte('booking_date', l14FromLyIso).lte('booking_date', l14ToLyIso),
    supabase.from('v_reservations_unified').select('reservation_id, check_in_date, check_out_date').eq('property_id', pid).eq('is_cancelled', false).gte('check_in_date', todayIso).lte('check_in_date', in30Iso),
    // PBS 2026-07-08 #204/attention — attention flags come from cockpit.attention_flags via SECURITY DEFINER RPC.
    supabase.rpc('fn_attention_list', { p_property_id: pid, p_dept: 'revenue', p_user_email: 'pbsbase@gmail.com' }),
  ]);

  const todayKpi = ((todayKpiRes.data ?? [])[0] ?? null) as { rn_tonight: number; capacity: number; occ_pct: number; adr_today: number; revpar_today: number } | null;
  const bugs = (bugsRes.data ?? []) as Array<{ id: number; body: string | null; status: string | null; created_at: string | null; page_url: string | null }>;
  const dueTasksCount = dueTasksRes.count ?? 0;
  const symToday = pid === 1000001 ? '€' : '$';

  const pickupCount = pickupToday.length;
  const cancelCount = cancellationsToday.length;
  const pickupValue = (pickupToday as Array<{ value?: number | null }>).reduce((s, r) => s + (Number(r.value) || 0), 0);
  const cancelValue = (cancellationsToday as Array<{ value?: number | null }>).reduce((s, r) => s + (Number(r.value) || 0), 0);

  // Targets
  const targets: RevenueTargets = {};
  for (const g of (guardrailsRes.data ?? []) as Array<{ rule_key: string; threshold_val: number | string }>) {
    const n = typeof g.threshold_val === 'string' ? Number(g.threshold_val) : g.threshold_val;
    if (!Number.isFinite(n)) continue;
    if (g.rule_key === 'occupancy_target') targets.occupancy_target = n;
    else if (g.rule_key === 'adr_target') targets.adr_target = n;
    else if (g.rule_key === 'revpar_target') targets.revpar_target = n;
    else if (g.rule_key === 'pickup_min_daily') targets.pickup_min_daily = n;
    else if (g.rule_key === 'pace_gap_pp') targets.pace_gap_pp = n;
  }

  // Build paceNext90 with STLY join
  const stlyMap = new Map<string, number>();
  for (const r of ((stlyRes.data ?? []) as Array<{ night_date: string; rooms_sold: number | null }>)) {
    stlyMap.set(String(r.night_date), Number(r.rooms_sold ?? 0));
  }
  const paceRows = (paceRes.data ?? []) as Array<{ night_date: string; confirmed_rooms: number | null }>;
  const paceNext90: PaceNight[] = paceRows.map((r) => {
    const shifted = shiftYear(r.night_date, -1);
    const stly = stlyMap.has(shifted) ? stlyMap.get(shifted)! : null;
    const rooms = Number(r.confirmed_rooms ?? 0);
    const daysOut = Math.max(0, Math.round((new Date(r.night_date).getTime() - Date.now()) / 86400_000));
    return {
      night_date: r.night_date,
      daysOut,
      confirmedRooms: rooms,
      capacity: CAPACITY,
      occPct: CAPACITY > 0 ? (rooms / CAPACITY) * 100 : 0,
      stlyRooms: stly,
    };
  });

  // L14 country pickup (top 5) + LY comparison
  const l14Rows = (l14PickupRes.data ?? []) as Array<{ guest_country_iso2: string | null; rate_plan_name: string | null }>;
  const l14LyRows = (l14LyPickupRes.data ?? []) as Array<{ guest_country_iso2: string | null }>;
  const countryL14 = new Map<string, number>();
  const countryL14Ly = new Map<string, number>();
  for (const r of l14Rows) {
    const c = r.guest_country_iso2 || 'UNK';
    countryL14.set(c, (countryL14.get(c) ?? 0) + 1);
  }
  for (const r of l14LyRows) {
    const c = r.guest_country_iso2 || 'UNK';
    countryL14Ly.set(c, (countryL14Ly.get(c) ?? 0) + 1);
  }
  const topCountriesL14: CountryPickup[] = Array.from(countryL14.entries())
    .filter(([c]) => c !== 'UNK')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([country, pickupL14]) => ({
      country,
      pickupL14,
      pickupLyL14: countryL14Ly.get(country) ?? null,
    }));

  // Rate plan sleeping + concentration (L14)
  const rateCounts = new Map<string, number>();
  for (const r of l14Rows) {
    const name = r.rate_plan_name || 'unknown';
    rateCounts.set(name, (rateCounts.get(name) ?? 0) + 1);
  }
  const totalPickupL14 = l14Rows.length;
  const ratePlanTopSharePct: number | null = totalPickupL14 > 0
    ? (Math.max(0, ...Array.from(rateCounts.values())) / totalPickupL14) * 100
    : null;
  const sleepingCount = totalPickupL14 > 0
    ? Array.from(rateCounts.values()).filter(c => c === 0).length
    : null; // strictly a placeholder; a proper sleep view would list all plans

  // LOS avg on next-30d arrivals
  const next30 = (next30ArrivalsRes.data ?? []) as Array<{ check_in_date: string | null; check_out_date: string | null }>;
  const losValues = next30
    .filter(r => r.check_in_date && r.check_out_date)
    .map(r => Math.max(1, Math.round((new Date(r.check_out_date!).getTime() - new Date(r.check_in_date!).getTime()) / 86400_000)));
  const avgLosNext30 = losValues.length > 0 ? losValues.reduce((s, v) => s + v, 0) / losValues.length : null;

  const revenueCtx: RevenueContext = {
    currencySymbol: symToday,
    rnTonight: Number(todayKpi?.rn_tonight ?? 0),
    capacity: Number(todayKpi?.capacity ?? CAPACITY),
    occPct: Number(todayKpi?.occ_pct ?? 0),
    adrToday: Number(todayKpi?.adr_today ?? 0),
    revparToday: Number(todayKpi?.revpar_today ?? 0),
    pickupCount, pickupValue, cancelCount, cancelValue,
    paceNext90,
    topCountriesL14,
    ratePlanSleepingCount: sleepingCount,
    ratePlanTopSharePct,
    avgLosNext30,
    avgLosBaseline: null,
    targets,
  };
  const revenueInsights = evaluateRevenueRules(revenueCtx);

  const activeTargets = Object.entries(targets).map(([k, v]) => `${k}=${v}`).join(' · ') || 'fallback defaults';
  // Next 30 nights = tomorrow through 30 days out (excludes today so it's a clean 30-night window).
  const softNightsNext30 = Math.min(
    30,
    paceNext90.filter(n => n.daysOut >= 1 && n.daysOut <= 30 && n.occPct < 50).length,
  );
  // Total room nights + revenue booked TODAY across all new reservations.
  // PBS 2026-07-08: revenue added alongside nights so the tile shows the value delta.
  const pickupNightsSum = (pickupToday as Array<{ nights?: number | null }>).reduce((s, r) => s + (Number(r.nights) || 0), 0);
  const pickupRevenueSum = (pickupToday as Array<{ value?: number | null }>).reduce((s, r) => s + (Number(r.value) || 0), 0);
  const cancelNightsSum = (cancellationsToday as Array<{ nights?: number | null }>).reduce((s, r) => s + (Number(r.nights) || 0), 0);
  const cancelRevenueSum = (cancellationsToday as Array<{ value?: number | null }>).reduce((s, r) => s + (Number(r.value) || 0), 0);

  // PBS 2026-07-07 evening: strip 10% VAT + 10% service (compound 21%) so KPI tiles show NET values matching Cloudbeds + USALI.
  const TAX_SERVICE = 1.21;
  const netAdr    = Math.round(Number(todayKpi?.adr_today ?? 0)    / TAX_SERVICE);
  const netRevpar = Math.round(Number(todayKpi?.revpar_today ?? 0) / TAX_SERVICE);
  const netRevenueTonight = Math.round(Number(todayKpi?.rn_tonight ?? 0) * netAdr);

  // KPI tiles (same as before + one forward-looking tile)
  const baseTiles: KpiTileProps[] = (cfg.kpiTiles ?? []).map((k) => {
    if (todayKpi) {
      if (k.k === 'OCC')    return { label: 'OCC',    value: `${todayKpi.occ_pct ?? 0}%`, size: 'sm', footnote: `${todayKpi.rn_tonight ?? 0} of ${todayKpi.capacity ?? 0} rooms tonight` } as KpiTileProps;
      if (k.k === 'ADR')    return { label: 'ADR',    value: `${symToday}${netAdr.toLocaleString('en-US')}`,    size: 'sm', footnote: 'today · in-house · net' } as KpiTileProps;
      if (k.k === 'RevPAR') return { label: 'RevPAR', value: `${symToday}${netRevpar.toLocaleString('en-US')}`, size: 'sm', footnote: 'today · vs capacity · net' } as KpiTileProps;
    }
    return { label: k.k, value: k.v, size: 'sm', footnote: k.d } as KpiTileProps;
  });
  const tiles: KpiTileProps[] = [
    ...baseTiles,
    { label: 'Revenue tonight', value: `${symToday}${netRevenueTonight.toLocaleString('en-US')}`, size: 'sm',
      footnote: `${todayKpi?.rn_tonight ?? 0} rooms × ADR · net`,
      status: netRevenueTonight > 0 ? 'green' : 'grey' },
    // PBS 2026-07-07 evening: room-nights headline, bookings count in small print.
    // PBS 2026-07-08: revenue added to footnote so the tile shows the value picked up / lost.
    { label: 'Pickup today · room nights', value: pickupNightsSum, size: 'sm',
      footnote: pickupCount === 0
        ? 'no new bookings'
        : `${pickupCount} ${pickupCount === 1 ? 'booking' : 'bookings'} · ${symToday}${Math.round(pickupRevenueSum).toLocaleString('en-US')} · created today`,
      status: pickupNightsSum > 0 ? 'green' : 'grey' },
    { label: 'Cancellations today · room nights', value: cancelNightsSum, size: 'sm',
      footnote: cancelCount === 0
        ? 'no cancellations'
        : `${cancelCount} ${cancelCount === 1 ? 'booking' : 'bookings'} · ${symToday}${Math.round(cancelRevenueSum).toLocaleString('en-US')} · lost today`,
      status: cancelCount === 0 ? 'green' : 'amber' },
    { label: 'Soft nights (next 30d)', value: softNightsNext30, size: 'sm',
      footnote: '< 50% OCC · window still open',
      status: softNightsNext30 === 0 ? 'green' : softNightsNext30 > 8 ? 'amber' : 'grey' },
  ];

  // PBS 2026-07-08 #204/attention — DB rows first, seed fallback for dev only.
  type AttnRow = { id: number; kind: string | null; label: string; body: string | null; severity: string; source: string | null; link_href: string | null; created_at: string | null };
  const attnRows = ((attnRes.data ?? []) as AttnRow[]);
  const attnFromDb = attnRows.map(r => ({ id: String(r.id), label: r.label, kind: r.kind ?? undefined, severity: r.severity, href: r.link_href ?? undefined, body: r.body ?? undefined, source: 'db' as const }));
  const attnSeed = (cfg.defaultAttn ?? []).map(a => ({ id: a.id, label: a.label, kind: a.kind, severity: a.severity, source: 'seed' as const }));
  const useSeed = attnFromDb.length === 0 && process.env.NODE_ENV !== 'production';
  const attn = useSeed ? attnSeed : attnFromDb;
  const attnSubtitle = useSeed
    ? `${attn.length} item${attn.length === 1 ? '' : 's'} · dev seed · dismiss with ×`
    : `${attn.length} item${attn.length === 1 ? '' : 's'} · live · dismiss with ×`;
  const docs = cfg.defaultDocs ?? [];
  const reportTypes = cfg.reportTypes ?? [];

  const DONNA_PROPERTY_ID = 1000001;
  const chatHref = pid === DONNA_PROPERTY_ID
    ? `/cockpit/chat?dept=revenue&role=revenue_hod_donna&name=Mira&emoji=${encodeURIComponent('📈')}&label=Revenue`
    : `/cockpit/chat?dept=revenue`;

  const hodHrefs = ['/revenue', `/h/${pid}/revenue`];
  const hodTabs = sections.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.label === 'HoD' && hodHrefs.includes('/revenue'),
  }));

  return (
    <DashboardPage
      title={`Revenue · ${cfg.hodName}`}
      subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      tabs={hodTabs}
      action={<TenantLink href={chatHref} style={primaryBtnStyle}>{`Ask ${cfg.hodName} →`}</TenantLink>}
    >
      {tiles.length > 0 && (
        <div style={fullRow}>
          <Container title="Headline" subtitle="snapshot · last refresh · money tiles NET (excl. 10% VAT + 10% service charge)" density="compact">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
              {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
            </div>
          </Container>
        </div>
      )}

      <div style={{ ...fullRow, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <Container title="Attention" subtitle={attnSubtitle} density="compact">
          <AttentionList items={attn} storageKey={`attn:revenue:${pid}`} userEmail="pbsbase@gmail.com" />
        </Container>
        <Container title="My Reports" subtitle={`${docs.length} item${docs.length === 1 ? '' : 's'} · red = unseen · dismiss with ×`} density="compact">
          <ReportsList items={docs} storageKey={`reports:revenue:${pid}`} />
        </Container>
        <Container title="My Tasks" subtitle={dueTasksCount > 0 ? `🔴 ${dueTasksCount} due · add / due-date / repeat / delete` : 'add / due-date / repeat / delete · per property'} density="compact">
          <HodTasksList deptSlug="revenue" propertyId={pid} />
        </Container>
        <Container title="Bugs" subtitle={`${bugs.length} open · + to add · /cockpit/bugs for full inbox`} density="compact">
          <BugsList deptSlug="revenue" propertyId={pid} initial={bugs as unknown as { id: number; body: string | null; status: string | null; created_at: string | null; page_url: string | null }[]} />
        </Container>
      </div>

      {/* Conclusions — rev-manager forward brief */}
      <div style={fullRow}>
        <ConclusionBlock
          insights={revenueInsights}
          title="CONCLUSIONS · rev-manager morning brief · 14/30/60/90d windows · countries · rate plans · LOS"
          subtitle={`${paceNext90.length} nights forward · ${totalPickupL14} bookings L14 · ${topCountriesL14.length} source markets tracked · targets: ${activeTargets}`}
          emptyText="Everything nominal. No forward-window alarms firing."
          storageKey={`revenue_hod_signals:${pid}`}
          maxRender={12}
        />
      </div>

      {reportTypes.length > 0 && (
        <div style={fullRow}>
          <Container title="Build a report" subtitle="pick a type · narrow with chips · open print-ready render" density="compact">
            <ReportBuilder reportTypes={reportTypes} hrefPrefix={pid === PROPERTY_ID ? '' : `/h/${pid}`} />
          </Container>
        </div>
      )}

      <div style={fullRow}>
        <BookingActivity propertyId={pid} searchParams={searchParams} />
      </div>

    </DashboardPage>
  );
}

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };
const primaryBtnStyle: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
  padding: '6px 14px', borderRadius: 4, background: 'var(--primary, #1F3A2E)', color: '#FFFFFF', textDecoration: 'none',
};
