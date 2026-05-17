// lib/reports/_shared.ts
// PBS 2026-05-13 #report-templates
// Shared utilities for server-side report rendering:
//   - property theming (LAK + USD parenthetical for Namkhan; EUR for Donna)
//   - small HTML primitives (inline-styled — required for emailable HTML)
//   - safe formatting helpers
//
// Every template must filter property-scoped data; this module exposes the
// resolved `PropertyContext` (theme colors, currency rules, FX) so callers
// never hardcode `260955` or hex literals.

import type { SupabaseClient } from '@supabase/supabase-js';

export type RenderResult = {
  html: string;
  subject: string;
  summary_text: string;
};

export type RenderParams = Record<string, any> & { property_id?: number | string };

export type RenderFn = (
  params: RenderParams,
  supabase: SupabaseClient,
) => Promise<RenderResult>;

// ---------------------------------------------------------------------------
// Property context (theme + FX) — kept tiny, no hex outside this server-side
// helper. Emailed HTML inlines these into style attributes per template.
// ---------------------------------------------------------------------------

export type PropertyTheme = {
  property_id: number;
  property_name: string;
  base_ccy: 'LAK' | 'EUR';
  comms_ccy: 'USD' | 'EUR';
  fx_to_comms: number;            // 1 base ccy = N comms ccy units
  colors: {
    ink: string;
    muted: string;
    border: string;
    accent: string;
    bg: string;
    band: string;
    good: string;
    warn: string;
    bad: string;
  };
};

export const FX_LAK_PER_USD = Number(process.env.NEXT_PUBLIC_FX_LAK_USD || 21800);

export function resolveProperty(property_id?: number | string): PropertyTheme {
  const id = Number(property_id ?? 260955);
  if (id === 1000001) {
    // Donna (EUR base)
    return {
      property_id: 1000001,
      property_name: 'Donna',
      base_ccy: 'EUR',
      comms_ccy: 'EUR',
      fx_to_comms: 1,
      colors: {
        ink: '#1F2937',
        muted: '#6B7280',
        border: '#E5E7EB',
        accent: '#0F766E',
        bg: '#FFFFFF',
        band: '#F8FAFC',
        good: '#15803D',
        warn: '#B45309',
        bad: '#B91C1C',
      },
    };
  }
  // Default: Namkhan (260955) — LAK base, USD comms
  return {
    property_id: 260955,
    property_name: 'The Namkhan Retreat',
    base_ccy: 'LAK',
    comms_ccy: 'USD',
    fx_to_comms: 1 / FX_LAK_PER_USD,
    colors: {
      ink: '#1F2937',
      muted: '#6B7280',
      border: '#E5E7EB',
      accent: '#2D5B4C',
      bg: '#FFFFFF',
      band: '#F7F5F0',
      good: '#15803D',
      warn: '#B45309',
      bad: '#B91C1C',
    },
  };
}

// ---------------------------------------------------------------------------
// Formatting (purpose-built for emailed HTML; lib/format.ts handles UI)
// ---------------------------------------------------------------------------

export function fmtUSD(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return '—';
  const v = Number(n);
  const abs = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}

export function fmtLAK(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return '—';
  const v = Number(n);
  const abs = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (abs >= 1_000_000_000) return `${sign}₭${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}₭${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}₭${(abs / 1_000).toFixed(0)}k`;
  return `${sign}₭${Math.round(abs).toLocaleString('en-US')}`;
}

export function fmtEUR(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return '—';
  const v = Number(n);
  return `€${Math.round(v).toLocaleString('en-US')}`;
}

/**
 * Per project rule: LAK base + USD parenthetical at FX 21,800 (Namkhan);
 * EUR for Donna. `n_usd` is the value in the comms currency (USD or EUR).
 */
export function fmtMoneyDual(
  n_usd: number | null | undefined,
  theme: PropertyTheme,
): string {
  if (n_usd == null || isNaN(Number(n_usd))) return '—';
  if (theme.comms_ccy === 'EUR') return fmtEUR(n_usd);
  // Namkhan: USD primary, LAK in parens
  const lak = Number(n_usd) * FX_LAK_PER_USD;
  return `${fmtUSD(n_usd)} (${fmtLAK(lak / FX_LAK_PER_USD)})`;
  // Note: fmtLAK takes USD-equivalent; converts internally via FX_LAK_PER_USD.
}

export function fmtPct(n: number | null | undefined, dp = 1): string {
  if (n == null || isNaN(Number(n))) return '—';
  return `${Number(n).toFixed(dp)}%`;
}

export function fmtNum(n: number | null | undefined, dp = 0): string {
  if (n == null || isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: dp });
}

export function fmtDateISO(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '—';
  return dt.toISOString().slice(0, 10);
}

