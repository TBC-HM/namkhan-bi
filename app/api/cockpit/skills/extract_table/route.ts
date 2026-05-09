// app/api/cockpit/skills/extract_table/route.ts
// PBS request 2026-05-07 — convert PDF / photo of a table → structured rows.
//
// Flow:
//   1. Accept { storage_url, format?: 'json'|'csv'|'xlsx', headers_hint?: string[] }
//   2. Download bytes from Supabase Storage (must be cockpit-uploads/* public URL).
//   3. Send to Claude vision with extraction prompt.
//   4. Parse JSON, return rows + optionally CSV/XLSX.
//
// Cost: ~$0.02-0.05 per call (Claude Sonnet vision).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STORAGE_PREFIX = "https://kpenyneooigsyuuomgct.supabase.co/storage/v1/object/public/";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");

function authed(req: Request): boolean {
  if (process.env.COCKPIT_AUTH_GATE !== "on") return true;
  return (req.headers.get("authorization") ?? "") === `Bearer ${process.env.COCKPIT_AGENT_TOKEN}`;
}

function detectMime(url: string, headerType: string | null): { mime: string; isPdf: boolean; isImage: boolean } {
  const u = url.toLowerCase();
  const ct = (headerType ?? "").toLowerCase();
  const isPdf = u.endsWith(".pdf") || ct.includes("pdf");
  const isImage = u.match(/\.(png|jpe?g|webp|gif)$/) !== null || ct.startsWith("image/");
  let mime = ct.split(";")[0] || "application/octet-stream";
  if (isPdf) mime = "application/pdf";
  else if (isImage && !mime.startsWith("image/")) {
    if (u.endsWith(".png")) mime = "image/png";
    else if (u.match(/\.jpe?g$/)) mime = "image/jpeg";
    else if (u.endsWith(".webp")) mime = "image/webp";
    else if (u.endsWith(".gif")) mime = "image/gif";
  }
  return { mime, isPdf, isImage };
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const out: string[] = [headers.map(escape).join(",")];
  for (const r of rows) out.push(headers.map((h) => escape(r[h])).join(","));
  return out.join("\n");
}

