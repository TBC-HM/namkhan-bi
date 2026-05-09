// app/api/cockpit/upload/route.ts
// POST — upload a file to Supabase Storage bucket `cockpit-uploads`.
// Returns { ok, path, public_url, name, size, mime }.
//
// Used by the cockpit Chat tab to attach files (md / zip / csv / xlsx /
// docs / png / pdf / images) to a ticket. The chat send call includes
// the path in `attachments[]`; the ticket parsed_summary appends the URL.
//
// Auth: same as other /api/cockpit/* routes (currently middleware OFF
// per Phase 0 decision; restore when SSO ships in workspace_users phase).
//
// Author: PBS via Claude (Cowork) · 2026-05-06.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

const BUCKET = "cockpit-uploads";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

// Allowed mime prefixes / extensions. Defensive: reject executables.
const ALLOWED_EXTS = new Set([
  "md", "txt", "csv", "tsv", "json", "yaml", "yml",
  "pdf",
  "doc", "docx", "rtf", "odt",
  "xls", "xlsx", "ods",
  "ppt", "pptx", "odp",
  "png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "heic", "heif",
  "zip", "tar", "gz", "tgz",
  "mp4", "mov", "webm", "m4a", "mp3", "wav",
]);

const FORBIDDEN_EXTS = new Set([
  "exe", "dll", "bat", "cmd", "sh", "ps1", "msi", "app", "dmg", "pkg",
  "jar", "scr", "vbs", "wsf",
]);

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find((b) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
    });
  }
}

export async function POST(req: Request) {
  noStore();

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing 'file' field" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "empty file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `file too large (${file.size} bytes; max ${MAX_BYTES})` },
      { status: 413 }
    );
  }

  const name = file.name || "upload";
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (FORBIDDEN_EXTS.has(ext)) {
    return NextResponse.json({ error: `forbidden file type: .${ext}` }, { status: 400 });
  }
  if (!ALLOWED_EXTS.has(ext)) {
    return NextResponse.json(
      { error: `unsupported extension: .${ext}. Allowed: ${[...ALLOWED_EXTS].sort().join(", ")}` },
      { status: 400 }
    );
  }

  await ensureBucket();

  // Path: cockpit-uploads/<yyyy-mm>/<sha256(name+ts)>-<sanitized-name>
  const ts = Date.now();
  const safeName = name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  const hash = crypto
    .createHash("sha256")
    .update(`${name}|${ts}|${file.size}`)
    .digest("hex")
    .slice(0, 12);
  const yyyymm = new Date().toISOString().slice(0, 7);
  const path = `${yyyymm}/${hash}-${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (upErr) {
    return NextResponse.json(
      { error: `upload failed: ${upErr.message}` },
      { status: 500 }
    );
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

  // Audit
  await supabase.from("cockpit_audit_log").insert({
    agent: "cockpit-chat-upload",
    action: "file_uploaded",
    target: path,
    success: true,
    metadata: {
      name,
      size: file.size,
      mime: file.type,
      ext,
      bucket: BUCKET,
      public_url: pub?.publicUrl ?? null,
    },
    reasoning: "User attached a file to chat from /cockpit Chat tab.",
  });

  return NextResponse.json({
    ok: true,
    bucket: BUCKET,
    path,
    public_url: pub?.publicUrl ?? null,
    name,
    size: file.size,
    mime: file.type,
    ext,
  });
}
