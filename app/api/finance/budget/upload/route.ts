// POST /api/finance/budget/upload
// Bulk-upsert annual budget rows. Accepts CSV (multipart/form-data) OR
// JSON body { rows: [...] }. Calls gl.upsert_budget_rows RPC.
//
// CSV columns required (header row): period_yyyymm, usali_subcategory, amount_usd
// Optional: usali_department
// Period accepted formats: 2026-04 OR 2026-4 OR 04 (assumes current year)

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_SUBCATS = new Set([
  'Revenue', 'Cost of Sales', 'Payroll & Related', 'Other Operating Expenses',
  'A&G', 'Sales & Marketing', 'POM', 'Utilities', 'Mgmt Fees',
  'Depreciation', 'Interest', 'Income Tax', 'FX Gain/Loss', 'Non-Operating',
]);

interface BudgetRow {
  period_yyyymm: string;
  usali_subcategory: string;
  usali_department?: string | null;
  amount_usd: number;
}

function parseCsv(text: string): { rows: BudgetRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows: BudgetRow[] = [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { rows, errors: ['empty file'] };

  const header = lines[0].split(',').map(c => c.trim().toLowerCase());
  const idxPeriod = header.indexOf('period_yyyymm');
  const idxSubcat = header.indexOf('usali_subcategory');
  const idxAmount = header.indexOf('amount_usd');
  const idxDept = header.indexOf('usali_department');
  if (idxPeriod < 0 || idxSubcat < 0 || idxAmount < 0) {
    errors.push('CSV header must include: period_yyyymm, usali_subcategory, amount_usd');
    return { rows, errors };
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length === 0 || cols.every(c => !c)) continue;
    let period = cols[idxPeriod];
    if (/^\d{4}-\d{1,2}$/.test(period)) {
      const [y, m] = period.split('-');
      period = `${y}-${m.padStart(2, '0')}`;
    } else if (/^\d{1,2}$/.test(period)) {
      period = `2026-${period.padStart(2, '0')}`;
    } else {
      errors.push(`row ${i + 1}: invalid period_yyyymm "${period}"`);
      continue;
    }
    const subcat = cols[idxSubcat];
    if (!VALID_SUBCATS.has(subcat)) {
      errors.push(`row ${i + 1}: invalid usali_subcategory "${subcat}". Allowed: ${Array.from(VALID_SUBCATS).join(', ')}`);
      continue;
    }
    const raw = cols[idxAmount].replace(/[$,\s]/g, '');
    const amt = Number(raw);
    if (!Number.isFinite(amt)) {
      errors.push(`row ${i + 1}: invalid amount_usd "${cols[idxAmount]}"`);
      continue;
    }
    const dept = idxDept >= 0 ? (cols[idxDept] || '') : '';
    rows.push({
      period_yyyymm: period,
      usali_subcategory: subcat,
      usali_department: dept || null,
      amount_usd: amt,
    });
  }
  return { rows, errors };
}

export async function POST(req: Request) {
  let rows: BudgetRow[] = [];
  let parseErrors: string[] = [];
  let sourceFile: string | null = null;

  const ctype = req.headers.get('content-type') || '';
  try {
    if (ctype.includes('multipart/form-data')) {
      const fd = await req.formData();
      const file = fd.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'file field missing' }, { status: 400 });
      }
      sourceFile = file.name;
      const text = await file.text();
      const parsed = parseCsv(text);
      rows = parsed.rows;
      parseErrors = parsed.errors;
    } else {
      const body = await req.json().catch(() => ({}));
      if (!Array.isArray(body?.rows)) {
        return NextResponse.json({ error: 'expected { rows: [...] } or multipart CSV' }, { status: 400 });
      }
      rows = body.rows.map((r: any) => ({
        period_yyyymm: String(r.period_yyyymm || ''),
        usali_subcategory: String(r.usali_subcategory || ''),
        usali_department: r.usali_department ?? null,
        amount_usd: Number(r.amount_usd) || 0,
      }));
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'parse failed' }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'no valid rows', parse_errors: parseErrors }, { status: 400 });
  }

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'admin init failed' }, { status: 500 });
  }

  const { data, error } = await admin.schema('gl').rpc('upsert_budget_rows', {
    p_rows: rows,
    p_uploaded_by: 'accountant',
    p_source_file: sourceFile,
  });
  if (error) {
    return NextResponse.json({ error: error.message, details: error.details, parse_errors: parseErrors }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    rows_upserted: data ?? rows.length,
    parse_errors: parseErrors,
    source_file: sourceFile,
  });
}

// GET returns a CSV template the user can download + edit
export async function GET() {
  const subcats = Array.from(VALID_SUBCATS);
  const months = ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12'];
  const lines: string[] = ['period_yyyymm,usali_subcategory,usali_department,amount_usd'];
  for (const m of months) {
    for (const s of subcats) {
      lines.push(`${m},${s},,0`);
    }
  }
  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="namkhan-budget-2026-template.csv"',
    },
  });
}
