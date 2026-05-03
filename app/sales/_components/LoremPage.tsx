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
      <div style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 14 }}>
        <strong style={{ color: 'var(--ink-soft)' }}>{pillar}</strong> › {tab}
      </div>
      <h1 style={{ margin: '4px 0 2px', fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 30, letterSpacing: '-0.01em' }}>
        {tab} · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>not yet wired</em>
      </h1>
      <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{lede}</div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(kpis.length, 5)}, minmax(0, 1fr))`, gap: 10, margin: '14px 0' }}>
        {kpis.map((k) => (
          <div
            key={k.scope}
            className="kpi"
            data-tooltip={`${k.scope} · ${k.sub ?? 'awaiting data'}`}
            style={{ background: 'var(--paper-pure)', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '12px 14px' }}
          >
            <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.scope}</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, color: 'var(--ink-faint)', fontStyle: 'italic', margin: '2px 0' }}>{k.value ?? 'lorem'}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{k.sub ?? '—'}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        {sections.map((s) => (
          <div key={s.heading} style={{ background: 'var(--paper-pure)', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.heading}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-faint)', fontStyle: 'italic', lineHeight: 1.6 }}>{s.body}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--st-warn-bg)', border: '1px solid var(--st-warn-bd)', borderRadius: 6, color: 'var(--brass)', fontSize: 11.5 }}>
        <strong>Not wired.</strong> {dataSourceNote}
      </div>
    </>
  );
}

export const LOREM_SHORT = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.';
export const LOREM_LONG = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';
