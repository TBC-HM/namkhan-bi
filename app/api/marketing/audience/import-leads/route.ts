// app/api/marketing/audience/import-leads/route.ts
// PBS 2026-07-21 · Multi-format lead-file ingest.
//
// Accepts:  .csv .xlsx .xls .numbers .pdf .doc .docx .txt
// Pipeline:
//   1. Parse file → raw text or row array (dynamic imports so cold start stays lean).
//   2. Anthropic (Claude Sonnet 4-6 via lib/mail/anthropic) extracts a JSON array
//      of { email, name, company, phone, source_hint } from the messy input.
//   3. Upsert every row into marketing.imported_leads_staging (status='pending')
//      via the SECURITY DEFINER RPC public.fn_import_leads_staging_upsert(text, jsonb).
// Response: { ok, rows_found, rows_upserted, source_file, ai_notes? }.
//
// NOTE: staging is intentionally review-first. PBS promotes rows to
// marketing.newsletter_subscribers in a separate step (future
// /marketing/audience?tab=inbox review UI).

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropic } from '@/lib/mail/anthropic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const HARD_TEXT_CAP = 200_000;   // ~50KB of chat = plenty for Claude Sonnet 4
const HARD_ROWS_CAP = 2000;

// ---------- helpers: format-specific parsers ----------

function parseCsvText(text: string): Record<string, string>[] {
  // Hand-rolled RFC-4180-ish CSV parser (single-file, no papaparse dep).
  // Supports quoted fields, escaped quotes, comma or tab delimiter.
  const lines: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  const delimiter = detectDelimiter(text.slice(0, 4000));
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === delimiter) { row.push(cur); cur = ''; }
      else if (c === '\r') { /* skip, will hit \n */ }
      else if (c === '\n') { row.push(cur); lines.push(row); row = []; cur = ''; }
      else { cur += c; }
    }
  }
  if (cur.length > 0 || row.length > 0) { row.push(cur); lines.push(row); }

  if (lines.length === 0) return [];
  const header = lines[0].map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = lines[r];
    if (cells.every((c) => !c.trim())) continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      obj[header[c] || `col${c}`] = (cells[c] ?? '').trim();
    }
    out.push(obj);
    if (out.length >= HARD_ROWS_CAP) break;
  }
  return out;
}

function detectDelimiter(sample: string): string {
  const commas = (sample.match(/,/g) ?? []).length;
  const tabs   = (sample.match(/\t/g) ?? []).length;
  const semis  = (sample.match(/;/g) ?? []).length;
  if (tabs > commas && tabs > semis) return '\t';
  if (semis > commas) return ';';
  return ',';
}

async function parseXlsx(buf: Buffer): Promise<Record<string, string>[]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buf, { type: 'buffer' });
  const out: Record<string, string>[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false }) as Record<string, unknown>[];
    for (const r of json) {
      const o: Record<string, string> = {};
      for (const k of Object.keys(r)) o[k] = String(r[k] ?? '').trim();
      out.push(o);
      if (out.length >= HARD_ROWS_CAP) break;
    }
    if (out.length >= HARD_ROWS_CAP) break;
  }
  return out;
}

async function parsePdf(buf: Buffer): Promise<string> {
  try {
    const mod: any = await import('pdf-parse');
    const pdfParse = mod?.default ?? mod;
    const res = await pdfParse(buf);
    return String(res?.text ?? '');
  } catch (e) {
    throw new Error('pdf_parse_failed: ' + (e as Error).message);
  }
}

async function parseDocx(buf: Buffer): Promise<string> {
  const mammoth: any = await import('mammoth');
  const res = await mammoth.extractRawText({ buffer: buf });
  return String(res?.value ?? '');
}

async function parseNumbers(buf: Buffer): Promise<string> {
  // .numbers is a zip container; best-effort extraction of every plain-text
  // fragment inside. Claude can pull leads out of the resulting soup.
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buf);
    let text = '';
    const names = Object.keys(zip.files);
    for (const name of names) {
      if (name.endsWith('/')) continue;
      // Numbers stores content in .iwa (protobuf) — no viable pure-JS decoder.
      // We opportunistically grab any XML/text side-cars (metadata, preview HTML).
      if (/\.(xml|txt|html|htm|json)$/i.test(name)) {
        try { text += '\n' + (await zip.files[name].async('string')); }
        catch { /* skip binary */ }
      }
      if (text.length > HARD_TEXT_CAP) break;
    }
    return text;
  } catch (e) {
    throw new Error('numbers_parse_failed: ' + (e as Error).message);
  }
}

// ---------- Anthropic extraction ----------

interface ExtractedLead {
  email: string;
  name?: string;
  company?: string;
  phone?: string;
  source_hint?: string;
  ai_notes?: string;
}

