// POST /api/sales/dmc/contract
// Create a new DMC / Tour Operator / OTA contract row in governance.dmc_contracts.
// Optionally accepts a PDF that gets stored in documents-confidential bucket
// at path: dmc/<contract_id>/<safe_filename>.pdf
//
// Accepts multipart/form-data so the client can ship JSON fields + a PDF in one POST.
// Required: partner_short_name. Everything else optional.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB hard cap on contract PDFs

function safeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 200);
}

function nullable(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function nullableNum(v: FormDataEntryValue | null): number | null {
  const s = nullable(v);
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function nullableBool(v: FormDataEntryValue | null): boolean | null {
  const s = nullable(v);
  if (s == null) return null;
  return /^(1|true|yes|on)$/i.test(s);
}

const VALID_PARTNER_TYPE = new Set(['DMC', 'TO', 'OTA']);
const VALID_STATUS = new Set(['active', 'expiring', 'expired', 'draft', 'suspended']);

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

  // Required
  const partnerShort = nullable(form.get('partner_short_name'));
  if (!partnerShort) {
    return NextResponse.json({ error: 'partner_short_name is required' }, { status: 400 });
  }

  // Validate enums
  let partnerType = nullable(form.get('partner_type')) ?? 'DMC';
  partnerType = partnerType.toUpperCase();
  if (!VALID_PARTNER_TYPE.has(partnerType)) {
    return NextResponse.json({ error: `partner_type must be one of: ${[...VALID_PARTNER_TYPE].join(', ')}` }, { status: 400 });
  }

  let status = nullable(form.get('status')) ?? 'draft';
  status = status.toLowerCase();
  if (!VALID_STATUS.has(status)) {
    return NextResponse.json({ error: `status must be one of: ${[...VALID_STATUS].join(', ')}` }, { status: 400 });
  }

  const row: Record<string, any> = {
    partner_short_name:   partnerShort,
    partner_legal_name:   nullable(form.get('partner_legal_name')),
    partner_type:         partnerType,
    country:              nullable(form.get('country')),
    country_flag:         nullable(form.get('country_flag')),
    vat_number:           nullable(form.get('vat_number')),
    address:              nullable(form.get('address')),
    contact_name:         nullable(form.get('contact_name')),
    contact_role:         nullable(form.get('contact_role')),
    contact_email:        nullable(form.get('contact_email')),
    contact_phone:        nullable(form.get('contact_phone')),
    effective_date:       nullable(form.get('effective_date')),
    expiry_date:          nullable(form.get('expiry_date')),
    signed_date:          nullable(form.get('signed_date')),
    status,
    auto_renew:           nullableBool(form.get('auto_renew')) ?? false,
    pricing_model:        nullable(form.get('pricing_model')) ?? 'standard',
    group_surcharge_pct:  nullableNum(form.get('group_surcharge_pct')),
    group_threshold:      nullableNum(form.get('group_threshold')),
    extra_bed_usd:        nullableNum(form.get('extra_bed_usd')),
    notes:                nullable(form.get('notes')),
  };

  // Insert contract row first to obtain contract_id
  const { data: insRow, error: insErr } = await admin
    .schema('governance')
    .from('dmc_contracts')
    .insert(row)
    .select('contract_id')
    .maybeSingle();

  if (insErr || !insRow) {
    return NextResponse.json({ error: insErr?.message ?? 'Insert failed' }, { status: 500 });
  }

  const contractId = insRow.contract_id as string;
  let pdfPath: string | null = null;

  // Optional PDF
  const pdf = form.get('pdf') as File | null;
  if (pdf && pdf instanceof File && pdf.size > 0) {
    if (pdf.type !== 'application/pdf') {
      // Don't fail — contract is created. Just skip the upload.
      return NextResponse.json({
        ok: true,
        contract_id: contractId,
        pdf_path: null,
        warning: `PDF skipped — mime was ${pdf.type}, expected application/pdf`,
      });
    }
    if (pdf.size > MAX_PDF_BYTES) {
      return NextResponse.json({
        ok: true,
        contract_id: contractId,
        pdf_path: null,
        warning: `PDF skipped — ${(pdf.size/1e6).toFixed(1)}MB exceeds 25MB limit`,
      });
    }

    const path = `dmc/${contractId}/${safeName(pdf.name)}`;
    const buffer = Buffer.from(await pdf.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from('documents-confidential')
      .upload(path, buffer, { contentType: 'application/pdf', upsert: true });

    if (upErr) {
      return NextResponse.json({
        ok: true,
        contract_id: contractId,
        pdf_path: null,
        warning: `PDF upload failed: ${upErr.message}`,
      });
    }

    // Persist storage path on the contract row
    await admin
      .schema('governance')
      .from('dmc_contracts')
      .update({ pdf_storage_path: path })
      .eq('contract_id', contractId);

    pdfPath = path;
  }

  return NextResponse.json({
    ok: true,
    contract_id: contractId,
    pdf_path: pdfPath,
  });
}
