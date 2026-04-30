// components/ops/GuardrailsBanner.tsx
// Block 9 — Yellow callout where external-system writes are involved.
// Per package hard rule: no auto-execution of Cloudbeds writes, vendor POs, guest msgs.

import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export default function GuardrailsBanner({ children }: Props) {
  return (
    <div
      style={{
        margin: '22px 0 32px',
        padding: '14px 16px',
        background: '#fef3c7',
        border: '1px solid #f3d57a',
        borderRadius: 8,
        color: '#5e4818',
        fontSize: 12.5,
        lineHeight: 1.5,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          fontSize: 10,
          background: '#fff8eb',
          border: '1px solid #f3d57a',
          color: '#5e4818',
          padding: '1px 6px',
          borderRadius: 3,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 700,
          marginRight: 8,
          verticalAlign: 'middle',
        }}
      >
        ⚙ Agent Guardrails
      </span>
      {children}
    </div>
  );
}
