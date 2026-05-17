// lib/reports/pace.ts
// OTB pace 7/30/90 from v_otb_pace (property-scoped), channel mix from v_channel_mix.

import type { RenderFn } from './_shared';
import {
  fmtMoneyDual,
  fmtNum,
  fmtPct,
  kpiGrid,
  pageShell,
  paragraph,
  resolveProperty,
  section,
  table,
  todayISO,
} from './_shared';

function rollupRange(rows: any[], from: string, to: string) {
  const sub = rows.filter(
    (r) => r.night_date >= from && r.night_date <= to,
  );
  const rooms = sub.reduce((s, r) => s + Number(r.confirmed_rooms || 0), 0);
  const revenue = sub.reduce((s, r) => s + Number(r.confirmed_revenue || 0), 0);
  const adr = rooms > 0 ? revenue / rooms : 0;
  return { rooms, revenue, adr, nights: sub.length };
}

export const render: RenderFn = async (params, supabase) => {
  const theme = resolveProperty(params.property_id);
  const today = todayISO();
  const horizon = Number(params.horizon_days || 90);
  const horizonEnd = todayISO(horizon);

  const { data: otb } = await supabase
    .from('v_otb_pace')
    .select('night_date,property_id,confirmed_rooms,confirmed_revenue,cancelled_rooms')
    .eq('property_id', theme.property_id)
    .gte('night_date', today)
    .lte('night_date', horizonEnd)
    .order('night_date');

  const rows = otb || [];
  const r7 = rollupRange(rows, today, todayISO(7));
  const r30 = rollupRange(rows, today, todayISO(30));
  const r90 = rollupRange(rows, today, todayISO(90));

  // Channel mix (period-scoped — view is current view of all bookings)
  const { data: chMix } = await supabase
    .from('v_channel_mix')
    .select('channel_group,source_name,room_nights,revenue,avg_adr')
    .order('revenue', { ascending: false })
    .limit(15);

  // Top movers: nights with highest OTB rooms in the next 30d
  const top = [...rows]
    .filter((r) => r.night_date <= todayISO(30))
    .sort((a, b) => Number(b.confirmed_rooms || 0) - Number(a.confirmed_rooms || 0))
    .slice(0, 10);

  const kpisHtml = kpiGrid(
    [
      {
        label: 'Next 7 days',
        value: `${fmtNum(r7.rooms)} rn`,
        sub: `${fmtMoneyDual(r7.revenue, theme)} · ADR ${fmtMoneyDual(r7.adr, theme)}`,
      },
      {
        label: 'Next 30 days',
        value: `${fmtNum(r30.rooms)} rn`,
        sub: `${fmtMoneyDual(r30.revenue, theme)} · ADR ${fmtMoneyDual(r30.adr, theme)}`,
      },
      {
        label: 'Next 90 days',
        value: `${fmtNum(r90.rooms)} rn`,
        sub: `${fmtMoneyDual(r90.revenue, theme)} · ADR ${fmtMoneyDual(r90.adr, theme)}`,
      },
    ],
    theme,
  );

  const chRows = (chMix || []).map((r: any) => ({
    channel: r.channel_group || '—',
    source: r.source_name || '—',
    nights: fmtNum(r.room_nights),
    rev: fmtMoneyDual(r.revenue, theme),
    adr: fmtMoneyDual(r.avg_adr, theme),
  }));

  const topRows = top.map((r: any) => ({
    night: r.night_date,
    rooms: fmtNum(r.confirmed_rooms),
    rev: fmtMoneyDual(r.confirmed_revenue, theme),
    canc: fmtNum(r.cancelled_rooms),
  }));

  const summary_text =
    `${theme.property_name} pace ${today}→${horizonEnd}: ` +
    `7d ${r7.rooms} rn, 30d ${r30.rooms} rn, 90d ${r90.rooms} rn. ` +
    `90-day OTB ADR ${fmtMoneyDual(r90.adr, theme)}.`;

  const note_html = paragraph(
    'LY / forecast comparators will fold in once v_pace_curve receives a property_id filter — Namkhan-only deployment is fine for this pass.',
    theme,
  );

  const html = pageShell({
    theme,
    title: 'Pace Report',
    subtitle: `OTB through ${horizonEnd} (${horizon} days)`,
    bodyHtml:
      section('OTB rollup', theme, kpisHtml) +
      section('Channel mix (current view)', theme, table(
        [
          { key: 'channel', label: 'Channel' },
          { key: 'source', label: 'Source' },
          { key: 'nights', label: 'Nights', align: 'right' },
          { key: 'rev', label: 'Revenue', align: 'right' },
          { key: 'adr', label: 'Avg ADR', align: 'right' },
        ],
        chRows,
        theme,
      )) +
      section('Top OTB nights (next 30)', theme, table(
        [
          { key: 'night', label: 'Night' },
          { key: 'rooms', label: 'Rooms', align: 'right' },
          { key: 'rev', label: 'Revenue', align: 'right' },
          { key: 'canc', label: 'Cxl rooms', align: 'right' },
        ],
        topRows,
        theme,
      )) +
      note_html,
  });

  return {
    html,
    subject: `${theme.property_name} · Pace report · ${today}`,
    summary_text,
  };
};
