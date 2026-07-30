// app/holding/it2/layout.tsx
// PBS 2026-07-30 — IT2: reorganized Holding IT area (brief it-area-reorg-v1).
// Mirrors the cockpit layout shell (tokens.css + white bg) but mounts the
// IT2 group nav. Old /holding/it stays untouched until PBS approves deletion.

import '@/app/(cockpit)/_design/internal/tokens.css';
import It2GroupNav from './_components/It2GroupNav';

export const dynamic = 'force-dynamic';

export default function It2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="cockpit-design" style={{ minHeight: '100vh', background: '#FFFFFF' }}>
      <It2GroupNav />
      <div style={{ padding: '20px 24px' }}>
        {children}
      </div>
    </div>
  );
}
