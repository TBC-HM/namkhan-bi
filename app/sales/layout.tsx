// Pass-through layout — suppresses any parent chrome (sidebar, topbar)
// so app/sales/page.tsx renders full-viewport black with no wrapping shell.
export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