const EXTRACT_SYSTEM =
  'You are a data-extraction agent. Given noisy text or a table of records, ' +
  'produce a JSON array of leads. Each item MUST have an "email" field. ' +
  'Optional fields: "name", "company", "phone", "source_hint" (a short label describing where the lead came from). ' +
  'Include ONLY leads with an obviously-real email address. ' +
  'Reject noreply/postmaster/mailer-daemon and CID-embedded artefacts. ' +
  'Return raw JSON — no markdown fence, no prose.';

async function extractWithClaude(input: string | Record<string, string>[]): Promise<{ leads: ExtractedLead[]; notes: string }> {
  const trimmed =
    typeof input === 'string'
      ? input.slice(0, HARD_TEXT_CAP)
      : JSON.stringify(input.slice(0, HARD_ROWS_CAP)).slice(0, HARD_TEXT_CAP);

  const prompt = `Extract every lead from the following payload. Return ONLY a JSON object of shape { "leads": [...], "notes": "one short sentence" }.

PAYLOAD:
${trimmed}`;

  const raw = await callAnthropic({
    system: EXTRACT_SYSTEM,
    prompt,
    maxTokens: 4096,
  });

  // Strip common wrappers just in case.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  let parsed: unknown = null;
  try { parsed = JSON.parse(cleaned); }
  catch {
    // Fall back to first {...} block in the response.
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch { /* noop */ } }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { leads: [], notes: 'claude_returned_unparseable_response' };
  }
  const p = parsed as { leads?: unknown; notes?: unknown };
  const leadsRaw = Array.isArray(p.leads) ? p.leads : [];
  const notes = typeof p.notes === 'string' ? p.notes : '';
  const leads: ExtractedLead[] = [];
  for (const item of leadsRaw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const email = typeof o.email === 'string' ? o.email.trim().toLowerCase() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    leads.push({
      email,
      name:        strOrUndef(o.name),
      company:     strOrUndef(o.company),
      phone:       strOrUndef(o.phone),
      source_hint: strOrUndef(o.source_hint),
      ai_notes:    strOrUndef(o.ai_notes),
    });
    if (leads.length >= HARD_ROWS_CAP) break;
  }
  return { leads, notes };
}

function strOrUndef(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s.length > 0 ? s : undefined;
}

// ---------- route handler ----------

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ ok: false, error: 'expected_multipart_form' }, { status: 400 }); }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'file_missing' }, { status: 400 });
  }

  const name = file.name || 'upload';
  const lower = name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  // 1. Parse
  let parsedText: string | null = null;
  let parsedRows: Record<string, string>[] | null = null;
  try {
    if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
      parsedText = buf.toString('utf8');
      // Prefer table parse when we obviously have headers.
      const first = parsedText.split(/\r?\n/)[0] ?? '';
      if (first.includes(',') || first.includes('\t') || first.includes(';')) {
        parsedRows = parseCsvText(parsedText);
      }
    } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      parsedRows = await parseXlsx(buf);
    } else if (lower.endsWith('.pdf')) {
      parsedText = await parsePdf(buf);
    } else if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
      parsedText = await parseDocx(buf);
    } else if (lower.endsWith('.numbers')) {
      parsedText = await parseNumbers(buf);
    } else {
      // Fallback: treat as utf-8 text.
      parsedText = buf.toString('utf8');
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'parse_failed', detail: (e as Error).message }, { status: 400 });
  }

  const customName = String(form.get('source_name') ?? '').trim();
  const source_file = customName.length > 0 ? customName : 'upload:' + name;

  // 2. Claude extraction
  let leads: ExtractedLead[] = [];
  let notes = '';
  try {
    const res = await extractWithClaude(parsedRows ?? parsedText ?? '');
    leads = res.leads;
    notes = res.notes;
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'ai_extract_failed', detail: (e as Error).message }, { status: 502 });
  }

  if (leads.length === 0) {
    return NextResponse.json({
      ok: true, rows_found: 0, rows_upserted: 0,
      source_file, ai_notes: notes || 'no_leads_found',
    });
  }

  // 3. Upsert into staging via RPC
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e) { return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 }); }

  const { data, error } = await admin.rpc('fn_import_leads_staging_upsert', {
    p_source_file: source_file,
    p_rows: leads,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });

  const j = data as { ok?: boolean; error?: string; rows_found?: number; rows_upserted?: number };
  if (!j?.ok) return NextResponse.json({ ok: false, error: j?.error ?? 'staging_upsert_failed' }, { status: 400 });

  return NextResponse.json({
    ok: true,
    rows_found: j.rows_found ?? leads.length,
    rows_upserted: j.rows_upserted ?? 0,
    source_file,
    ai_notes: notes,
  });
}