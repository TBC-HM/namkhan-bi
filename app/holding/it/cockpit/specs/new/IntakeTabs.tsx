'use client';

// app/holding/it/cockpit/specs/new/IntakeTabs.tsx
// md-intake-v1: local two-mode toggle on the Spec Builder — the guided
// 8-section form (existing) vs. Upload MD (owner MD → verbatim canon →
// deterministic evaluation → brief + queue row). Local toggle only — the page
// keeps its existing sub-nav tab strip; no nav groups are added.

import { useState } from 'react';
import { TOKENS } from '@/app/holding/it/cockpit/_components/tokens';
import SpecBuilderClient, { type GoalOption } from './SpecBuilderClient';
import UploadMdClient from './UploadMdClient';

export default function IntakeTabs({ goals }: { goals: GoalOption[] }) {
  const [mode, setMode] = useState<'form' | 'upload'>('form');

  const pill = (active: boolean): React.CSSProperties => ({
    fontSize: 13, fontWeight: 600, padding: '10px 20px', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
    border: '2px solid', borderColor: active ? TOKENS.forest : TOKENS.border,
    background: active ? TOKENS.forest : TOKENS.bgRaised,
    color: active ? '#FFFFFF' : TOKENS.inkSoft,
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
        <button type="button" onClick={() => setMode('form')} style={pill(mode === 'form')}>
          ✍️ Guided form
          <div style={{ fontSize: 11, fontWeight: 400, marginTop: 3, opacity: 0.85 }}>answer 8 sections · agent context auto-injected</div>
        </button>
        <button type="button" onClick={() => setMode('upload')} style={pill(mode === 'upload')}>
          📄 Upload MD
          <div style={{ fontSize: 11, fontWeight: 400, marginTop: 3, opacity: 0.85 }}>owner MD → verbatim canon → evaluated → brief + queue row</div>
        </button>
      </div>
      {mode === 'form' ? <SpecBuilderClient goals={goals} /> : <UploadMdClient goals={goals} />}
    </div>
  );
}
