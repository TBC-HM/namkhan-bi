// app/api/sop/send/route.ts
// PBS 2026-07-11 pm: SOP email delivery. Previously PBS was seeing the SOP body
// inlined into the email body. Now the SOP goes as a proper .doc attachment
// (application/msword payload built by lib/sop-docx.buildSopHtml). Email body
// is a short cover paragraph; the SOP itself opens in Word / Docs / Pages.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { buildSopHtml, docFilename, effectiveDate, versionLabel, type SopDocRow, type SopMetaRow } from '@/lib/sop-docx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Node's Buffer is fine here (route runs on nodejs runtime).
function utf8ToBase64(s: string): string {
  return Buffer.from(s, 'utf-8').toString('base64');
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const sop_code = String(b.sop_code ?? '').trim();
    const to = String(b.to ?? '').trim();
    const subject_in = String(b.subject ?? '').trim();
    const cover_note = String(b.message ?? '').trim();
    if (!sop_code || !to) {
      return NextResponse.json({ error: 'sop_code and to required' }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const { data: row, error } = await sb
      .from('v_sop_catalog')
      .select('sop_code, title, dept_code, short_summary, body_md, version, author, sop_date, status, primary_audience, property_id, created_at, updated_at')
      .eq('sop_code', sop_code)
      .maybeSingle();
    if (error) return NextResponse.json({ error: 'SOP lookup failed: ' + error.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: 'SOP not found' }, { status: 404 });

    const docRow = row as unknown as SopDocRow;
    const meta: SopMetaRow | null = null;

    const ver = versionLabel(docRow);
    const eff = effectiveDate(docRow);
    const subject = subject_in || `SOP · ${docRow.title} (${ver})`;
    const filename = docFilename(docRow);

    // The attachment payload — same HTML shape the /docx endpoint serves.
    const docHtml = buildSopHtml(docRow, meta, { forDownload: true });
    const attachmentB64 = utf8ToBase64(docHtml);

    // Short email body — no SOP content inlined. The doc goes as attachment.
    const bodyHtml = `
      <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1B1B1B;max-width:640px;margin:0 auto;padding:20px;background:#FFFFFF;">
        <div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#5A5A5A;">Namkhan · SOP delivery</div>
        <h1 style="margin:6px 0 12px;font-size:18px;font-weight:700;color:#1F3A2E;">${esc(docRow.title)}</h1>
        <p style="font-size:13px;line-height:1.55;color:#1B1B1B;margin:0 0 12px;">
          Attached: <strong>${esc(sop_code)}</strong> — ${esc(docRow.title)} (<strong>${esc(ver)}</strong>), effective ${esc(eff)}.
          Please review the attached document and confirm receipt.
        </p>
        ${cover_note ? `<div style="padding:12px;background:#FAFAF7;border:1px solid #E6DFCC;border-radius:6px;font-size:13px;line-height:1.5;color:#1B1B1B;margin-bottom:12px;">${esc(cover_note).replace(/\n/g, '<br/>')}</div>` : ''}
        <p style="font-size:12px;color:#5A5A5A;margin:16px 0 0;">Open the attached <code>.doc</code> file in Word, Google Docs, or Pages.</p>
      </div>
    `;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ error: 'server not configured' }, { status: 500 });

    const res = await fetch(`${url}/functions/v1/send-report-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        subject,
        html: bodyHtml,
        attachments: [
          {
            filename,
            content: attachmentB64,
            content_type: 'application/msword',
          },
        ],
      }),
    });
    const j = await res.json().catch(() => ({ error: `edge fn returned ${res.status}` }));
    if (!res.ok || j.error) return NextResponse.json({ error: j.error ?? `HTTP ${res.status}` }, { status: res.status });

    return NextResponse.json({ ok: true, to, subject, filename });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
