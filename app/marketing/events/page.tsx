// app/marketing/events/page.tsx
//
// PBS 2026-05-16: Events Cockpit · calendar-first like /finance/hr/holidays.
// Replaces the prior "list grouped by month" with the cockpit-family anatomy:
//   1. KPI band
//   2. Inner sub-strip · ?view=calendar|list|impact
//   3. Hero: 12-month calendar grid (events dotted on day cells, color by
//      primary department impact)
//   4. Agent fleet
//   5. Right rail (department impact tally, source markets, guardrails)
//
// Live data: marketing.calendar_events (preserved · same fields as before).

import Link from 'next/link';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import ArtifactActions from '@/components/page/ArtifactActions';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fmtIsoDate } from '@/lib/format';
import { MARKETING_SUBPAGES } from '../_subpages';
import TabStrip, { INFO_TABS } from '@/app/finance/_components/TabStrip';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// ─── Data ─────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────

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

// Primary department per event (for calendar dot color)
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
  rate:      'var(--brass, #a8854a)',
  marketing: 'var(--st-good, #82ad8c)',
  content:   '#5dade2',
  fnb:       '#c97b6a',
  retreat:   'var(--text-2, #d8cca8)',
  unset:     'var(--text-place, #5a5448)',
};
const DEPT_LABEL: Record<Dept, string> = {
  rate: 'Rate-shop', marketing: 'Marketing', content: 'Content',
  fnb: 'F&B', retreat: 'Retreat', unset: 'Unset',
};

// Expand each event to all ISO dates it covers (multi-day events fill multiple cells)
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

// ─── Agents (cockpit family) ──────────────────────────────────────────────

interface EventAgent { name: string; desc: string; signal: string }
const AGENTS: EventAgent[] = [
  { name: 'Event Scout',          desc: 'Surfaces upcoming local festivals, congresses, fairs and ICP-relevant cultural events.',                 signal: '7 candidates' },
  { name: 'Demand Modeler',       desc: 'Estimates the demand-score override based on prior years, source-market signals and seasonality.',         signal: '12 modeled'   },
  { name: 'Rate-shop Trigger',    desc: 'When an event is high-demand, flags Revenue to lift rates + pull min-LOS.',                                 signal: '4 lifts'      },
  { name: 'Marketing Brief',      desc: 'Drafts the marketing brief: hook + pillar + ICP + hashtags + post timing.',                                 signal: '11 briefs'    },
  { name: 'Content Architect',    desc: 'Builds blog posts + IG carousels + reels tied to the event narrative.',                                     signal: '8 outlines'   },
  { name: 'F&B Planner',          desc: 'Special menus + drink pairings + sourcing for event days.',                                                 signal: '5 menus'      },
  { name: 'Retreat Planner',      desc: 'Aligns retreat schedules with major events (Songkran / Tết / Full Moon).',                                  signal: '3 retreats'   },
  { name: 'Reality & Brand',      desc: 'Ensures event narrative + visuals match the actual resort + Lao cultural reality.',                        signal: '0 flags'      },
];

// ─── Page ─────────────────────────────────────────────────────────────────

interface Props { searchParams?: { view?: string; y?: string; dept?: string } }

