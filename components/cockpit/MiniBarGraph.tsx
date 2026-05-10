// components/cockpit/MiniBarGraph.tsx
// Animated equaliser-style bar graph for team member cards.
// Pillars animate continuously when isWorking=true, freeze when false.
// CSS-only keyframes; respects prefers-reduced-motion.

import React from "react";

interface MiniBarGraphProps {
  isWorking: boolean;
  /** Number of bars (default 5) */
  bars?: number;
  /** Bar colour when active (default matches cockpit green) */
  color?: string;
  /** Dim colour when idle */
  dimColor?: string;
  className?: string;
}

// Stagger delays (ms) for each of up to 8 bars — gives an organic EQ feel.
const DELAYS = ["0ms", "160ms", "80ms", "240ms", "40ms", "200ms", "120ms", "280ms"];
// Peak heights (%) — each bar has a slightly different natural height.
const PEAKS = [65, 90, 50, 80, 70, 55, 85, 60];

export default function MiniBarGraph({
  isWorking,
  bars = 5,
  color = "#4ade80",
  dimColor = "#374151",
  className = "",
}: MiniBarGraphProps) {
  const count = Math.min(Math.max(bars, 2), 8);

  return (
    <>
      <style>{`
        @keyframes nmk-bar-bounce {
          0%   { transform: scaleY(0.15); }
          50%  { transform: scaleY(1);    }
          100% { transform: scaleY(0.15); }
        }
        @media (prefers-reduced-motion: reduce) {
          .nmk-bar { animation: none !important; transform: scaleY(0.4) !important; }
        }
      `}</style>
      <div
        className={`nmk-mini-bar-graph ${className}`}
        aria-hidden="true"
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "2px",
          height: "20px",
          width: `${count * 5 + (count - 1) * 2}px`,
        }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="nmk-bar"
            style={{
              flex: "0 0 5px",
              height: "100%",
              borderRadius: "2px 2px 0 0",
              backgroundColor: isWorking ? color : dimColor,
              transformOrigin: "bottom",
              transform: isWorking ? undefined : "scaleY(0.25)",
              opacity: isWorking ? 1 : 0.4,
              transition: "background-color 0.4s ease, opacity 0.4s ease, transform 0.4s ease",
              animation: isWorking
                ? `nmk-bar-bounce ${600 + (i % 3) * 150}ms ease-in-out ${DELAYS[i % DELAYS.length]} infinite`
                : "none",
              // natural peak height baked into the container; scaleY handles motion
              maxHeight: `${PEAKS[i % PEAKS.length]}%`,
            }}
          />
        ))}
      </div>
    </>
  );
}
