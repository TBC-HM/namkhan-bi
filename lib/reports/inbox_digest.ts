// lib/reports/inbox_digest.ts
// Last 7 days of inbound mail volume + top senders.
// Uses sales.email_messages (cross-schema; read-only).

import type { RenderFn } from './_shared';
import {
  fmtNum,
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
  const end = typeof params.week_end === 'string' ? params.week_end : todayISO();
  const endDate = new Date(end);
  const startDate = new Date(end);
  startDate.setUTCDate(startDate.getUTCDate() - 6);
  const start = startDate.toISOString().slice(0, 10);

  let total = 0;
  let inbound = 0;
  let outbound = 0;
  const senderMap = new Map<string, number>();
  let warn: string | null = null;

  try {
    const { data, error } = await supabase
      .schema('sales')
      .from('email_messages')
      .select('direction,from_email,from_name,received_at,sent_at,thread_id')
      .gte('received_at', `${start}T00:00:00Z`)
      .lte('received_at', `${end}T23:59:59Z`)
      .limit(5000);
    if (error) {
      warn = `email_messages read failed: ${error.message}`;
    } else {
      for (const r of (data || []) as any[]) {
        total += 1;
        if ((r.direction || '').toLowerCase() === 'inbound') inbound += 1;
        else outbound += 1;
        const k = r.from_email || r.from_name || 'unknown';
        senderMap.set(k, (senderMap.get(k) || 0) + 1);
      }
    }
  } catch (e: any) {
    warn = `Could not read sales.email_messages: ${e?.message || e}`;
  }

  const topSenders = Array.from(senderMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([sender, count]) => ({ sender, count: fmtNum(count) }));

  const summary_text =
    `${theme.property_name} inbox ${start}→${end}: ${fmtNum(total)} mails (${fmtNum(inbound)} in, ${fmtNum(outbound)} out).`;

  const html = pageShell({
    theme,
    title: 'Inbox Digest',
    subtitle: `${start} → ${end}`,
    bodyHtml:
      section(
        'Volume',
        theme,
        kpiGrid(
          [
            { label: 'Total', value: fmtNum(total) },
            { label: 'Inbound', value: fmtNum(inbound) },
            { label: 'Outbound', value: fmtNum(outbound) },
          ],
          theme,
        ),
      ) +
      section(
        'Top senders',
        theme,
        table(
          [
            { key: 'sender', label: 'Sender' },
            { key: 'count', label: 'Mails', align: 'right' },
          ],
          topSenders,
          theme,
        ),
      ) +
      paragraph(
        'Response-time histogram and unresponded threads will fold in once thread-level reply telemetry stabilises (currently inferred from email_messages only).',
        theme,
      ) +
      (warn ? paragraph(warn, theme) : ''),
  });

  return {
    html,
    subject: `${theme.property_name} · Inbox digest · w/e ${end}`,
    summary_text,
  };
};
