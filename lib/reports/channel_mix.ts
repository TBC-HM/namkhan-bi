// lib/reports/channel_mix.ts
// Bookings + revenue by source over period; commission cost (best effort from
// v_channel_economics if available); direct % trend.

import type { RenderFn } from './_shared';
import {
  fmtMoneyDual,
  fmtNum,
  fmtPct,
  pageShell,
  resolveProperty,
  section,
  table,
  todayISO,
  paragraph,
  kpiGrid,
} from './_shared';

export const render: RenderFn = async (params, supabase) => {
  const theme = resolveProperty(params.property_id);
  const to = typeof params.to === 'string' ? params.to : todayISO(-1);
  const from = typeof params.from === 'string' ? params.from : todayISO(-30);

  // Snapshot mix (point-in-time view of all reservations)
  const { data: mix } = await supabase
    .from('v_channel_mix')
    .select('channel_group,source_name,room_nights,revenue,avg_adr')
    .order('revenue', { ascending: false });

  const rows = (mix || []).map((r: any) => ({
    channel: r.channel_group || '—',
    source: r.source_name || '—',
    nights: fmtNum(r.room_nights),
    rev: fmtMoneyDual(r.revenue, theme),
    adr: fmtMoneyDual(r.avg_adr, theme),
  }));

  const totalRev = (mix || []).reduce(
    (s: number, r: any) => s + Number(r.revenue || 0),
    0,
  );
  const totalNights = (mix || []).reduce(
    (s: number, r: any) => s + Number(r.room_nights || 0),
    0,
  );
  const direct = (mix || [])
    .filter((r: any) =>
      /direct|website|website-direct|direct-website/i.test(
        `${r.channel_group} ${r.source_name}`,
      ),
    )
    .reduce((s: number, r: any) => s + Number(r.revenue || 0), 0);
  const directPct = totalRev > 0 ? (direct / totalRev) * 100 : 0;

  // Commission cost (best effort)
  let commissionLine = 'Commission cost: not queried (no canonical view in this pass).';
  try {
    const { data: ec } = await supabase
      .from('v_channel_economics')
      .select('*')
      .limit(500);
    if (ec && ec.length > 0) {
      const totalComm = ec.reduce(
        (s: number, r: any) =>
          s + Number(r.commission_usd ?? r.commission ?? r.commission_amount ?? 0),
        0,
      );
      if (totalComm > 0)
        commissionLine = `Total commission: ${fmtMoneyDual(totalComm, theme)} (${fmtPct((totalComm / Math.max(totalRev, 1)) * 100)} of revenue).`;
    }
  } catch {
    /* non-fatal */
  }

  const summary_text =
    `${theme.property_name} channel mix ${from}→${to}: ${fmtNum(totalNights)} rn, ` +
    `${fmtMoneyDual(totalRev, theme)} revenue, direct ${fmtPct(directPct)}.`;

  const html = pageShell({
    theme,
    title: 'Channel Mix Report',
    subtitle: `${from} → ${to}`,
    bodyHtml:
      section(
        'Headline',
        theme,
        kpiGrid(
          [
            { label: 'Total revenue', value: fmtMoneyDual(totalRev, theme) },
            { label: 'Room nights', value: fmtNum(totalNights) },
            { label: 'Direct %', value: fmtPct(directPct) },
          ],
          theme,
        ),
      ) +
      section(
        'Sources',
        theme,
        table(
          [
            { key: 'channel', label: 'Channel group' },
            { key: 'source', label: 'Source' },
            { key: 'nights', label: 'Nights', align: 'right' },
            { key: 'rev', label: 'Revenue', align: 'right' },
            { key: 'adr', label: 'Avg ADR', align: 'right' },
          ],
          rows,
          theme,
        ),
      ) +
      section('Commission cost', theme, paragraph(commissionLine, theme)),
  });

  return {
    html,
    subject: `${theme.property_name} · Channel mix · ${from}–${to}`,
    summary_text,
  };
};
