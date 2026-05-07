import type { Metadata } from 'next';

/**
 * /guest — Standalone layout.
 * Deliberately omits <AppShell> / <Sidebar> so the black entry screen
 * renders full-viewport with zero extra chrome.
 *
 * Font declarations are inherited from the root layout's <html> element;
 * no duplicate font loading needed here.
 */
export const metadata: Metadata = {
  title: 'Guest Intelligence — Namkhan BI',
  description: 'Real-time property insights curated for partners and guests of Nam Khan River Lodge.',
  robots: { index: false, follow: false },   // internal tool — no indexing
};

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Wrap in a minimal div that resets any inherited padding/margin from
    // the root layout body, while still living inside <html> for font inheritance.
    <div
      style={{
        minHeight: '100dvh',
        width: '100%',
        margin: 0,
        padding: 0,
        backgroundColor: '#0a0a0a',
        isolation: 'isolate',            // new stacking context — no sidebar bleeds through
      }}
    >
      {children}
    </div>
  );
}
