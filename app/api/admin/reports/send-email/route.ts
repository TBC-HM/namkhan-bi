// app/api/admin/reports/send-email/route.ts
// Emails one CB stock report snapshot as a CSV attachment.
// POST body: { report_id: number, email: string }
// Query: ?property_id=<id>
// Data source: public.v_stock_report_snapshot (same as the download route).
// Delivery: send-report-email edge fn (Resend) — contract is { to, subject, html, attachments }.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';
import { flattenSnapshot } from '@/lib/cb-report-table';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const rawPid = searchParams.get('property_id');

  let propertyId: number;
  try {
    propertyId = await requirePropertyAccess(req, rawPid);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { report_id?: number; email?: string };

  const reportId = Number(body.report_id);
  if (!Number.isFinite(reportId) || reportId <= 0) {
    return NextResponse.json({ error: 'report_id required' }, { status: 400 });
  }

  const to = (body.email ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: 'valid email required' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any)
    .from('v_stock_report_snapshot')
    .select('report_name, report_date, period_from, period_to, headers, records')
    .eq('property_id', propertyId)
    .eq('report_id', reportId)
    .order('synced_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'No snapshot found for this report — sync it first' }, { status: 404 });
  }

  const snap = data as {
    report_name: string;
    report_date: string | null;
    period_from: string | null;
    period_to: string | null;
    headers: unknown;
    records: unknown;
  };

  // PBS 2026-09-06: this used to flatten inline, assuming `headers` was string[] and
  // `records` column-oriented. For a GROUPED report `headers[0]` is an ARRAY, so
  // csvCell(value: string) got a string[], `value.replace` was not a function, and the
  // route threw an uncaught TypeError — the 500 PBS hit. Even when it did not throw it
  // produced a header-only CSV. flattenSnapshot handles all three shapes and is the same
  // code the download route and the full-report page use, so the emailed CSV is now
  // identical to the downloaded one, two-decimal rule included.
  const { columns, rows } = flattenSnapshot(snap.headers, snap.records);
  const rowCount = rows.length;
  const csv = [columns.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n');

  const reportName = snap.report_name ?? `Report ${reportId}`;
  const period = snap.period_from ? `${snap.period_from} → ${snap.period_to}` : (snap.report_date ?? 'unknown period');
  const safeName = reportName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `cb_${safeName}_${snap.period_from ?? snap.report_date ?? 'snapshot'}.csv`;

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;">
      <h2 style="font-size:16px;color:#1B1B1B;margin:0 0 12px;">${esc(reportName)}</h2>
      <p style="font-size:13px;line-height:1.55;color:#1B1B1B;margin:0 0 12px;">
        Cloudbeds stock report <strong>#${reportId}</strong> — ${esc(period)}.<br/>
        ${rowCount.toLocaleString('en-US')} row${rowCount === 1 ? '' : 's'} attached as CSV.
      </p>
      <p style="font-size:12px;color:#5A5A5A;margin:16px 0 0;">Sent from the Namkhan BI reports library.</p>
    </div>
  `;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Supabase env not configured' }, { status: 500 });
  }

  const res = await fetch(`${url}/functions/v1/send-report-email`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to,
      subject: `${reportName} · ${period}`,
      html,
      attachments: [{
        filename,
        content: Buffer.from(csv, 'utf-8').toString('base64'),
        content_type: 'text/csv',
      }],
    }),
  });

  const j = await res.json().catch(() => ({ error: `edge fn returned ${res.status}` }));
  if (!res.ok || j.error) {
    return NextResponse.json({ error: j.error ?? `HTTP ${res.status}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true, to, rows: rowCount, filename });
}

// Coerces rather than trusting the annotation. The 500 above happened precisely because
// a `string`-typed parameter received a string[] at runtime and .replace blew up; a route
// that emails a file should not 500 over a cell it did not expect.
function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[,"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
