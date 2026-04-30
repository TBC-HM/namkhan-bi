// components/sections/PanelHero.tsx
// Top hero strip: one big moss-tile headline + 4 KPI tiles side by side.
// Used as the first thing on every panel.

import { ReactNode } from 'react';

interface Props {
  eyebrow: string;
  title: string;
  emphasis?: string;
  sub?: string;
  kpis: ReactNode;     // pass <KpiCard /> children (4 of them)
}

export default function PanelHero({ eyebrow, title, emphasis, sub, kpis }: Props) {
  return (
    <div className="panel-hero">
      <div className="panel-headline">
        <div className="panel-headline-eyebrow">{eyebrow}</div>
        <h2>
          {title}
          {emphasis && <> <em>{emphasis}</em></>}
        </h2>
        {sub && <div className="panel-headline-sub">{sub}</div>}
      </div>
      {kpis}
    </div>
  );
}
