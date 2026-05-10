'use client';
/**
 * DateRangePicker — quick-jump window + compare selector
 * Ticket #600
 *
 * Renders two button-group rows:
 *   Window:  Today | 7d | 30d | 90d | YTD
 *   Compare: STLY  | Prior Period | None
 *
 * On any selection the component shallow-pushes ?win and ?cmp
 * to the URL so server pages re-fetch with the new range.
 *
 * Props:
 *   onClose  — called after selection so the parent popup can close
 *   autoClose — if true (default) the popup closes after the Window
 *               button is clicked; Compare row stays live so the user
 *               can flip the compare mode first, then it closes.
 */
import React, { useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { WinSlug, CmpSlug } from '@/lib/dateParams';
import { coerceWin, coerceCmp } from '@/lib/dateParams';

const WIN_OPTIONS: { slug: WinSlug; label: string }[] = [
  { slug: 'today', label: 'Today' },
  { slug: '7d',    label: '7 d'   },
  { slug: '30d',   label: '30 d'  },
  { slug: '90d',   label: '90 d'  },
  { slug: 'ytd',   label: 'YTD'   },
];

const CMP_OPTIONS: { slug: CmpSlug; label: string }[] = [
  { slug: 'stly',  label: 'STLY'         },
  { slug: 'prior', label: 'Prior period' },
  { slug: 'none',  label: 'None'         },
];

interface Props {
  onClose?: () => void;
  autoClose?: boolean;
}

export function DateRangePicker({ onClose, autoClose = true }: Props) {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  const activeWin = coerceWin(searchParams.get('win'));
  const activeCmp = coerceCmp(searchParams.get('cmp'));

  const push = useCallback(
    (win: WinSlug, cmp: CmpSlug) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('win', win);
      params.set('cmp', cmp);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const handleWin = (slug: WinSlug) => {
    push(slug, activeCmp);
    if (autoClose) onClose?.();
  };

  const handleCmp = (slug: CmpSlug) => {
    push(activeWin, slug);
    onClose?.();
  };

  return (
    <div className="drp" role="group" aria-label="Date range and compare picker">
      <fieldset className="drp__fieldset">
        <legend className="drp__legend">Window</legend>
        <div className="drp__row" role="group">
          {WIN_OPTIONS.map(({ slug, label }) => (
            <button
              key={slug}
              type="button"
              aria-pressed={activeWin === slug}
              className={`drp__btn${activeWin === slug ? ' drp__btn--active' : ''}`}
              onClick={() => handleWin(slug)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="drp__fieldset">
        <legend className="drp__legend">Compare</legend>
        <div className="drp__row" role="group">
          {CMP_OPTIONS.map(({ slug, label }) => (
            <button
              key={slug}
              type="button"
              aria-pressed={activeCmp === slug}
              className={`drp__btn${activeCmp === slug ? ' drp__btn--active' : ''}`}
              onClick={() => handleCmp(slug)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
