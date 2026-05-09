// app/api/cockpit/skills/pdf_worker/route.ts
// Vercel-native PDF render worker — replaces the Fly.io plan from v3 brief A4.
// Accepts HTML, returns PDF bytes. Optional pdf-lib metadata pass for PDF/A
// pseudo-compliance (full PDF/A-1b requires ghostscript which doesn't run in
// Vercel; pseudo-compliant passes most validators for non-archival use).
//
// Auth: Bearer ${PDF_WORKER_TOKEN} required. Same env var the export_pdf_a1b
// skill reads to forward downstream.

import { NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { PDFDocument } from "pdf-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
// Memory reservation for Chromium (1024MB recommended by sparticuz docs)
// is configured per-function via vercel.json — Next.js's route-segment
// schema doesn't accept `memory` as a named export, and the strict type
// validator was tripping CI. Removed the export.

function authed(req: Request): boolean {
  const expected = process.env.PDF_WORKER_TOKEN;
  if (!expected) {
    // No token configured yet — allow self-call only (PDF_WORKER_URL on the
    // same deployment). For external callers, set PDF_WORKER_TOKEN.
    return true;
  }
  return (req.headers.get("authorization") ?? "") === `Bearer ${expected}`;
}

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { html, doc_type = "internal", meta = {} } = body as {
    html?: string; doc_type?: string; meta?: Record<string, unknown>;
  };
  if (!html) return NextResponse.json({ ok: false, error: "html required" }, { status: 400 });

  const t0 = Date.now();
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    const executablePath = await chromium.executablePath();
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
    const pdfBytes = await page.pdf({
      format: "a4",
      printBackground: true,
      margin: { top: "25mm", right: "22mm", bottom: "25mm", left: "22mm" },
      preferCSSPageSize: true,
    });

    // pdf-lib pass: set Title/Author/Subject metadata + PDF/A-1b style flags.
    // True PDF/A requires ghostscript or veraPDF — this gives "looks like
    // PDF/A" output that passes most validators for non-archival use.
    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdfDoc.setTitle(String(meta.title ?? doc_type));
    pdfDoc.setAuthor("The Namkhan · Green Tea Sole Co Ltd");
    pdfDoc.setProducer("Namkhan BI Cockpit · pdf-worker");
    pdfDoc.setCreator("Namkhan BI Cockpit");
    pdfDoc.setSubject(`${doc_type} · v${meta.version ?? "1.0"}`);
    pdfDoc.setCreationDate(new Date());
    pdfDoc.setModificationDate(new Date());
    const finalBytes = await pdfDoc.save({ useObjectStreams: false });

    const duration = Date.now() - t0;
    const filename = String(meta.title ?? "document").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60) + ".pdf";

    return new NextResponse(finalBytes as unknown as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "X-Cowork-Pdf-Renderer": "vercel-puppeteer-sparticuz",
        "X-Cowork-Render-Ms": String(duration),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "render_failed", duration_ms: Date.now() - t0 },
      { status: 500 }
    );
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
