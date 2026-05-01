// POST /api/operations/staff/payslip
// Bulk monthly payslip / HR-doc uploader.
//
// Accepts a multipart batch of PDFs. For each file:
//   1. Parse filename → emp_id + period_month + hr_doc_kind
//   2. Resolve staff_id from ops.v_staff_register
//   3. Upload PDF to documents-confidential/hr/<staff_id>/<period>/<kind>/<filename>
//   4. Insert docs.documents (sensitivity=confidential, valid_from=period_month, file_size, sha256)
//   5. Insert docs.hr_docs (staff_user_id, hr_doc_kind)
//
// Filename pattern (preferred):  TNK_<num>_<YYYY-MM>_<kind>.pdf
// Form fields override pattern when provided:
//   period (YYYY-MM-01)
//   hr_doc_kind  one of: payslip, contract, id_copy, tax_form, work_permit, other
//   staff_id     uuid (skip emp_id parse)

import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB / file
const VALID_KINDS = new Set(['payslip', 'contract', 'id_copy', 'tax_form', 'work_permit', 'other']);

function safeName(name: string): string {
  return name.normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(0, 200);
}

interface ParsedFilename {
  emp_id: string | null;
  period: string | null;        // 'YYYY-MM-01'
  hr_doc_kind: string | null;
}

// "TNK_1001_2026-04_payslip.pdf" → { emp_id: 'TNK 1001', period: '2026-04-01', hr_doc_kind: 'payslip' }
function parseFilename(name: string): ParsedFilename {
  const stem = name.replace(/\.[^.]+$/, '');
  // Match: PREFIX_NUMBER_YYYY-MM_KIND  — emp_id has space (e.g. "TNK 1001")
  const m = stem.match(/^([A-Za-z]+)[_ ]?(\d+)[_ ]?(\d{4}-\d{2})[_ ]?([a-z_]+)$/i);
  if (!m) return { emp_id: null, period: null, hr_doc_kind: null };
  return {
    emp_id: `${m[1].toUpperCase()} ${m[2]}`,
    period: `${m[3]}-01`,
    hr_doc_kind: m[4].toLowerCase(),
  };
}

interface FileResult {
  filename: string;
  ok: boolean;
  staff_id?: string;
  emp_id?: string;
  period?: string;
  hr_doc_kind?: string;
  doc_id?: string;
  storage_path?: string;
  error?: string;
}

export async function POST(req: Request) {
  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 });
  }

  const raw = [...form.getAll('file'), ...form.getAll('files')];
  const files: File[] = raw.filter((x): x is File => x instanceof File && x.size > 0);
  if (files.length === 0) {
    return NextResponse.json({ error: 'No files in upload' }, { status: 400 });
  }

  // Form-level overrides (apply to ALL files when provided)
  const formPeriodRaw = (form.get('period') as string | null)?.trim() || null;       // 'YYYY-MM' or 'YYYY-MM-01'
  const formKind      = ((form.get('hr_doc_kind') as string | null)?.trim() || null)?.toLowerCase() ?? null;
  const formStaffId   = (form.get('staff_id') as string | null)?.trim() || null;

  // Normalize formPeriod to date string
  const formPeriod = formPeriodRaw
    ? (formPeriodRaw.length === 7 ? `${formPeriodRaw}-01` : formPeriodRaw)
    : null;

  // Cache emp_id → staff_id lookups
  const empCache = new Map<string, string>();
  async function lookupByEmpId(emp: string): Promise<string | null> {
    if (empCache.has(emp)) return empCache.get(emp)!;
    const { data } = await admin
      .schema('ops' as any)
      .from('staff_employment')
      .select('id')
      .eq('emp_id', emp)
      .eq('is_active', true)
      .maybeSingle();
    const id = (data as any)?.id ?? null;
    if (id) empCache.set(emp, id);
    return id;
  }

  const results: FileResult[] = [];

  for (const file of files) {
    const r: FileResult = { filename: file.name, ok: false };
    try {
      if (file.size > MAX_BYTES) {
        r.error = `Too large: ${(file.size/1e6).toFixed(1)}MB > 10MB`;
        results.push(r);
        continue;
      }
      if (file.type !== 'application/pdf') {
        r.error = `Unsupported mime: ${file.type} (PDF only)`;
        results.push(r);
        continue;
      }

      const parsed = parseFilename(file.name);
      const period = formPeriod ?? parsed.period;
      const hr_doc_kind = formKind ?? parsed.hr_doc_kind ?? 'payslip';
      let staff_id = formStaffId;

      if (!period) { r.error = 'Period missing (filename or form)'; results.push(r); continue; }
      if (!VALID_KINDS.has(hr_doc_kind)) { r.error = `Invalid hr_doc_kind: ${hr_doc_kind}`; results.push(r); continue; }
      r.period = period;
      r.hr_doc_kind = hr_doc_kind;

      if (!staff_id && parsed.emp_id) {
        staff_id = await lookupByEmpId(parsed.emp_id);
        r.emp_id = parsed.emp_id;
      }
      if (!staff_id) {
        r.error = parsed.emp_id ? `No active staff with emp_id ${parsed.emp_id}` : 'staff_id missing — filename did not match TNK_<id>_<YYYY-MM>_<kind>.pdf';
        results.push(r);
        continue;
      }
      r.staff_id = staff_id;

      const buffer = Buffer.from(await file.arrayBuffer());
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
      const periodTag = period.slice(0, 7); // YYYY-MM
      const path = `hr/${staff_id}/${periodTag}/${hr_doc_kind}/${safeName(file.name)}`;
      r.storage_path = path;

      // Upload (overwrite if same path — replace previous payslip for the period)
      const { error: upErr } = await admin.storage
        .from('documents-confidential')
        .upload(path, buffer, { contentType: 'application/pdf', upsert: true });
      if (upErr) {
        r.error = `Storage: ${upErr.message}`;
        results.push(r);
        continue;
      }

      // docs.documents row (NOT NULL: doc_type, title)
      const periodYear = Number(period.slice(0, 4));
      const title = `${hr_doc_kind} · ${r.emp_id ?? staff_id.slice(0,8)} · ${periodTag}`;
      const { data: docIns, error: docErr } = await admin
        .schema('docs' as any)
        .from('documents')
        .insert({
          doc_type: 'hr',
          doc_subtype: hr_doc_kind,
          title,
          storage_bucket: 'documents-confidential',
          storage_path: path,
          mime: 'application/pdf',
          file_size_bytes: file.size,
          file_name: file.name,
          file_checksum: sha256,
          status: 'active',
          sensitivity: 'confidential',
          valid_from: period,
          period_year: periodYear,
        })
        .select('doc_id')
        .maybeSingle();

      if (docErr || !docIns) {
        r.error = `docs.documents insert: ${docErr?.message ?? 'no row'}`;
        results.push(r);
        continue;
      }
      r.doc_id = (docIns as any).doc_id;

      // docs.hr_docs row
      const { error: hrErr } = await admin
        .schema('docs' as any)
        .from('hr_docs')
        .insert({
          doc_id: r.doc_id,
          staff_user_id: staff_id,
          hr_doc_kind,
          is_sensitive: true,
        });
      if (hrErr) {
        r.error = `docs.hr_docs insert: ${hrErr.message}`;
        results.push(r);
        continue;
      }

      r.ok = true;
      results.push(r);
    } catch (e: any) {
      r.error = e?.message ?? 'Unknown error';
      results.push(r);
    }
  }

  const failed = results.filter(r => !r.ok).length;
  return NextResponse.json({
    ok: failed === 0,
    uploaded: results.length - failed,
    failed,
    results,
  });
}
