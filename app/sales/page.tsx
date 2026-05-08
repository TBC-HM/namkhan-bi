// app/sales/page.tsx
// Sales dept entry — proper landing per master design directive 2026-05-08.
// Replaces 10-line redirect-only stub. Mirrors the /revenue entry pattern:
// greeting, sub-page chips, no data destruction.
//
// Sub-pages preserved: inquiries, b2b, bookings, pipeline.

import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const SUB_PAGES = [
  { href: '/sales/inquiries', label: 'Inquiries', hint: 'Email cockpit · unanswered threads' },
  { href: '/sales/b2b',       label: 'B2B / DMC',  hint: 'Contracts · LPA · deeplinks' },
  { href: '/sales/bookings',  label: 'Bookings',   hint: 'Reservations · pace' },
  { href: '/sales/pipeline',  label: 'Pipeline',   hint: 'Leads · stages · close rate' },
] as const;

export default function SalesIndexPage() {
  return (
    <main style={{ background: 'var(--bg-page, #0a0a08)', minHeight: '100vh', padding: '32px 28px 80px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 28, gap: 16,
        }}>
          <div style={{
            fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra, 0.18em)',
            textTransform: 'uppercase', color: 'var(--brass, #a8854a)',
            fontFamily: 'Menlo, monospace',
          }}>
            BOSS · PAUL BAUER
          </div>
          <Link href="/" style={{
            fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra, 0.18em)',
            textTransform: 'uppercase', color: 'var(--ink-mute, #888)',
            fontFamily: 'Menlo, monospace', textDecoration: 'none',
          }}>
            ← HOME
          </Link>
        </div>

        <PageHeader
          pillar="Namkhan"
          tab="Sales"
          title={<>Sales, <em style={{ color: 'var(--brass, #a8854a)', fontStyle: 'italic' }}>at a glance</em>.</>}
          lede="Direct revenue, partner contracts, and the inbox."
        />

        <section style={{ marginTop: 28, marginBottom: 36 }}>
          <div style={{
            fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra, 0.18em)',
            textTransform: 'uppercase', color: 'var(--brass, #a8854a)',
            fontFamily: 'Menlo, monospace', marginBottom: 14,
          }}>
            SALES PAGES
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10,
          }}>
            {SUB_PAGES.map((sp) => (
              <Link key={sp.href} href={sp.href} style={{
                display: 'block', padding: '14px 16px',
                background: 'var(--bg-card, rgba(255,255,255,0.04))',
                border: '1px solid var(--border-soft, rgba(168,133,74,0.25))',
                borderRadius: 6, textDecoration: 'none',
              }}>
                <div style={{
                  fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic',
                  fontSize: 'var(--t-lg)', color: 'var(--ink, #f5efe3)',
                  marginBottom: 4,
                }}>
                  {sp.label}
                </div>
                <div style={{
                  fontSize: 'var(--t-xs)', color: 'var(--ink-mute, #888)',
                  fontFamily: 'Menlo, monospace',
                }}>
                  {sp.hint}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <p style={{
          fontSize: 'var(--t-sm)', color: 'var(--ink-mute, #888)',
          fontStyle: 'italic', maxWidth: 720,
        }}>
          Inquiries is the canonical Sales reference page. Every other Sales surface follows
          the same typography hierarchy.
        </p>

      </div>
    </main>
  );
}
