// app/marketing/layout.tsx
// Pass-through layout — suppresses any parent shell chrome (sidebar, topnav)
// so the entry page renders full-viewport black. Sub-pages inherit this too.

export const metadata = {
  title: 'Marketing — Namkhan BI',
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10,
        background: '#000',
        overflow: 'auto',
      }}
    >
      {children}
    </div>
  );
}
