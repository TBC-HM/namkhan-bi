// app/api/admin/reports/sync/route.ts
// Triggers a sync-cloudbeds edge function call for one stock report.
// POST body: { report_id: number, report_name: string, from_date?: string, to_date?: string }
// Query: ?property_id=<id>
import { NextRequest, NextResponse } from 'next/server';
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

  const body = await req.json().catch(() => ({})) as {
    report_id?: number;
    report_name?: string;
    from_date?: string;
    to_date?: string;
  };

  const reportId = Number(body.report_id);
  if (!Number.isFinite(reportId) || reportId <= 0) {
    return NextResponse.json({ error: 'report_id required' }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const payload = {
    scope: 'stock_report',
    propertyID: propertyId,
    reportId,
    reportName: body.report_name ?? `Report ${reportId}`,
    fromDate: body.from_date ?? oneYearAgo,
    toDate: body.to_date ?? today,
  };

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    return NextResponse.json({ error: 'Supabase env not configured' }, { status: 500 });
  }

  const res = await fetch(`${base}/functions/v1/sync-cloudbeds`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return NextResponse.json(
      { error: `Edge function returned ${res.status}`, detail: text.slice(0, 300) },
      { status: 502 },
    );
  }

  const result = await res.json().catch(() => ({ ok: true }));
  return NextResponse.json({ ok: true, result });
}
