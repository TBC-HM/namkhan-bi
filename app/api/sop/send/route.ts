// app/api/sop/send/route.ts
// PBS 2026-07-09 pm: SOP email delivery — relays to send-report-email edge fn.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const sop_code = String(b.sop_code ?? '').trim();
    const to = String(b.to ?? '').trim();
    const subject = String(b.subject ?? '').trim() || `SOP · ${sop_code}`;
    const message = String(b.message ?? '');
    if (!sop_code || !to) {
      return NextResponse.json({ error: 'sop_code and to required' }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const { data: row, error } = await sb
      .from('v_sop_catalog')
      .select('sop_code, title, dept_code, short_summary, body_md, version, author, sop_date')
      .eq('sop_code', sop_code)
      .maybeSingle();
    if (error) return NextResponse.json({ error: 'SOP lookup failed: ' + error.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: 'SOP not found' }, { status: 404 });

    const html = `
      <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1B1B1B;max-width:640px;margin:0 auto;padding:20px;background:#FFFFFF;">
        <div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#5A5A5A;">SOP · ${escapeHtml(row.sop_code)}</div>
        <h1 style="margin:4px 0 8px;font-size:20px;font-weight:700;color:#084838;">${escapeHtml(row.title)}</h1>
        <div style="font-size:12px;color:#5A5A5A;margin-bottom:14px;">
          ${escapeHtml(row.dept_code)} · v${escapeHtml(row.version ?? '—')}
          ${row.author ? ` · by ${escapeHtml(row.author)}` : ''}
          ${row.sop_date ? ` · ${escapeHtml(row.sop_date)}` : ''}
        </div>
        ${message ? `<div style="padding:12px;background:#FAFAF7;border:1px solid #E6DFCC;border-radius:6px;font-size:13px;line-height:1.5;margin-bottom:14px;">${escapeHtml(message).replace(/\n/g, '<br/>')}</div>` : ''}
        ${row.short_summary ? `<div style="padding:12px;background:#FAFAF7;border:1px solid #E6DFCC;border-radius:6px;font-size:13px;line-height:1.5;margin-bottom:14px;">${escapeHtml(row.short_summary)}</div>` : ''}
        <div style="padding:16px;background:#FFFFFF;border:1px solid #E6DFCC;border-radius:6px;font-size:13px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(row.body_md ?? '(no body content stored)')}</div>
        <div style="margin-top:20px;font-size:11px;color:#5A5A5A;">— The Namkhan · ops SOP delivery</div>
      </div>
    `;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ error: 'server not configured' }, { status: 500 });

    const res = await fetch(`${url}/functions/v1/send-report-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html }),
    });
    const j = await res.json().catch(() => ({ error: `edge fn returned ${res.status}` }));
    if (!res.ok || j.error) return NextResponse.json({ error: j.error ?? `HTTP ${res.status}` }, { status: res.status });

    return NextResponse.json({ ok: true, to, subject });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
