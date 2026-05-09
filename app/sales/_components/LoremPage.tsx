// app/sales/_components/LoremPage.tsx
// Reusable scaffold for sub-tabs awaiting data. PBS manifesto 2026-05-09:
// rendered inside <Page> with <Panel>; KPIs go through <KpiBox state="pending">.

import { ReactNode } from 'react';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import ArtifactActions from '@/components/page/ArtifactActions';
import { SALES_SUBPAGES } from '../_subpages';

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
  const ctx = (kind: 'panel' | 'brief' | 'table' | 'kpi', title: string) => ({ kind, title, dept: pillar.toLowerCase() });
  return (
    <Page
      eyebrow={`${pillar} · ${tab}`}
      title={<>{tab} · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>not yet wired</em></>}
      subPages={SALES_SUBPAGES}
    >
      <div style={{ fontSize: 'var(--t-md)', color: 'var(--ink-soft)', marginBottom: 14 }}>{lede}</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        {kpis.map((k) => (
          <KpiBox
            key={k.scope}
            value={null}
            unit="count"
            label={k.scope}
            state="pending"
            tooltip={`${k.scope} · ${k.sub ?? 'awaiting data'}`}
          />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {sections.map((s) => (
          <Panel key={s.heading} title={s.heading} eyebrow="awaiting data" actions={<ArtifactActions context={ctx('panel', s.heading)} />}>
            <div style={{ fontSize: 'var(--t-md)', color: 'var(--ink-faint)', fontStyle: 'italic', lineHeight: 1.6 }}>{s.body}</div>
          </Panel>
        ))}
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--st-warn-bg)', border: '1px solid var(--st-warn-bd)', borderRadius: 6, color: 'var(--brass)', fontSize: 'var(--t-sm)' }}>
        <strong>Not wired.</strong> {dataSourceNote}
      </div>
    </Page>
  );
}

export const LOREM_SHORT = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.';
export const LOREM_LONG = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';
