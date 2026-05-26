// app/(cockpit)/_design/overlay/SideDrawer.tsx
// Reusable "drawer slides in from the right OVER the page" primitive.
// Server component — accepts children as already-rendered React elements, so
// no function-prop serialisation issues across the RSC boundary (e.g. Chart's
// tooltipFormatter inside DrillPanel keeps working).
//
// Visual contract (PBS 2026-05-26):
//   - drawer is NOT part of the page flow; it overlays on top
//   - slides over from the right edge, fixed 480px wide
//   - backdrop click closes
//   - URL-driven open state (closeHref navigates to the "closed" URL)
//
// Usage:
//   <SideDrawer open={!!activeExpand} closeHref={hrefExpand(activeExpand)} title="Room: Junior Suite">
//     <DrillPanel ... />
//     <IcpSection ... />
//   </SideDrawer>

import Link from 'next/link';
import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  closeHref: string;
  title?: ReactNode;
  width?: string;
  children: ReactNode;
}

export default function SideDrawer({ open, closeHref, title, width = '480px', children }: Props) {
  if (!open) return null;
  return (
    <>
      <Link
        href={closeHref}
        aria-label="Close drawer"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.32)',
          zIndex: 49,
          cursor: 'pointer',
        }}
      />
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width,
          maxWidth: '92vw',
          height: '100vh',
          background: 'var(--paper, #FFFFFF)',
          boxShadow: '-12px 0 32px rgba(0,0,0,0.18)',
          borderLeft: '1px solid var(--hairline, #E6DFCC)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--hairline, #E6DFCC)',
            background: 'var(--paper, #FFFFFF)',
            flex: '0 0 auto',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink, #1B1B1B)' }}>
            {title ?? null}
          </div>
          <Link
            href={closeHref}
            aria-label="Close"
            style={{
              fontSize: 14,
              padding: '4px 10px',
              borderRadius: 4,
              border: '1px solid var(--hairline, #E6DFCC)',
              background: 'var(--paper, #FFFFFF)',
              color: 'var(--ink-soft, #5A5A5A)',
              textDecoration: 'none',
              lineHeight: 1,
            }}
          >
            ✕
          </Link>
        </div>
        <div
          style={{
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflowY: 'auto',
            flex: '1 1 auto',
          }}
        >
          {children}
        </div>
      </aside>
    </>
  );
}