export default async function EventsCockpitPage({ searchParams }: Props) {
  const events = await getEvents();
  const view = parseView(searchParams?.view);
  const year = parseYear(searchParams?.y);
  const deptFilter = (typeof searchParams?.dept === 'string' ? searchParams.dept : 'all') as Dept | 'all';

  // KPI math
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const upcoming = events.filter((e) => new Date(e.date_start) >= today);
  const next7  = upcoming.filter((e) => new Date(e.date_start).getTime() <= today.getTime() + 7  * 86_400_000).length;
  const next30 = upcoming.filter((e) => new Date(e.date_start).getTime() <= today.getTime() + 30 * 86_400_000).length;
  const next90 = upcoming.filter((e) => new Date(e.date_start).getTime() <= today.getTime() + 90 * 86_400_000).length;
  const confirmed = events.filter((e) => e.is_confirmed).length;
  const high      = events.filter((e) => (e.demand_score_override ?? 0) >= 80).length;

  // Year-scoped + dept-filtered
  const yearEvents = events.filter((e) => e.date_start.startsWith(`${year}-`));
  const filtered = deptFilter === 'all'
    ? yearEvents
    : yearEvents.filter((e) => primaryDept(e) === deptFilter);
  const byDate = eventsByDate(filtered);

  // Department impact tally (for right rail)
  const deptCounts: Record<Dept, number> = { rate: 0, marketing: 0, content: 0, fnb: 0, retreat: 0, unset: 0 };
  for (const e of yearEvents) {
    if (e.applies_to_rate_shop) deptCounts.rate++;
    if (e.applies_to_marketing) deptCounts.marketing++;
    if (e.applies_to_content)   deptCounts.content++;
    if (e.applies_to_fnb)       deptCounts.fnb++;
    if (e.applies_to_retreat)   deptCounts.retreat++;
  }
  // Top source markets across year
  const marketCounts = new Map<string, number>();
  for (const e of yearEvents) {
    for (const m of (e.source_markets ?? [])) marketCounts.set(m, (marketCounts.get(m) ?? 0) + 1);
  }
  const topMarkets = Array.from(marketCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Years present in data
  const yearsAvailable = Array.from(new Set(events.map((e) => Number(e.date_start.slice(0, 4))))).sort();

  const qs = (view: View, y: number, dept: Dept | 'all') =>
    `?view=${view}&y=${y}${dept === 'all' ? '' : `&dept=${dept}`}`;

  return (
    <Page
      eyebrow="Marketing · Events"
      title={<>Events <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>cockpit</em></>}
      subPages={MARKETING_SUBPAGES}
    >
      <TabStrip tabs={INFO_TABS} activeKey="events" />

      {/* KPI band */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        <KpiBox value={events.length}   unit="count" label="Total events"     tooltip="All events in marketing.calendar_events." />
        <KpiBox value={upcoming.length} unit="count" label="Upcoming"         tooltip="Events with date_start ≥ today" />
        <KpiBox value={next7}           unit="count" label="Next 7 days"      tooltip="Within 7 days of today" />
        <KpiBox value={next30}          unit="count" label="Next 30 days"     tooltip="Within 30 days of today · drives marketing brief planning" />
        <KpiBox value={next90}          unit="count" label="Next 90 days"     tooltip="Within 90 days · retreat planning window" />
        <KpiBox value={confirmed}       unit="count" label="Confirmed"        tooltip="is_confirmed=true · forecast otherwise" />
        <KpiBox value={high}            unit="count" label="High demand (≥80)" tooltip="demand_score_override ≥ 80 · drives rate-shop + content priority" />
      </div>

      {/* Sub-strip */}
      <div style={S.subStrip}>
        {(['calendar', 'list', 'impact'] as View[]).map((v) => (
          <a key={v} href={qs(v, year, deptFilter)}
             style={{ ...S.subStripLink, ...(v === view ? S.subStripLinkActive : {}) }}>
            {v === 'calendar' ? '📅 Calendar' : v === 'list' ? '📋 List' : '⚡ Impact'}
          </a>
        ))}
      </div>

      {/* SECTION: Calendar */}
      {view === 'calendar' && (
        <Panel
          title={`${year} · calendar`}
          eyebrow={`${filtered.length} events${deptFilter === 'all' ? '' : ` · ${DEPT_LABEL[deptFilter as Dept]}`} · click any day to drilldown (Phase 2)`}
        >
          <div style={{ padding: 14 }}>
            {/* Year + dept filter row */}
            <div style={S.controlsRow}>
              <div style={S.controlGroup}>
                <span style={S.controlLabel}>Year</span>
                {yearsAvailable.map((y) => (
                  <a key={y} href={qs(view, y, deptFilter)}
                     style={{ ...S.chip, ...(y === year ? S.chipActive : {}) }}>{y}</a>
                ))}
              </div>
              <div style={S.controlGroup}>
                <span style={S.controlLabel}>Drives</span>
                <a href={qs(view, year, 'all')} style={{ ...S.chip, ...(deptFilter === 'all' ? S.chipActive : {}) }}>All</a>
                {(['rate', 'marketing', 'content', 'fnb', 'retreat'] as Dept[]).map((d) => (
                  <a key={d} href={qs(view, year, d)}
                     style={{ ...S.chip, ...(deptFilter === d ? S.chipActive : {}) }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: DEPT_COLOR[d], marginRight: 4 }} />
                    {DEPT_LABEL[d]}
                  </a>
                ))}
              </div>
            </div>

            {/* 12-month grid */}
            <div style={S.monthGrid}>
              {Array.from({ length: 12 }, (_, m) => (
                <MonthCard
                  key={m}
                  year={year}
                  monthIndex0={m}
                  byDate={byDate}
                  todayIso={todayIso}
                />
              ))}
            </div>

            {/* Legend */}
            <div style={S.legendRow}>
              {(['rate', 'marketing', 'content', 'fnb', 'retreat'] as Dept[]).map((d) => (
                <span key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: DEPT_COLOR[d] }} />
                  <span style={S.legendLabel}>{DEPT_LABEL[d]}</span>
                </span>
              ))}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'transparent', border: '1px dashed var(--brass, #a8854a)' }} />
                <span style={S.legendLabel}>Tentative</span>
              </span>
            </div>
          </div>
        </Panel>
      )}

      {/* SECTION: List */}
      {view === 'list' && (
        <ListView events={upcoming} />
      )}

      {/* SECTION: Impact */}
      {view === 'impact' && (
        <ImpactView events={yearEvents} deptCounts={deptCounts} topMarkets={topMarkets} year={year} />
      )}

      {/* Agent fleet */}
      <div style={{ marginTop: 14 }}>
        <Panel title="Agent fleet" eyebrow={`${AGENTS.length} event specialists`}>
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            {AGENTS.map((a) => (
              <div key={a.name} style={S.agentCard}>
                <div style={S.agentHead}>
                  <span style={S.agentName}>{a.name}</span>
                  <span style={S.signalPill}>{a.signal}</span>
                </div>
                <div style={S.agentDesc}>{a.desc}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div style={S.footerNote}>
        Source: <code>marketing.calendar_events</code>. Calendar dots are colored by the event&apos;s primary department impact. Multi-day events fill every day cell.{' '}
        <Link href="/marketing/library" style={{ color: 'var(--brass)' }}>media library</Link> ·{' '}
        <Link href="/marketing/campaigns" style={{ color: 'var(--brass)' }}>campaigns</Link>
      </div>
    </Page>
  );
}

// ─── Month card (calendar hero) ───────────────────────────────────────────

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
  // Unique by event_id (multi-day events show once in the month list)
  const seen = new Set<string>();
  const uniqueMonthEvents: EventRow[] = [];
  for (const e of monthEvents) { if (!seen.has(e.event_id)) { seen.add(e.event_id); uniqueMonthEvents.push(e); } }

  return (
    <div style={S.monthCard}>
      <div style={S.monthHead}>
        <span>{MONTH_NAMES[monthIndex0]} {year}</span>
        <span style={S.monthCount}>{uniqueMonthEvents.length || '—'}</span>
      </div>

      <div style={S.dowRow}>
        {DOW_LABELS.map((d, i) => <div key={i} style={S.dowCell}>{d}</div>)}
      </div>

      <div style={S.daysGrid}>
        {cells.map((c, i) => {
          if (!c.day) return <div key={i} style={{ height: 26 }} />;
          const dayEvents = c.iso ? byDate.get(c.iso) ?? [] : [];
          const isToday = c.iso === todayIso;
          const dot = dayEvents.length > 0 ? primaryDept(dayEvents[0]) : undefined;
          const tentative = dayEvents.length > 0 && dayEvents.every((e) => e.is_confirmed === false);
          const tip = dayEvents.length > 0 ? dayEvents.map((e) => e.display_name).join('\n') : undefined;

          return (
            <div
              key={i}
              title={tip}
              style={{
                ...S.dayCell,
                background: dot ? DEPT_COLOR[dot] : 'transparent',
                color: dot ? '#fff' : 'var(--text-1, #d8cca8)',
                fontWeight: (dayEvents.length > 0 || isToday) ? 600 : 400,
                border: isToday ? '1px solid var(--text-0, #e9e1ce)' : tentative ? '1px dashed var(--brass, #a8854a)' : '1px solid transparent',
              }}
            >
              {c.day}
            </div>
          );
        })}
      </div>

      {uniqueMonthEvents.length > 0 && (
        <ul style={S.eventList}>
          {uniqueMonthEvents.slice(0, 6).map((e) => (
            <li key={e.event_id} style={S.eventLi}>
              <span style={{ ...S.eventDot, background: DEPT_COLOR[primaryDept(e)] }} />
              <span style={S.eventDay}>{e.date_start.slice(8, 10)}</span>
              <span style={S.eventName}>{e.display_name}</span>
              {(e.demand_score_override ?? 0) >= 80 && <span style={S.highBadge}>HIGH</span>}
            </li>
          ))}
          {uniqueMonthEvents.length > 6 && (
            <li style={S.eventMore}>+{uniqueMonthEvents.length - 6} more</li>
          )}
        </ul>
      )}
    </div>
  );
}

