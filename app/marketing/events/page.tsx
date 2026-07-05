// app/marketing/events/page.tsx
// PBS 2026-07-05: Migrated to new paper-white design (DashboardPage + KpiTile
// + MARKETING_SUBPAGES tabs). Same data source: marketing.calendar_events.
// Preserves 3-view sub-strip: Calendar · List · Impact.

import Link from 'next/link';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fmtIsoDate } from '@/lib/format';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const INK_S = '#3A3A3A';
const FOREST = '#084838';
const RED    = '#B03826';
const CREAM  = '#F5F0E1';
const AMBER  = '#C28F2C';

interface EventRow {
  event_id: string;
  type_code: string | null;
  date_start: string;
  date_end: string | null;
  buildup_start: string | null;
  display_name: string;
  demand_score_override: number | null;
  source_markets: string[] | null;
  applies_to_rate_shop: boolean | null;
  applies_to_marketing: boolean | null;
  applies_to_content: boolean | null;
  applies_to_fnb: boolean | null;
  applies_to_retreat: boolean | null;
  marketing_brief: string | null;
  hashtags: string[] | null;
  is_confirmed: boolean | null;
  notes: string | null;
}

async function getEvents(): Promise<EventRow[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .schema('marketing')
    .from('calendar_events')
    .select('event_id,type_code,date_start,date_end,buildup_start,display_name,demand_score_override,source_markets,applies_to_rate_shop,applies_to_marketing,applies_to_content,applies_to_fnb,applies_to_retreat,marketing_brief,hashtags,is_confirmed,notes')
    .order('date_start', { ascending: true })
    .limit(500);
  return (data ?? []) as EventRow[];
}

type View = 'calendar' | 'list' | 'impact';
function parseView(v: string | string[] | undefined): View {
  const s = typeof v === 'string' ? v : 'calendar';
  return (['calendar', 'list', 'impact'] as string[]).includes(s) ? (s as View) : 'calendar';
}
function parseYear(v: string | string[] | undefined): number {
  const n = Number(typeof v === 'string' ? v : NaN);
  return Number.isFinite(n) && n >= 2024 && n <= 2030 ? n : new Date().getUTCFullYear();
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}
function firstDowMon0(year: number, monthIndex0: number): number {
  const js = new Date(Date.UTC(year, monthIndex0, 1)).getUTCDay();
  return (js + 6) % 7;
}
function weekday(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { weekday: 'short' });
}

type Dept = 'rate' | 'marketing' | 'content' | 'fnb' | 'retreat' | 'unset';
function primaryDept(e: EventRow): Dept {
  if (e.applies_to_retreat)   return 'retreat';
  if (e.applies_to_fnb)       return 'fnb';
  if (e.applies_to_rate_shop) return 'rate';
  if (e.applies_to_marketing) return 'marketing';
  if (e.applies_to_content)   return 'content';
  return 'unset';
}
const DEPT_COLOR: Record<Dept, string> = {
  rate:      FOREST,
  marketing: '#5DA46B',
  content:   '#3E8DBE',
  fnb:       RED,
  retreat:   AMBER,
  unset:     INK_M,
};
const DEPT_LABEL: Record<Dept, string> = {
  rate: 'Rate-shop', marketing: 'Marketing', content: 'Content',
  fnb: 'F&B', retreat: 'Retreat', unset: 'Unset',
};

function eventsByDate(events: EventRow[]): Map<string, EventRow[]> {
  const out = new Map<string, EventRow[]>();
  for (const e of events) {
    const start = new Date(e.date_start + 'T00:00:00Z');
    const end = new Date((e.date_end ?? e.date_start) + 'T00:00:00Z');
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      const arr = out.get(iso) ?? [];
      arr.push(e);
      out.set(iso, arr);
    }
  }
  return out;
}

