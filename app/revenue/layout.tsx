// app/revenue/layout.tsx
// PBS 2026-05-09: pure passthrough for chrome; layout adds the global
// floating chat button (PBS note#8 · 2026-05-23) so it appears on every
// revenue page. Central Chat round 3 (brief central-chat-v1 §0.B.1):
// FloatingMira replaced by a scoped CentralChat instance — knowledge scope
// derived from placement: revenue.
import FloatingCentralChat from '@/components/chat/FloatingCentralChat';

export default function RevenueLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <FloatingCentralChat moduleScope="revenue" emoji="📈" label="Revenue" />
    </>
  );
}
