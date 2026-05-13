// app/marketing/events/page.tsx
// PBS 2026-05-09: "Events schedule page like this" (screenshot 12.24.10).
// First pass: a clean list grouped by month, KPIs across the year, and chips
// for the "applies_to_*" flags so PBS can see which department each event
// drives. Calendar grid view can layer on once this is in PBS's hands.

import Link from 'next/link';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import ArtifactActions from '@/components/page/ArtifactActions';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fmtIsoDate } from '@/lib/format';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

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

function monthKey(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { year: 'numeric', month: 'long' });
}

function weekday(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { weekday: 'short' });
}

const APPLIES_LABEL: Array<{ key: keyof EventRow; label: string; tone: string }> = [
  { key: 'applies_to_rate_shop', label: 'Rate',      tone: '#a8854a' },
  { key: 'applies_to_marketing', label: 'Marketing', tone: '#34E0A1' },
  { key: 'applies_to_content',   label: 'Content',   tone: '#1877F2' },
  { key: 'applies_to_fnb',       label: 'F&B',       tone: '#E4405F' },
  { key: 'applies_to_retreat',   label: 'Retreat',   tone: 'var(--line-soft)' },
];

export default async function EventsSchedulePage() {
  const events = await getEvents();

  const today = new Date();
  const upcoming = events.filter((e) => new Date(e.date_start) >= today);
  const next7  = upcoming.filter((e) => new Date(e.date_start).getTime() <= today.getTime() + 7  * 86_400_000).length;
  const next30 = upcoming.filter((e) => new Date(e.date_start).getTime() <= today.getTime() + 30 * 86_400_000).length;
  const next90 = upcoming.filter((e) => new Date(e.date_start).getTime() <= today.getTime() + 90 * 86_400_000).length;
  const confirmed = events.filter((e) => e.is_confirmed).length;
  const high      = events.filter((e) => (e.demand_score_override ?? 0) >= 80).length;

  // Group by month for the rendering.
  const byMonth = new Map<string, EventRow[]>();
  for (const e of upcoming) {
    const k = monthKey(e.date_start);
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k)!.push(e);
  }

  return (
    <Page
      eyebrow="Marketing · Events"
      title={<>Events <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>schedule</em></>}
      subPages={MARKETING_SUBPAGES}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox value={events.length}    unit="count" label="Total events"     tooltip="All events in marketing.calendar_events." />
        <KpiBox value={upcoming.length}  unit="count" label="Upcoming"         tooltip="Events with date_start >= today." />
        <KpiBox value={next7}            unit="count" label="Next 7 days"   tooltip="Events with date_start within 7 days of today." />
        <KpiBox value={next30}           unit="count" label="Next 30 days"  tooltip="Events with date_start within 30 days of today." />
        <KpiBox value={next90}           unit="count" label="Next 90 days"  tooltip="Events with date_start within 90 days of today. Drives marketing brief planning." />
        <KpiBox value={confirmed}        unit="count" label="Confirmed"        tooltip="is_confirmed = true. Unconfirmed = forecast / candidate." />
        <KpiBox value={high}             unit="count" label="High demand (≥80)" tooltip="demand_score_override ≥ 80. Drives rate-shop + content priority." />
      </div>

      {byMonth.size === 0 ? (
        <Panel title="No upcoming events" eyebrow="—">
          <div style={{ padding: 24, color: '#7d7565', fontStyle: 'italic', textAlign: 'center' }}>
            Nothing scheduled. Add events to <code>marketing.calendar_events</code>.
          </div>
        </Panel>
      ) : (
        Array.from(byMonth.entries()).map(([month, rows]) => (
          <div key={month} style={{ marginBottom: 14 }}>
            <Panel
              title={month}
              eyebrow={`${rows.length} event${rows.length === 1 ? '' : 's'}`}
              actions={<ArtifactActions context={{ kind: 'panel', title: `Events · ${month}`, dept: 'marketing' }} />}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rows.map((e) => {
                  const startDate = new Date(e.date_start);
                  const dayLabel = `${weekday(e.date_start)} ${startDate.toLocaleString('en-GB', { day: '2-digit', month: 'short' })}`;
                  const through  = e.date_end && e.date_end !== e.date_start ? ` → ${fmtIsoDate(e.date_end)}` : '';
                  const buildup  = e.buildup_start ? ` · prep from ${fmtIsoDate(e.buildup_start)}` : '';
                  return (
                    <div key={e.event_id} style={S.row}>
                      <div style={S.dayCol}>
                        <div style={S.dayPill}>{dayLabel}</div>
                        {through && <div style={S.through}>{through.replace(' → ', '→ ')}</div>}
                      </div>
                      <div style={S.titleCol}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <strong style={{ color: 'var(--ink)' }}>{e.display_name}</strong>
                          {e.type_code && <span style={S.typeChip}>{e.type_code}</span>}
                          {e.is_confirmed === false && <span style={S.unconfirmed}>tentative</span>}
                          {(e.demand_score_override ?? 0) >= 80 && <span style={S.high}>high demand</span>}
                        </div>
                        {e.marketing_brief && (
                          <div style={S.brief}>{e.marketing_brief}</div>
                        )}
                        <div style={S.appliesRow}>
                          {APPLIES_LABEL.filter((a) => Boolean((e as any)[a.key])).map((a) => (
                            <span key={a.label as string} style={{ ...S.applies, color: a.tone, borderColor: a.tone + '55' }}>
                              {a.label}
                            </span>
                          ))}
                        </div>
                        {e.hashtags && e.hashtags.length > 0 && (
                          <div style={S.tags}>
                            {e.hashtags.slice(0, 6).map((t) => <span key={t}>#{t}</span>)}
                          </div>
                        )}
                        {buildup && <div style={S.through}>{buildup}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>
        ))
      )}

      <div style={{ marginTop: 14, fontSize: 11, color: '#7d7565' }}>
        Source: <code style={{ color: '#a8854a' }}>marketing.calendar_events</code> ·{' '}
        <Link href="/marketing/library" style={{ color: '#a8854a' }}>media library</Link> ·{' '}
        <Link href="/marketing/campaigns" style={{ color: '#a8854a' }}>campaigns</Link>
      </div>
    </Page>
  );
}

const S: Record<string, React.CSSProperties> = {
  row: {
    display: 'grid',
    gridTemplateColumns: '170px 1fr',
    gap: 14,
    padding: '10px 12px',
    background: '#0f0d0a',
    border: '1px solid #1f1c15',
    borderRadius: 4,
    alignItems: 'flex-start',
  },
  dayCol: { paddingTop: 2 },
  dayPill: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase',
    color: '#a8854a', fontWeight: 700,
  },
  through: { fontSize: 10, color: '#7d7565', marginTop: 2 },
  titleCol: { display: 'flex', flexDirection: 'column', gap: 6 },
  brief: { fontSize: 12, color: '#9b907a', lineHeight: 1.5 },
  typeChip: {
    background: '#1a1812', color: 'var(--line-soft)',
    padding: '1px 6px', borderRadius: 3,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
  },
  unconfirmed: {
    background: '#2a261d', color: 'var(--brass-soft)',
    padding: '1px 6px', borderRadius: 3,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700,
  },
  high: {
    background: '#1a2e21', color: '#7ad790',
    padding: '1px 6px', borderRadius: 3,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700,
  },
  appliesRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  applies: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600,
    padding: '1px 6px', borderRadius: 3,
    background: 'transparent', border: '1px solid',
  },
  tags: {
    display: 'flex', gap: 8, flexWrap: 'wrap',
    fontSize: 11, color: '#7d7565',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
};
