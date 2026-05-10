'use client';

// components/page/DateRangePicker.tsx
// Quick-jump date-range + compare picker rendered inside the HeaderPills
// date-pill popup (ticket #691).
//
// Two button groups:
//   Window  — Today / 7d / 30d / 90d / YTD
//   Compare — STLY / Prior Period / None
//
// Active state is driven by current ?win / ?cmp URL params.
// Selecting any button calls router.push() with merged params, preserving
// all other existing query string keys (property, segment, etc.).
//
// Defaults: win=30d, cmp=none (no compare).

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import {
  type WinToken,
  type CmpToken,
  parseWin,
  parseCmp,
  WIN_DEFAULT,
  CMP_DEFAULT,
} from '../../lib/dateRangeFromParams';

const WIN_OPTIONS: Array<{ token: WinToken; label: string }> = [
  { token: 'today', label: 'Today' },
  { token: '7d',    label: '7d'   },
  { token: '30d',   label: '30d'  },
  { token: '90d',   label: '90d'  },
  { token: 'ytd',   label: 'YTD'  },
];

const CMP_OPTIONS: Array<{ token: CmpToken; label: string }> = [
  { token: 'stly',  label: 'STLY'         },
  { token: 'prior', label: 'Prior Period'  },
  { token: 'none',  label: 'None'          },
];

/** Hook: read + navigate ?win / ?cmp while preserving all other params. */
export function useDateWindow() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const win = parseWin(searchParams.get('win'));
  const cmp = parseCmp(searchParams.get('cmp'));

  const navigate = useCallback(
    (nextWin: WinToken, nextCmp: CmpToken) => {
      // Clone all existing params so property/segment/etc. are preserved.
      const params = new URLSearchParams(searchParams.toString());
      if (nextWin === WIN_DEFAULT) {
        params.delete('win');
      } else {
        params.set('win', nextWin);
      }
      if (nextCmp === CMP_DEFAULT) {
        params.delete('cmp');
      } else {
        params.set('cmp', nextCmp);
      }
      const qs = params.toString();
      router.push(qs ? `?${qs}` : '?');
    },
    [router, searchParams],
  );

  return { win, cmp, navigate };
}

interface DateRangePickerProps {
  /** Called after the user picks a value, so the parent can close the popup. */
  onAfterSelect?: () => void;
}

export default function DateRangePicker({ onAfterSelect }: DateRangePickerProps) {
  const { win, cmp, navigate } = useDateWindow();

  function pickWin(token: WinToken) {
    navigate(token, cmp);
    onAfterSelect?.();
  }

  function pickCmp(token: CmpToken) {
    navigate(win, token);
    onAfterSelect?.();
  }

  return (
    <div style={S.root}>
      {/* Window row */}
      <div style={S.row}>
        <span style={S.label}>window</span>
        <div style={S.btnGroup}>
          {WIN_OPTIONS.map(({ token, label }) => (
            <button
              key={token}
              onClick={() => pickWin(token)}
              style={token === win ? { ...S.btn, ...S.btnActive } : S.btn}
              title={`Show last ${label}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Compare row */}
      <div style={S.row}>
        <span style={S.label}>compare</span>
        <div style={S.btnGroup}>
          {CMP_OPTIONS.map(({ token, label }) => (
            <button
              key={token}
              onClick={() => pickCmp(token)}
              style={token === cmp ? { ...S.btn, ...S.btnActive } : S.btn}
              title={`Compare: ${label}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  root: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: '1px solid #1f1c15',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 9,
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    color: '#5a5448',
    width: 52,
    flexShrink: 0,
  },
  btnGroup: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap' as const,
  },
  btn: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10,
    letterSpacing: '0.08em',
    color: '#9b907a',
    background: 'transparent',
    border: '1px solid #2a261d',
    borderRadius: 4,
    padding: '3px 8px',
    cursor: 'pointer',
    lineHeight: 1.4,
  },
  btnActive: {
    color: '#f0e5cb',
    background: '#1c160d',
    borderColor: '#a8854a',
  },
};