interface EventAgent { name: string; desc: string; signal: string }
const AGENTS: EventAgent[] = [
  { name: 'Event Scout',       desc: 'Surfaces upcoming local festivals, congresses, fairs and ICP-relevant cultural events.',           signal: '7 candidates' },
  { name: 'Demand Modeler',    desc: 'Estimates the demand-score override based on prior years, source-market signals and seasonality.', signal: '12 modeled' },
  { name: 'Rate-shop Trigger', desc: 'When an event is high-demand, flags Revenue to lift rates + pull min-LOS.',                         signal: '4 lifts' },
  { name: 'Marketing Brief',   desc: 'Drafts the marketing brief: hook + pillar + ICP + hashtags + post timing.',                         signal: '11 briefs' },
  { name: 'Content Architect', desc: 'Builds blog posts + IG carousels + reels tied to the event narrative.',                             signal: '8 outlines' },
  { name: 'F&B Planner',       desc: 'Special menus + drink pairings + sourcing for event days.',                                         signal: '5 menus' },
  { name: 'Retreat Planner',   desc: 'Aligns retreat schedules with major events (Songkran / Tết / Full Moon).',                          signal: '3 retreats' },
  { name: 'Reality & Brand',   desc: 'Ensures event narrative + visuals match the actual resort + Lao cultural reality.',                signal: '0 flags' },
];

interface Props { searchParams?: { view?: string; y?: string; dept?: string } }

