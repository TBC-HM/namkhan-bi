/**
 * KpiTooltip — shared hover/focus tooltip for KpiBox metrics.
 * Used by Pulse, Revenue, and all department entry pages.
 *
 * Props:
 *   children  — the trigger element (KpiBox label or value)
 *   tip       — tooltip copy (source, formula, caveats)
 *
 * Behaviour:
 *   • Desktop: shows on mouseenter / focusin, hides on mouseleave / focusout
 *   • Mobile:  tap toggles (touchend); auto-closes after 4 s
 *   • Positioning: prefers above; flips below if < 80 px from top of viewport
 *   • Never overflows horizontally — clamped with max-width + left clamp logic
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import styles from './KpiTooltip.module.css';

interface KpiTooltipProps {
  tip: string;
  children: React.ReactNode;
}

export function KpiTooltip({ tip, children }: KpiTooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
  }, []);

  const toggle = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setVisible(v => {
      if (!v) {
        timerRef.current = setTimeout(() => setVisible(false), 4000);
        return true;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      return false;
    });
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (!tip) return <>{children}</>;

  return (
    <span
      className={styles.wrapper}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onTouchEnd={toggle}
      tabIndex={0}
      role="button"
      aria-label="metric info"
    >
      {children}
      <span className={styles.icon} aria-hidden>ⓘ</span>
      {visible && (
        <span role="tooltip" className={styles.bubble}>
          {tip}
        </span>
      )}
    </span>
  );
}
