// app/revenue-v2/layout.tsx
// Revenue v2 shell — scoped CSS via .rmv2 wrapper, top bar with full nav.

import "./styles.css";
import Shell from "./_components/Shell";

export const metadata = {
  title: "Revenue v2 · Namkhan",
  description: "Revenue rebuild — staging only. Dummy data.",
};

export default function RevenueV2Layout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
