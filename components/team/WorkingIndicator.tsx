/**
 * WorkingIndicator — animated equalizer bars shown on TeamMember cards.
 * When isWorking=true the bars bounce at staggered intervals;
 * when false they sit at minimum height (static).
 * Pure CSS keyframes — no extra dependencies needed.
 */
import React from 'react';
import styles from './WorkingIndicator.module.css';

interface WorkingIndicatorProps {
  isWorking: boolean;
  /** number of bars, 3–5 recommended */
  bars?: number;
}

export default function WorkingIndicator({
  isWorking,
  bars = 4,
}: WorkingIndicatorProps) {
  return (
    <div
      className={styles.equalizer}
      aria-label={isWorking ? 'Currently working' : 'Not on shift'}
      aria-hidden="false"
    >
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={[
            styles.bar,
            isWorking ? styles.active : styles.idle,
          ].join(' ')}
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}
