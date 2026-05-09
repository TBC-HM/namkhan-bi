// app/marketing/compiler/retreats/page.tsx
// All retreats published from the compiler. Status / spots / link.

import Link from 'next/link';
import Page from '@/components/page/Page';
import { MARKETING_SUBPAGES } from '../../_subpages';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { fmtIsoDate, fmtKpi } from '@/lib/format';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RetreatRow {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  arrival_window_from: string;
  arrival_window_to: string;
  spots_total: number;
  spots_booked: number;
  spots_remaining: number;
  price_usd_from: number;
  status: string;
  series_slug: string | null;
  created_at: string;
}

const STATUS_TONE: Record<string, StatusTone> = {
  draft: 'pending',
  published: 'active',
  sold_out: 'expired',
  expired: 'inactive',
  cancelled: 'inactive',
};

export default async function RetreatsListPage() {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .schema('web').from('retreats')
    .select('id, slug, name, tagline, arrival_window_from, arrival_window_to, spots_total, spots_booked, spots_remaining, price_usd_from, status, series_slug, created_at')
    .order('created_at', { ascending: false });
  const rows = (data ?? []) as RetreatRow[];

  return (
    <Page eyebrow="Marketing · Compiler · Retreats" title={<>Live <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>retreats</em></>} subPages={MARKETING_SUBPAGES}>

      {error && (
        <div style={{ marginTop: 12, fontSize: 'var(--t-xs)', color: 'var(--st-bad)' }}>
          DB error: {error.message}
        </div>
      )}

      <div style={{ marginTop: 16, marginBottom: 8 }} className="t-eyebrow">Published · {rows.length}</div>

      {rows.length === 0 ? (
        <div style={{ color: 'var(--ink-mute)', fontStyle: 'italic', fontSize: 'var(--t-sm)', padding: 24 }}>
          No retreats published yet. Compile + deploy from the home page.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-sm)' }}>
          <thead>
            <tr>
              {['Name','Series','Window','From / pax','Spots','Status','Deployed'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--paper-deep)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--paper-warm)' }}>
                <td style={{ padding: '6px 12px' }}>
                  <Link href={`/r/${r.slug}`} target="_blank" style={{ color: 'var(--ink)', textDecoration: 'none' }}>
                    <strong>{r.name}</strong>
                    <div style={{ fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>/r/{r.slug} ↗</div>
                  </Link>
                </td>
                <td style={{ padding: '6px 12px' }}>{r.series_slug ?? '—'}</td>
                <td style={{ padding: '6px 12px' }}>{fmtIsoDate(r.arrival_window_from)} → {fmtIsoDate(r.arrival_window_to)}</td>
                <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtKpi(r.price_usd_from, 'usd', 0)}</td>
                <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{r.spots_remaining} / {r.spots_total}</td>
                <td style={{ padding: '6px 12px', textAlign: 'center' }}><StatusPill tone={STATUS_TONE[r.status] ?? 'info'}>{r.status}</StatusPill></td>
                <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtIsoDate(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 18, fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>
        <Link href="/marketing/compiler" style={{ color: 'var(--brass)' }}>← BACK TO COMPILER</Link>
      </div>
    </Page>
  );
}
