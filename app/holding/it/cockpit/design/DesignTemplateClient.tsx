'use client';

// app/holding/it/cockpit/design/DesignTemplateClient.tsx
// What the design contract ACTUALLY means, rendered: live atoms with sample
// data, locked token swatches, format law in action, per-property currency
// behaviour, forbidden patterns. Contract version banner proves the doc is
// read live from documentation.documents. PBS 2026-07-25.
// v2 2026-07-25 pm: KpiTile section = HOUSE STANDARD sm + LY pill (PBS, screenshot /h/260955/revenue).

import { Container, KpiTile, MetricRow } from '@/app/(cockpit)/_design';

const MONO = 'JetBrains Mono, ui-monospace, monospace';

const BRAND_TOKENS: Array<{ token: string; hex: string; use: string }> = [
  { token: '--bg',         hex: '#F4EFE2', use: 'page background (cockpit scope)' },
  { token: '--paper',      hex: '#FFFFFF', use: 'cards, tables, tiles — DEFAULT surface' },
  { token: '--primary',    hex: '#1F3A2E', use: 'primary green — actions, active states' },
  { token: '--sand',       hex: '#B8A878', use: 'amber/attention accents' },
  { token: '--terracotta', hex: '#B8542A', use: 'red/at-risk accents' },
  { token: '--ink',        hex: '#1B1B1B', use: 'text' },
  { token: '--ink-soft',   hex: '#5A5A5A', use: 'muted text' },
  { token: '--hairline',   hex: '#E6DFCC', use: 'ALL borders + dividers' },
];

const STATUS_TOKENS: Array<{ token: string; hex: string; use: string }> = [
  { token: '--status-green', hex: '#2E7D32', use: 'wired · live · on-track · paid' },
  { token: '--status-amber', hex: '#B8A878', use: 'partial · warning · attention' },
  { token: '--status-red',   hex: '#B8542A', use: 'blocked · overdue · at-risk' },
  { token: '--status-grey',  hex: '#8A8A8A', use: 'unknown · n/a · disabled' },
];

const FORMAT_ROWS: Array<{ metric: string; nk: string; dp: string; delta: number; goodUp: boolean; note: string }> = [
  { metric: 'Rooms revenue MTD', nk: '$48,210',  dp: '€112,540', delta: 12.3,  goodUp: true,  note: 'money via v_property_display — NEVER mix currencies in one row' },
  { metric: 'ADR',               nk: '$186',     dp: '€245',     delta: -3.1,  goodUp: true,  note: 'negative + good_direction=up → red ▼' },
  { metric: 'Cancellation rate', nk: '8.4%',     dp: '11.2%',    delta: -2.2,  goodUp: false, note: 'DOWN is good here → negative delta renders GREEN' },
  { metric: 'Occupancy · MTD',   nk: '61.5%',    dp: '74.0%',    delta: 5.0,   goodUp: true,  note: 'scope ALWAYS in the label — never bare "Occupancy" (ADR-123)' },
];

