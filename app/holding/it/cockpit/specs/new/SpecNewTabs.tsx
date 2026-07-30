'use client';

// app/holding/it/cockpit/specs/new/SpecNewTabs.tsx — MD Intake v1
// Mode toggle for the Spec Builder: guided 8-section form (existing path)
// vs owner-MD upload (md-intake-v1). Pure presentational switch — both
// children receive the same server-fetched goal list.

import { useState } from 'react';
import SpecBuilderClient, { type GoalOption } from './SpecBuilderClient';
import UploadMdClient from './UploadMdClient';

const pill = (active: boolean): React.CSSProperties => ({
  fontSize: 13, fontWeight: 600, padding: '10px 20px', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
  border: '2px solid', borderColor: active ? '#1F3A2E' : '#E6DFCC',
  background: active ? '#1F3A2E' : '#FFFFFF',
  color: active ? '#FFFFFF' : '#5A5A5A',
});

export default function SpecNewTabs({ goals }: { goals: GoalOption[] }) {
  const [mode, setMode] = useState<'form' | 'upload'>('form');
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
        <button type="button" onClick={() => setMode('form')} style={pill(mode === 'form')}>
          📝 Guided form
          <div style={{ fontSize: 11, fontWeight: 400, marginTop: 3, opacity: 0.85 }}>answer 8 sections step by step</div>
        </button>
        <button type="button" onClick={() => setMode('upload')} style={pill(mode === 'upload')}>
          📄 Upload MD
          <div style={{ fontSize: 11, fontWeight: 400, marginTop: 3, opacity: 0.85 }}>drop an owner doc · auto-evaluated → brief</div>
        </button>
      </div>
      {mode === 'form' ? <SpecBuilderClient goals={goals} /> : <UploadMdClient goals={goals} />}
    </div>
  );
}
