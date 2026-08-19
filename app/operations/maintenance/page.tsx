// app/operations/maintenance/page.tsx
// PBS 2026-08-19: Design-system compliance rewrite (pm-v3-slice-6).
// Replaced raw Tailwind with primitives: Container, ListContainer, MonthCalendar.
// Removed emoji headings per L26. No protected paths touched.

import { Container, ListContainer, MonthCalendar, type CalendarDay } from '@/app/(cockpit)/_design';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import HodLanding from '@/app/_components/HodLanding';
import type { KpiTileProps } from '@/app/(cockpit)/_design';
import type { MaintenanceTicketRow } from './_data/tickets';
import type { PpmTaskRow } from './_data/ppm';
import type { AssetHealthCell } from './_data/assets';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function MaintenancePage() {
  const pid = PROPERTY_ID;

  // Fetch maintenance data (all tables still empty per Gap-M1..Gap-M5)
  const [ticketsRes, ppmRes, assetsRes] = await Promise.all([
    supabase.from('maintenance_tickets').select('*').eq('property_id', pid).limit(100),
    supabase.from('ppm_tasks').select('*').eq('property_id', pid).order('due_date').limit(60),
    supabase.from('assets').select('*').eq('property_id', pid).limit(200),
  ]);

  const tickets = (ticketsRes.data ?? null) as MaintenanceTicketRow[] | null;
  const ppmTasks = (ppmRes.data ?? null) as PpmTaskRow[] | null;
  const assets = (assetsRes.data ?? null) as AssetHealthCell[] | null;

  // KPI tiles
  const openCount = tickets?.length ?? null;
  const slaRiskCount = tickets?.filter(t => 
    t.hours_to_sla_breach !== null && 
    t.hours_to_sla_breach !== undefined && 
    t.hours_to_sla_breach < 4
  ).length ?? null;

  const liveTiles: KpiTileProps[] = [
    {
      label: 'Open tickets',
      value: openCount ?? '—',
      footnote: openCount ? `${slaRiskCount} within 4h SLA` : 'Data needed · Gap-M1',
      status: slaRiskCount && slaRiskCount > 0 ? 'red' : openCount && openCount > 0 ? 'green' : 'grey',
      size: 'sm',
    },
    {
      label: 'MTTR · 30d',
      value: '—',
      footnote: 'Target 4h · Gap-M1',
      status: 'grey',
      size: 'sm',
    },
    {
      label: 'Asset health',
      value: assets?.length ?? '—',
      footnote: assets ? 'assets registered' : 'Gap-M2 census needed',
      status: 'grey',
      size: 'sm',
    },
    {
      label: 'Energy · kWh/occ',
      value: '—',
      footnote: 'Benchmark 32 · Gap-M4',
      status: 'grey',
      size: 'sm',
    },
  ];

  // Calendar days for PPM tasks (next 30 days)
  const calendarDays: CalendarDay[] = [];
  if (ppmTasks && ppmTasks.length > 0) {
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const dayTasks = ppmTasks.filter(t => t.due_date === iso);
      if (dayTasks.length > 0) {
        const overdueCount = dayTasks.filter(t => t.status === 'overdue').length;
        calendarDays.push({
          date: iso,
          label: `${dayTasks.length}`,
          tone: overdueCount > 0 ? 'red' : dayTasks.some(t => t.status === 'in_progress') ? 'amber' : 'green',
          tooltip: dayTasks.map(t => `${t.template_name} (${t.asset_code})`).join('\n'),
        });
      } else {
        calendarDays.push({ date: iso });
      }
    }
  }

  return (
    <HodLanding
      slug="operations"
      propertyId={pid}
      liveTiles={liveTiles}
      extraContainers={
        <>
          {/* Ticket Queue */}
          <div style={{ gridColumn: '1 / -1' }}>
            <ListContainer
              title="Ticket queue"
              subtitle={tickets ? `${tickets.length} open` : 'No tickets'}
              data={tickets ?? []}
              preview={5}
              rowKey={(r) => r.id}
              renderRow={(r) => (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '90px 1fr 80px 70px', 
                  gap: 12, 
                  alignItems: 'center',
                  padding: '8px 0',
                }}>
                  <span style={{ 
                    fontFamily: 'var(--mono, monospace)', 
                    fontSize: 'var(--t-sm)', 
                    fontWeight: 700,
                    color: r.priority === 'urgent' ? 'var(--status-red)' : 
                           r.priority === 'corrective' ? 'var(--status-amber)' : 'var(--ink-soft)',
                    textTransform: 'uppercase',
                  }}>
                    {r.priority}
                  </span>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{r.title}</span>
                    {(r.asset || r.room_no) && (
                      <span style={{ 
                        marginLeft: 8, 
                        fontSize: 'var(--t-sm)', 
                        color: 'var(--ink-soft)',
                        fontFamily: 'var(--mono, monospace)',
                      }}>
                        {r.asset || r.room_no}
                      </span>
                    )}
                  </div>
                  <span style={{ 
                    fontFamily: 'var(--mono, monospace)', 
                    textAlign: 'right',
                    fontSize: 'var(--t-sm)',
                    color: r.hours_to_sla_breach !== null && r.hours_to_sla_breach < 4 
                      ? 'var(--status-red)' 
                      : r.hours_to_sla_breach !== null && r.hours_to_sla_breach < 24
                      ? 'var(--status-amber)'
                      : 'var(--status-green)',
                  }}>
                    {r.hours_to_sla_breach !== null ? `${r.hours_to_sla_breach}h` : '—'}
                  </span>
                  <span style={{ 
                    fontSize: 'var(--t-xs)', 
                    color: 'var(--ink-soft)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    textAlign: 'right',
                  }}>
                    {r.source}
                  </span>
                </div>
              )}
              drawerColumns={[
                { key: 'priority', label: 'Priority', width: 100 },
                { key: 'title', label: 'Title', width: 300 },
                { key: 'hours_to_sla_breach', label: 'SLA', width: 80 },
                { key: 'source', label: 'Source', width: 80 },
              ]}
              empty={{
                title: 'No open tickets',
                hint: 'Gap-M1 · ops.maintenance_tickets table empty',
              }}
            />
          </div>

          {/* PPM Calendar */}
          <div style={{ gridColumn: '1 / span 2' }}>
            <Container 
              title="PPM calendar" 
              subtitle={ppmTasks ? `${ppmTasks.length} tasks scheduled` : 'No tasks scheduled'}
            >
              {calendarDays.length > 0 ? (
                <MonthCalendar days={calendarDays} variant="events" />
              ) : (
                <div style={{ 
                  padding: 24, 
                  textAlign: 'center', 
                  color: 'var(--ink-soft)',
                  fontStyle: 'italic',
                }}>
                  Gap-M5 · ops.ppm_templates + ops.ppm_tasks needed
                </div>
              )}
            </Container>
          </div>

          {/* Asset Health Heat Map */}
          <div style={{ gridColumn: '3 / -1' }}>
            <Container 
              title="Asset health" 
              subtitle={assets ? `${assets.length} assets tracked` : 'No assets registered'}
            >
              {assets && assets.length > 0 ? (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', 
                  gap: 6,
                  padding: '8px 0',
                }}>
                  {assets.slice(0, 24).map((a) => (
                    <div
                      key={a.asset_code}
                      title={`${a.category} · ${a.location} · ${a.health}${a.mtbf_days ? ` · MTBF ${a.mtbf_days}d` : ''}`}
                      style={{
                        background: a.health === 'green' ? 'rgba(46, 125, 50, 0.1)' :
                                    a.health === 'amber' ? 'rgba(184, 168, 120, 0.1)' : 'rgba(184, 84, 42, 0.1)',
                        border: `1px solid ${a.health === 'green' ? 'var(--status-green)' :
                                              a.health === 'amber' ? 'var(--status-amber)' : 'var(--status-red)'}`,
                        borderRadius: 4,
                        padding: 8,
                        fontFamily: 'var(--mono, monospace)',
                        fontSize: 'var(--t-xs)',
                        minHeight: 50,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{a.asset_code}</div>
                      <div style={{ fontSize: 9, color: 'var(--ink-soft)' }}>{a.location}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ 
                  padding: 24, 
                  textAlign: 'center', 
                  color: 'var(--ink-soft)',
                  fontStyle: 'italic',
                }}>
                  Gap-M2 · 142 assets census required
                </div>
              )}
            </Container>
          </div>
        </>
      }
    />
  );
}
