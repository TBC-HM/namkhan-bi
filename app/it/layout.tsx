// Pass-through layout — IT section uses its own full-viewport black shell.
// Intentionally does NOT import the global sidebar/nav chrome.

export const metadata = {
  title: 'IT Manager — Namkhan BI',
  description: 'Infrastructure & Systems console for The Namkhan.',
};

export default function ITLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
