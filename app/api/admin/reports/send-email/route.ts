// app/api/admin/reports/send-email/route.ts
// Schedules a stock report to be emailed to a given address.
// POST body: { report_id: number, email: string }
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
    email?: string;
  };

  const reportId = Number(body.report_id);
  if (!Number.isFinite(reportId) || reportId <= 0) {
    return NextResponse.json({ error: 'report_id required' }, { status: 400 });
  }

  const email = (body.email ?? '').trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'valid email required' }, { status: 400 });
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    return NextResponse.json({ error: 'Supabase env not configured' }, { status: 500 });
  }

  const payload = {
    property_id: propertyId,
    report_id: reportId,
    email,
  };

  const res = await fetch(`${base}/functions/v1/send-report-email`, {
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
