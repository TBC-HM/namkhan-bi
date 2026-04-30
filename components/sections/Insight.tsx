// components/sections/Insight.tsx
// Italic serif callout below cards — moss/warn/alert tones.

import { ReactNode } from 'react';

interface Props {
  tone?: 'info' | 'warn' | 'alert';
  eye: string;            // mono eyebrow text
  children: ReactNode;
}

export default function Insight({ tone = 'info', eye, children }: Props) {
  const cls = tone === 'warn' ? 'warn' : tone === 'alert' ? 'alert' : '';
  return (
    <div className={`insight ${cls}`}>
      <span className="insight-eye">{eye}</span>
      {children}
    </div>
  );
}
