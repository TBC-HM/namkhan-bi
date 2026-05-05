// app/finance/pnl/CommentaryPanel.tsx
// Variance commentary auto-draft. Two states:
//  1) latest gl.commentary_drafts row for this period → display polished body
//  2) no draft yet → render the legacy template (children) as fallback
// Regenerate button posts to the server action that calls Claude and stores
// the new draft in gl.commentary_drafts, then revalidates the page.

import { regenerateCommentary } from './actions';
import type { ReactNode } from 'react';

interface Props {
  period: string; // YYYY-MM
  draftBody: string | null;
  draftCreatedAt: string | null;
  fallback: ReactNode;
  hasApiKey: boolean;
  payload: {
    monthLabel: string;
    totalRev: number;
    priorTotalRev: number;
    revVsPriorPct: number;
    gop: number | null;
    gopMomDelta: number | null;
    gopMomPct: number | null;
    revVsLyPct: number | null;
    agTotal: number;
    agPrior: number;
    fbLabour: number;
    fbRev: number;
    fbLabourPct: number | null;
    fbCogsPct: number | null;
    utilCur: number;
    utilPrior: number;
    occPct: number | null;
    adr: number | null;
    topVariances: { dept: string; delta: number }[];
  };
}

export default function CommentaryPanel({ period, draftBody, draftCreatedAt, fallback, hasApiKey, payload }: Props) {
  return (
    <>
      <div className="meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span>
          {draftBody ? (
            <>LLM draft · {draftCreatedAt ? new Date(draftCreatedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'unknown'}</>
          ) : (
            <>Template · numbers from gl.* · {hasApiKey ? 'Click Generate to rewrite via Claude.' : <strong>ANTHROPIC_API_KEY not set on Vercel — using template only.</strong>}</>
          )}
        </span>
        <form action={regenerateCommentary}>
          <input type="hidden" name="period" value={period} />
          <input type="hidden" name="payload" value={JSON.stringify(payload)} />
          <button
            type="submit"
            className="btn"
            disabled={!hasApiKey}
            title={hasApiKey ? 'Call Claude to rewrite' : 'Set ANTHROPIC_API_KEY on Vercel to enable'}
            style={{
              padding: '4px 10px',
              fontSize: 'var(--t-xs)',
              background: hasApiKey ? 'var(--green-2)' : 'var(--surf-2)',
              color: hasApiKey ? 'var(--paper-warm)' : 'var(--ink-mute)',
              cursor: hasApiKey ? 'pointer' : 'not-allowed',
              border: '1px solid var(--rule)',
              borderRadius: 3,
              fontFamily: 'var(--mono)',
              letterSpacing: 'var(--ls-extra)',
              textTransform: 'uppercase',
            }}
          >
            {draftBody ? '↻ Regenerate' : '⚡ Generate'}
          </button>
        </form>
      </div>
      <div className="comm" style={{ marginTop: 10 }}>
        {draftBody ? (
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{draftBody}</div>
        ) : (
          fallback
        )}
      </div>
    </>
  );
}
