// app/holding/it/cockpit/specs/page.tsx
// Module Docs hub — lists module specs + build briefs.
// Uses public.v_documents_latest + public.v_build_briefs (bridge views over documentation schema).

import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MODULE_DOC_TYPES = [
  'bug_agent_module', 'compiler_module', 'gbp_module', 'inventory_module',
  'media_module', 'newsletter_module', 'proposals_module', 'sales_module',
  'socials_module', 'spec_builder_module', 'university_module', 'youtube_module',
];

const BADGE: Record<string, { bg: string; color: string }> = {
  bug_agent_module:    { bg: '#EDE7F6', color: '#4527A0' },
  compiler_module:     { bg: '#E8EAF6', color: '#283593' },
  gbp_module:          { bg: '#FCE4EC', color: '#880E4F' },
  inventory_module:    { bg: '#E8F5E9', color: '#1B5E20' },
  media_module:        { bg: '#E3F2FD', color: '#0D47A1' },
  newsletter_module:   { bg: '#FFF3E0', color: '#E65100' },
  proposals_module:    { bg: '#F3E5F5', color: '#6A1B9A' },
  sales_module:        { bg: '#E0F7FA', color: '#006064' },
  socials_module:      { bg: '#FFEBEE', color: '#B71C1C' },
  spec_builder_module: { bg: '#E0F2F1', color: '#004D40' },
  university_module:   { bg: '#F1F8E9', color: '#33691E' },
  youtube_module:      { bg: '#FFEBEE', color: '#C62828' },
};

const BRIEF_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  ready:       { label: 'ready for agent', bg: '#E3F2FD', color: '#1565C0' },
  shipped:     { label: 'agent ran ✓',      bg: '#E8F5E9', color: '#2E7D32' },
  in_progress: { label: 'agent running',    bg: '#FFF8E1', color: '#F57F17' },
  draft:       { label: 'draft',            bg: '#F4EFE2', color: '#5A5A5A' },
};

function TypePill({ docType }: { docType: string }) {
  const b = BADGE[docType] ?? { bg: '#F4EFE2', color: '#5A5A5A' };
  const label = docType.replace(/_module$/, '').replace(/_/g, ' ');
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: 99, background: b.bg, color: b.color }}>
      {label}
    </span>
  );
}

async function fetchData() {
  const [{ data: moduleDocs }, { data: briefs }, { data: statuses }] = await Promise.all([
    supabase
      .from('v_documents_latest')
      .select('id, doc_type, title, status, version, last_updated_at')
      .in('doc_type', MODULE_DOC_TYPES)
      .order('doc_type'),
    (supabase as any)
      .from('v_build_briefs')
      .select('id, slug, title, status, tags, created_at, shipped_at')
      .order('created_at', { ascending: false })
      .limit(30),
    (supabase as any)
      .from('v_module_status')
      .select('doc_type, completion_pct, is_live, signed_off_at')
      .in('doc_type', MODULE_DOC_TYPES),
  ]);
  const statusMap: Record<string, any> = {};
  for (const s of (statuses ?? [])) statusMap[s.doc_type] = s;
  return { moduleDocs: moduleDocs ?? [], briefs: briefs ?? [], statusMap };
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function SpecsPage() {
  const { moduleDocs, briefs, statusMap } = await fetchData();

  return (
    <div style={{ maxWidth: 960, padding: '28px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1B1B1B', margin: 0 }}>Module Documentation</h1>
          <p style={{ fontSize: 12, color: '#5A5A5A', margin: '4px 0 0' }}>
            Spec docs for all modules in development · % shows progress to goal · Signed off = 100% & tested
          </p>
        </div>
        <Link href="/holding/it/cockpit/specs/new" style={{
          fontSize: 12, fontWeight: 700, padding: '8px 18px', borderRadius: 4,
          background: '#1F3A2E', color: '#FFFFFF', textDecoration: 'none', letterSpacing: '0.05em',
        }}>+ New spec</Link>
      </div>

      {/* Module spec docs */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#1B1B1B', margin: '0 0 12px', letterSpacing: '0.04em' }}>
          MODULE SPECS ({moduleDocs.length})
        </h2>
        {moduleDocs.length === 0 ? (
          <div style={{ fontSize: 12, color: '#8A8A8A', padding: '20px 0' }}>
            Loading module specs — if this persists, check v_documents_latest.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {moduleDocs.map((doc: any) => {
              const st = statusMap[doc.doc_type];
              const pct = st?.completion_pct ?? 0;
              const live = st?.is_live ?? false;
              const signedOff = !!st?.signed_off_at;
              return (
                <div key={doc.doc_type} style={{
                  background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6,
                  padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <TypePill docType={doc.doc_type} />
                    <span style={{ fontSize: 10, fontWeight: 700,
                      color: signedOff ? '#2E7D32' : doc.status === 'published' ? '#2E7D32' : '#B8A878' }}>
                      v{doc.version} · {signedOff ? 'signed off' : doc.status}
                    </span>
                  </div>
                  {/* % progress bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 4, background: '#F0EBE0', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99,
                        background: pct >= 80 ? '#2E7D32' : pct >= 50 ? '#F57F17' : '#D32F2F' }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#5A5A5A' }}>{pct}%</span>
                    {live && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px',
                      borderRadius: 99, background: '#E8F5E9', color: '#2E7D32' }}>live</span>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1B1B1B', lineHeight: 1.4 }}>{doc.title}</div>
                  <div style={{ fontSize: 11, color: '#8A8A8A', marginTop: 'auto', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{doc.last_updated_at ? shortDate(doc.last_updated_at) : '—'}</span>
                    <Link href={`/holding/it/module/${encodeURIComponent(doc.doc_type)}`}
                      style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 3,
                        background: '#1F3A2E', color: '#FFFFFF', textDecoration: 'none' }}>
                      Spec →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Build briefs */}
      <section>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#1B1B1B', margin: '0 0 4px', letterSpacing: '0.04em' }}>
          BUILD BRIEFS ({briefs.length})
        </h2>
        <p style={{ fontSize: 11, color: '#5A5A5A', margin: '0 0 12px' }}>
          Briefs written in + New spec · picked up by agents · "agent ran" means the agent completed its run (does not mean the module is 100% done)
        </p>
        <div style={{ border: '1px solid #E6DFCC', borderRadius: 6, overflow: 'hidden' }}>
          {briefs.length === 0 ? (
            <div style={{ fontSize: 12, color: '#8A8A8A', padding: '20px 16px' }}>
              No briefs yet. Write your first spec with + New spec above.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#FAFAF7', borderBottom: '1px solid #E6DFCC' }}>
                  {['TITLE', 'STATUS', 'CREATED', 'AGENT RAN'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700,
                      color: '#5A5A5A', fontSize: 11, letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {briefs.map((b: any, i: number) => {
                  const bs = BRIEF_STATUS[b.status] ?? { label: b.status ?? 'draft', bg: '#F4EFE2', color: '#5A5A5A' };
                  return (
                    <tr key={b.id} style={{ borderBottom: i < briefs.length - 1 ? '1px solid #E6DFCC' : 'none' }}>
                      <td style={{ padding: '10px 14px', color: '#1B1B1B', fontWeight: 500,
                        maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.title ?? b.slug}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px',
                          borderRadius: 99, background: bs.bg, color: bs.color }}>
                          {bs.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#5A5A5A' }}>
                        {b.created_at ? shortDate(b.created_at) : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', color: b.shipped_at ? '#2E7D32' : '#8A8A8A' }}>
                        {b.shipped_at ? shortDate(b.shipped_at) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
