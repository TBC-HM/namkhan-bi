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
import { flattenSnapshot } from '@/lib/cb-report-table';

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
    headers: unknown;
    records: unknown;
  };

  // Shared with the CSV route so preview and download can never disagree about what a
  // snapshot holds — see lib/cb-report-table.ts for the three shapes CB returns.
  const { columns: headers, rows: allRows } = flattenSnapshot(snap.headers, snap.records);
  const totalRows = allRows.length;
  const rows = allRows.slice(0, limit);

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