export function fmtDateLong(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// HTML primitives (inline-styled — emailed HTML standard)
// ---------------------------------------------------------------------------

export function pageShell(opts: {
  theme: PropertyTheme;
  title: string;
  subtitle?: string;
  bodyHtml: string;
}): string {
  const { theme, title, subtitle, bodyHtml } = opts;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${theme.colors.bg};color:${theme.colors.ink};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;">
<div style="max-width:720px;margin:0 auto;padding:24px;">
  <div style="border-bottom:2px solid ${theme.colors.accent};padding-bottom:12px;margin-bottom:20px;">
    <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${theme.colors.muted};">${escapeHtml(theme.property_name)}</div>
    <div style="font-size:22px;font-weight:600;margin-top:2px;color:${theme.colors.ink};">${escapeHtml(title)}</div>
    ${subtitle ? `<div style="font-size:13px;color:${theme.colors.muted};margin-top:2px;">${escapeHtml(subtitle)}</div>` : ''}
  </div>
  ${bodyHtml}
  <div style="margin-top:32px;padding-top:12px;border-top:1px solid ${theme.colors.border};font-size:11px;color:${theme.colors.muted};">
    Generated ${escapeHtml(new Date().toISOString())} · property ${theme.property_id}
  </div>
</div>
</body></html>`;
}

export function section(title: string, theme: PropertyTheme, bodyHtml: string): string {
  return `<div style="margin-top:24px;">
    <div style="font-size:13px;font-weight:600;color:${theme.colors.ink};margin-bottom:8px;letter-spacing:0.02em;text-transform:uppercase;">${escapeHtml(title)}</div>
    ${bodyHtml}
  </div>`;
}

export function kpiGrid(
  items: Array<{ label: string; value: string; sub?: string }>,
  theme: PropertyTheme,
): string {
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tr>${items
    .map(
      (k) => `<td style="padding:10px 12px;border:1px solid ${theme.colors.border};background:${theme.colors.band};vertical-align:top;">
        <div style="font-size:11px;color:${theme.colors.muted};text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(k.label)}</div>
        <div style="font-size:20px;font-weight:600;color:${theme.colors.ink};margin-top:4px;">${k.value}</div>
        ${k.sub ? `<div style="font-size:11px;color:${theme.colors.muted};margin-top:2px;">${escapeHtml(k.sub)}</div>` : ''}
      </td>`,
    )
    .join('')}</tr></table>`;
}

export function table(
  cols: Array<{ key: string; label: string; align?: 'left' | 'right' }>,
  rows: Array<Record<string, any>>,
  theme: PropertyTheme,
): string {
  const head = cols
    .map(
      (c) =>
        `<th style="text-align:${c.align || 'left'};padding:6px 10px;border-bottom:1px solid ${theme.colors.border};font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${theme.colors.muted};">${escapeHtml(c.label)}</th>`,
    )
    .join('');
  const body = rows
    .map(
      (r) =>
        `<tr>${cols
          .map(
            (c) =>
              `<td style="padding:6px 10px;border-bottom:1px solid ${theme.colors.border};text-align:${c.align || 'left'};font-size:13px;color:${theme.colors.ink};">${r[c.key] == null ? '—' : (typeof r[c.key] === 'string' ? r[c.key] : escapeHtml(r[c.key]))}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${cols.length}" style="padding:12px;color:${theme.colors.muted};font-size:12px;">No data.</td></tr>`}</tbody></table>`;
}

export function flag(
  variancePct: number | null | undefined,
  theme: PropertyTheme,
): string {
  if (variancePct == null || isNaN(Number(variancePct))) {
    return `<span style="color:${theme.colors.muted};">—</span>`;
  }
  const v = Number(variancePct);
  const color =
    v <= -10 ? theme.colors.bad : v < -2 ? theme.colors.warn : theme.colors.good;
  return `<span style="color:${color};font-weight:600;">${v > 0 ? '+' : ''}${v.toFixed(1)}%</span>`;
}

export function variance(
  actual: number | null | undefined,
  base: number | null | undefined,
): number | null {
  if (actual == null || base == null || Number(base) === 0) return null;
  return ((Number(actual) - Number(base)) / Number(base)) * 100;
}

export function paragraph(text: string, theme: PropertyTheme): string {
  return `<p style="margin:8px 0;color:${theme.colors.ink};font-size:13px;">${escapeHtml(text)}</p>`;
}

export function note(text: string, theme: PropertyTheme): string {
  return `<div style="background:${theme.colors.band};border-left:3px solid ${theme.colors.accent};padding:8px 12px;margin:12px 0;font-size:12px;color:${theme.colors.muted};">${escapeHtml(text)}</div>`;
}