export default async function EventsCockpitPage({ searchParams }: Props) {
  const events = await getEvents();
  const view = parseView(searchParams?.view);
  const year = parseYear(searchParams?.y);
  const deptFilter = (typeof searchParams?.dept === 'string' ? searchParams.dept : 'all') as Dept | 'all';

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const upcoming = events.filter((e) => new Date(e.date_start) >= today);
  const next7  = upcoming.filter((e) => new Date(e.date_start).getTime() <= today.getTime() + 7  * 86_400_000).length;
  const next30 = upcoming.filter((e) => new Date(e.date_start).getTime() <= today.getTime() + 30 * 86_400_000).length;
  const next90 = upcoming.filter((e) => new Date(e.date_start).getTime() <= today.getTime() + 90 * 86_400_000).length;
  const confirmed = events.filter((e) => e.is_confirmed).length;
  const high = events.filter((e) => (e.demand_score_override ?? 0) >= 80).length;

  const yearEvents = events.filter((e) => e.date_start.startsWith(`${year}-`));
  const filtered = deptFilter === 'all' ? yearEvents : yearEvents.filter((e) => primaryDept(e) === deptFilter);
  const byDate = eventsByDate(filtered);

  const deptCounts: Record<Dept, number> = { rate: 0, marketing: 0, content: 0, fnb: 0, retreat: 0, unset: 0 };
  for (const e of yearEvents) {
    if (e.applies_to_rate_shop) deptCounts.rate++;
    if (e.applies_to_marketing) deptCounts.marketing++;
    if (e.applies_to_content)   deptCounts.content++;
    if (e.applies_to_fnb)       deptCounts.fnb++;
    if (e.applies_to_retreat)   deptCounts.retreat++;
  }
  const marketCounts = new Map<string, number>();
  for (const e of yearEvents) {
    for (const m of (e.source_markets ?? [])) marketCounts.set(m, (marketCounts.get(m) ?? 0) + 1);
  }
  const topMarkets = Array.from(marketCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const yearsAvailable = Array.from(new Set(events.map((e) => Number(e.date_start.slice(0, 4))))).sort();

  const qs = (v: View, y: number, dept: Dept | 'all') =>
    `?view=${v}&y=${y}${dept === 'all' ? '' : `&dept=${dept}`}`;

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s: any) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/library', // Info hub owns events
  }));

  const tiles: KpiTileProps[] = [
    { label: 'Total events',   value: events.length,   size: 'sm', footnote: 'marketing.calendar_events' },
    { label: 'Upcoming',       value: upcoming.length, size: 'sm', footnote: 'date_start ≥ today' },
    { label: 'Next 7 days',    value: next7,           size: 'sm' },
    { label: 'Next 30 days',   value: next30,          size: 'sm', footnote: 'briefing window' },
    { label: 'Next 90 days',   value: next90,          size: 'sm', footnote: 'retreat planning' },
    { label: 'Confirmed',      value: confirmed,       size: 'sm', footnote: 'is_confirmed=true' },
    { label: 'High demand',    value: high,            size: 'sm', footnote: 'score ≥ 80' },
  ];

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="Marketing · Events"
        subtitle={`${events.length} events · ${upcoming.length} upcoming · calendar-first cockpit`}
        tabs={tabs}
      >
        {/* KPI band */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        {/* Sub-strip */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 8, borderBottom: `1px solid ${HAIR}` }}>
          {(['calendar', 'list', 'impact'] as View[]).map((v) => (
            <a key={v} href={qs(v, year, deptFilter)}
               style={{ ...subLinkSt, ...(v === view ? subLinkActiveSt : {}) }}>
              {v === 'calendar' ? 'Calendar' : v === 'list' ? 'List' : 'Impact'}
            </a>
          ))}
        </div>

        {view === 'calendar' && (
          <Section title={`${year} · calendar`} note={`${filtered.length} events${deptFilter === 'all' ? '' : ` · ${DEPT_LABEL[deptFilter as Dept]}`}`}>
            {/* Year + dept filter row */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={filterLabelSt}>Year</span>
                {yearsAvailable.map((y) => (
                  <a key={y} href={qs(view, y, deptFilter)}
                     style={{ ...chipSt, ...(y === year ? chipActiveSt : {}) }}>{y}</a>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={filterLabelSt}>Drives</span>
                <a href={qs(view, year, 'all')} style={{ ...chipSt, ...(deptFilter === 'all' ? chipActiveSt : {}) }}>All</a>
                {(['rate', 'marketing', 'content', 'fnb', 'retreat'] as Dept[]).map((d) => (
                  <a key={d} href={qs(view, year, d)}
                     style={{ ...chipSt, ...(deptFilter === d ? chipActiveSt : {}) }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: DEPT_COLOR[d], marginRight: 4 }} />
                    {DEPT_LABEL[d]}
                  </a>
                ))}
              </div>
            </div>

            {/* 12-month grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {Array.from({ length: 12 }, (_, m) => (
                <MonthCard key={m} year={year} monthIndex0={m} byDate={byDate} todayIso={todayIso} />
              ))}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
              {(['rate', 'marketing', 'content', 'fnb', 'retreat'] as Dept[]).map((d) => (
                <span key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: DEPT_COLOR[d] }} />
                  <span style={legendLabelSt}>{DEPT_LABEL[d]}</span>
                </span>
              ))}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'transparent', border: `1px dashed ${FOREST}` }} />
                <span style={legendLabelSt}>Tentative</span>
              </span>
            </div>
          </Section>
        )}

        {view === 'list' && <ListView events={upcoming} />}

        {view === 'impact' && (
          <ImpactView events={yearEvents} deptCounts={deptCounts} topMarkets={topMarkets} year={year} />
        )}

        {/* Agent fleet */}
        <Section title="Agent fleet" note={`${AGENTS.length} event specialists`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
            {AGENTS.map((a) => (
              <div key={a.name} style={agentCardSt}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>{a.name}</span>
                  <span style={signalPillSt}>{a.signal}</span>
                </div>
                <div style={{ fontSize: 11, color: INK_M, lineHeight: 1.5, marginTop: 4 }}>{a.desc}</div>
              </div>
            ))}
          </div>
        </Section>

        <div style={{ gridColumn: '1 / -1', padding: '10px 12px', fontSize: 11, color: INK_M, fontStyle: 'italic', borderTop: `1px solid ${HAIR}` }}>
          Source: <code>marketing.calendar_events</code>. Calendar dots are colored by the event&apos;s primary department impact.{' '}
          <Link href="/marketing/library" style={{ color: FOREST }}>media library</Link> ·{' '}
          <Link href="/marketing/campaigns" style={{ color: FOREST }}>campaigns</Link>
        </div>
      </DashboardPage>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ gridColumn: '1 / -1', background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{title}</div>
        {note && <div style={{ fontSize: 10, color: INK_M, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{note}</div>}
      </div>
      {children}
    </div>
  );
}

function MonthCard({ year, monthIndex0, byDate, todayIso }: { year: number; monthIndex0: number; byDate: Map<string, EventRow[]>; todayIso: string }) {
  const days = daysInMonth(year, monthIndex0);
  const startDow = firstDowMon0(year, monthIndex0);

  const cells: Array<{ day: number | null; iso: string | null }> = [];
  for (let i = 0; i < startDow; i++) cells.push({ day: null, iso: null });
  for (let d = 1; d <= days; d++) {
    const iso = `${year}-${String(monthIndex0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, iso });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, iso: null });

  const monthEvents = Array.from(byDate.values()).flat().filter((e) =>
    e.date_start.startsWith(`${year}-${String(monthIndex0 + 1).padStart(2, '0')}-`)
  );
  const seen = new Set<string>();
  const uniqueMonthEvents: EventRow[] = [];
  for (const e of monthEvents) { if (!seen.has(e.event_id)) { seen.add(e.event_id); uniqueMonthEvents.push(e); } }

  return (
    <div style={{ background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: FOREST, fontWeight: 700 }}>
        <span>{MONTH_NAMES[monthIndex0]} {year}</span>
        <span style={{ color: INK_M, fontSize: 9 }}>{uniqueMonthEvents.length || '—'}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {DOW_LABELS.map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 9, color: INK_M, padding: '2px 0' }}>{d}</div>)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {cells.map((c, i) => {
          if (!c.day) return <div key={i} style={{ height: 26 }} />;
          const dayEvents = c.iso ? byDate.get(c.iso) ?? [] : [];
          const isToday = c.iso === todayIso;
          const dot = dayEvents.length > 0 ? primaryDept(dayEvents[0]) : undefined;
          const tentative = dayEvents.length > 0 && dayEvents.every((e) => e.is_confirmed === false);
          const tip = dayEvents.length > 0 ? dayEvents.map((e) => e.display_name).join('\n') : undefined;

          return (
            <div key={i} title={tip} style={{
              height: 26,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, borderRadius: 3,
              background: dot ? DEPT_COLOR[dot] : 'transparent',
              color: dot ? '#fff' : INK,
              fontWeight: (dayEvents.length > 0 || isToday) ? 600 : 400,
              border: isToday ? `1px solid ${INK}` : tentative ? `1px dashed ${FOREST}` : '1px solid transparent',
            }}>
              {c.day}
            </div>
          );
        })}
      </div>

      {uniqueMonthEvents.length > 0 && (
        <ul style={{ margin: '4px 0 0', paddingLeft: 0, listStyle: 'none', borderTop: `1px solid ${HAIR}`, paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {uniqueMonthEvents.slice(0, 6).map((e) => (
            <li key={e.event_id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, lineHeight: 1.4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: DEPT_COLOR[primaryDept(e)] }} />
              <span style={{ fontSize: 10, color: INK_M, minWidth: 18 }}>{e.date_start.slice(8, 10)}</span>
              <span style={{ color: INK, flex: 1 }}>{e.display_name}</span>
              {(e.demand_score_override ?? 0) >= 80 && <span style={{ fontSize: 8, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, color: FOREST, border: `1px solid ${FOREST}`, padding: '0 3px', borderRadius: 2 }}>HIGH</span>}
            </li>
          ))}
          {uniqueMonthEvents.length > 6 && (
            <li style={{ fontSize: 10, color: INK_M, textAlign: 'right' }}>+{uniqueMonthEvents.length - 6} more</li>
          )}
        </ul>
      )}
    </div>
  );
}

function ListView({ events }: { events: EventRow[] }) {
  const byMonth = new Map<string, EventRow[]>();
  for (const e of events) {
    const k = new Date(e.date_start).toLocaleString('en-GB', { year: 'numeric', month: 'long' });
    (byMonth.get(k) ?? byMonth.set(k, []).get(k)!).push(e);
  }
  if (byMonth.size === 0) {
    return (
      <Section title="No upcoming events">
        <div style={{ padding: 24, color: INK_M, fontStyle: 'italic', textAlign: 'center' }}>
          Nothing scheduled. Add events to <code>marketing.calendar_events</code>.
        </div>
      </Section>
    );
  }
  return (
    <>
      {Array.from(byMonth.entries()).map(([month, rows]) => (
        <Section key={month} title={month} note={`${rows.length} event${rows.length === 1 ? '' : 's'}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rows.map((e) => (
              <div key={e.event_id} style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 14, padding: '10px 12px', background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 4 }}>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: FOREST, fontWeight: 700 }}>
                    {weekday(e.date_start)} {new Date(e.date_start).toLocaleString('en-GB', { day: '2-digit', month: 'short' })}
                  </div>
                  {e.date_end && e.date_end !== e.date_start && (
                    <div style={{ fontSize: 10, color: INK_M, marginTop: 2 }}>→ {fmtIsoDate(e.date_end)}</div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ color: INK }}>{e.display_name}</strong>
                    {e.type_code && <span style={typeChipSt}>{e.type_code}</span>}
                    {e.is_confirmed === false && <span style={tentativeChipSt}>tentative</span>}
                    {(e.demand_score_override ?? 0) >= 80 && <span style={highChipSt}>high demand</span>}
                  </div>
                  {e.marketing_brief && <div style={{ fontSize: 12, color: INK_S, lineHeight: 1.5 }}>{e.marketing_brief}</div>}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {e.applies_to_rate_shop  && <span style={deptChipSt('rate')}>Rate</span>}
                    {e.applies_to_marketing  && <span style={deptChipSt('marketing')}>Marketing</span>}
                    {e.applies_to_content    && <span style={deptChipSt('content')}>Content</span>}
                    {e.applies_to_fnb        && <span style={deptChipSt('fnb')}>F&amp;B</span>}
                    {e.applies_to_retreat    && <span style={deptChipSt('retreat')}>Retreat</span>}
                  </div>
                  {e.source_markets && e.source_markets.length > 0 && (
                    <div style={{ fontSize: 11, color: INK_M, letterSpacing: '0.08em' }}>Source: {e.source_markets.join(' · ')}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}

function ImpactView({ events, deptCounts, topMarkets, year }: { events: EventRow[]; deptCounts: Record<Dept, number>; topMarkets: Array<[string, number]>; year: number }) {
  const highDemand = events.filter((e) => (e.demand_score_override ?? 0) >= 80);
  return (
    <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 340px)', gap: 12, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 10 }}>Department impact · {year}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['rate', 'marketing', 'content', 'fnb', 'retreat'] as Dept[]).map((d) => {
              const max = Math.max(...Object.values(deptCounts), 1);
              const pct = Math.round((deptCounts[d] / max) * 100);
              return (
                <div key={d} style={{ display: 'grid', gridTemplateColumns: '12px 110px 1fr 40px', gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: DEPT_COLOR[d] }} />
                  <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK }}>{DEPT_LABEL[d]}</span>
                  <div style={{ height: 8, background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: DEPT_COLOR[d] }} />
                  </div>
                  <strong style={{ fontSize: 12, color: INK, textAlign: 'right' }}>{deptCounts[d]}</strong>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 10 }}>High-demand events</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {highDemand.map((e) => (
              <div key={e.event_id} style={{ background: CREAM, border: `1px solid ${HAIR}`, borderLeft: `3px solid ${FOREST}`, borderRadius: 6, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 14, color: INK, fontWeight: 600 }}>{e.display_name}</span>
                  <span style={{ fontSize: 14, color: FOREST, fontWeight: 700 }}>{e.demand_score_override}</span>
                </div>
                <div style={{ fontSize: 11, letterSpacing: '0.08em', color: INK_M }}>
                  {e.date_start}{e.date_end && e.date_end !== e.date_start ? ` → ${e.date_end}` : ''} · {DEPT_LABEL[primaryDept(e)]}
                </div>
                {e.marketing_brief && <div style={{ fontSize: 12, color: INK_S, lineHeight: 1.5 }}>{e.marketing_brief}</div>}
              </div>
            ))}
            {highDemand.length === 0 && <div style={{ color: INK_M, fontStyle: 'italic' }}>No high-demand events scored ≥ 80 in {year}.</div>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 10 }}>Top source markets</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {topMarkets.map(([m, c]) => (
              <div key={m} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', borderBottom: `1px solid ${HAIR}` }}>
                <span style={{ fontSize: 11, letterSpacing: '0.08em', color: INK }}>{m}</span>
                <strong style={{ fontSize: 12, color: FOREST }}>{c}</strong>
              </div>
            ))}
            {topMarkets.length === 0 && <div style={{ color: INK_M, fontStyle: 'italic' }}>No source markets tagged.</div>}
          </div>
        </div>

        <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 10 }}>Guardrails</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Callout tone="brass">High-demand events (≥80) auto-flag Revenue to lift rates + raise min-LOS.</Callout>
            <Callout tone="soft">Marketing-applicable events generate post calendar entries 30 days ahead in Social cockpit.</Callout>
            <Callout tone="soft">Retreat-applicable events propose retreat scheduling in Compiler.</Callout>
            <Callout tone="warn">Tentative events (is_confirmed=false) are forecast only. Don&apos;t broadcast until confirmed.</Callout>
          </div>
        </div>
      </div>
    </div>
  );
}

