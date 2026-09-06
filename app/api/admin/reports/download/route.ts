// app/api/admin/reports/download/route.ts
// Downloads a single CB stock report snapshot as CSV.
// Query params: property_id (required), report_id (required)
// Data source: public.v_stock_report_snapshot -> insights.stock_reports_cb
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';
import { flattenSnapshot } from '@/lib/cb-report-table';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const rawPid = searchParams.get('property_id');
  const rawRid = searchParams.get('report_id');

  const reportId = Number(rawRid);
  if (!Number.isFinite(reportId) || reportId <= 0) {
    return new NextResponse('report_id required', { status: 400 });
  }

  let propertyId: number;
  try {
    propertyId = await requirePropertyAccess(req, rawPid);
  } catch (err) {
    if (err instanceof Response) return err;
    return new NextResponse('Unauthorized', { status: 401 });
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
    return new NextResponse('No snapshot found for this report', { status: 404 });
  }

  const snap = data as {
    report_name: string;
    report_date: string | null;
    period_from: string | null;
    period_to: string | null;
    headers: unknown;
    records: unknown;
  };

  // Cloudbeds returns three different snapshot shapes; flattenSnapshot handles all of
  // them. Doing this inline is what produced header-only CSVs for the 13 grouped reports.
  const { columns, rows } = flattenSnapshot(snap.headers, snap.records);

  const lines: string[] = [columns.map(csvCell).join(',')];
  for (const row of rows) lines.push(row.map(csvCell).join(','));

  const csv = lines.join('\r\n');
  const safeName = (snap.report_name ?? `report_${reportId}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateRange = snap.period_from
    ? `${snap.period_from}_to_${snap.period_to}`
    : (snap.report_date ?? 'unknown');
  const filename = `cb_${safeName}_${dateRange}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function csvCell(value: string): string {
  if (/[,"\n\r]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}
