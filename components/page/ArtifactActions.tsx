'use client';

// components/page/ArtifactActions.tsx
// PBS design manifesto rule #4 (locked 2026-05-09): every artifact carries
// the same 4 actions, always — ✦ AI · ⊕ Save · ↻ Schedule · 📁 Project.
// Drop into any <Panel actions={<ArtifactActions context={...} />}>.
//
// Default behaviour: each button dispatches a `CustomEvent` on `window`
// with detail = { context, ...extra }. The page-level handler routes the
// event to the right API call. This lets us wire artifacts page-by-page
// without touching every Panel call site.
//
// You can override any of the 4 by passing onAskAI / onSave / onSchedule /
// onAddToProject — when provided, they replace the default dispatch.

import { useState } from 'react';

export type ArtifactContext = {
  /** What kind of artifact: panel | kpi | brief | table | other */
  kind: 'panel' | 'kpi' | 'brief' | 'table' | 'other';
  /** Human-readable title (e.g. "RN by channel · 30d"). */
  title: string;
  /** One-line summary of what the artifact says (used by AI prompt). */
  signal?: string;
  /** Department slug (revenue / sales / ...) — for project pickers. */
  dept?: string;
  /** Optional payload for the action (e.g. table rows for Save to Reports). */
  payload?: unknown;
};

interface Props {
  context: ArtifactContext;
  onAskAI?:         (ctx: ArtifactContext) => void;
  onSave?:          (ctx: ArtifactContext) => void;
  onSchedule?:      (ctx: ArtifactContext, schedule: ScheduleChoice) => void;
  onAddToProject?:  (ctx: ArtifactContext) => void;
}

type ScheduleChoice = 'once' | 'daily' | 'weekly' | 'monthly';

const SCHEDULE_OPTIONS: { v: ScheduleChoice; label: string }[] = [
  { v: 'once',    label: 'Once'    },
  { v: 'daily',   label: 'Daily'   },
  { v: 'weekly',  label: 'Weekly'  },
  { v: 'monthly', label: 'Monthly' },
];

function dispatchArtifact(name: string, detail: unknown) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(`artifact:${name}`, { detail }));
}

export default function ArtifactActions({
  context, onAskAI, onSave, onSchedule, onAddToProject,
}: Props) {
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const askAI = () => {
    if (onAskAI) return onAskAI(context);
    dispatchArtifact('ai', { context });
  };
  const save = () => {
    if (onSave) return onSave(context);
    dispatchArtifact('save', { context });
  };
  const addToProject = () => {
    if (onAddToProject) return onAddToProject(context);
    dispatchArtifact('project', { context });
  };
  const pickSchedule = (s: ScheduleChoice) => {
    setScheduleOpen(false);
    if (onSchedule) return onSchedule(context, s);
    dispatchArtifact('schedule', { context, schedule: s });
  };

  return (
    <div style={S.row}>
      <IconBtn label="✦ AI"       title="Ask Vector about this"      onClick={askAI} />
      <IconBtn label="⊕"          title="Save to reports"            onClick={save} />
      <div style={{ position: 'relative' }}>
        <IconBtn
          label="↻"
          title="Schedule recurring"
          onClick={() => setScheduleOpen(o => !o)}
        />
        {scheduleOpen && (
          <div style={S.sched}>
            {SCHEDULE_OPTIONS.map(o => (
              <button key={o.v} onClick={() => pickSchedule(o.v)} style={S.schedItem}>
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <IconBtn label="📁"         title="Add to project"             onClick={addToProject} />
    </div>
  );
}

function IconBtn({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={title} aria-label={title} style={S.btn}>
      {label}
    </button>
  );
}

const S: Record<string, React.CSSProperties> = {
  row: { display: 'flex', alignItems: 'center', gap: 4 },
  btn: {
    background:    'transparent',
    border:        '1px solid #2a261d',
    borderRadius:  4,
    color:         '#9b907a',
    cursor:        'pointer',
    fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
    fontSize:      9,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    padding:       '3px 7px',
    lineHeight:    1.2,
    transition:    'color 100ms ease, border-color 100ms ease',
  },
  sched: {
    position: 'absolute', top: 26, right: 0, zIndex: 60,
    background: '#0f0d0a', border: '1px solid #2a261d', borderRadius: 6,
    padding: 4, minWidth: 110, boxShadow: '0 12px 28px rgba(0,0,0,0.6)',
    display: 'flex', flexDirection: 'column',
  },
  schedItem: {
    background:    'transparent',
    border:        'none',
    color:         '#d8cca8',
    cursor:        'pointer',
    fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
    fontSize:      10,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    padding:       '6px 10px',
    textAlign:     'left',
  },
};
