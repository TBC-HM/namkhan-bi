// app/marketing/compiler/[run_id]/preview/page.tsx
// PDF + funnel preview tabs (stubbed in v1 — points to the public /r/[slug]).

import Link from 'next/link';
import { notFound } from 'next/navigation';
import Page from '@/components/page/Page';
import { MARKETING_SUBPAGES } from '../../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PreviewPage({ params }: { params: { run_id: string } }) {
  const admin = getSupabaseAdmin();
  const { data: run } = await admin
    .schema('compiler')
    .from('runs')
    .select('*')
    .eq('id', params.run_id)
    .maybeSingle();
  if (!run) notFound();

  const { data: deploys } = await admin
    .schema('compiler')
    .from('deploys')
    .select('subdomain, design_variant, status, deployed_at')
    .eq('run_id', params.run_id)
    .order('created_at', { ascending: false })
    .limit(1);
  const live = deploys?.[0];

  return (
    <Page eyebrow="Marketing · Compiler · Preview" title={<>Funnel <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>preview</em></>} subPages={MARKETING_SUBPAGES}>

      <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          { key: 'lead', label: 'Lead magnet', path: live ? `/r/${live.subdomain}/lead` : null },
          { key: 'detail', label: 'Retreat detail', path: live ? `/r/${live.subdomain}` : null },
          { key: 'checkout', label: 'Checkout', path: live ? `/r/${live.subdomain}/checkout` : null },
        ].map(p => (
          <div key={p.key} style={{
            padding: 16, background: 'var(--paper)', border: '1px solid var(--ink-faint)',
            borderRadius: 4,
          }}>
            <div style={{
              fontSize: 'var(--t-xs)', textTransform: 'uppercase',
              letterSpacing: 'var(--ls-extra)', color: 'var(--brass)',
              fontFamily: 'var(--mono)', marginBottom: 6,
            }}>
              {p.label}
            </div>
            {p.path ? (
              <Link href={p.path} target="_blank" style={{ color: 'var(--ink)', fontSize: 'var(--t-sm)' }}>
                Open ↗ <span style={{ color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>{p.path}</span>
              </Link>
            ) : (
              <span style={{ color: 'var(--ink-mute)', fontStyle: 'italic', fontSize: 'var(--t-sm)' }}>
                Deploy first to enable preview
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 26, padding: 14, background: 'var(--paper-deep, #f5efdf)',
        borderRadius: 4, fontSize: 'var(--t-sm)', color: 'var(--ink-soft)',
      }}>
        <strong>Stubs in v1:</strong> Puppeteer PDF render, design variant tile (A/B/C), Cloudflare cache purge. Funnel pages render with the canonical Namkhan look-and-feel rather than a template-fork.
      </div>

      <div style={{ marginTop: 24 }}>
        <Link href={`/marketing/compiler/${params.run_id}`} style={{ color: 'var(--brass)', fontSize: 'var(--t-sm)' }}>
          ← Back to variants
        </Link>
      </div>
    </Page>
  );
}