const EXTRACTION_PROMPT = `Extract every table you find in this document/image. Return a single JSON object with this exact shape:

{
  "tables": [
    {
      "title": "<short descriptive title or null>",
      "headers": ["col1", "col2", ...],
      "rows": [
        {"col1": "value", "col2": "value", ...},
        ...
      ],
      "notes": "<any caveats — merged cells, unclear values, etc.>"
    }
  ]
}

Rules:
- Use the actual column header text from the document, not invented names.
- Preserve numbers as numbers when possible (no thousands separators, decimal point).
- Preserve dates as ISO YYYY-MM-DD when the format is unambiguous.
- Empty cells: use null, NOT empty string.
- If multiple tables, list them all.
- Return ONLY the JSON object, no prose, no code fences.`;

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY missing" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const { storage_url, format = "json", headers_hint } = body as {
    storage_url?: string; format?: "json" | "csv" | "xlsx"; headers_hint?: string[];
  };
  if (!storage_url) return NextResponse.json({ ok: false, error: "storage_url required" }, { status: 400 });
  if (!storage_url.startsWith(STORAGE_PREFIX)) {
    return NextResponse.json({ ok: false, error: `storage_url must start with ${STORAGE_PREFIX}` }, { status: 400 });
  }

  const t0 = Date.now();

  // Fetch the file
  let bytes: ArrayBuffer; let mimeInfo;
  try {
    const r = await fetch(storage_url, { cache: "no-store" });
    if (!r.ok) return NextResponse.json({ ok: false, error: `fetch ${r.status}` }, { status: 400 });
    bytes = await r.arrayBuffer();
    mimeInfo = detectMime(storage_url, r.headers.get("content-type"));
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fetch_failed" }, { status: 502 });
  }
  if (!mimeInfo.isPdf && !mimeInfo.isImage) {
    return NextResponse.json({ ok: false, error: `unsupported mime: ${mimeInfo.mime}. Use PDF or PNG/JPG/WEBP/GIF image.` }, { status: 400 });
  }
  if (bytes.byteLength > 30 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: `file too large: ${bytes.byteLength} bytes (max 30MB)` }, { status: 413 });
  }

  // Build Anthropic message — vision supports images directly; PDFs use document content blocks.
  const b64 = Buffer.from(bytes).toString("base64");
  const userContent: Array<Record<string, unknown>> = mimeInfo.isPdf
    ? [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
        { type: "text", text: EXTRACTION_PROMPT + (headers_hint && headers_hint.length ? `\n\nHint — expected headers: ${headers_hint.join(", ")}` : "") },
      ]
    : [
        { type: "image", source: { type: "base64", media_type: mimeInfo.mime, data: b64 } },
        { type: "text", text: EXTRACTION_PROMPT + (headers_hint && headers_hint.length ? `\n\nHint — expected headers: ${headers_hint.join(", ")}` : "") },
      ];

  let parsed: { tables: Array<{ title?: string | null; headers: string[]; rows: Record<string, unknown>[]; notes?: string }> } = { tables: [] };
  let inputTokens = 0; let outputTokens = 0; let modelText = "";
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        messages: [{ role: "user", content: userContent }],
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json({ ok: false, error: `anthropic ${resp.status}: ${errText.slice(0, 300)}` }, { status: 502 });
    }
    const j = await resp.json();
    inputTokens = j?.usage?.input_tokens ?? 0;
    outputTokens = j?.usage?.output_tokens ?? 0;
    modelText = (j?.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text?: string }) => b.text ?? "").join("");
    let cleaned = modelText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    parsed = JSON.parse(cleaned);
  } catch (e) {
    await supabase.from("cockpit_audit_log").insert({
      agent: "skill-extract-table", action: "extract_table_failed", target: storage_url, success: false,
      metadata: { error: e instanceof Error ? e.message : "parse_failed", model_text_preview: modelText.slice(0, 500) },
      reasoning: "Vision extraction failed or model returned non-JSON.",
    });
    return NextResponse.json({ ok: false, error: "vision_parse_failed", model_text_preview: modelText.slice(0, 500) }, { status: 502 });
  }

  const tables = parsed.tables ?? [];
  const totalRows = tables.reduce((sum, t) => sum + (t.rows?.length ?? 0), 0);
  const milliCost = Math.round((inputTokens * 3 + outputTokens * 15) / 1000);

  await supabase.from("cockpit_audit_log").insert({
    agent: "skill-extract-table", action: "extract_table", target: storage_url, success: true,
    duration_ms: Date.now() - t0,
    input_tokens: inputTokens, output_tokens: outputTokens, cost_usd_milli: milliCost,
    metadata: { mime: mimeInfo.mime, table_count: tables.length, total_rows: totalRows, format },
    reasoning: `Extracted ${tables.length} table(s), ${totalRows} rows total.`,
  });

  // Format selection
  if (format === "csv") {
    if (tables.length === 0) return NextResponse.json({ ok: true, tables: [], note: "no tables found" });
    const csv = tables.map((t) => `# ${t.title ?? "table"}\n${rowsToCsv(t.rows ?? [])}\n`).join("\n");
    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `inline; filename="extracted-tables.csv"` },
    });
  }
  // xlsx requested — use existing xlsx dep (already in package.json) for a real workbook
  if (format === "xlsx") {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      tables.forEach((t, i) => {
        const ws = XLSX.utils.json_to_sheet(t.rows ?? [], { header: t.headers });
        XLSX.utils.book_append_sheet(wb, ws, (t.title ?? `table_${i + 1}`).slice(0, 28));
      });
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
      // Use base64 string in body — NextResponse Edge type accepts it.
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      return new NextResponse(ab, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="extracted-tables.xlsx"`,
        },
      });
    } catch (e) {
      return NextResponse.json({ ok: false, error: `xlsx_build_failed: ${e instanceof Error ? e.message : ""}`, tables }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    tables,
    stats: { table_count: tables.length, total_rows: totalRows, mime: mimeInfo.mime, duration_ms: Date.now() - t0, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd_milli: milliCost },
  });
}
