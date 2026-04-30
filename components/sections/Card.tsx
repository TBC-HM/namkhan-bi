// components/sections/Card.tsx
// Beyond Circle card — paper-warm background, line border, head with title and meta.

import { ReactNode } from 'react';

interface Props {
  title: string;
  emphasis?: string;        // italic moss accent inside title (after a space)
  sub?: string;             // small mono caption under title
  source?: string;          // brass source pill on the right
  actions?: ReactNode;      // top-right action bar (e.g. toggle group)
  children: ReactNode;
  className?: string;
}

export default function Card({
  title, emphasis, sub, source, actions, children, className = '',
}: Props) {
  return (
    <div className={`card ${className}`}>
      <div className="card-head">
        <div>
          <div className="card-title">
            {title}
            {emphasis && <> <em>{emphasis}</em></>}
          </div>
          {sub && <div className="card-sub">{sub}</div>}
        </div>
        <div style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
          {actions}
          {source && <span className="card-source">{source}</span>}
        </div>
      </div>
      {children}
    </div>
  );
}
