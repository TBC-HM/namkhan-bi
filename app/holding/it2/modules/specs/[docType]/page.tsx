// app/holding/it2/modules/specs/[docType]/page.tsx
// Moved it2-native from /holding/it/module/[docType] (it-area-reorg-v1 final slice).
// PBS 2026-07-23: module doc preview. Renders the canonical module spec from
// public.v_documents_latest. Version replacement is handled at the DB layer by
// UNIQUE(doc_type) — this route always shows the latest.
// 2026-08-06 (seo_pr_cockpit-owner-findings-v1): removed ALLOWED whitelist —
// the DB query naturally 404s if doc doesn't exist; hardcoded list was stale
// and blocked valid modules like seo_pr_cockpit (finding #53).

import { notFound } from 'next/navigation';
import TenantLink from '@/components/nav/TenantLink';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TYPE_LABEL: Record<string, string> = {
  gbp_module:        'Google Business Profile',
  media_module:      'Media',
  newsletter_module: 'Newsletter',
  socials_module:    'Socials',
  seo_pr_cockpit:    'SEO & PR Cockpit',
};

interface PageProps {
  params: Promise<{ docType: string }>;
}

export default async function ModulePreviewPage({ params }: PageProps) {
  const { docType } = await params;

  const { data, error } = await supabase
    .from('v_documents_latest')
    .select('doc_type, title, content_md, version, status, last_updated_at, last_updated_by, md_length')
    .eq('doc_type', docType)
    .maybeSingle();

  if (error || !data) notFound();

  const updated = new Date(data.last_updated_at).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <DashboardPage
      title={TYPE_LABEL[data.doc_type] ?? data.doc_type}
      subtitle={data.title}
      action={
        <TenantLink href="/holding/it2/modules/specs" style={backBtnStyle}>← Back to Module Docs</TenantLink>
      }
    >
      <div style={fullRow}>
        <Container
          title="Module spec"
          subtitle={`v${data.version} · ${data.status} · updated ${updated} · ${data.md_length.toLocaleString()} chars · by ${data.last_updated_by ?? '—'}`}
          density="compact"
        >
          <pre style={docBodyStyle}>{data.content_md ?? ''}</pre>
        </Container>
      </div>
    </DashboardPage>
  );
}

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };

const backBtnStyle: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
  padding: '6px 14px', borderRadius: 4,
  background: '#FFFFFF', color: '#1B1B1B', border: '1px solid #E6DFCC',
  textDecoration: 'none',
};

const docBodyStyle: React.CSSProperties = {
  margin: 0,
  padding: '12px 16px',
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 13,
  lineHeight: 1.6,
  color: '#1B1B1B',
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  background: '#FFFFFF',
  border: '1px solid #E6DFCC',
  borderRadius: 3,
  maxHeight: '75vh',
  overflow: 'auto',
};
