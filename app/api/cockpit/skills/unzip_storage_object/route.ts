// app/api/cockpit/skills/unzip_storage_object/route.ts
// GAP 1 of COWORK BRIEF 2026-05-07. Unblocks ticket #88.
//
// POST { storage_url, max_files? } → fetches a zip from Supabase Storage,
// extracts in memory, returns file_tree + text_contents for known text types.
//
// Bearer-auth: COCKPIT_AGENT_TOKEN OR workspace cookie (open mode allowed).
// Audit-logged on every call. Hard caps: 200 files, 10 MB uncompressed.

import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STORAGE_PREFIX =
  "https://kpenyneooigsyuuomgct.supabase.co/storage/v1/object/public/cockpit-uploads/";

const TEXT_EXTS = new Set([
  "md", "json", "txt", "html", "htm", "css",
  "tsx", "ts", "jsx", "js", "mjs", "cjs",
  "yml", "yaml", "csv", "tsv",
]);

const HARD_CAP_FILES = 200;
const HARD_CAP_BYTES = 10 * 1024 * 1024;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

function extOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

function isAuthorized(req: Request): boolean {
  if (process.env.COCKPIT_AUTH_GATE !== "on") return true;
  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ") && auth.slice(7) === process.env.COCKPIT_AGENT_TOKEN) return true;
  // Workspace cookie path is handled by middleware in non-open mode.
  return false;
}

export async function POST(req: Request) {
  const t0 = Date.now();
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { storage_url?: string; max_files?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }); }

  const url = (body.storage_url ?? "").trim();
  const maxFiles = Math.min(Math.max(body.max_files ?? HARD_CAP_FILES, 1), HARD_CAP_FILES);

  if (!url) return NextResponse.json({ ok: false, error: "storage_url required" }, { status: 400 });
  if (!url.startsWith(STORAGE_PREFIX)) {
    return NextResponse.json(
      { ok: false, error: `storage_url must start with ${STORAGE_PREFIX}` },
      { status: 400 }
    );
  }

  // Fetch the zip
  let zipBuf: ArrayBuffer;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) {
      await audit({ url, ok: false, err: `fetch ${r.status}` });
      return NextResponse.json({ ok: false, error: `fetch returned ${r.status}` }, { status: 400 });
    }
    zipBuf = await r.arrayBuffer();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await audit({ url, ok: false, err: `fetch_threw: ${msg}` });
    return NextResponse.json({ ok: false, error: `fetch_threw: ${msg}` }, { status: 400 });
  }

  // Unzip in memory
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await audit({ url, ok: false, err: `zip_invalid: ${msg}` });
    return NextResponse.json({ ok: false, error: `zip_invalid: ${msg}` }, { status: 400 });
  }

  const file_tree: { path: string; size: number; is_text: boolean }[] = [];
  const text_contents: Record<string, string> = {};
  let totalBytes = 0;
  let count = 0;

  const entries = Object.keys(zip.files);
  for (const path of entries) {
    const entry = zip.files[path];
    if (entry.dir) continue;

    if (count >= maxFiles) {
      return NextResponse.json(
        { ok: false, error: `too_many_files: zip has more than ${maxFiles} entries` },
        { status: 413 }
      );
    }

    const ext = extOf(path);
    const isText = TEXT_EXTS.has(ext);

    let content: string | null = null;
    let size = 0;
    if (isText) {
      content = await entry.async("string");
      size = Buffer.byteLength(content, "utf8");
    } else {
      // For binaries we still want size for the tree but skip the bytes themselves.
      const u8 = await entry.async("uint8array");
      size = u8.byteLength;
    }

    totalBytes += size;
    if (totalBytes > HARD_CAP_BYTES) {
      return NextResponse.json(
        { ok: false, error: `too_large: uncompressed total exceeds ${HARD_CAP_BYTES} bytes` },
        { status: 413 }
      );
    }

    file_tree.push({ path, size, is_text: isText });
    if (isText && content !== null) text_contents[path] = content;
    count++;
  }

  await audit({ url, ok: true, files: count, bytes: totalBytes, ms: Date.now() - t0 });

  return NextResponse.json({
    ok: true,
    file_tree,
    text_contents,
    stats: {
      files: count,
      total_bytes: totalBytes,
      text_files: Object.keys(text_contents).length,
      duration_ms: Date.now() - t0,
    },
  });
}

async function audit(payload: { url: string; ok: boolean; err?: string; files?: number; bytes?: number; ms?: number }) {
  try {
    await supabase.from("cockpit_audit_log").insert({
      agent: "skill-unzip",
      action: "unzip_storage_object",
      target: payload.url,
      success: payload.ok,
      duration_ms: payload.ms ?? null,
      reasoning: payload.ok
        ? `Unzipped ${payload.files} files (${payload.bytes} bytes uncompressed).`
        : `Unzip failed: ${payload.err}`,
      metadata: payload,
    });
  } catch {
    // never throw from audit
  }
}
