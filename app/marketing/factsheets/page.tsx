// app/marketing/factsheets/page.tsx
// PBS 2026-07-16 (item 5) — Factsheet registry.
// Lists every marketing factsheet doc (doc_type='marketing' AND doc_subtype='factsheet' OR
// tagged 'factsheet'), grouped by which sales deal-type it applies to.
// Reads public.v_marketing_factsheets (bridge view, PostgREST-safe).

import Link from 'next/link';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN = 260955;

interface FactsheetRow {
  doc_id: string;
  property_id: number | null;
  title: string;
  body_markdown: string | null;
  file_name: string | null;
  mime: string | null;
  file_size_bytes: number | null;
  storage_bucket: string | null;
  storage_path: string | null;
  external_url: string | null;
  for_deal_types: string[] | null;
  tags: string[] | null;
  updated_at: string | null;
  created_at: string | null;
}

const T = {
  WHITE: '#FFFFFF',
  HAIR: '#E6DFCC',
  INK: '#1B1B1B',
  INK_M: '#5A5A5A',
  FOREST: '#084838',
  RED: '#B04A2F',
  WARM: '#F5F0E1',
} as const;

const DEAL_LABEL: Record<string, string> = {
  fit: 'FIT',
  group: 'Group',
  btb_dmc: 'B2B · DMC',
  btb_corporate: 'B2B · Corporate',
  retreat_lead: 'Retreat',
  wholesale: 'Wholesale',
  influencer: 'Influencer',
};

export default async function FactsheetsPage() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_marketing_factsheets')
    .select('*')
    .or('property_id.eq.' + NAMKHAN + ',property_id.is.null')
    .order('created_at', { ascending: false });

  const rows = ((data ?? []) as FactsheetRow[]);

  const tabs = MARKETING_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: false,
  }));

  return (
    <DashboardPage
      title="Factsheets"
      subtitle="Sales-ready one-pagers by deal type. Attach one to a proposal from the composer."
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="All factsheets" meta={rows.length + ' total'}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Link
              href="/documents/new?doc_type=marketing&doc_subtype=factsheet"
              style={{
                padding: '6px 12px', background: T.FOREST, color: T.WHITE,
                fontSize: 12, fontWeight: 600, borderRadius: 4,
                textDecoration: 'none', border: '1px solid ' + T.FOREST,
              }}
            >
              + New factsheet
            </Link>
          </div>

          {error && (
            <div style={{
              padding: 10, color: T.RED, background: '#FBEEE8',
              border: '1px solid ' + T.RED, borderRadius: 3, fontSize: 12,
            }}>
              Load failed: {error.message}
            </div>
          )}

          {rows.length === 0 && !error && (
            <div style={{
              padding: 24, textAlign: 'center', color: T.INK_M,
              fontSize: 13, background: T.WARM, borderRadius: 4,
            }}>
              No factsheets yet. Click <strong>+ New factsheet</strong> to upload one.
            </div>
          )}

          {rows.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Deal type</th>
                  <th style={thStyle}>File</th>
                  <th style={thStyle}>Updated</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.doc_id}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: T.INK }}>{r.title}</div>
                      {r.body_markdown && (
                        <div style={{ fontSize: 11, color: T.INK_M, marginTop: 2 }}>
                          {r.body_markdown.slice(0, 120)}
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(r.for_deal_types ?? []).length === 0 && (
                          <span style={pillStyle}>all</span>
                        )}
                        {(r.for_deal_types ?? []).map((dt) => (
                          <span key={dt} style={pillStyle}>{DEAL_LABEL[dt] ?? dt}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, fontSize: 11, color: T.INK_M }}>
                      {r.file_name ? r.file_name : (r.body_markdown ? '(markdown only)' : '(no file)')}
                      {r.file_size_bytes ? <div>{(r.file_size_bytes / 1024).toFixed(0)} KB</div> : null}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 11, color: T.INK_M }}>
                      {r.updated_at ? new Date(r.updated_at).toISOString().slice(0, 10) : '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <Link href={'/documents/' + r.doc_id} style={linkStyle}>Edit</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Container>
      </div>
    </DashboardPage>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase',
  letterSpacing: 0.5, color: T.INK_M, fontWeight: 600,
  borderBottom: '1px solid ' + T.HAIR, background: T.WHITE,
};
const tdStyle: React.CSSProperties = {
  padding: '10px', borderBottom: '1px solid ' + T.HAIR,
  fontSize: 12, color: T.INK, verticalAlign: 'top',
};
const pillStyle: React.CSSProperties = {
  display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 10,
  background: T.FOREST, color: T.WHITE, fontWeight: 600,
};
const linkStyle: React.CSSProperties = {
  color: T.FOREST, fontSize: 12, textDecoration: 'none', fontWeight: 600,
};