function deltaCell(delta: number, goodUp: boolean) {
  const good = (delta > 0 && goodUp) || (delta < 0 && !goodUp);
  const color = delta === 0 ? 'var(--ink-soft)' : good ? 'var(--status-green, #2E7D32)' : 'var(--status-red, #B8542A)';
  const glyph = delta === 0 ? '–' : delta > 0 ? '▲' : '▼';
  return (
    <span style={{ color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
      {glyph} {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

function Swatch({ hex }: { hex: string }) {
  return <span style={{ display: 'inline-block', width: 30, height: 16, borderRadius: 3, background: hex,
    border: '1px solid var(--hairline)', verticalAlign: 'middle' }} />;
}

const thStyle = { textAlign: 'left' as const, fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600,
  padding: '6px 8px', borderBottom: '1px solid var(--hairline)', background: 'var(--paper)' };
const tdStyle = { fontSize: 12.5, padding: '6px 8px', borderBottom: '1px solid var(--hairline)',
  background: 'var(--paper)', color: 'var(--ink)' };
const tdNum = { ...tdStyle, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const };

export function DesignTemplateClient({ meta }: { meta: { version: number; title: string; updated: string } }) {
  return (
    <div style={{ maxWidth: 1080, color: 'var(--ink)' }}>
      <div style={{ margin: '4px 0 14px' }}>
        <div style={{ fontSize: 20, fontWeight: 650 }}>Design contract — live template</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 4 }}>
          Every element below is rendered by the REAL design-system atoms, not screenshots.
          If a page in the app looks different from this page, that page is in violation (or pre-dates the contract — see handbook Lesson 18, archaeological layers).
        </div>
      </div>

      <div style={{ border: '1px solid var(--hairline)', borderLeft: '3px solid var(--primary)', borderRadius: 6,
        background: 'var(--paper)', padding: '10px 14px', marginBottom: 16, fontSize: 12.5 }}>
        <b>Contract read LIVE from documentation.documents:</b> v{meta.version} · {meta.title}
        <span style={{ color: 'var(--ink-soft)' }}> · last_updated {meta.updated} · if this says v14+ the doc IS current and IS being read — enforcement (lint/CI), not reading, is the open gap.</span>
      </div>

      <Container title="1 · Brand tokens (locked §2) — the ONLY colors allowed outside globals.css: none. Tokens only." density="compact">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thStyle}>Token</th><th style={thStyle}>Resolves</th><th style={thStyle}>Swatch</th><th style={thStyle}>Use</th></tr></thead>
          <tbody>
            {BRAND_TOKENS.map((t) => (
              <tr key={t.token}>
                <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 11.5 }}>{t.token}</td>
                <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 11.5 }}>{t.hex}</td>
                <td style={tdStyle}><Swatch hex={t.hex} /></td>
                <td style={tdStyle}>{t.use}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 8 }}>
          Property scope note: /h/[property_id]/* pages resolve these through ThemeInjector — Donna overrides table/dropdown chrome via the --tbl-* set.
          NEVER use --paper-warm / --paper-deep on table cells (resolves DARK on Namkhan — the July-1 dark-header incident). v14 rule: tokens win; hex only inside globals.css.
        </div>
      </Container>

      <Container title="2 · Status semantics — color = status, never branding" density="compact">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {STATUS_TOKENS.map((t) => (
              <tr key={t.token}>
                <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 11.5, width: 160 }}>{t.token}</td>
                <td style={{ ...tdStyle, width: 60 }}><Swatch hex={t.hex} /></td>
                <td style={tdStyle}>{t.use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Container>

      <Container title="3 · KpiTile — the ONE way a number appears (HOUSE STANDARD: size sm + LY pill, PBS 2026-07-25)" density="compact">
        <MetricRow tiles={[
          { label: 'OCC · tonight', value: '40.00%', size: 'sm', stly: 'LY 0.00%',
            footnote: '12 of 30 rooms' },
          { label: 'ADR · today', value: '$151', size: 'sm', stly: 'LY —',
            footnote: 'in-house · net' },
          { label: 'REVPAR · today', value: '$60', size: 'sm', stly: 'LY $0',
            footnote: 'vs capacity · net' },
          { label: 'Cancellation rate', value: '8.4%', size: 'sm', stly: 'LY 11.1%',
            delta: { value: -2.2, period: 'vs prev month', direction: 'down', isGoodWhenUp: false },
            footnote: 'DOWN is good → green (polarity §11.1)' },
        ]} />
        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 8 }}>
          House standard (locked 2026-07-25, reference = /h/260955/revenue headline rows): tiles are size <b>sm</b> by default,
          and every tile whose metric has a last-year value carries the <b>stly</b> pill (bottom-right "LY …" box, pre-formatted).
          md/lg sizes only where a page has ≤3 hero numbers. STLY/Budget as compare[] lines stay for analytical tiles;
          the LY pill is the compact default everywhere else.
        </div>
      </Container>

      <Container title="4 · Format law (§11) in action — per property" density="compact">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={thStyle}>Metric</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Namkhan 260955 (USD)</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Donna 1000001 (EUR)</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Δ vs STLY</th>
            <th style={thStyle}>Rule demonstrated</th>
          </tr></thead>
          <tbody>
            {FORMAT_ROWS.map((r) => (
              <tr key={r.metric}>
                <td style={tdStyle}>{r.metric}</td>
                <td style={tdNum}>{r.nk}</td>
                <td style={tdNum}>{r.dp}</td>
                <td style={tdNum}>{deltaCell(r.delta, r.goodUp)}</td>
                <td style={{ ...tdStyle, fontSize: 11.5, color: 'var(--ink-soft)' }}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 8 }}>
          Absolutes are NEVER colour-coded — only deltas/comparisons. Numerics right-aligned, tabular-nums, thousands separators.
          Paper-white cells, hairline borders, ink text on th+td — no dark headers, no brass labels.
        </div>
      </Container>

      <Container title="5 · Forbidden (§7 + v14) — if you see these on any page, file it" density="compact">
        <ul style={{ fontSize: 12.5, lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
          <li>Hand-rolled tiles / tables / charts — compose from <span style={{ fontFamily: MONO, fontSize: 11.5 }}>@/app/(cockpit)/_design</span> only (deep imports forbidden).</li>
          <li>Hex colors in a page component — tokens only; hex lives in globals.css alone.</li>
          <li>STLY / Budget rendered as separate cards next to a tile — belongs INSIDE via compare[].</li>
          <li>Status colors used as branding.</li>
          <li>Dark table headers / brass th text (--paper-warm, --paper-deep on cells).</li>
          <li>Unprefixed URLs on multi-property surfaces — every link carries /h/[property_id] or /holding.</li>
          <li>Bare "Occupancy" labels — scope in the label, bound to v_occupancy_scoped.</li>
          <li>New component in _design without a contract entry (v14 squatter rule).</li>
        </ul>
      </Container>

      <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '4px 0 24px' }}>
        Reference implementations: HodLanding v2 (dept landings) · /university/* (reader surfaces, U.1–U.8) · this page (cockpit data surfaces).
        Full contract: Knowledge → All Docs → TBC Design System.
      </div>
    </div>
  );
}