function Callout({ tone, children }: { tone: 'brass' | 'soft' | 'warn'; children: React.ReactNode }) {
  const border = tone === 'brass' ? FOREST : tone === 'warn' ? AMBER : HAIR;
  return (
    <div style={{ padding: '6px 8px', borderLeft: `2px solid ${border}`, background: CREAM, fontSize: 11, lineHeight: 1.5, color: INK_S }}>
      {children}
    </div>
  );
}

function deptChipSt(d: Dept): React.CSSProperties {
  return {
    fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
    padding: '1px 6px', borderRadius: 3,
    border: `1px solid ${DEPT_COLOR[d]}`, color: DEPT_COLOR[d],
  };
}

const subLinkSt: React.CSSProperties = {
  padding: '6px 12px', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase',
  color: INK_M, border: `1px solid ${HAIR}`, borderRadius: 3, textDecoration: 'none', background: WHITE, fontWeight: 600,
};
const subLinkActiveSt: React.CSSProperties = {
  color: WHITE, background: FOREST, borderColor: FOREST,
};
const filterLabelSt: React.CSSProperties = { fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: FOREST, fontWeight: 700 };
const chipSt: React.CSSProperties = { padding: '3px 9px', fontSize: 11, letterSpacing: '0.06em', color: INK, background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 999, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' };
const chipActiveSt: React.CSSProperties = { color: WHITE, background: FOREST, borderColor: FOREST, fontWeight: 700 };
const legendLabelSt: React.CSSProperties = { fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_M };
const agentCardSt: React.CSSProperties = { background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '8px 10px' };
const signalPillSt: React.CSSProperties = { fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: FOREST, border: `1px solid ${FOREST}`, padding: '1px 5px', borderRadius: 2 };
const typeChipSt: React.CSSProperties = { background: WHITE, color: INK_M, padding: '1px 6px', borderRadius: 3, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', border: `1px solid ${HAIR}` };
const tentativeChipSt: React.CSSProperties = { background: CREAM, color: AMBER, padding: '1px 6px', borderRadius: 3, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, border: `1px solid ${AMBER}` };
const highChipSt: React.CSSProperties = { background: WHITE, color: FOREST, padding: '1px 6px', borderRadius: 3, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, border: `1px solid ${FOREST}` };
