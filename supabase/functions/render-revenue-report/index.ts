// render-revenue-report v8 · PBS 2026-07-15
// v8: remove footer (Scheduled via Namkhan cockpit… reply to unsubscribe)
//     · replace 'Author: Namkhan BI cockpit (automated)' with 'Delivered by TBC Revenue Management'
//     · remove daily 'Pickup velocity · last 15 days' section.
// v7: rename 'scrape' -> 'last feed' in parity integrity strip (3 sites).
// v6 · PBS 2026-07-14
// Daily preview page overhaul:
//   - Yesterday row: added dedicated "RN sold yesterday + Revenue yesterday" tile at the end.
//   - Removed "Today — on the books now" subtitle line.
//   - Removed "Pickup velocity" descriptive subtitle line.
//   - Removed "Monthly pickup matrix" and "Daily pickup by night" sections.
//   - Added "OTB · Pickup · Comparison · SDLY" matrix (from /revenue/pickup).
//   - Added "Forward outlook by night" table (from /revenue/pickup-day).
//   - Added Parity matrix (from /revenue/parity).
// Weekly + monthly bundles unchanged.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CADENCE_LABEL: Record<string,string> = { daily:'Daily report', weekly:'Weekly report', monthly:'Monthly report' };
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PRIMARY = '#084838';
const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const HAIRLINE = '#E6DFCC';
const PAPER = '#FFFFFF';
const PAPER_SOFT = '#FAFAF7';
const GREEN = '#1F5C2C';
const RED = '#B04A2F';
const OTA_COL = '#1F3A2E';
const DIR_COL = '#4B7A5F';
const OTH_COL = '#B8A878';
const LINE_COL = '#8E8E8E';
const BLOCK_TINT = '#F8F8F8';
const BLOCK_RULE = '#BDBDBD';
const HL_BAND = '#F5F1E4';

