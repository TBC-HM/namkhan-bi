// app/api/finance/planning/budget-import/route.ts
// FP&C Module v1 (brief module-financial-planning-control-v1).
//
// POST multipart/form-data { file: .xlsx|.csv, property_id } →
//   parse → rows [{year_month, gl_class, amount_usd}] →
//   public.fn_budget_import RPC (SECURITY DEFINER, WRITE-PATH law).
//   Atomic: any invalid row rejects the whole file with named per-row errors (A2b).
//
// GET ?property_id=260955 → xlsx template (12 months of current year × valid classes,
//   classes read live from public.v_gl_classes — zero hand-typed lists).
//
// Mirrors the legacy /api/finance/budget/upload shape (FormData, per-row errors).
// The legacy route + finance.gl_budgets (USALI-keyed, 0 rows) stays untouched —
// deprecation is a separate PBS decision (AUDIT REALITY LAW).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BudgetRow {
  year_month: string;
  gl_class: string;
  amount_usd: number;
}

const NAMKHAN_ID = 260955;

function normPeriod(raw: string): string | null {
  const s = String(raw ?? '').trim();
  const m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, '0')}`;
}

function parseRows(records: Record<string, unknown>[]): { rows: BudgetRow[]; errors: string[] } {
  const rows: BudgetRow[] = [];
  const errors: string[] = [];
  records.forEach((r, i) => {
    const keys = Object.fromEntries(Object.keys(r).map((k) => [k.trim().toLowerCase(), k]));
    const kPeriod = keys['year_month'] ?? keys['period_yyyymm'];
    const kClass = keys['gl_class'] ?? keys['class'];
    const kAmount = keys['amount_usd'] ?? keys['amount'];
    if (!kPeriod || !kClass || !kAmount) {
      errors.push(`row ${i + 2}: missing required column(s) — need year_month, gl_class, amount_usd`);
      return;
    }
    const period = normPeriod(String(r[kPeriod]));
    if (!period) {
      errors.push(`row ${i + 2}: invalid year_month "${String(r[kPeriod])}" (expected YYYY-MM)`);
      return;
    }
    const amt = Number(String(r[kAmount]).replace(/[$,\s]/g, ''));
    if (!Number.isFinite(amt)) {
      errors.push(`row ${i + 2}: invalid amount_usd "${String(r[kAmount])}"`);
      return;
    }
    rows.push({ year_month: period, gl_class: String(r[kClass]).trim(), amount_usd: amt });
  });
  return { rows, errors };
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'expected multipart/form-data with a file field' }, { status: 400 });
  }
  const file = form.get('file');
  const propertyId = Number(form.get('property_id') ?? NAMKHAN_ID);
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file field is required' }, { status: 400 });
  }
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    return NextResponse.json({ error: 'invalid property_id' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const XLSX = await import('xlsx');
  let records: Record<string, unknown>[] = [];
  try {
    const wb = XLSX.read(buf, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    records = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false }) as Record<string, unknown>[];
  } catch (e: unknown) {
    return NextResponse.json({ error: `could not parse file: ${e instanceof Error ? e.message : 'unknown'}` }, { status: 400 });
  }
  if (records.length === 0) {
    return NextResponse.json({ error: 'file contains no data rows' }, { status: 400 });
  }

  const { rows, errors: parseErrors } = parseRows(records);
  if (parseErrors.length > 0) {
    return NextResponse.json({ error: 'file rejected — fix the rows below and re-upload', parse_errors: parseErrors }, { status: 422 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_budget_import', {
    p_property_id: propertyId,
    p_rows: rows,
    p_locked_by: 'budget-import-ui',
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data?.ok) {
    return NextResponse.json(
      { error: 'file rejected by validation — no rows inserted', parse_errors: (data?.errors ?? []).map((e: { row: number; error: string }) => `row ${e.row}: ${e.error}`) },
      { status: 422 },
    );
  }
  return NextResponse.json({ ok: true, version: data.version, rows_inserted: data.rows_inserted, source_file: file.name });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const propertyId = Number(url.searchParams.get('property_id') ?? NAMKHAN_ID);
  const sb = getSupabaseAdmin();
  const { data: classes, error } = await sb
    .from('v_gl_classes')
    .select('class_id')
    .eq('property_id', propertyId)
    .eq('is_active', true)
    .not('class_id', 'in', '(not_specified,DONNA-DEFAULT)')
    .order('class_id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const year = new Date().getFullYear();
  const rows: BudgetRow[] = [];
  for (const c of classes ?? []) {
    for (let m = 1; m <= 12; m++) {
      rows.push({ year_month: `${year}-${String(m).padStart(2, '0')}`, gl_class: c.class_id, amount_usd: 0 });
    }
  }
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'budget');
  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return new NextResponse(new Uint8Array(out), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="budget_template_${propertyId}_${year}.xlsx"`,
    },
  });
}
