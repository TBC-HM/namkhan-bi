// components/ui/GreyOut.tsx
// Wraps a section to render it greyed-out with a "Coming soon" overlay.
// Per mockup: opacity 0.35, pointer-events none, centered overlay.

import { ReactNode } from 'react';

export default function GreyOut({
  reason,
  children,
}: {
  reason: string;
  children?: ReactNode;
}) {
  return (
    <div className="grey-out-wrap">
      <div className="grey-out-content">{children}</div>
      <div className="grey-out-overlay">
        <div className="grey-out-label">Coming soon</div>
        <div className="grey-out-reason">{reason}</div>
      </div>
    </div>
  );
}