function tzFor(propertyId: number): string { if (propertyId === 260955) return 'Asia/Vientiane'; if (propertyId === 1000001) return 'Europe/Madrid'; return 'UTC'; }
function todayIsoInTz(tz: string): string { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); const y = parts.find(p => p.type === 'year')!.value; const m = parts.find(p => p.type === 'month')!.value; const d = parts.find(p => p.type === 'day')!.value; return `${y}-${m}-${d}`; }
function addDaysIso(iso: string, n: number): string { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function fmtDate(iso: string): string { const d = new Date(iso + 'T00:00:00Z'); return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }); }
function fmtDmy(iso: string): string { const d = new Date(iso + 'T00:00:00Z'); return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`; }
function fmtMonth(y: number, m: number): string { return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); }
function n(v: unknown, digits = 0): string { const x = Number(v); if (!Number.isFinite(x)) return '—'; return x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
function money(v: unknown, ccy = 'USD', digits = 0): string { const x = Number(v); if (!Number.isFinite(x)) return '—'; return `${ccy === 'USD' ? '$' : (ccy === 'EUR' ? '€' : ccy + ' ')}${x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`; }
function pct(v: unknown, digits = 1): string { const x = Number(v); if (!Number.isFinite(x)) return '—'; return `${x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`; }
function csvEscape(s: string): string { return (s.includes('"') || s.includes(',') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s; }

type SB = ReturnType<typeof createClient>;
interface KpiDay { night_date: string; rooms_available: number | null; rooms_sold: number | null; rooms_revenue: number | null; ancillary_revenue: number | null; total_revenue: number | null; occupancy_pct: number | null; adr: number | null; revpar: number | null; trevpar: number | null; base_currency: string | null; }
interface VelocityRow { day: string; day_pos: number; pickup_ota: number; pickup_direct: number; pickup_other: number; pickup_total: number; sdly_ota: number; sdly_direct: number; sdly_other: number; sdly_total: number; ma_7d: number; }
interface MonthlyRow { year: number; month: number; reservations: number; rn: number; rev: number; rev_total: number }
interface DayRow { stay_date: string; otb_rooms_now: number; otb_rooms_1d_ago: number; otb_rooms_7d_ago: number; otb_revenue_now: number; otb_revenue_1d_ago: number; otb_revenue_7d_ago: number; new_bookings_2d_rn: number; cancellations_2d_rn: number; }
interface PaceOtbRow { stay_date: string; year: number; month: number; iso_dow: number; rooms_available: number; otb_rooms_sold: number; otb_revenue: number; otb_occupancy_pct: number; otb_adr: number; otb_revpar: number; }
interface OtbAtRow { stay_year: number; stay_month: number; rn: number; rev: number; rev_total: number; avail_rn: number; }
interface IntegrityRow { property_id: number; shop_date: string; stay_date: string; direct_usd: number | null; direct_status: string | null; booking_usd: number | null; booking_status: string | null; expedia_usd: number | null; expedia_status: string | null; agoda_usd: number | null; agoda_status: string | null; tiket_usd: number | null; tiket_status: string | null; lowest_usd: number | null; highest_usd: number | null; spread_usd: number | null; spread_pct: number | null; otas_with_rate: number | null; otas_sold_out: number | null; }

async function loadKpiRange(admin: SB, pid: number, fromIso: string, toIso: string): Promise<KpiDay[]> { const { data } = await admin.from('v_kpi_daily_property').select('*').eq('property_id', pid).gte('night_date', fromIso).lte('night_date', toIso).order('night_date'); return (data ?? []) as KpiDay[]; }
async function loadVelocity(admin: SB, pid: number): Promise<VelocityRow[]> { const { data } = await admin.from('v_pickup_velocity_15d30d').select('*').eq('property_id', pid).order('day', { ascending: false }).limit(30); return (data ?? []) as VelocityRow[]; }
async function loadMonthly(admin: SB, pid: number, mBack: number, mFwd: number): Promise<MonthlyRow[]> { const t = new Date(); const from = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - mBack, 1)); const to = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + mFwd, 1)); const { data } = await admin.from('v_pickup_monthly').select('*').eq('property_id', pid); const rows = (data ?? []) as MonthlyRow[]; return rows.filter((r) => { const d = Date.UTC(r.year, r.month - 1, 1); return d >= from.getTime() && d <= to.getTime(); }).sort((a, b) => (a.year - b.year) * 12 + (a.month - b.month)); }
async function loadDayReport(admin: SB, pid: number, fromIso: string, toIso: string): Promise<DayRow[]> { const { data } = await admin.from('v_pickup_day_report').select('*').eq('property_id', pid).gte('stay_date', fromIso).lte('stay_date', toIso).order('stay_date'); return (data ?? []) as DayRow[]; }
async function loadPaceOtb(admin: SB, pid: number, fromIso: string, toIso: string): Promise<PaceOtbRow[]> { const { data } = await admin.schema('kpi').from('v_pace_otb_daily').select('stay_date,year,month,iso_dow,rooms_available,otb_rooms_sold,otb_revenue,otb_occupancy_pct,otb_adr,otb_revpar').eq('property_id', pid).gte('stay_date', fromIso).lte('stay_date', toIso).order('stay_date'); return (data ?? []) as PaceOtbRow[]; }
async function loadIntegrity(admin: SB, pid: number): Promise<IntegrityRow[]> { const { data } = await admin.from('v_rate_integrity_matrix').select('*').eq('property_id', pid).order('shop_date', { ascending: false }).order('stay_date', { ascending: true }); const rows = (data ?? []) as IntegrityRow[]; if (rows.length === 0) return []; const latestShop = rows[0].shop_date; return rows.filter((r) => r.shop_date === latestShop); }
async function loadPropertyName(admin: SB, pid: number): Promise<string> { for (const view of ['v_properties','v_property_directory']) { try { const { data } = await admin.from(view).select('property_id,name').eq('property_id', pid).maybeSingle(); if (data?.name) return data.name as string; } catch (_e) {} } if (pid === 260955) return 'The Namkhan'; if (pid === 1000001) return 'Donna Portals'; return `Property ${pid}`; }

interface PickupMatrixData { property: string; capacity: number; asOfDate: string; monthlySnapshotLabel: string; mondaySnapshotLabel: string; yesterdaySnapshotLabel: string; todaySnapshotLabel: string; sdlyDate: string; months: Array<{ monthKey: string; monthLabel: string; rows: PickupMatrixRow[] }>; total: PickupMatrixRow[]; stalenessNote?: string; currencySymbol: string; }
type PickupMetric = 'RN' | 'OCC' | 'REV rooms' | 'REV total' | 'ADR' | 'RevPAR';
interface PickupDelta { abs: number | null; pct: number | null }
interface PickupMatrixRow { metric: PickupMetric; baseline2023: number | null; baseline2024: number | null; baseline2025: number | null; budget2026: number | null; otbAll: number | null; otbMonthly: number | null; otbMonday: number | null; otbYesterday: number | null; otbToday: number | null; pickupMonthly: PickupDelta; pickupWeekly: PickupDelta; pickupYesterday: PickupDelta; vsBudget: PickupDelta; vsLy: PickupDelta; sdly: number | null; sdlyDiff: number | null; }
interface MonthAgg { rn: number; rev: number; rev_total: number; avail: number }

function deltaOf(a: number | null, b: number | null): PickupDelta { if (a == null || b == null) return { abs: null, pct: null }; const abs = a - b; const p = b !== 0 ? (abs / Math.abs(b)) * 100 : null; return { abs, pct: p }; }
function valueOf(a: MonthAgg | null, metric: PickupMetric): number | null { if (!a) return null; if (metric === 'RN') return a.rn; if (metric === 'OCC') return a.avail > 0 ? (a.rn / a.avail) * 100 : null; if (metric === 'REV rooms') return a.rev; if (metric === 'REV total') return a.rev_total; if (metric === 'ADR') return a.rn > 0 ? a.rev / a.rn : null; if (metric === 'RevPAR') return a.avail > 0 ? a.rev / a.avail : null; return null; }
function bucketRows(rows: OtbAtRow[] | null, year: number): Record<number, MonthAgg> { const out: Record<number, MonthAgg> = {}; for (const r of rows ?? []) { if (Number(r.stay_year) !== year) continue; out[Number(r.stay_month)] = { rn: Number(r.rn ?? 0), rev: Number(r.rev ?? 0), rev_total: Number(r.rev_total ?? r.rev ?? 0), avail: Number(r.avail_rn ?? 0) }; } return out; }
function sumBucket(b: Record<number, MonthAgg>): MonthAgg { const t: MonthAgg = { rn: 0, rev: 0, rev_total: 0, avail: 0 }; for (const m of Object.values(b)) { t.rn += m.rn; t.rev += m.rev; t.rev_total += m.rev_total; t.avail += m.avail; } return t; }
function fmtIsoLocal(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

async function loadPickupMatrix(admin: SB, propertyId: number, sym: string): Promise<PickupMatrixData | null> {
  try {
    const property = propertyId === 260955 ? 'The Namkhan' : propertyId === 1000001 ? 'Donna Portals' : `Property ${propertyId}`;
    const asofRes = await admin.rpc('fn_pickup_asof', { p_property_id: propertyId }).then((r) => (r.data?.[0] ?? null) as { asof_date: string; last_booking: string | null; is_stale: boolean; days_stale: number } | null);
    const asOf = asofRes ? new Date(asofRes.asof_date + 'T00:00:00') : new Date();
    const isStale = asofRes?.is_stale ?? false;
    const daysStale = asofRes?.days_stale ?? 0;
    const stayYear = asOf.getFullYear();
    const sdlyYear = stayYear - 1;
    const yesterday = new Date(asOf); yesterday.setDate(asOf.getDate() - 1);
    const lastMonday = new Date(asOf); { const dow = lastMonday.getDay() || 7; lastMonday.setDate(lastMonday.getDate() - (dow - 1) - 7); }
    const monthStart = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
    const sdly = new Date(asOf); sdly.setFullYear(sdlyYear);
    const y2 = new Date(stayYear - 2, 11, 31);
    const y3 = new Date(stayYear - 3, 11, 31);
    const snap = (d: Date): Promise<OtbAtRow[]> => Promise.resolve(admin.rpc('fn_pickup_otb_at', { p_property_id: propertyId, p_asof: fmtIsoLocal(d) }).then((r) => (r.data ?? []) as OtbAtRow[]));
    const [sToday, sYest, sMon, sMonth, sSdly, sY2, sY3] = await Promise.all([snap(asOf).catch(() => []), snap(yesterday).catch(() => []), snap(lastMonday).catch(() => []), snap(monthStart).catch(() => []), snap(sdly).catch(() => []), snap(y2).catch(() => []), snap(y3).catch(() => [])]);
    const otbToday = bucketRows(sToday, stayYear);
    const otbYest = bucketRows(sYest, stayYear);
    const otbMon = bucketRows(sMon, stayYear);
    const otbMonth = bucketRows(sMonth, stayYear);
    const sdlyB = bucketRows(sSdly, sdlyYear);
    const availY: Record<number, Record<number, number>> = {};
    const fillAvail = (rows: OtbAtRow[], year: number) => { availY[year] = {}; for (const r of rows) if (Number(r.stay_year) === year) availY[year][Number(r.stay_month)] = Number(r.avail_rn ?? 0); };
    fillAvail(sToday, stayYear); fillAvail(sSdly, sdlyYear); fillAvail(sY2, stayYear - 2); fillAvail(sY3, stayYear - 3);
    const { data: baseRows } = await admin.from('v_pickup_monthly').select('year,month,rn,rev,rev_total').eq('property_id', propertyId).gte('year', stayYear - 3).lte('year', stayYear - 1);
    const baseline: Record<number, Record<number, MonthAgg>> = {};
    for (const r of (baseRows ?? []) as Array<{ year: number; month: number; rn: number; rev: number; rev_total: number | null }>) {
      const y = Number(r.year); const mo = Number(r.month);
      (baseline[y] ??= {})[mo] = { rn: Number(r.rn ?? 0), rev: Number(r.rev ?? 0), rev_total: Number(r.rev_total ?? r.rev ?? 0), avail: availY[y]?.[mo] ?? 0 };
    }
    const METRICS: PickupMetric[] = ['RN', 'OCC', 'REV rooms', 'REV total', 'ADR', 'RevPAR'];
    const buildRow = (metric: PickupMetric, mo: number): PickupMatrixRow => {
      const tAll = valueOf(otbToday[mo] ?? null, metric);
      const tMonthly = valueOf(otbMonth[mo] ?? null, metric);
      const tMonday = valueOf(otbMon[mo] ?? null, metric);
      const tYest = valueOf(otbYest[mo] ?? null, metric);
      const tToday = tAll;
      const sdlyValue = valueOf(sdlyB[mo] ?? null, metric);
      const suppress = isStale;
      return { metric, baseline2023: valueOf(baseline[stayYear - 3]?.[mo] ?? null, metric), baseline2024: valueOf(baseline[stayYear - 2]?.[mo] ?? null, metric), baseline2025: valueOf(baseline[stayYear - 1]?.[mo] ?? null, metric), budget2026: null, otbAll: tAll, otbMonthly: tMonthly, otbMonday: tMonday, otbYesterday: tYest, otbToday: tToday, pickupMonthly: suppress ? { abs: null, pct: null } : deltaOf(tToday, tMonthly), pickupWeekly: suppress ? { abs: null, pct: null } : deltaOf(tToday, tMonday), pickupYesterday: suppress ? { abs: null, pct: null } : deltaOf(tToday, tYest), vsBudget: { abs: null, pct: null }, vsLy: deltaOf(tToday, sdlyValue), sdly: sdlyValue, sdlyDiff: (tToday != null && sdlyValue != null) ? tToday - sdlyValue : null };
    };
    const months = [] as PickupMatrixData['months'];
    for (let mo = 1; mo <= 12; mo++) months.push({ monthKey: `${stayYear}-${String(mo).padStart(2, '0')}`, monthLabel: `01/${String(mo).padStart(2, '0')}/${stayYear}`, rows: METRICS.map((m) => buildRow(m, mo)) });
    const tot = { today: sumBucket(otbToday), monthly: sumBucket(otbMonth), monday: sumBucket(otbMon), yest: sumBucket(otbYest), sdly: sumBucket(sdlyB), b23: sumBucket(baseline[stayYear - 3] ?? {}), b24: sumBucket(baseline[stayYear - 2] ?? {}), b25: sumBucket(baseline[stayYear - 1] ?? {}) };
    const totalRow = (metric: PickupMetric): PickupMatrixRow => {
      const tToday = valueOf(Object.keys(otbToday).length ? tot.today : null, metric);
      const tMonthly = valueOf(Object.keys(otbMonth).length ? tot.monthly : null, metric);
      const tMonday = valueOf(Object.keys(otbMon).length ? tot.monday : null, metric);
      const tYest = valueOf(Object.keys(otbYest).length ? tot.yest : null, metric);
      const sdlyValue = valueOf(Object.keys(sdlyB).length ? tot.sdly : null, metric);
      const suppress = isStale;
      return { metric, baseline2023: valueOf(Object.keys(baseline[stayYear - 3] ?? {}).length ? tot.b23 : null, metric), baseline2024: valueOf(Object.keys(baseline[stayYear - 2] ?? {}).length ? tot.b24 : null, metric), baseline2025: valueOf(Object.keys(baseline[stayYear - 1] ?? {}).length ? tot.b25 : null, metric), budget2026: null, otbAll: tToday, otbMonthly: tMonthly, otbMonday: tMonday, otbYesterday: tYest, otbToday: tToday, pickupMonthly: suppress ? { abs: null, pct: null } : deltaOf(tToday, tMonthly), pickupWeekly: suppress ? { abs: null, pct: null } : deltaOf(tToday, tMonday), pickupYesterday: suppress ? { abs: null, pct: null } : deltaOf(tToday, tYest), vsBudget: { abs: null, pct: null }, vsLy: deltaOf(tToday, sdlyValue), sdly: sdlyValue, sdlyDiff: (tToday != null && sdlyValue != null) ? tToday - sdlyValue : null };
    };
    const curMonthAvail = otbToday[asOf.getMonth() + 1]?.avail ?? 0;
    const capacity = curMonthAvail > 0 ? Math.round(curMonthAvail / new Date(stayYear, asOf.getMonth() + 1, 0).getDate()) : 0;
    const asOfDmy = `${String(asOf.getDate()).padStart(2,'0')}/${String(asOf.getMonth()+1).padStart(2,'0')}/${asOf.getFullYear()}`;
    const dmy = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    const stalenessNote = isStale ? `${property} feed stopped — data as of ${asofRes?.last_booking ? dmy(new Date(asofRes.last_booking + 'T00:00:00')) : asOfDmy} (${daysStale}d ago). Live pickup deltas suppressed; SDLY anchored to ${dmy(sdly)}.` : undefined;
    return { property, capacity, asOfDate: `OTB · Pickup · Comparison · SDLY  ·  as of ${asOfDmy}`, monthlySnapshotLabel: dmy(monthStart), mondaySnapshotLabel: dmy(lastMonday), yesterdaySnapshotLabel: dmy(yesterday), todaySnapshotLabel: asOfDmy, sdlyDate: dmy(sdly), months, total: METRICS.map(totalRow), stalenessNote, currencySymbol: sym };
  } catch (_e) { return null; }
}

function pickupMatrixHtml(data: PickupMatrixData): string {
  const CS = data.currencySymbol;
  const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US');
  const fmtUsd = (v: number) => CS + Math.round(v).toLocaleString('en-US');
  const fmtPct2 = (v: number) => `${v.toFixed(1)}%`;
  const fmtMet = (m: PickupMetric, v: number) => m === 'OCC' ? fmtPct2(v) : m === 'RN' ? fmtInt(v) : fmtUsd(v);
  const cellText = (v: number | null, m: PickupMetric) => v == null || !Number.isFinite(v) ? { text: '—', muted: true, neg: false } : { text: fmtMet(m, v), muted: false, neg: v < 0 };
  const deltaText = (d: PickupDelta | undefined, m: PickupMetric, kind: 'abs' | 'pct') => {
    const raw = kind === 'abs' ? d?.abs : d?.pct;
    if (raw == null || !Number.isFinite(raw)) return { text: '—', tone: 'mute' as const };
    const isOcc = m === 'OCC';
    const rounded = (kind === 'pct' || isOcc) ? Math.round(raw * 10) / 10 : Math.round(raw);
    if (rounded === 0) return { text: '—', tone: 'mute' as const };
    const sign = rounded > 0 ? '+' : '';
    const text = kind === 'abs' ? (isOcc ? sign + rounded.toFixed(1) + 'pp' : sign + fmtInt(rounded)) : sign + rounded.toFixed(1) + '%';
    return { text, tone: (rounded > 0 ? 'good' : 'bad') as 'good' | 'bad' };
  };
  const tdCell = (v: number | null, m: PickupMetric, emphasis: boolean, borderTop: string) => {
    const c = cellText(v, m);
    const color = c.muted ? INK_SOFT : m === 'OCC' ? (c.neg ? '#C62828' : '#2E7D32') : c.neg ? '#C62828' : INK;
    return `<td style="padding:2px 4px;text-align:right;border-right:1px solid #E0E0E0;border-top:${borderTop};color:${color};font-style:${c.muted?'italic':'normal'};font-weight:${emphasis?600:400};white-space:nowrap;font-variant-numeric:tabular-nums;font-size:10px">${c.text}</td>`;
  };
  const tdDelta = (d: PickupDelta | undefined, m: PickupMetric, kind: 'abs'|'pct', borderTop: string) => {
    const c = deltaText(d, m, kind);
    const bg = c.tone === 'good' ? '#E8F2E4' : c.tone === 'bad' ? '#FBEAEA' : 'transparent';
    const fg = c.tone === 'good' ? '#2E7D32' : c.tone === 'bad' ? '#C62828' : INK_SOFT;
    return `<td style="padding:2px 4px;text-align:right;border-right:1px solid #E0E0E0;border-top:${borderTop};background:${bg};color:${fg};font-style:${c.tone==='mute'?'italic':'normal'};white-space:nowrap;font-variant-numeric:tabular-nums;font-size:10px">${c.text}</td>`;
  };
  const groupTh = (label: string, span = 1) => `<th colspan="${span}" style="padding:6px 10px;text-align:center;color:${INK};font-weight:800;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;background:${PAPER};border-bottom:1px solid #E0E0E0;border-right:1px solid #E0E0E0">${label}</th>`;
  const headerTh = (label: string, sub?: string, span = 1) => `<th colspan="${span}" style="padding:5px 8px;text-align:right;color:${INK};font-weight:700;font-size:10px;background:${PAPER};border-bottom:1px solid #E0E0E0;border-right:1px solid #E0E0E0;white-space:nowrap">${label}${sub ? `<div style=\"font-size:10px;font-weight:500;color:${INK};margin-top:1px\">${sub}</div>` : ''}</th>`;
  const renderBlock = (month: { monthKey: string; monthLabel: string; rows: PickupMatrixRow[] }, isAlt: boolean, isTotal: boolean) => {
    const bg = isTotal ? PAPER : isAlt ? BLOCK_TINT : PAPER;
    return month.rows.map((r, i) => {
      const first = i === 0;
      const borderTop = first ? (isTotal ? `2px solid ${BLOCK_RULE}` : `1.5px solid ${BLOCK_RULE}`) : 'none';
      const rowHead = `<th style="padding:2px 6px;text-align:left;min-width:84px;width:84px;max-width:84px;border-right:1px solid #E0E0E0;color:${INK};vertical-align:middle;background:${bg};border-top:${borderTop};font-weight:${isTotal?700:500};border-bottom:none">${first ? `<div style=\"font-size:11px;font-weight:700;color:${INK};letter-spacing:0.04em;margin-bottom:2px\">${month.monthLabel}</div>` : ''}<div style="font-size:10px;font-weight:500;color:${INK_SOFT};letter-spacing:0.04em">${r.metric}</div></th>`;
      return `<tr style="background:${bg}">${rowHead}${tdCell(r.baseline2023, r.metric, false, borderTop)}${tdCell(r.baseline2024, r.metric, false, borderTop)}${tdCell(r.baseline2025, r.metric, false, borderTop)}${tdCell(r.budget2026, r.metric, false, borderTop)}${tdCell(r.otbAll, r.metric, true, borderTop)}${tdCell(r.otbMonthly, r.metric, false, borderTop)}${tdCell(r.otbMonday, r.metric, false, borderTop)}${tdCell(r.otbYesterday, r.metric, false, borderTop)}${tdCell(r.otbToday, r.metric, true, borderTop)}${tdDelta(r.pickupMonthly, r.metric, 'abs', borderTop)}${tdDelta(r.pickupWeekly, r.metric, 'abs', borderTop)}${tdDelta(r.pickupYesterday, r.metric, 'abs', borderTop)}${tdDelta(r.vsBudget, r.metric, 'abs', borderTop)}${tdDelta(r.vsBudget, r.metric, 'pct', borderTop)}${tdDelta(r.vsLy, r.metric, 'abs', borderTop)}${tdDelta(r.vsLy, r.metric, 'pct', borderTop)}${tdCell(r.sdly, r.metric, false, borderTop)}${tdDelta({ abs: r.sdlyDiff, pct: null }, r.metric, 'abs', borderTop)}</tr>`;
    }).join('');
  };
  const head1 = `<tr>${groupTh(data.asOfDate + (data.stalenessNote ? `<div style=\"font-size:10px;color:${INK_SOFT};margin-top:2px;font-style:italic;text-align:left\">${data.stalenessNote}</div>` : ''))}${groupTh('Baselines', 4)}${groupTh('OTB snapshots', 5)}${groupTh('Pickup', 3)}${groupTh('Comparison', 4)}${groupTh(`SDLY · ${data.sdlyDate}`, 2)}</tr>`;
  const head2 = `<tr>${headerTh('Period')}${headerTh('2023')}${headerTh('2024')}${headerTh('2025')}${headerTh('Budget 2026')}${headerTh('2026')}${headerTh('Monthly', data.monthlySnapshotLabel)}${headerTh('Monday', data.mondaySnapshotLabel)}${headerTh('Yesterday', data.yesterdaySnapshotLabel)}${headerTh('Today', data.todaySnapshotLabel)}${headerTh('Monthly')}${headerTh('Weekly')}${headerTh('Yesterday')}${headerTh('OTB vs Budget', undefined, 2)}${headerTh('OTB vs LY', undefined, 2)}${headerTh('SDLY value')}${headerTh('Δ vs SDLY')}</tr>`;
  const body = data.months.map((m, i) => renderBlock(m, i % 2 === 1, false)).join('') + renderBlock({ monthKey: 'TOTAL', monthLabel: 'TOTAL 2026', rows: data.total }, false, true);
  return `<div style="overflow-x:auto;border:1px solid #E0E0E0;border-radius:4px;background:${PAPER}"><table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;width:auto;font-family:inherit;font-size:10px;background:${PAPER};line-height:1.2"><thead>${head1}${head2}</thead><tbody>${body}</tbody></table></div>`;
}

function forwardOutlookHtml(pace: PaceOtbRow[], pickupMap: Map<string, DayRow>, sym: string, snapshotDate: string | null): string {
  if (pace.length === 0) return `<div style="padding:12px;color:${INK_SOFT};font-style:italic">No forward outlook data.</div>`;
  const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const fmtInt = (v: number | null | undefined) => v == null ? '' : Math.round(v).toLocaleString('en-US');
  const fmtMoney = (v: number | null | undefined) => v == null ? '' : `${Math.round(v).toLocaleString('en-US')} ${sym}`;
  const fmtPct = (v: number | null | undefined) => v == null ? '' : `${Math.round(v)}%`;
  const fmtD = (iso: string) => { const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`; };
  const pickup = (p: DayRow | undefined, kind: '1d' | '7d') => { if (!p) return { rn: 0, rev: 0, adr: 0 }; const rn = Number(p.otb_rooms_now) - Number(kind === '1d' ? p.otb_rooms_1d_ago : p.otb_rooms_7d_ago); const rev = Number(p.otb_revenue_now) - Number(kind === '1d' ? p.otb_revenue_1d_ago : p.otb_revenue_7d_ago); const adr = rn !== 0 ? rev / rn : 0; return { rn, rev, adr }; };
  const th = `padding:6px 8px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:${INK_SOFT};background:${PAPER};border-right:1px solid ${HAIRLINE};border-bottom:1px solid ${HAIRLINE};white-space:nowrap`;
  const td = `padding:4px 6px;text-align:right;font-size:11px;color:${INK};border-right:1px solid #F0EBD8;border-bottom:1px solid #F0EBD8;font-variant-numeric:tabular-nums;white-space:nowrap`;
  const byMonth = new Map<string, PaceOtbRow[]>();
  for (const r of pace) { const key = `${r.year}-${String(r.month).padStart(2, '0')}`; const arr = byMonth.get(key) ?? []; arr.push(r); byMonth.set(key, arr); }
  let rows = '';
  for (const [mk, rowsInMonth] of byMonth.entries()) {
    const totOcc = rowsInMonth.reduce((s, r) => s + Number(r.otb_rooms_sold), 0);
    const totRev = rowsInMonth.reduce((s, r) => s + Number(r.otb_revenue), 0);
    const totAvail = rowsInMonth.reduce((s, r) => s + Math.max(0, Number(r.rooms_available) - Number(r.otb_rooms_sold)), 0);
    const capSum = rowsInMonth.reduce((s, r) => s + Number(r.rooms_available), 0);
    const avgOtbPct = capSum > 0 ? (totOcc / capSum) * 100 : 0;
    const avgAdr = totOcc > 0 ? totRev / totOcc : 0;
    const p1sum = rowsInMonth.reduce((s, r) => s + pickup(pickupMap.get(r.stay_date), '1d').rn, 0);
    const p1rev = rowsInMonth.reduce((s, r) => s + pickup(pickupMap.get(r.stay_date), '1d').rev, 0);
    const p7sum = rowsInMonth.reduce((s, r) => s + pickup(pickupMap.get(r.stay_date), '7d').rn, 0);
    const p7rev = rowsInMonth.reduce((s, r) => s + pickup(pickupMap.get(r.stay_date), '7d').rev, 0);
    const [yy, mm] = mk.split('-');
    const monthLabel = new Date(Number(yy), Number(mm) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    for (const r of rowsInMonth) {
      const pu = pickupMap.get(r.stay_date);
      const p1 = pickup(pu, '1d'); const p7 = pickup(pu, '7d');
      const newBk = Number(pu?.new_bookings_2d_rn ?? 0);
      const cxl = Number(pu?.cancellations_2d_rn ?? 0);
      const dow = DOW[(r.iso_dow - 1 + 7) % 7];
      const isWeekend = r.iso_dow === 6 || r.iso_dow === 7;
      const zebra = isWeekend ? '#FBF6E8' : '#FFFFFF';
      const rowBg = cxl > 0 ? '#F5D5CE' : (Number(r.otb_rooms_sold) > 0 ? '#DFF0DE' : zebra);
      const cellStyle = `${td};background:${rowBg}`;
      const dowCell = `<td style="${cellStyle};font-weight:700;text-align:center">${dow}${newBk > 0 ? `<span style=\"margin-left:4px;color:#1F5C2C;font-weight:800\">+${newBk}</span>` : ''}${cxl > 0 ? `<span style=\"margin-left:4px;color:#B04A2F;font-weight:800\">−${cxl}</span>` : ''}</td>`;
      const avail = Math.max(0, r.rooms_available - r.otb_rooms_sold);
      rows += `<tr>${dowCell}<td style="${cellStyle}">${fmtD(r.stay_date)}</td><td style="${cellStyle};font-weight:600">${fmtPct(r.otb_occupancy_pct)}</td><td style="${cellStyle}">${fmtInt(r.otb_rooms_sold)}</td><td style="${cellStyle}">${fmtInt(avail)}</td><td style="${cellStyle}">${fmtMoney(r.otb_adr)}</td><td style="${cellStyle}">${fmtMoney(r.otb_revenue)}</td><td style="${cellStyle};color:${p1.rn===0?INK_SOFT:INK}">${p1.rn===0?'0':fmtInt(p1.rn)}</td><td style="${cellStyle};color:${p1.rev===0?INK_SOFT:INK}">${p1.rev===0?`0 ${sym}`:fmtMoney(p1.rev)}</td><td style="${cellStyle};color:${p1.rn===0?INK_SOFT:INK}">${p1.rn===0?`0 ${sym}`:fmtMoney(p1.adr)}</td><td style="${cellStyle};color:${p7.rn===0?INK_SOFT:INK}">${p7.rn===0?'0':fmtInt(p7.rn)}</td><td style="${cellStyle};color:${p7.rev===0?INK_SOFT:INK}">${p7.rev===0?`0 ${sym}`:fmtMoney(p7.rev)}</td><td style="${cellStyle};color:${p7.rn===0?INK_SOFT:INK}">${p7.rn===0?`0 ${sym}`:fmtMoney(p7.adr)}</td></tr>`;
    }
    const totalTd = `padding:6px 8px;text-align:right;font-size:11px;font-weight:800;color:#0B3B2E;border-right:1px solid ${HAIRLINE};border-top:2px solid #0B3B2E;border-bottom:2px solid #0B3B2E;background:#F8F5EA;font-variant-numeric:tabular-nums`;
    rows += `<tr style="background:#F8F5EA"><td colspan="2" style="${totalTd};text-align:left">${monthLabel} TOTAL</td><td style="${totalTd}">${fmtPct(avgOtbPct)}</td><td style="${totalTd}">${fmtInt(totOcc)}</td><td style="${totalTd}">${fmtInt(totAvail)}</td><td style="${totalTd}">${fmtMoney(avgAdr)}</td><td style="${totalTd}">${fmtMoney(totRev)}</td><td style="${totalTd}">${fmtInt(p1sum)}</td><td style="${totalTd}">${fmtMoney(p1rev)}</td><td style="${totalTd}">${fmtMoney(p1sum > 0 ? p1rev / p1sum : 0)}</td><td style="${totalTd}">${fmtInt(p7sum)}</td><td style="${totalTd}">${fmtMoney(p7rev)}</td><td style="${totalTd}">${fmtMoney(p7sum > 0 ? p7rev / p7sum : 0)}</td></tr>`;
  }
  const header = `<thead><tr style="background:#F8F5EA"><th style="${th}" colspan="2">Date</th><th style="${th}" colspan="3">Availability</th><th style="${th}" colspan="2">OTB</th><th style="${th}" colspan="3">Pickup −1d</th><th style="${th}" colspan="3">Pickup −7d</th></tr><tr style="background:${PAPER}"><th style="${th}">DoW</th><th style="${th}">Date</th><th style="${th}">OCC</th><th style="${th}">Sold</th><th style="${th}">Avail</th><th style="${th}">ADR</th><th style="${th}">Room rev</th><th style="${th}">RN</th><th style="${th}">Rev</th><th style="${th}">ADR</th><th style="${th}">RN</th><th style="${th}">Rev</th><th style="${th}">ADR</th></tr></thead>`;
  return `<div style="overflow-x:auto;border:1px solid ${HAIRLINE};border-radius:6px"><table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:10px;white-space:nowrap">${header}<tbody>${rows}</tbody></table></div>`;
}

function parityIntegrityHtml(rows: IntegrityRow[]): string {
  if (rows.length === 0) return `<div style="padding:12px;color:${INK_SOFT};font-style:italic">No parity integrity feed yet.</div>`;
  const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dayName = (iso: string) => { const d = new Date(iso + 'T00:00:00Z'); return DOW[d.getUTCDay()] || ''; };
  const fmtUsd = (v: number | null) => v == null ? '—' : `$${Math.round(v).toLocaleString('en-US')}`;
  const fmtCell = (usd: number | null, status: string | null) => status === 'sold_out' ? 'Sold out' : fmtUsd(usd);
  const fmtPct2 = (v: number | null) => v == null ? '—' : `${(Number(v) * 100).toFixed(1)}%`;
  const th = `padding:6px 8px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:${INK_SOFT};background:${PAPER_SOFT};border-right:1px solid ${HAIRLINE};border-bottom:1px solid ${HAIRLINE};white-space:nowrap`;
  const td = `padding:5px 8px;text-align:right;font-size:11px;color:${INK};border-right:1px solid ${HAIRLINE};border-bottom:1px solid ${HAIRLINE};font-variant-numeric:tabular-nums;white-space:nowrap`;
  const body = rows.map((r) => {
    const spreadPct = Number(r.spread_pct ?? 0);
    const alertBg = spreadPct >= 0.15 ? '#FBEAEA' : spreadPct >= 0.05 ? '#FDF2E1' : 'transparent';
    return `<tr style="background:${alertBg}"><td style="${td};text-align:left;font-weight:600">${dayName(r.stay_date)}</td><td style="${td};text-align:left">${fmtDmy(r.stay_date)}</td><td style="${td}">${fmtCell(r.direct_usd, r.direct_status)}</td><td style="${td}">${fmtCell(r.booking_usd, r.booking_status)}</td><td style="${td}">${fmtCell(r.expedia_usd, r.expedia_status)}</td><td style="${td}">${fmtCell(r.agoda_usd, r.agoda_status)}</td><td style="${td}">${fmtCell(r.tiket_usd, r.tiket_status)}</td><td style="${td};font-weight:600">${r.spread_usd != null ? fmtUsd(r.spread_usd) : '—'}</td><td style="${td};font-weight:600">${fmtPct2(r.spread_pct)}</td></tr>`;
  }).join('');
  const header = `<thead><tr>${['Day','Date','Brand.com','Booking.com','Expedia','Agoda','Tiket','Spread','Spread %'].map((h)=>`<th style=\"${th}\">${h}</th>`).join('')}</tr></thead>`;
  return `<div style="overflow-x:auto;border:1px solid ${HAIRLINE};border-radius:6px"><table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;background:${PAPER}">${header}<tbody>${body}</tbody></table></div>`;
}

function kpiStripe(label: string, k: KpiDay | null, ccy: string): string {
  if (!k) return `<div style="padding:12px;font-size:12px;color:${INK_SOFT};font-style:italic;background:${PAPER_SOFT};border:1px solid ${HAIRLINE};border-radius:6px">${label}: no data.</div>`;
  const cells: Array<[string,string]> = [['Rooms sold', `${k.rooms_sold ?? 0} / ${k.rooms_available ?? 0}`], ['Occupancy', pct(k.occupancy_pct)], ['ADR', money(k.adr, ccy)], ['RevPAR', money(k.revpar, ccy)], ['Rooms rev', money(k.rooms_revenue, ccy)], ['Ancillary', money(k.ancillary_revenue, ccy)], ['Total rev', money(k.total_revenue, ccy)]];
  const cellsHtml = cells.map(([lbl, val]) => `<td style=\"padding:8px 10px;border-right:1px solid ${HAIRLINE};vertical-align:top;min-width:70px\"><div style=\"font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:${INK_SOFT};margin-bottom:2px\">${lbl}</div><div style=\"font-size:13px;font-weight:700;color:${INK};font-variant-numeric:tabular-nums\">${val}</div></td>`).join('');
  return `<div style="margin-bottom:8px"><div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${INK_SOFT};margin-bottom:4px">${label} · ${k.night_date}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${HAIRLINE};background:${PAPER};border-radius:6px;overflow:hidden"><tr>${cellsHtml}</tr></table></div>`;
}

function yesterdayHighlightTile(k: KpiDay | null, ccy: string): string {
  if (!k) return '';
  const rn = k.rooms_sold ?? 0;
  const rev = k.rooms_revenue ?? 0;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${HAIRLINE};background:${HL_BAND};border-radius:6px;overflow:hidden;margin-top:6px"><tr><td style="padding:10px 12px;border-right:1px solid ${HAIRLINE};vertical-align:top"><div style="font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:${INK_SOFT};margin-bottom:2px">RN sold yesterday</div><div style="font-size:18px;font-weight:800;color:${PRIMARY};font-variant-numeric:tabular-nums">${n(rn)}</div></td><td style="padding:10px 12px;vertical-align:top"><div style="font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:${INK_SOFT};margin-bottom:2px">Revenue yesterday · bookings</div><div style="font-size:18px;font-weight:800;color:${PRIMARY};font-variant-numeric:tabular-nums">${money(rev, ccy)}</div></td></tr></table>`;
}

interface StackedBar { label: string; segments: Array<{ value: number; color: string; name: string }>; overlay?: number }
function svgStackedBars(bars: StackedBar[], width: number, height: number, opts: { showLegend?: boolean; overlayColor?: string }): string {
  const padL = 40, padR = 12, padT = 12, padB = 40;
  const w = width - padL - padR, h = height - padT - padB;
  const maxVal = Math.max(1, ...bars.map((b) => Math.max(b.segments.reduce((s, seg) => s + seg.value, 0), b.overlay ?? 0)));
  const bw = w / bars.length * 0.72, gap = w / bars.length * 0.28;
  const bars2 = bars.map((b, i) => {
    const x = padL + i * (bw + gap) + gap / 2;
    let y = padT + h;
    const rects: string[] = [];
    for (const seg of b.segments) { const sh = (seg.value / maxVal) * h; y -= sh; rects.push(`<rect x="${x}" y="${y}" width="${bw}" height="${sh}" fill="${seg.color}" />`); }
    const overlayY = padT + h - (b.overlay ?? 0) / maxVal * h;
    const overlay = b.overlay !== undefined ? `<line x1="${x - 2}" y1="${overlayY}" x2="${x + bw + 2}" y2="${overlayY}" stroke="${opts.overlayColor ?? LINE_COL}" stroke-width="2" stroke-dasharray="3,2" />` : '';
    const xLabel = `<text x="${x + bw / 2}" y="${padT + h + 14}" text-anchor="middle" font-size="8" fill="${INK_SOFT}">${b.label}</text>`;
    return rects.join('') + overlay + xLabel;
  }).join('');
  const yTicks = [0, 0.5, 1].map((f) => { const v = maxVal * f; const y = padT + h - f * h; return `<line x1="${padL - 3}" y1="${y}" x2="${padL}" y2="${y}" stroke="${INK_SOFT}" stroke-width="0.5" /><text x="${padL - 6}" y="${y + 3}" text-anchor="end" font-size="8" fill="${INK_SOFT}">${Math.round(v).toLocaleString()}</text>`; }).join('');
  let legend = '';
  if (opts.showLegend && bars.length > 0) { const items = bars[0].segments.map((s) => s.name); const colors = bars[0].segments.map((s) => s.color); const py = padT + h + 30; legend = items.map((it, idx) => { const x = padL + idx * 65; return `<rect x="${x}" y="${py - 6}" width="8" height="8" fill="${colors[idx]}" /><text x="${x + 12}" y="${py + 1}" font-size="9" fill="${INK_SOFT}">${it}</text>`; }).join(''); }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:${PAPER}"><line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + h}" stroke="${INK_SOFT}" stroke-width="0.5" /><line x1="${padL}" y1="${padT + h}" x2="${padL + w}" y2="${padT + h}" stroke="${INK_SOFT}" stroke-width="0.5" />${yTicks}${bars2}${legend}</svg>`;
}

interface LineSeries { label: string; color: string; points: Array<{ x: number; y: number }> }
function svgLineChart(series: LineSeries[], xLabels: string[], width: number, height: number): string {
  const padL = 40, padR = 12, padT = 12, padB = 40;
  const w = width - padL - padR, h = height - padT - padB;
  const xMax = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.x)));
  const yMax = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.y)));
  const yMin = Math.min(0, ...series.flatMap((s) => s.points.map((p) => p.y)));
  const xScale = (x: number) => padL + (x / xMax) * w;
  const yScale = (y: number) => padT + h - ((y - yMin) / (yMax - yMin || 1)) * h;
  const paths = series.map((s) => { const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.x).toFixed(1)} ${yScale(p.y).toFixed(1)}`).join(' '); return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" />`; }).join('');
  const xTicksEvery = Math.max(1, Math.ceil(xLabels.length / 8));
  const xTicks = xLabels.map((l, i) => (i % xTicksEvery === 0 ? `<text x="${xScale(i)}" y="${padT + h + 14}" text-anchor="middle" font-size="8" fill="${INK_SOFT}">${l}</text>` : '')).join('');
  const yTicks = [0, 0.5, 1].map((f) => { const v = yMin + (yMax - yMin) * f; const y = padT + h - f * h; return `<line x1="${padL - 3}" y1="${y}" x2="${padL}" y2="${y}" stroke="${INK_SOFT}" stroke-width="0.5" /><text x="${padL - 6}" y="${y + 3}" text-anchor="end" font-size="8" fill="${INK_SOFT}">${Math.round(v).toLocaleString()}</text>`; }).join('');
  const legend = series.map((s, idx) => { const x = padL + idx * 90; const y = padT + h + 30; return `<line x1="${x}" y1="${y - 3}" x2="${x + 12}" y2="${y - 3}" stroke="${s.color}" stroke-width="2" /><text x="${x + 16}" y="${y}" font-size="9" fill="${INK_SOFT}">${s.label}</text>`; }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:${PAPER}"><line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + h}" stroke="${INK_SOFT}" stroke-width="0.5" /><line x1="${padL}" y1="${padT + h}" x2="${padL + w}" y2="${padT + h}" stroke="${INK_SOFT}" stroke-width="0.5" />${yTicks}${paths}${xTicks}${legend}</svg>`;
}

function section(title: string, subtitle: string, inner: string): string {
  const subtitleHtml = subtitle ? `<div style="font-size:11px;color:${INK_SOFT};margin-bottom:10px">${subtitle}</div>` : `<div style="margin-bottom:10px"></div>`;
  return `<tr><td style="padding:22px 32px 6px 32px"><div style="font-size:15px;font-weight:700;color:${PRIMARY};letter-spacing:-0.01em">${title}</div>${subtitleHtml}${inner}</td></tr>`;
}

function monthlyHtmlTable(rows: MonthlyRow[], ccy: string): string {
  if (rows.length === 0) return `<div style="padding:12px;color:${INK_SOFT};font-style:italic">No monthly pickup data.</div>`;
  const th = (label: string, align: 'left'|'right' = 'left') => `<th style="padding:6px 10px;text-align:${align};font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:${INK_SOFT};font-weight:700;border-bottom:1px solid ${HAIRLINE};background:${PAPER_SOFT}">${label}</th>`;
  const td = (v: string, align: 'left'|'right' = 'left', bold = false, color = INK) => `<td style="padding:6px 10px;border-bottom:1px solid ${HAIRLINE};font-size:11px;color:${color};text-align:${align};${bold ? 'font-weight:700;' : ''}font-variant-numeric:tabular-nums">${v}</td>`;
  const body = rows.map((r) => `<tr>${td(fmtMonth(r.year, r.month))}${td(n(r.reservations), 'right')}${td(n(r.rn), 'right')}${td(money(r.rev, ccy), 'right')}${td(money(r.rev_total, ccy), 'right', true)}</tr>`).join('');
  return `<div style="overflow-x:auto"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${HAIRLINE};background:${PAPER};border-radius:6px;overflow:hidden"><thead><tr>${th('Month')}${th('Bookings','right')}${th('RN','right')}${th('Rooms rev','right')}${th('Total rev','right')}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function dayByNightHtmlTable(rows: DayRow[], ccy: string): string {
  if (rows.length === 0) return `<div style="padding:12px;color:${INK_SOFT};font-style:italic">No daily pickup data.</div>`;
  const th = (label: string, align: 'left'|'right' = 'left') => `<th style="padding:6px 8px;text-align:${align};font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:${INK_SOFT};font-weight:700;border-bottom:1px solid ${HAIRLINE};background:${PAPER_SOFT};white-space:nowrap">${label}</th>`;
  const td = (v: string, align: 'left'|'right' = 'left', bold = false, color = INK) => `<td style="padding:6px 8px;border-bottom:1px solid ${HAIRLINE};font-size:11px;color:${color};text-align:${align};${bold ? 'font-weight:700;' : ''}font-variant-numeric:tabular-nums;white-space:nowrap">${v}</td>`;
  const body = rows.map((r) => { const d1 = (r.otb_rooms_now ?? 0) - (r.otb_rooms_1d_ago ?? 0); const d7 = (r.otb_rooms_now ?? 0) - (r.otb_rooms_7d_ago ?? 0); const d1Col = d1 > 0 ? GREEN : (d1 < 0 ? RED : INK_SOFT); const d7Col = d7 > 0 ? GREEN : (d7 < 0 ? RED : INK_SOFT); return `<tr>${td(fmtDate(r.stay_date))}${td(n(r.otb_rooms_now), 'right', true)}${td((d1 >= 0 ? '+' : '') + n(d1), 'right', false, d1Col)}${td((d7 >= 0 ? '+' : '') + n(d7), 'right', false, d7Col)}${td(money(r.otb_revenue_now, ccy), 'right')}${td('+' + n(r.new_bookings_2d_rn), 'right', false, GREEN)}${td('-' + n(r.cancellations_2d_rn), 'right', false, RED)}</tr>`; }).join('');
  return `<div style="overflow-x:auto"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${HAIRLINE};background:${PAPER};border-radius:6px;overflow:hidden"><thead><tr>${th('Night')}${th('OTB','right')}${th('Δ 1d','right')}${th('Δ 7d','right')}${th('OTB rev','right')}${th('New 2d','right')}${th('Cx 2d','right')}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function buildMonthlyCsv(rows: MonthlyRow[], propertyName: string, reportDate: string): string { const lines: string[] = []; lines.push(csvEscape(`Monthly pickup · ${propertyName} · Report date ${reportDate}`)); lines.push(''); lines.push(['Year','Month','Month label','Bookings','RN','Rooms rev','Total rev'].map(csvEscape).join(',')); for (const r of rows) lines.push([r.year, r.month, fmtMonth(r.year, r.month), r.reservations, r.rn, Number(r.rev).toFixed(2), Number(r.rev_total).toFixed(2)].map(String).map(csvEscape).join(',')); return '﻿' + lines.join('\n'); }
function buildDailyCsv(rows: DayRow[], propertyName: string, reportDate: string): string { const lines: string[] = []; lines.push(csvEscape(`Daily pickup by night · ${propertyName} · Report date ${reportDate}`)); lines.push(''); lines.push(['Stay date','OTB rooms now','OTB rooms 1d ago','OTB rooms 7d ago','Δ 1d','Δ 7d','OTB rev now','OTB rev 1d ago','OTB rev 7d ago','New bookings (2d, RN)','Cancellations (2d, RN)'].map(csvEscape).join(',')); for (const r of rows) { const d1 = (r.otb_rooms_now ?? 0) - (r.otb_rooms_1d_ago ?? 0); const d7 = (r.otb_rooms_now ?? 0) - (r.otb_rooms_7d_ago ?? 0); lines.push([r.stay_date, r.otb_rooms_now, r.otb_rooms_1d_ago, r.otb_rooms_7d_ago, d1, d7, Number(r.otb_revenue_now).toFixed(2), Number(r.otb_revenue_1d_ago).toFixed(2), Number(r.otb_revenue_7d_ago).toFixed(2), r.new_bookings_2d_rn, r.cancellations_2d_rn].map(String).map(csvEscape).join(',')); } return '﻿' + lines.join('\n'); }
function b64(s: string): string { const bytes = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]); return btoa(bin); }

interface ReportContext { propertyId: number; propertyName: string; reportDate: string; ccy: string; tz: string; }
interface Bundle { html: string; attachments: Array<{ filename: string; content: string; content_type: string }> }

async function buildDailyBundle(admin: SB, ctx: ReportContext): Promise<Bundle> {
  const today = ctx.reportDate;
  const yesterday = addDaysIso(today, -1);
  const in365 = addDaysIso(today, 365);
  const sym = ctx.ccy === 'EUR' ? '€' : '$';

  const [kpis, velocity, monthly24, day60, pickupMatrix, paceForward, dayForward, integrity] = await Promise.all([
    loadKpiRange(admin, ctx.propertyId, addDaysIso(today, -2), today),
    loadVelocity(admin, ctx.propertyId),
    loadMonthly(admin, ctx.propertyId, 12, 12),
    loadDayReport(admin, ctx.propertyId, today, addDaysIso(today, 60)),
    loadPickupMatrix(admin, ctx.propertyId, sym),
    loadPaceOtb(admin, ctx.propertyId, today, in365),
    loadDayReport(admin, ctx.propertyId, today, in365),
    loadIntegrity(admin, ctx.propertyId),
  ]);
  const yesterdayK = kpis.find((r) => r.night_date === yesterday) ?? null;
  const todayK = kpis.find((r) => r.night_date === today) ?? null;
  const dayForwardMap = new Map<string, DayRow>(dayForward.map((r) => [r.stay_date, r]));

  const vel15 = velocity.slice(0, 15).reverse();
  const velBars: StackedBar[] = vel15.map((r) => ({ label: fmtDate(r.day).split(' ')[1], segments: [{ value: r.pickup_ota, color: OTA_COL, name: 'OTA' }, { value: r.pickup_direct, color: DIR_COL, name: 'Direct' }, { value: r.pickup_other, color: OTH_COL, name: 'Other' }], overlay: r.sdly_total }));
  const velChart = svgStackedBars(velBars, 720, 220, { showLegend: true, overlayColor: LINE_COL });

  const yesterdayInner = kpiStripe('Yesterday', yesterdayK, ctx.ccy) + yesterdayHighlightTile(yesterdayK, ctx.ccy);
  const pickupMatrixInner = pickupMatrix ? pickupMatrixHtml(pickupMatrix) : `<div style="padding:12px;color:${INK_SOFT};font-style:italic;background:${PAPER_SOFT};border:1px solid ${HAIRLINE};border-radius:6px">Pickup matrix unavailable — fn_pickup_asof / fn_pickup_otb_at returned no data.</div>`;
  const forwardInner = forwardOutlookHtml(paceForward, dayForwardMap, sym, null);
  const parityInner = parityIntegrityHtml(integrity);

  const body =
    section('Yesterday — actualised', `Money tiles NET (excl. tax & service charge) · anchor ${yesterday} (${ctx.tz})`, yesterdayInner) +
    section('Today', '', kpiStripe('Today', todayK, ctx.ccy)) +

    section('OTB · Pickup · Comparison · SDLY', pickupMatrix ? (pickupMatrix.stalenessNote ?? `as of ${pickupMatrix.todaySnapshotLabel}`) : 'awaiting pickup data', pickupMatrixInner) +
    section('Forward outlook by night', `${paceForward.length} nights from today · monthly totals inline · real −1d and −7d pickup from booking_date`, forwardInner) +
    section('Own-OTA rate integrity · parity', integrity[0] ? `last feed ${fmtDmy(integrity[0].shop_date)} · ${integrity.length} stay-dates · lowest available rate without fees & VAT` : 'no integrity feed yet', parityInner);

  const propertyTag = ctx.propertyName.replace(/\s+/g, '_');
  return { html: body, attachments: [{ filename: `monthly-pickup-${propertyTag}-${ctx.reportDate}.csv`, content: b64(buildMonthlyCsv(monthly24, ctx.propertyName, ctx.reportDate)), content_type: 'text/csv' }, { filename: `daily-pickup-${propertyTag}-${ctx.reportDate}.csv`, content: b64(buildDailyCsv(day60, ctx.propertyName, ctx.reportDate)), content_type: 'text/csv' }] };
}

async function buildWeeklyBundle(admin: SB, ctx: ReportContext): Promise<Bundle> {
  const today = ctx.reportDate;
  const from = addDaysIso(today, -7), to = addDaysIso(today, -1);
  const [kpis, velocity, monthly24, day60] = await Promise.all([loadKpiRange(admin, ctx.propertyId, from, to), loadVelocity(admin, ctx.propertyId), loadMonthly(admin, ctx.propertyId, 12, 12), loadDayReport(admin, ctx.propertyId, today, addDaysIso(today, 60))]);
  const seed = { rooms_available: 0, rooms_sold: 0, rooms_revenue: 0, ancillary_revenue: 0, total_revenue: 0, night_date: `${from} → ${to}`, occupancy_pct: 0, adr: 0, revpar: 0, trevpar: 0, base_currency: ctx.ccy } as unknown as KpiDay;
  const agg = kpis.reduce((s, r) => ({ ...s, rooms_available: (s.rooms_available ?? 0) + (r.rooms_available ?? 0), rooms_sold: (s.rooms_sold ?? 0) + (r.rooms_sold ?? 0), rooms_revenue: Number(s.rooms_revenue ?? 0) + Number(r.rooms_revenue ?? 0), ancillary_revenue: Number(s.ancillary_revenue ?? 0) + Number(r.ancillary_revenue ?? 0), total_revenue: Number(s.total_revenue ?? 0) + Number(r.total_revenue ?? 0) }), seed);
  const avail = Number(agg.rooms_available) || 1;
  agg.occupancy_pct = Number(agg.rooms_sold) / avail * 100;
  agg.adr = Number(agg.rooms_sold) > 0 ? Number(agg.rooms_revenue) / Number(agg.rooms_sold) : 0;
  agg.revpar = Number(agg.rooms_revenue) / avail;
  agg.trevpar = Number(agg.total_revenue) / avail;
  const velBars: StackedBar[] = velocity.slice(0, 30).reverse().map((r) => ({ label: fmtDate(r.day).split(' ')[1], segments: [{ value: r.pickup_ota, color: OTA_COL, name: 'OTA' }, { value: r.pickup_direct, color: DIR_COL, name: 'Direct' }, { value: r.pickup_other, color: OTH_COL, name: 'Other' }], overlay: r.sdly_total }));
  const velChart = svgStackedBars(velBars, 720, 220, { showLegend: true });
  const monthBars: StackedBar[] = monthly24.map((r) => ({ label: fmtMonth(r.year, r.month), segments: [{ value: Number(r.rev), color: PRIMARY, name: 'Rooms rev' }] }));
  const monthChart = svgStackedBars(monthBars, 720, 220, { showLegend: false });
  const day28 = day60.slice(0, 28);
  const otbSeries: LineSeries = { label: 'OTB rooms', color: PRIMARY, points: day28.map((r, i) => ({ x: i, y: r.otb_rooms_now })) };
  const xLabels = day28.map((r) => fmtDate(r.stay_date).split(' ')[1]);
  const dayChart = svgLineChart([otbSeries], xLabels, 720, 220);
  const body = `${section('Last 7 days · aggregate', `Rolling week ${from} → ${to} · anchor ${today} (${ctx.tz})`, kpiStripe('Week', agg, ctx.ccy))}${section('Pickup velocity · last 30 days', `Stacked bars TY · dashed SDLY overlay`, `<div style="border:1px solid ${HAIRLINE};border-radius:6px;background:${PAPER};padding:6px">${velChart}</div>`)}${section('Monthly pickup matrix · last 12 + next 12 (24 months, FULL TABLE)', `Bar chart above · complete row-per-month table below (${ctx.ccy})`, `<div style="border:1px solid ${HAIRLINE};border-radius:6px;background:${PAPER};padding:6px;margin-bottom:10px">${monthChart}</div>${monthlyHtmlTable(monthly24, ctx.ccy)}`)}${section('Daily pickup by night · next 60 nights (FULL TABLE)', `Line chart above (28 nights) · complete row-per-night table below (60 nights)`, `<div style="border:1px solid ${HAIRLINE};border-radius:6px;background:${PAPER};padding:6px;margin-bottom:10px">${dayChart}</div>${dayByNightHtmlTable(day60, ctx.ccy)}`)}<tr><td style="padding:14px 32px;font-size:11px;color:${INK_SOFT};background:${PAPER_SOFT};border-top:1px dashed ${HAIRLINE}">Same monthly + daily tables also attached as CSV.</td></tr>`;
  const propertyTag = ctx.propertyName.replace(/\s+/g, '_');
  return { html: body, attachments: [{ filename: `monthly-pickup-${propertyTag}-${ctx.reportDate}.csv`, content: b64(buildMonthlyCsv(monthly24, ctx.propertyName, ctx.reportDate)), content_type: 'text/csv' }, { filename: `daily-pickup-${propertyTag}-${ctx.reportDate}.csv`, content: b64(buildDailyCsv(day60, ctx.propertyName, ctx.reportDate)), content_type: 'text/csv' }] };
}

async function buildMonthlyBundle(admin: SB, ctx: ReportContext): Promise<Bundle> {
  const today = ctx.reportDate;
  const monthStart = today.slice(0, 8) + '01';
  const [kpis, velocity, monthly24, day60] = await Promise.all([loadKpiRange(admin, ctx.propertyId, monthStart, addDaysIso(today, -1)), loadVelocity(admin, ctx.propertyId), loadMonthly(admin, ctx.propertyId, 12, 12), loadDayReport(admin, ctx.propertyId, monthStart, addDaysIso(monthStart, 60))]);
  const seed = { rooms_available: 0, rooms_sold: 0, rooms_revenue: 0, ancillary_revenue: 0, total_revenue: 0, night_date: `${monthStart} → ${addDaysIso(today, -1)}`, occupancy_pct: 0, adr: 0, revpar: 0, trevpar: 0, base_currency: ctx.ccy } as unknown as KpiDay;
  const agg = kpis.reduce((s, r) => ({ ...s, rooms_available: (s.rooms_available ?? 0) + (r.rooms_available ?? 0), rooms_sold: (s.rooms_sold ?? 0) + (r.rooms_sold ?? 0), rooms_revenue: Number(s.rooms_revenue ?? 0) + Number(r.rooms_revenue ?? 0), ancillary_revenue: Number(s.ancillary_revenue ?? 0) + Number(r.ancillary_revenue ?? 0), total_revenue: Number(s.total_revenue ?? 0) + Number(r.total_revenue ?? 0) }), seed);
  const avail = Number(agg.rooms_available) || 1;
  agg.occupancy_pct = Number(agg.rooms_sold) / avail * 100;
  agg.adr = Number(agg.rooms_sold) > 0 ? Number(agg.rooms_revenue) / Number(agg.rooms_sold) : 0;
  agg.revpar = Number(agg.rooms_revenue) / avail;
  agg.trevpar = Number(agg.total_revenue) / avail;
  const velBars: StackedBar[] = velocity.slice(0, 30).reverse().map((r) => ({ label: fmtDate(r.day).split(' ')[1], segments: [{ value: r.pickup_ota, color: OTA_COL, name: 'OTA' }, { value: r.pickup_direct, color: DIR_COL, name: 'Direct' }, { value: r.pickup_other, color: OTH_COL, name: 'Other' }], overlay: r.sdly_total }));
  const velChart = svgStackedBars(velBars, 720, 220, { showLegend: true });
  const monthBars: StackedBar[] = monthly24.map((r) => ({ label: fmtMonth(r.year, r.month), segments: [{ value: Number(r.rev), color: PRIMARY, name: 'Rooms rev' }] }));
  const monthChart = svgStackedBars(monthBars, 720, 220, { showLegend: false });
  const otbSeries: LineSeries = { label: 'OTB rooms', color: PRIMARY, points: day60.map((r, i) => ({ x: i, y: r.otb_rooms_now })) };
  const xLabels = day60.map((r) => fmtDate(r.stay_date).split(' ')[1]);
  const dayChart = svgLineChart([otbSeries], xLabels, 720, 220);
  const body = `${section('Month-to-date · aggregate', `${monthStart} → ${addDaysIso(today, -1)} · anchor ${today} (${ctx.tz})`, kpiStripe('MTD', agg, ctx.ccy))}${section('Pickup velocity · last 30 days', `Stacked bars TY · dashed SDLY overlay`, `<div style="border:1px solid ${HAIRLINE};border-radius:6px;background:${PAPER};padding:6px">${velChart}</div>`)}${section('Monthly pickup matrix · last 12 + next 12 (24 months, FULL TABLE)', `Bar chart above · complete row-per-month table below (${ctx.ccy})`, `<div style="border:1px solid ${HAIRLINE};border-radius:6px;background:${PAPER};padding:6px;margin-bottom:10px">${monthChart}</div>${monthlyHtmlTable(monthly24, ctx.ccy)}`)}${section('Daily pickup by night · next 60 nights from month start (FULL TABLE)', `Line chart above · complete row-per-night table below`, `<div style="border:1px solid ${HAIRLINE};border-radius:6px;background:${PAPER};padding:6px;margin-bottom:10px">${dayChart}</div>${dayByNightHtmlTable(day60, ctx.ccy)}`)}<tr><td style="padding:14px 32px;font-size:11px;color:${INK_SOFT};background:${PAPER_SOFT};border-top:1px dashed ${HAIRLINE}">Same monthly + daily tables also attached as CSV.</td></tr>`;
  const propertyTag = ctx.propertyName.replace(/\s+/g, '_');
  return { html: body, attachments: [{ filename: `monthly-pickup-${propertyTag}-${ctx.reportDate}.csv`, content: b64(buildMonthlyCsv(monthly24, ctx.propertyName, ctx.reportDate)), content_type: 'text/csv' }, { filename: `daily-pickup-${propertyTag}-${ctx.reportDate}.csv`, content: b64(buildDailyCsv(day60, ctx.propertyName, ctx.reportDate)), content_type: 'text/csv' }] };
}

function renderShell(ctx: ReportContext, cadenceLabel: string, subject: string, body: string): string { return `<!doctype html><html><head><meta charset="utf-8"><title>${subject}</title></head><body style="margin:0;padding:0;background:#FFFFFF;font-family:-apple-system,'SF Pro Text',Helvetica,Arial,sans-serif;color:${INK}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:840px;margin:0 auto;background:${PAPER}"><tr><td style="padding:28px 32px 14px 32px;border-bottom:1px solid ${HAIRLINE}"><div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${INK_SOFT};margin-bottom:4px">${cadenceLabel}</div><div style="font-size:22px;font-weight:700;color:${PRIMARY};letter-spacing:-0.01em">${ctx.propertyName}</div><div style="font-size:12px;color:${INK_SOFT};margin-top:2px">Report date: <strong style=\"color:${INK}\">${ctx.reportDate}</strong> · Hotel local time (${ctx.tz}) · Delivered by TBC Revenue Management</div></td></tr>${body}</table></body></html>`; }

async function sendViaResend(opts: { to: string; name?: string | null; subject: string; html: string; attachments?: Array<{ filename: string; content: string; content_type?: string }>; meta?: unknown }): Promise<{ status: string; error?: string }> {
  try {
    const url = `${SUPABASE_URL}/functions/v1/send-report-email`;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` }, body: JSON.stringify({ to: opts.to, name: opts.name, subject: opts.subject, html: opts.html, attachments: opts.attachments, meta: opts.meta }) });
    if (!res.ok) return { status: 'error', error: `send-report-email HTTP ${res.status}` };
    return { status: 'sent' };
  } catch (e) { return { status: 'error', error: String((e as Error).message ?? e) }; }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  try {
    const body = await req.json().catch(() => ({}));
    const propertyId = Number(body.property_id);
    const templateKey = String(body.template_key ?? '');
    const send = Boolean(body.send);
    if (!Number.isFinite(propertyId) || !['daily','weekly','monthly'].includes(templateKey)) return new Response(JSON.stringify({ error: 'invalid property_id or template_key' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const tz = tzFor(propertyId);
    const reportDate = todayIsoInTz(tz);
    const propertyName = await loadPropertyName(admin, propertyId);
    const ccy = 'USD';
    const ctx: ReportContext = { propertyId, propertyName, reportDate, ccy, tz };
    let bundle: Bundle;
    if (templateKey === 'daily') bundle = await buildDailyBundle(admin, ctx);
    else if (templateKey === 'weekly') bundle = await buildWeeklyBundle(admin, ctx);
    else bundle = await buildMonthlyBundle(admin, ctx);
    const cadenceLabel = CADENCE_LABEL[templateKey];
    const subject = `Revenue · ${cadenceLabel} · ${propertyName} · ${reportDate}`;
    const html = renderShell(ctx, cadenceLabel, subject, bundle.html);
    if (!send) return new Response(JSON.stringify({ subject, html, property_name: propertyName, report_date: reportDate, attachment_count: bundle.attachments.length }), { headers: { 'Content-Type': 'application/json' } });
    const { data: recips, error: recipErr } = await admin.from('v_revenue_report_recipients').select('id,email,name,active,property_id,template_key').eq('property_id', propertyId).eq('template_key', templateKey).eq('active', true);
    if (recipErr) throw recipErr;
    const sent: Array<{ recipient_email: string; status: string; send_id?: number; error?: string }> = [];
    for (const r of (recips ?? [])) {
      const rec = r as { id: number; email: string; name: string | null };
      const { data: ins, error: insErr } = await admin.schema('documentation').from('revenue_report_sends').insert({ property_id: propertyId, template_key: templateKey, recipient_email: rec.email, subject, html_snapshot: html, status: 'queued' }).select('id').single();
      const sendId = (ins as { id: number } | null)?.id;
      if (insErr) { sent.push({ recipient_email: rec.email, status: 'error', error: insErr.message }); continue; }
      const result = await sendViaResend({ to: rec.email, name: rec.name, subject, html, attachments: bundle.attachments, meta: { property_id: propertyId, template_key: templateKey, send_id: sendId } });
      if (sendId) await admin.schema('documentation').from('revenue_report_sends').update({ status: result.status, error: result.error ?? null }).eq('id', sendId);
      sent.push({ recipient_email: rec.email, status: result.status, send_id: sendId, error: result.error });
    }
    return new Response(JSON.stringify({ subject, property_name: propertyName, report_date: reportDate, sent, sent_count: sent.length, attachment_count: bundle.attachments.length }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
