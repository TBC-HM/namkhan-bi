// app/api/admin/reports/send-email/route.ts
// Emails one CB stock report snapshot as a CSV attachment.
// POST body: { report_id: number, email: string }
// Query: ?property_id=<id>
// Data source: public.v_stock_report_snapshot (same as the download route).
// Delivery: send-report-email edge fn (Resend) — contract is { to, subject, html, attachments }.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

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
    headers: string[];
    records: Record<string, unknown[]>;
  };

  const headers: string[] = Array.isArray(snap.headers) ? snap.headers : [];
  const records = snap.records ?? {};
  const firstCol = headers[0];
  const rowCount = firstCol && Array.isArray(records[firstCol]) ? records[firstCol].length : 0;

  const lines: string[] = [headers.map(csvCell).join(',')];
  for (let i = 0; i < rowCount; i++) {
    lines.push(headers.map((h) => {
      const col = records[h];
      const val = Array.isArray(col) ? col[i] : null;
      return csvCell(val == null ? '' : String(val));
    }).join(','));
  }
  const csv = lines.join('\r\n');

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

function csvCell(value: string): string {
  return /[,"\n\r]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
