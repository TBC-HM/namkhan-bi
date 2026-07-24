// app/holding/it/cockpit/specs/page.tsx
// Module documentation hub — all published module specs + recent build briefs.

import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BADGE: Record<string, { bg: string; color: string }> = {
  inventory_module:     { bg: '#E8F5E9', color: '#2E7D32' },
  media_module:         { bg: '#E3F2FD', color: '#1565C0' },
  newsletter_module:    { bg: '#FFF3E0', color: '#E65100' },
  gbp_module:           { bg: '#FCE4EC', color: '#880E4F' },
  university_module:    { bg: '#EDE7F6', color: '#4527A0' },
  socials_module:       { bg: '#F3E5F5', color: '#6A1B9A' },
  spec_builder_module:  { bg: '#E0F2F1', color: '#004D40' },
};
const DEFAULT_BADGE = { bg: '#F4EFE2', color: '#5A5A5A' };

function TypePill({ docType }: { docType: string }) {
  const b = BADGE[docType] ?? DEFAULT_BADGE;
  const label = docType.replace(/_module$/, '').replace(/_/g, ' ');
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: 99, background: b.bg, color: b.color }}>
      {label}
    </span>
  );
}

async function fetchData() {
  const sb = getSupabaseAdmin();
  const [{ data: moduleDocs }, { data: briefs }] = await Promise.all([
    sb.schema('documentation' as any).from('documents')
      .select('id, doc_type, title, status, version, last_updated_at, last_updated_by')
      .like('doc_type', '%module%')
      .order('last_updated_at', { ascending: false }),
    sb.schema('documentation' as any).from('build_briefs')
      .select('id, slug, title, status, tags, created_at, last_updated_at, shipped_at, assigned_to')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  return { moduleDocs: moduleDocs ?? [], briefs: briefs ?? [] };
}

export default async function SpecsPage() {
  const { moduleDocs, briefs } = await fetchData();

  return (
    <div style={{ maxWidth: 900, padding: '28px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1B1B1B', margin: 0 }}>Module Documentation</h1>
          <p style={{ fontSize: 12, color: '#5A5A5A', margin: '4px 0 0' }}>
            Canonical spec docs for every shipped module · build briefs ready for agents
          </p>
        </div>
        <Link href="/holding/it/cockpit/specs/new" style={{
          fontSize: 12, fontWeight: 700, padding: '8px 18px', borderRadius: 4,
          background: '#1F3A2E', color: '#FFFFFF', textDecoration: 'none', letterSpacing: '0.05em',
        }}>+ New spec</Link>
      </div>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#1B1B1B', margin: '0 0 12px', letterSpacing: '0.04em' }}>
          MODULE SPECS ({moduleDocs.length})
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {moduleDocs.map((doc: any) => (
            <div key={doc.id} style={{
              background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6,
              padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <TypePill docType={doc.doc_type} />
                <span style={{ fontSize: 10, color: doc.status === 'published' ? '#2E7D32' : '#B8A878', fontWeight: 600 }}>
                  {doc.status}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1B1B1B', lineHeight: 1.4 }}>{doc.title}</div>
              <div style={{ fontSize: 11, color: '#8A8A8A', marginTop: 'auto' }}>
                v{doc.version ?? 1} · {doc.last_updated_at ? new Date(doc.last_updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </div>
            </div>
          ))}
          {moduleDocs.length === 0 && (
            <div style={{ fontSize: 12, color: '#8A8A8A', gridColumn: '1 / -1', padding: '20px 0' }}>No module docs yet.</div>
          )}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#1B1B1B', margin: '0 0 12px', letterSpacing: '0.04em' }}>
          RECENT BUILD BRIEFS ({briefs.length})
        </h2>
        <div style={{ border: '1px solid #E6DFCC', borderRadius: 6, overflow: 'hidden' }}>
          {briefs.length === 0 ? (
            <div style={{ fontSize: 12, color: '#8A8A8A', padding: '20px 16px' }}>No briefs yet. Write your first spec above.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#FAFAF7', borderBottom: '1px solid #E6DFCC' }}>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, color: '#5A5A5A', fontSize: 11, letterSpacing: '0.05em' }}>TITLE</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, color: '#5A5A5A', fontSize: 11, letterSpacing: '0.05em' }}>STATUS</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, color: '#5A5A5A', fontSize: 11, letterSpacing: '0.05em' }}>CREATED</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, color: '#5A5A5A', fontSize: 11, letterSpacing: '0.05em' }}>SHIPPED</th>
                </tr>
              </thead>
              <tbody>
                {briefs.map((b: any, i: number) => (
                  <tr key={b.id} style={{ borderBottom: i < briefs.length - 1 ? '1px solid #E6DFCC' : 'none', background: '#FFFFFF' }}>
                    <td style={{ padding: '10px 14px', color: '#1B1B1B', fontWeight: 500, maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title ?? b.slug}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                        background: b.status === 'shipped' ? '#E8F5E9' : b.status === 'ready' ? '#E3F2FD' : '#F4EFE2',
                        color: b.status === 'shipped' ? '#2E7D32' : b.status === 'ready' ? '#1565C0' : '#5A5A5A',
                      }}>{b.status ?? 'draft'}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#5A5A5A' }}>
                      {b.created_at ? new Date(b.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: b.shipped_at ? '#2E7D32' : '#8A8A8A' }}>
                      {b.shipped_at ? new Date(b.shipped_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
