// app/legal/docs/preview/[doc_id]/page.tsx
// Inline preview wrapper. Supabase's signed URLs don't force "inline" via the
// Content-Disposition header — browsers download anything they can't render
// natively (PDFs preview; .docx / .xlsx download). This page wraps the file
// in the right viewer per MIME so PBS sees the document instead of a download
// prompt.
//
// Strategy:
//   PDF                → native <iframe> (every modern browser has a PDF viewer)
//   Image (png/jpeg)   → <img>
//   Office (docx/xlsx) → Microsoft's hosted Office Online viewer
//                        https://view.officeapps.live.com/op/embed.aspx?src=…
//   Anything else      → small "no native preview" card with a download link

import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SIGNED_TTL = 600; // 10 min — Office viewer fetches the URL once after page load

interface Props { params: { doc_id: string } }

interface FileInfo { storage_bucket: string | null; storage_path: string | null; file_name: string | null; mime: string | null }

function pickViewer(mime: string | null, fileName: string | null): 'pdf' | 'image' | 'office' | 'unsupported' {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('application/pdf')) return 'pdf';
  if (m.startsWith('image/')) return 'image';
  if (
    m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    m === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    m === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    m === 'application/msword' ||
    m === 'application/vnd.ms-excel' ||
    m === 'application/vnd.ms-powerpoint'
  ) return 'office';
  // Fall back to filename extension if mime was wrong / absent.
  const ext = (fileName ?? '').toLowerCase().split('.').pop() ?? '';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'office';
  return 'unsupported';
}

export default async function DocPreviewPage({ params }: Props) {
  const docId = params.doc_id;
  if (!docId) notFound();

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('fn_doc_file_info', { p_doc_id: docId });
  if (error) {
    return <ErrorCard title="Lookup failed" detail={error.message} />;
  }
  const row = (Array.isArray(data) ? data[0] : data) as FileInfo | null;
  if (!row) notFound();
  if (!row.storage_bucket || !row.storage_path) {
    return <ErrorCard title="No stored file" detail="This document has no bytes in the bucket." />;
  }

  const viewer = pickViewer(row.mime, row.file_name);

  // Inline signed URL (no `download` option → Content-Disposition stays inline-ish).
  const { data: signed, error: signErr } = await supabase.storage
    .from(row.storage_bucket)
    .createSignedUrl(row.storage_path, SIGNED_TTL);
  if (signErr || !signed?.signedUrl) {
    return <ErrorCard title="Sign failed" detail={signErr?.message ?? 'no URL'} />;
  }
  const url = signed.signedUrl;

  // Office viewer needs a public-reachable URL (Microsoft fetches it server-side).
  // The Supabase signed URL is publicly fetchable until TTL expires, so that's
  // fine.
  const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
  const fileName  = row.file_name ?? 'document';
  const downloadHref = `/api/legal/docs/file/${encodeURIComponent(docId)}?mode=download`;

  return (
    <main style={S.page}>
      <header style={S.header}>
        <div style={{ minWidth: 0 }}>
          <div style={S.titleSmall}>Preview</div>
          <div style={S.titleLarge} title={fileName}>{fileName}</div>
        </div>
        <a href={downloadHref} download style={S.dlBtn}>⤓ Download</a>
      </header>

      <section style={S.viewer}>
        {viewer === 'pdf'    && <iframe src={url} title={fileName} style={S.frame} />}
        {viewer === 'image'  && <img src={url} alt={fileName} style={S.image} />}
        {viewer === 'office' && <iframe src={officeUrl} title={fileName} style={S.frame} />}
        {viewer === 'unsupported' && (
          <div style={S.unsupported}>
            <h2 style={{ fontSize: 14, margin: '0 0 8px 0' }}>No inline preview for this file type</h2>
            <p style={{ fontSize: 12, color: '#5A5A5A', margin: '0 0 12px 0' }}>
              MIME: <code>{row.mime ?? 'unknown'}</code>
            </p>
            <a href={downloadHref} download style={S.dlBtn}>⤓ Download</a>
          </div>
        )}
      </section>
    </main>
  );
}

function ErrorCard({ title, detail }: { title: string; detail: string }) {
  return (
    <main style={S.page}>
      <header style={S.header}>
        <div style={S.titleLarge}>{title}</div>
      </header>
      <section style={S.unsupported}>
        <code style={{ color: '#C62828' }}>{detail}</code>
      </section>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:      { display: 'flex', flexDirection: 'column', height: '100vh', background: '#FFFFFF', color: '#1B1B1B' },
  header:    { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #E0E0E0' },
  titleSmall:{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.08em' },
  titleLarge:{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70vw' },
  dlBtn:     { marginLeft: 'auto', padding: '6px 12px', border: '1px solid #1B1B1B', borderRadius: 3, background: '#1B1B1B', color: '#FFFFFF', textDecoration: 'none', fontSize: 11 },
  viewer:    { flex: 1, minHeight: 0, display: 'flex' },
  frame:     { width: '100%', height: '100%', border: 'none' },
  image:     { maxWidth: '100%', maxHeight: '100%', margin: 'auto', objectFit: 'contain' },
  unsupported: { padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#1B1B1B' },
};