// ─── List view ────────────────────────────────────────────────────────────

function ListView({ events }: { events: EventRow[] }) {
  const byMonth = new Map<string, EventRow[]>();
  for (const e of events) {
    const k = new Date(e.date_start).toLocaleString('en-GB', { year: 'numeric', month: 'long' });
    (byMonth.get(k) ?? byMonth.set(k, []).get(k)!).push(e);
  }
  if (byMonth.size === 0) {
    return (
      <Panel title="No upcoming events" eyebrow="—">
        <div style={{ padding: 24, color: 'var(--text-mute, #9b907a)', fontStyle: 'italic', textAlign: 'center' }}>
          Nothing scheduled. Add events to <code>marketing.calendar_events</code>.
        </div>
      </Panel>
    );
  }
  return (
    <>
      {Array.from(byMonth.entries()).map(([month, rows]) => (
        <div key={month} style={{ marginBottom: 12 }}>
          <Panel
            title={month}
            eyebrow={`${rows.length} event${rows.length === 1 ? '' : 's'}`}
            actions={<ArtifactActions context={{ kind: 'panel', title: `Events · ${month}`, dept: 'marketing' }} />}
          >
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rows.map((e) => (
                <div key={e.event_id} style={S.listRow}>
                  <div style={S.listDayCol}>
                    <div style={S.listDayPill}>{weekday(e.date_start)} {new Date(e.date_start).toLocaleString('en-GB', { day: '2-digit', month: 'short' })}</div>
                    {e.date_end && e.date_end !== e.date_start && (
                      <div style={S.listThrough}>→ {fmtIsoDate(e.date_end)}</div>
                    )}
                  </div>
                  <div style={S.listBodyCol}>
                    <div style={S.listHead}>
                      <strong style={{ color: 'var(--text-0, #e9e1ce)' }}>{e.display_name}</strong>
                      {e.type_code && <span style={S.typeChip}>{e.type_code}</span>}
                      {e.is_confirmed === false && <span style={S.tentativeChip}>tentative</span>}
                      {(e.demand_score_override ?? 0) >= 80 && <span style={S.highChip}>high demand</span>}
                    </div>
                    {e.marketing_brief && <div style={S.listBrief}>{e.marketing_brief}</div>}
                    <div style={S.deptRow}>
                      {e.applies_to_rate_shop  && <span style={deptChip('rate')}>Rate</span>}
                      {e.applies_to_marketing  && <span style={deptChip('marketing')}>Marketing</span>}
                      {e.applies_to_content    && <span style={deptChip('content')}>Content</span>}
                      {e.applies_to_fnb        && <span style={deptChip('fnb')}>F&amp;B</span>}
                      {e.applies_to_retreat    && <span style={deptChip('retreat')}>Retreat</span>}
                    </div>
                    {e.source_markets && e.source_markets.length > 0 && (
                      <div style={S.sourceRow}>Source: {e.source_markets.join(' · ')}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      ))}
    </>
  );
}

// ─── Impact view ──────────────────────────────────────────────────────────

function ImpactView({ events, deptCounts, topMarkets, year }: { events: EventRow[]; deptCounts: Record<Dept, number>; topMarkets: Array<[string, number]>; year: number }) {
  const highDemand = events.filter((e) => (e.demand_score_override ?? 0) >= 80);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 340px)', gap: 14, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Panel title={`Department impact · ${year}`} eyebrow="which dept each event drives">
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['rate', 'marketing', 'content', 'fnb', 'retreat'] as Dept[]).map((d) => {
              const max = Math.max(...Object.values(deptCounts), 1);
              const pct = Math.round((deptCounts[d] / max) * 100);
              return (
                <div key={d} style={S.impactRow}>
                  <span style={{ ...S.impactDot, background: DEPT_COLOR[d] }} />
                  <span style={S.impactLabel}>{DEPT_LABEL[d]}</span>
                  <div style={S.impactBarOuter}>
                    <div style={{ ...S.impactBarInner, width: `${pct}%`, background: DEPT_COLOR[d] }} />
                  </div>
                  <strong style={S.impactCount}>{deptCounts[d]}</strong>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="High-demand events" eyebrow={`${highDemand.length} events · score ≥ 80`}>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {highDemand.map((e) => (
              <div key={e.event_id} style={S.highRow}>
                <div style={S.highHead}>
                  <span style={S.highName}>{e.display_name}</span>
                  <span style={S.highScore}>{e.demand_score_override}</span>
                </div>
                <div style={S.highMeta}>{e.date_start}{e.date_end && e.date_end !== e.date_start ? ` → ${e.date_end}` : ''} · {DEPT_LABEL[primaryDept(e)]}</div>
                {e.marketing_brief && <div style={S.highBrief}>{e.marketing_brief}</div>}
              </div>
            ))}
            {highDemand.length === 0 && <div style={{ color: 'var(--text-mute, #9b907a)', fontStyle: 'italic' }}>No high-demand events scored ≥ 80 in {year}.</div>}
          </div>
        </Panel>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Panel title="Top source markets" eyebrow={`${topMarkets.length} tagged on events`}>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {topMarkets.map(([m, c]) => (
              <div key={m} style={S.marketRow}>
                <span style={S.marketName}>{m}</span>
                <strong style={S.marketCount}>{c}</strong>
              </div>
            ))}
            {topMarkets.length === 0 && <div style={{ color: 'var(--text-mute, #9b907a)', fontStyle: 'italic' }}>No source markets tagged.</div>}
          </div>
        </Panel>

        <Panel title="Guardrails" eyebrow="how events flow through the cockpits">
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Callout tone="brass">High-demand events (≥80) auto-flag Revenue to lift rates + raise min-LOS.</Callout>
            <Callout tone="soft">Marketing-applicable events generate post calendar entries 30 days ahead in Social cockpit.</Callout>
            <Callout tone="soft">Retreat-applicable events propose retreat scheduling in Compiler.</Callout>
            <Callout tone="warn">Tentative events (is_confirmed=false) are forecast only. Don&apos;t broadcast until confirmed.</Callout>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── Atoms ────────────────────────────────────────────────────────────────

function deptChip(d: Dept): React.CSSProperties {
  return {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase',
    fontWeight: 600,
    padding: '1px 6px', borderRadius: 3,
    border: `1px solid ${DEPT_COLOR[d]}`,
    color: DEPT_COLOR[d],
  };
}

function Callout({ tone, children }: { tone: 'brass' | 'soft' | 'warn'; children: React.ReactNode }) {
  const border = tone === 'brass' ? 'var(--brass, #a8854a)' : tone === 'warn' ? 'var(--st-warn, #C28F2C)' : 'var(--border-1, #1f1c15)';
  return (
    <div style={{ padding: '8px 10px', borderLeft: `2px solid ${border}`, background: 'var(--surf-1, #0f0d0a)', fontSize: 'var(--t-sm)', lineHeight: 1.5, color: 'var(--text-1, #d8cca8)' }}>
      {children}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  // Sub-strip
  subStrip: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--border-1, #1f1c15)' },
  subStripLink: { padding: '6px 12px', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-mute, #9b907a)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 3, textDecoration: 'none', background: 'var(--surf-1, #0f0d0a)' },
  subStripLinkActive: { color: 'var(--surf-0, #0a0a0a)', background: 'var(--brass, #a8854a)', borderColor: 'var(--brass, #a8854a)', fontWeight: 700 },

  // Controls
  controlsRow: { display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 12 },
  controlGroup: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  controlLabel: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--brass, #a8854a)' },
  chip: { padding: '3px 9px', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, letterSpacing: '0.10em', color: 'var(--text-1, #d8cca8)', background: 'transparent', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 999, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' },
  chipActive: { color: 'var(--surf-0, #0a0a0a)', background: 'var(--brass, #a8854a)', borderColor: 'var(--brass, #a8854a)', fontWeight: 700 },

  // Calendar grid
  monthGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 },
  monthCard: { background: 'var(--surf-1, #0f0d0a)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 6, padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 },
  monthHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--brass, #a8854a)' },
  monthCount: { color: 'var(--text-mute, #9b907a)', fontVariantNumeric: 'tabular-nums', fontSize: 9 },
  dowRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 },
  dowCell: { textAlign: 'center', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, color: 'var(--text-place, #5a5448)', padding: '2px 0' },
  daysGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 },
  dayCell: { height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, borderRadius: 3 },
  eventList: { marginTop: 6, paddingLeft: 0, listStyle: 'none', borderTop: '1px solid var(--border-1, #1f1c15)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 3 },
  eventLi: { display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 11, lineHeight: 1.4 },
  eventDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0, alignSelf: 'center' },
  eventDay: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, color: 'var(--text-mute, #9b907a)', minWidth: 18 },
  eventName: { color: 'var(--text-1, #d8cca8)', flex: 1 },
  eventMore: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, color: 'var(--text-place, #5a5448)', textAlign: 'right' },
  highBadge: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 8, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--brass, #a8854a)', border: '1px solid var(--brass, #a8854a)', padding: '0 3px', borderRadius: 2 },

  // Legend
  legendRow: { display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 16 },
  legendLabel: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-mute, #9b907a)' },

  // List view
  listRow: { display: 'grid', gridTemplateColumns: '170px 1fr', gap: 14, padding: '10px 12px', background: 'var(--surf-1, #0f0d0a)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 4 },
  listDayCol: { paddingTop: 2 },
  listDayPill: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--brass, #a8854a)', fontWeight: 700 },
  listThrough: { fontSize: 10, color: 'var(--text-mute, #9b907a)', marginTop: 2 },
  listBodyCol: { display: 'flex', flexDirection: 'column', gap: 6 },
  listHead: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  typeChip: { background: 'var(--surf-0, #0a0a0a)', color: 'var(--text-mute, #9b907a)', padding: '1px 6px', borderRadius: 3, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' },
  tentativeChip: { background: 'var(--paper-deep, #2a261d)', color: 'var(--brass-soft, #c4a06b)', padding: '1px 6px', borderRadius: 3, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 },
  highChip: { background: 'rgba(168,133,74,0.15)', color: 'var(--brass, #a8854a)', padding: '1px 6px', borderRadius: 3, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, border: '1px solid var(--brass, #a8854a)' },
  listBrief: { fontSize: 12, color: 'var(--text-1, #d8cca8)', lineHeight: 1.5 },
  deptRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  sourceRow: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, color: 'var(--text-mute, #9b907a)', letterSpacing: '0.10em' },

  // Impact
  impactRow: { display: 'grid', gridTemplateColumns: '12px 110px 1fr 40px', gap: 8, alignItems: 'center' },
  impactDot: { width: 10, height: 10, borderRadius: '50%' },
  impactLabel: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-1, #d8cca8)' },
  impactBarOuter: { height: 8, background: 'var(--surf-0, #0a0a0a)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 4, overflow: 'hidden' },
  impactBarInner: { height: '100%' },
  impactCount: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-sm)', color: 'var(--brass, #a8854a)', textAlign: 'right' },

  // High-demand cards
  highRow: { background: 'var(--surf-1, #0f0d0a)', border: '1px solid var(--border-1, #1f1c15)', borderLeft: '3px solid var(--brass, #a8854a)', borderRadius: 6, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 },
  highHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  highName: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 'var(--t-md)', color: 'var(--text-0, #e9e1ce)' },
  highScore: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-lg)', color: 'var(--brass, #a8854a)', fontWeight: 700 },
  highMeta: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.12em', color: 'var(--text-mute, #9b907a)' },
  highBrief: { fontSize: 'var(--t-sm)', lineHeight: 1.5, color: 'var(--text-1, #d8cca8)' },

  // Market rows
  marketRow: { display: 'flex', justifyContent: 'space-between', padding: '4px 6px', borderBottom: '1px solid var(--border-1, #1f1c15)' },
  marketName: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.10em', color: 'var(--text-1, #d8cca8)' },
  marketCount: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-sm)', color: 'var(--brass, #a8854a)' },

  // Agents
  agentCard: { background: 'var(--surf-1, #0f0d0a)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 6, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 },
  agentHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  agentName: { fontSize: 'var(--t-sm)', fontWeight: 600, color: 'var(--text-0, #e9e1ce)' },
  agentDesc: { fontSize: 'var(--t-xs)', lineHeight: 1.5, color: 'var(--text-mute, #9b907a)', minHeight: 54 },
  signalPill: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--brass, #a8854a)', border: '1px solid var(--brass, #a8854a)', padding: '1px 5px', borderRadius: 3 },

  footerNote: { marginTop: 18, padding: '10px 12px', fontSize: 'var(--t-xs)', color: 'var(--text-mute, #9b907a)', fontStyle: 'italic', borderTop: '1px solid var(--border-1, #1f1c15)' },
};
