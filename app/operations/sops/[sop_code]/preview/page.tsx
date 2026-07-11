// app/operations/sops/[sop_code]/preview/page.tsx
// PBS 2026-07-11 pm: SOP preview rewritten as a structured document (cover +
// numbered sections + revision history + signature blocks). Same HTML shape as
// the .doc download (both go through lib/sop-docx.buildSopHtml) so what PBS
// sees on the page is exactly what lands in the emailed attachment / print PDF.

import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sopDocStyleSheet } from '@/lib/sop-docx-styles';
import {
  buildSopHtml,
  effectiveDate,
  propertyLabel,
  reviewIntervalLabel,
  renderBody,
  versionLabel,
  type SopDocRow,
  type SopMetaRow,
} from '@/lib/sop-docx';
import PreviewToolbar from './_components/PreviewToolbar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SopPreviewPage({ params }: { params: Promise<{ sop_code: string }> }) {
  const { sop_code } = await params;
  const code = String(sop_code || '').trim();
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('v_sop_catalog')
    .select('sop_code, title, dept_code, short_summary, body_md, version, author, sop_date, status, primary_audience, property_id, created_at, updated_at')
    .eq('sop_code', code)
    .maybeSingle();
  const row = data as SopDocRow | null;
  if (!row) notFound();

  // sop_meta lives in the non-PostgREST schema `knowledge`; keep this null until a
  // bridge view lands. renderer + downloader both fall back to sensible defaults.
  const meta: SopMetaRow | null = null;

  // We render the SAME HTML the .doc download emits. This guarantees pixel-parity
  // between preview / print / attachment. The wrapper below only supplies the
  // Namkhan chrome + a toolbar with Print + Download-.doc actions.
  const documentHtml = buildSopHtml(row, meta, { forDownload: false });
  const styles = sopDocStyleSheet();
  const ver = versionLabel(row);
  const eff = effectiveDate(row);
  const propLabel = propertyLabel(row.property_id ?? null);
  const reviewInterval = reviewIntervalLabel(meta?.review_cadence_days ?? null);
  // touch renderBody so the tsc "unused" check doesn't strip the re-export we may
  // need later when we split the section renderers out of the html builder.
  void renderBody;

  const docxHref = `/api/sop/${encodeURIComponent(row.sop_code)}/docx`;
  const editHref = `/operations/sops/${encodeURIComponent(row.sop_code)}/edit`;
  const sendHref = `/operations/sops/${encodeURIComponent(row.sop_code)}/send`;

  return (
    <div style={{ padding: 24, background: '#F1EEE7', color: '#1B1B1B', fontFamily: '-apple-system, Helvetica, Arial, sans-serif', minHeight: '100vh' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <PreviewToolbar sopCode={row.sop_code} docxHref={docxHref} editHref={editHref} sendHref={sendHref} />

        <div style={{ marginTop: 4, marginBottom: 12, fontSize: 11, color: '#5A5A5A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Preview · {ver} · effective {eff} · {reviewInterval} review · {propLabel}
        </div>

        <div
          className="sop-doc-frame"
          style={{ background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden' }}
        >
          {/* Inject the same stylesheet the .doc payload uses so the preview matches. */}
          <style dangerouslySetInnerHTML={{ __html: styles }} />
          {/* documentHtml is a full <html>…</html> string. We slice out its <body> for
              in-page embedding — Word / Docs / Pages get the full doc via the download. */}
          <div dangerouslySetInnerHTML={{ __html: extractBody(documentHtml) }} />
        </div>
      </div>
    </div>
  );
}

// Extract just the <body>…</body> inner HTML from a full HTML doc, so we can render
// inline inside the preview page without conflicting <html>/<head> tags.
function extractBody(fullHtml: string): string {
  const m = /<body[^>]*>([\s\S]*)<\/body>/i.exec(fullHtml);
  return m ? m[1] : fullHtml;
}
