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
      <div style={{ fontSize: 11, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 14 }}>
        <strong style={{ color: '#4a4538' }}>{pillar}</strong> › {tab}
      </div>
      <h1 style={{ margin: '4px 0 2px', fontFamily: 'Georgia, serif', fontWeight: 500, fontSize: 30 }}>
        {tab} · <em style={{ color: '#a17a4f' }}>not yet wired</em>
      </h1>
      <div style={{ fontSize: 13, color: '#4a4538' }}>{lede}</div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(kpis.length, 5)}, minmax(0, 1fr))`, gap: 10, margin: '14px 0' }}>
        {kpis.map((k) => (
          <div key={k.scope} style={{ background: '#fff', border: '1px solid #e6dfc9', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 10.5, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.scope}</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 500, color: '#c5b89a', fontStyle: 'italic', margin: '2px 0' }}>{k.value ?? 'lorem'}</div>
            <div style={{ fontSize: 11, color: '#8a8170' }}>{k.sub ?? '—'}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        {sections.map((s) => (
          <div key={s.heading} style={{ background: '#fff', border: '1px solid #e6dfc9', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 10.5, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.heading}</div>
            <div style={{ fontSize: 13, color: '#c5b89a', fontStyle: 'italic', lineHeight: 1.6 }}>{s.body}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', background: '#fef3c7', border: '1px solid #f3d57a', borderRadius: 6, color: '#5e4818', fontSize: 11.5 }}>
        <strong>Not wired.</strong> {dataSourceNote}
      </div>
    </>
  );
}

export const LOREM_SHORT = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.';
export const LOREM_LONG = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';
