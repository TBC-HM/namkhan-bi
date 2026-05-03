// app/sales/_components/LoremPage.tsx
// Reusable "lorem ipsum" page scaffold for unwired sub-tabs.
// Shows the IA the user can expect, with explicit lorem placeholders so
// stakeholders can see at a glance which sections are awaiting data.

import { ReactNode } from 'react';

export interface LoremBlock {
  scope: string;
  value?: ReactNode;
  sub?: string;
}

interface Props {
  pillar: string;
  tab: string;
  lede: string;
  kpis: LoremBlock[];
  sections: Array<{ heading: string; body: string }>;
  dataSourceNote: string;
}

export default function LoremPage({ pillar, tab, lede, kpis, sections, dataSourceNote }: Props) {
  return (
    <>
      <div style={{ fontSize: "var(--t-sm)", color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 14 }}>
        <strong style={{ color: 'var(--ink-soft)' }}>{pillar}</strong> › {tab}
      </div>
      <h1 style={{ margin: '4px 0 2px', fontFamily: 'var(--serif)', fontWeight: 500, fontSize: "var(--t-3xl)", letterSpacing: '-0.01em' }}>
        {tab} · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>not yet wired</em>
      </h1>
      <div style={{ fontSize: "var(--t-md)", color: 'var(--ink-soft)' }}>{lede}</div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(kpis.length, 5)}, minmax(0, 1fr))`, gap: 10, margin: '14px 0' }}>
        {kpis.map((k) => (
          <div
            key={k.scope}
            className="kpi-box"
            data-tooltip={`${k.scope} · ${k.sub ?? 'awaiting data'}`}
          >
            <div className="kpi-tile-scope">{k.scope}</div>
            <div className="kpi-tile-value lorem">{k.value ?? 'lorem'}</div>
            <div className="kpi-tile-sub">{k.sub ?? '—'}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        {sections.map((s) => (
          <div key={s.heading} className="panel">
            <div className="kpi-tile-scope" style={{ marginBottom: 6 }}>{s.heading}</div>
            <div style={{ fontSize: "var(--t-md)", color: 'var(--ink-faint)', fontStyle: 'italic', lineHeight: 1.6 }}>{s.body}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--st-warn-bg)', border: '1px solid var(--st-warn-bd)', borderRadius: 6, color: 'var(--brass)', fontSize: "var(--t-sm)" }}>
        <strong>Not wired.</strong> {dataSourceNote}
      </div>
    </>
  );
}

export const LOREM_SHORT = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.';
export const LOREM_LONG = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';
