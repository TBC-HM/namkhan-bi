// app/api/admin/reports/preview/route.ts
// Returns the first N rows of a synced stock-report snapshot as JSON, so the reports
// table can show the data inline instead of making you download a CSV to find out
// whether a sync actually returned anything useful.
//
// Same source and same auth gate as the CSV download route; only the shape differs.
// Query: ?property_id=<id>&report_id=<id>&limit=<n, default 25, max 200>
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  let propertyId: number;
  try {
    propertyId = await requirePropertyAccess(req, searchParams.get('property_id'));
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const reportId = Number(searchParams.get('report_id'));
  if (!Number.isFinite(reportId) || reportId <= 0) {
    return NextResponse.json({ error: 'report_id required' }, { status: 400 });
  }
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 25, 1), 200);

  const { data, error } = await (getSupabaseAdmin() as any)
    .from('v_stock_report_snapshot')
    .select('report_name, report_date, period_from, period_to, headers, records')
    .eq('property_id', propertyId)
    .eq('report_id', reportId)
    .order('synced_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'No snapshot found — sync this report first' }, { status: 404 });
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

  // CB returns column-oriented data: records is { columnName: [v1, v2, ...] }. Row
  // count comes from the first column's array length, matching the CSV route exactly
  // so preview and download can never disagree about what the snapshot holds.
  const firstCol = headers[0];
  const totalRows = firstCol && Array.isArray(records[firstCol]) ? records[firstCol].length : 0;

  const rows: string[][] = [];
  for (let i = 0; i < Math.min(totalRows, limit); i++) {
    rows.push(headers.map((h) => {
      const col = records[h];
      const v = Array.isArray(col) ? col[i] : null;
      return v == null ? '' : String(v);
    }));
  }

  return NextResponse.json({
    ok: true,
    report_name: snap.report_name,
    period: snap.period_from ? `${snap.period_from} → ${snap.period_to}` : (snap.report_date ?? null),
    headers,
    rows,
    total_rows: totalRows,
    shown: rows.length,
  });
}
