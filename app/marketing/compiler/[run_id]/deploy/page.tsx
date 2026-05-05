// app/marketing/compiler/[run_id]/deploy/page.tsx
// Deploy summary page — shows recent deploys for this run.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageHeader from '@/components/layout/PageHeader';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { fmtIsoDate } from '@/lib/format';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATUS_TONE: Record<string, StatusTone> = {
  queued: 'pending', provisioning: 'pending', live: 'active',
  failed: 'expired', rolled_back: 'inactive',
};

export default async function DeployPage({ params }: { params: { run_id: string } }) {
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
    .select('*')
    .eq('run_id', params.run_id)
    .order('created_at', { ascending: false });

  return (
    <>
      <PageHeader
        pillar="Marketing"
        tab="Compiler · Deploy"
        title={<>Deploy <em style={{ color: 'var(--brass)' }}>history</em></>}
        lede="Each deploy publishes a web.retreats row. v1 routes to /r/[slug] on this domain."
      />

      <table className="data-table" style={{ marginTop: 22, width: '100%' }}>
        <thead>
          <tr>
            <th className="data-table-th align-left">Subdomain</th>
            <th className="data-table-th align-left">Design</th>
            <th className="data-table-th align-left">Status</th>
            <th className="data-table-th align-left">Deployed</th>
            <th className="data-table-th align-left">URL</th>
          </tr>
        </thead>
        <tbody>
          {(deploys ?? []).length === 0 ? (
            <tr><td colSpan={5} className="data-table-td align-left" style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>No deploys yet for this run.</td></tr>
          ) : (
            (deploys ?? []).map(d => (
              <tr key={d.id} className="data-table-row">
                <td className="data-table-td align-left"><strong>{d.subdomain}</strong></td>
                <td className="data-table-td align-left">{d.design_variant}</td>
                <td className="data-table-td align-left"><StatusPill tone={STATUS_TONE[d.status] ?? 'info'}>{d.status}</StatusPill></td>
                <td className="data-table-td align-left tabular">{fmtIsoDate(d.deployed_at)}</td>
                <td className="data-table-td align-left">
                  <Link href={`/r/${d.subdomain}`} target="_blank" style={{ color: 'var(--brass)', fontSize: 'var(--t-sm)' }}>
                    /r/{d.subdomain} ↗
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div style={{ marginTop: 24, fontSize: 'var(--t-sm)' }}>
        <Link href={`/marketing/compiler/${params.run_id}`} style={{ color: 'var(--brass)' }}>
          ← Back to variants
        </Link>
      </div>
    </>
  );
}
