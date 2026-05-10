"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import styles from "./DateRangeQuickPicker.module.css";

export type WinParam = "today" | "7d" | "30d" | "90d" | "ytd";
export type CmpParam = "stly" | "prior" | "none";

const WIN_OPTIONS: { label: string; value: WinParam }[] = [
  { label: "Today",  value: "today" },
  { label: "7 d",   value: "7d"    },
  { label: "30 d",  value: "30d"   },
  { label: "90 d",  value: "90d"   },
  { label: "YTD",   value: "ytd"   },
];

const CMP_OPTIONS: { label: string; value: CmpParam }[] = [
  { label: "STLY",          value: "stly"  },
  { label: "Prior period",  value: "prior" },
  { label: "None",          value: "none"  },
];

/** Default window when ?win is absent. */
export const DEFAULT_WIN: WinParam = "30d";
/** Default compare when ?cmp is absent. */
export const DEFAULT_CMP: CmpParam = "stly";

interface Props {
  /** Called after URL params are updated so the parent can close the popup. */
  onApply?: () => void;
}

export default function DateRangeQuickPicker({ onApply }: Props) {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  const win = (searchParams.get("win") ?? DEFAULT_WIN) as WinParam;
  const cmp = (searchParams.get("cmp") ?? DEFAULT_CMP) as CmpParam;

  const push = useCallback(
    (nextWin: WinParam, nextCmp: CmpParam) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("win", nextWin);
      params.set("cmp", nextCmp);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      onApply?.();
    },
    [router, pathname, searchParams, onApply],
  );

  return (
    <div className={styles.root} role="group" aria-label="Date range picker">
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Window</legend>
        <div className={styles.btnGroup}>
          {WIN_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={win === o.value}
              className={`${styles.btn} ${win === o.value ? styles.active : ""}`}
              onClick={() => push(o.value, cmp)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Compare</legend>
        <div className={styles.btnGroup}>
          {CMP_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={cmp === o.value}
              className={`${styles.btn} ${cmp === o.value ? styles.active : ""}`}
              onClick={() => push(win, o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
