// app/h/[property_id]/settings/documents/page.tsx
// PBS 2026-08-02 — Document register settings consolidated in property settings.
// Each tenant has their own Families/Subtypes/Matters/Cases/Collections/Tags/Authors.
// SettingsDrawerButton imported from legal/docs — no code duplication.
// The panel opens as a drawer (existing UX preserved).

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import SettingsDrawerButton from '@/app/h/[property_id]/finance/legal/docs/_components/SettingsDrawerButton';
import UploadDropzone from '@/app/marketing/media/_client/UploadDropzone';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SETTINGS_TABS = (pid: number) => [
  { key: 'property',   label: 'Property',   href: `/h/${pid}/settings/property`   },
  { key: 'media',      label: 'Media',      href: `/h/${pid}/settings/media`      },
  { key: 'rate_plans', label: 'Rate Plans', href: `/h/${pid}/settings/rate-plans` },
  { key: 'guardrails', label: 'Guardrails', href: `/h/${pid}/settings/guardrails` },
  { key: 'documents',  label: 'Documents',  href: `/h/${pid}/settings/documents`, active: true },
  { key: 'archive',    label: 'Archive',    href: `/h/${pid}/settings/archive`    },
  { key: 'data',       label: 'Data',       href: `/h/${pid}/settings/data`       },
  { key: 'brain',      label: 'Brain',      href: `/h/${pid}/settings/brain`      },
  { key: 'knowledge',  label: 'Knowledge',  href: `/h/${pid}/settings/knowledge`  },
];

async function fetchDocSettings(propertyId: number) {
  const sb = getSupabaseAdmin();
  const [familyRows, vocab, cases, collections, projects, tagRows, authors] = await Promise.all([
    sb.from('v_doc_register').select('doc_type').eq('property_id', propertyId),
    sb.from('v_doc_subtype_vocab').select('doc_type, subtype_slug, label, time_model, sort_order').order('doc_type').order('label'),
    sb.from('v_doc_cases').select('case_ref, title, matter_type, status').eq('property_id', propertyId).order('case_ref'),
    sb.from('v_doc_collections').select('name, description, is_smart').eq('property_id', propertyId).order('name'),
    sb.from('v_doc_projects').select('project_name, n_docs').eq('property_id', propertyId).order('n_docs', { ascending: false }),
    sb.from('v_doc_register').select('tags').eq('property_id', propertyId),
    sb.from('v_doc_authors').select('author_name, n_docs').eq('property_id', propertyId).order('n_docs', { ascending: false }),
  ]);

  // Build family counts
  const familyCounts = new Map<string, number>();
  for (const r of (familyRows.data ?? []) as { doc_type: string | null }[]) {
    const k = String(r.doc_type ?? '');
    if (k) familyCounts.set(k, (familyCounts.get(k) ?? 0) + 1);
  }
  const familiesWithCounts = Array.from(familyCounts.entries())
    .map(([doc_type, n]) => ({ doc_type, n })).sort((a, b) => b.n - a.n);

  // Build tag counts
  const tagCounts = new Map<string, number>();
  for (const r of (tagRows.data ?? []) as { tags: string[] | null }[]) {
    for (const t of r.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const tags = Array.from(tagCounts.entries()).map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n);

  return {
    families: familiesWithCounts,
    subtypeVocab: (vocab.data ?? []) as any[],
    cases: (cases.data ?? []) as any[],
    collections: (collections.data ?? []) as any[],
    projects: ((projects.data ?? []) as any[]).map((p: any) => ({ project: p.project_name, n: p.n_docs ?? 0 })),
    tags,
    authors: ((authors.data ?? []) as any[]).map((a: any) => ({ author: a.author_name, n: a.n_docs ?? 0 })),
  };
}

export default async function DocumentsSettingsPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  const d = await fetchDocSettings(propertyId);

  return (
    <DashboardPage
      title="Settings · Documents"
      subtitle={`Document register vocabulary · families · subtypes · matters · cases · collections · tags · authors · property ${propertyId}`}
      tabs={SETTINGS_TABS(propertyId)}
    >
      {/* Document upload — goes through DMS ingestion pipeline */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Upload documents" subtitle="PDF · contracts · certificates · policies — routed through document register pipeline">
          <div style={{ padding: 16 }}>
            <UploadDropzone />
            <p style={{ fontSize: 11, color: '#5A5A5A', marginTop: 8 }}>
              Documents land in the register with status=needs_review. Open the register (Finance → Legal → Docs) to classify family, subtype and matter.
            </p>
          </div>
        </Container>
      </div>

      {/* Document register vocabulary — tenant-scoped */}
      <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
        <Container
          title="Document register · vocabulary"
          subtitle={`Families · subtypes · matters · cases · collections · tags · authors — scoped to property ${propertyId}`}
          action={
            <SettingsDrawerButton
              propertyId={propertyId}
              families={d.families}
              subtypeVocab={d.subtypeVocab}
              projects={d.projects}
              cases={d.cases}
              collections={d.collections}
              tags={d.tags}
              authors={d.authors}
            />
          }
        >
          <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {[
              { label: 'Families',    value: d.families.length    },
              { label: 'Subtypes',    value: d.subtypeVocab.length },
              { label: 'Matters',     value: d.projects.length    },
              { label: 'Cases',       value: d.cases.length       },
              { label: 'Collections', value: d.collections.length },
              { label: 'Tags',        value: d.tags.length        },
              { label: 'Authors',     value: d.authors.length     },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#FAFAF7', border: '1px solid #E6DFCC', borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#5A5A5A' }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: '#1B1B1B', margin: '2px 0' }}>{value}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: '#5A5A5A', padding: '0 16px 12px', margin: 0 }}>
            Click the ⚙ gear above to manage vocabulary. Changes apply immediately across all documents for this property.
          </p>
        </Container>
      </div>
    </DashboardPage>
  );
}
