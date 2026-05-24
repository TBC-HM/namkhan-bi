// app/revenue/layout.tsx
// PBS 2026-05-09: pure passthrough for chrome; layout adds the global
// FloatingMira help-bot button (PBS note#8 · 2026-05-23) so it appears on
// every revenue page.
import { FloatingMira } from '@/app/(cockpit)/_design';

export default function RevenueLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <FloatingMira />
    </>
  );
}
