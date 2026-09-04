// app/api/admin/reports/download/route.ts
// Downloads a single CB stock report snapshot as CSV.
// Query params: property_id (required), report_id (required)
// Data source: public.v_stock_report_snapshot -> insights.stock_reports_cb
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

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
    headers: string[];
    records: Record<string, unknown[]>;
  };

  const headers: string[] = Array.isArray(snap.headers) ? snap.headers : [];
  const records: Record<string, unknown[]> = snap.records ?? {};

  // Determine actual row count from first column's array length
  const firstCol = headers[0];
  const rowCount = firstCol && Array.isArray(records[firstCol]) ? records[firstCol].length : 0;

  // Build CSV
  const lines: string[] = [];
  lines.push(headers.map(csvCell).join(','));

  for (let i = 0; i < rowCount; i++) {
    const cells = headers.map((h) => {
      const col = records[h];
      const val = Array.isArray(col) ? col[i] : null;
      return csvCell(val == null ? '' : String(val));
    });
    lines.push(cells.join(','));
  }

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
