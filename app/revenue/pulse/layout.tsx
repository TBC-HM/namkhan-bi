// app/revenue/pulse/layout.tsx
// #156 (2026-05-26) — paper-white scope for /pulse to neutralise the 3 remaining
// legacy black-header / yellow-typo containers (PulseAlertsPanel, PulsePaceGap,
// PulseHeroOpen). Same token-override pattern as /finance/layout.tsx — one CSS
// scope swaps the dark surface/border/text tokens for paper-white equivalents
// without touching any of the 11 _components files.

export default function PulseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pulse-paperwhite-scope">
      <style>{`
        .pulse-paperwhite-scope {
          --surf-0: #FFFFFF;
          --surf-1: #FAFAF7;
          --surf-2: #F4EFE2;
          --paper-warm: #FAFAF7;
          --paper-deep: #EDE7D4;
          --border-1: #E6DFCC;
          --border-2: #D6CFB8;
          --border-3: #C8C0A6;
          --rule: #D6CFB8;
          --text-0: #1B1B1B;
          --text-1: #1B1B1B;
          --text-2: #2A2A2A;
          --text-warm: #1B1B1B;
          --text-soft: #5A5A5A;
          --text-mute: #5A5A5A;
          --text-dim: #7D7D7D;
          --text-place: #9A9A9A;
          --ink: #1B1B1B;
          --ink-mute: #5A5A5A;
          --ink-soft: #5A5A5A;
          --ink-faint: #9A9A9A;
          --line-soft: #E6DFCC;
          --hairline: #E6DFCC;
        }
        .pulse-paperwhite-scope thead th {
          color: #5A5A5A !important;
          background: #FAFAF7 !important;
          border-bottom: 1px solid #E6DFCC !important;
        }
        .pulse-paperwhite-scope .panel,
        .pulse-paperwhite-scope .panel.dashed {
          background: #FFFFFF !important;
          border-color: #E6DFCC !important;
          color: #1B1B1B !important;
        }
      `}</style>
      {children}
    </div>
  );
}
