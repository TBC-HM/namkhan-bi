// app/marketing/compiler/[run_id]/edit/page.tsx
// Itinerary editor — read-only matrix in v1; edit JSON-via-textarea fallback.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import Page from '@/components/page/Page';
import { MARKETING_SUBPAGES } from '../../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fmtKpi } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Day { day: number; title: string; am: string[]; pm: string[]; eve: string[]; skus: string[]; }

export default async function EditPage({
  params,
  searchParams,
}: {
  params: { run_id: string };
  searchParams: { variant?: string };
}) {
  const admin = getSupabaseAdmin();
  const { data: run } = await admin
    .schema('compiler')
    .from('runs')
    .select('*')
    .eq('id', params.run_id)
    .maybeSingle();
  if (!run) notFound();

  const { data: variants } = await admin
    .schema('compiler')
    .from('variants')
    .select('*')
    .eq('run_id', params.run_id)
    .order('label');

  const list = variants ?? [];
  const active = list.find(v => v.id === searchParams.variant) ?? list[0];

  if (!active) {
    return (
      <Page eyebrow="Marketing · Compiler · Edit" title="No variants" subPages={MARKETING_SUBPAGES}>
        <div style={{ marginTop: 16 }}>
          <Link href={`/marketing/compiler/${params.run_id}`} style={{ color: 'var(--brass)' }}>
            ← Back to variants
          </Link>
        </div>
      </Page>
    );
  }

  const days = (active.day_structure ?? []) as Day[];

  return (
    <Page eyebrow="Marketing · Compiler · Edit" title={<>Itinerary <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>editor</em></>} subPages={MARKETING_SUBPAGES}>

      <div style={{ marginTop: 16, display: 'flex', gap: 8, fontSize: 'var(--t-sm)' }}>
        {list.map(v => (
          <Link
            key={v.id}
            href={`/marketing/compiler/${params.run_id}/edit?variant=${v.id}`}
            style={{
              padding: '6px 12px',
              background: v.id === active.id ? 'var(--moss)' : 'var(--paper-deep, #f5efdf)',
              color: v.id === active.id ? 'var(--paper)' : 'var(--ink)',
              border: '1px solid var(--ink-faint)',
              borderRadius: 4,
              textDecoration: 'none',
            }}
          >
            Variant {v.label}
          </Link>
        ))}
      </div>

      <table className="data-table" style={{ marginTop: 24, width: '100%' }}>
        <thead>
          <tr>
            <th className="data-table-th align-left" style={{ width: 90 }}>Day</th>
            <th className="data-table-th align-left">Title</th>
            <th className="data-table-th align-left">Morning</th>
            <th className="data-table-th align-left">Afternoon</th>
            <th className="data-table-th align-left">Evening</th>
            <th className="data-table-th align-left" style={{ width: 220 }}>SKUs</th>
          </tr>
        </thead>
        <tbody>
          {days.map(d => (
            <tr key={d.day} className="data-table-row">
              <td className="data-table-td align-left tabular">{d.day}</td>
              <td className="data-table-td align-left"><strong>{d.title}</strong></td>
              <td className="data-table-td align-left">{d.am.join(' · ') || '—'}</td>
              <td className="data-table-td align-left">{d.pm.join(' · ') || '—'}</td>
              <td className="data-table-td align-left">{d.eve.join(' · ') || '—'}</td>
              <td className="data-table-td align-left" style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                {d.skus.join(', ') || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{
        marginTop: 24, padding: 14, background: 'var(--paper-deep, #f5efdf)',
        borderRadius: 4, fontSize: 'var(--t-sm)', color: 'var(--ink-soft)',
      }}>
        <strong>v1 note:</strong> in-place editing (drag-swap activities, change SKUs) ships in v1.1.
        For now, the variant builder generates the structure from the parsed spec and you can re-compile with a different prompt.
      </div>

      <div style={{ marginTop: 24, display: 'flex', gap: 12, fontSize: 'var(--t-sm)' }}>
        <Link href={`/marketing/compiler/${params.run_id}`} style={{ color: 'var(--brass)' }}>
          ← Back to variants
        </Link>
      </div>
    </Page>
  );
}
