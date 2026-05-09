// app/api/cockpit/skills/export_pdf_a1b/route.ts
// v3 brief A4 — PDF/A-1b export pipeline.
//
// Architecture: this thin handler renders Markdown → HTML with brand CSS,
// then proxies to an external Puppeteer worker for PDF generation. Vercel
// serverless cannot embed Chromium without busting the 50MB bundle limit,
// so the production path is to run a Fly.io worker (PBS provisions when
// ready). Until then, this endpoint:
//   • Validates input
//   • Renders Markdown → branded HTML inline
//   • If PDF_WORKER_URL env var is set, POSTs HTML to it and returns the
//     PDF bytes
//   • Else returns the rendered HTML as text/html so PBS can save-as-PDF
//     via Chrome's "Print to PDF" until the worker lands.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Minimal inline markdown → HTML (no external dep). Handles the patterns we
// actually emit in SOPs: # / ## / ### headers, **bold**, *italic*, `code`,
// fenced ``` blocks, > blockquote, - and 1. lists, GFM-style pipe tables, links.
// For richer rendering swap to remark/marked once we install it.
function escapeHtml(s: string) { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function inlineMd(s: string): string {
  return s
    .replace(/`([^`]+)`/g, (_,c) => `<code>${escapeHtml(c)}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}
function mdToHtml(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i];
    // Fenced code
    if (/^```/.test(ln)) {
      const buf: string[] = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      out.push(`<pre><code>${escapeHtml(buf.join("\n"))}</code></pre>`); i++; continue;
    }
    // Headings
    const h = ln.match(/^(#{1,3})\s+(.+)$/);
    if (h) { out.push(`<h${h[1].length}>${inlineMd(escapeHtml(h[2]))}</h${h[1].length}>`); i++; continue; }
    // Pipe table
    if (/\|/.test(ln) && i + 1 < lines.length && /^[\s|:-]+$/.test(lines[i+1])) {
      const head = ln.split("|").map(c => c.trim()).filter((_,k,a)=>k>0 && k<a.length-1);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /\|/.test(lines[i])) {
        rows.push(lines[i].split("|").map(c => c.trim()).filter((_,k,a)=>k>0 && k<a.length-1));
        i++;
      }
      out.push(`<table><thead><tr>${head.map(c=>`<th>${inlineMd(escapeHtml(c))}</th>`).join("")}</tr></thead><tbody>${
        rows.map(r=>`<tr>${r.map(c=>`<td>${inlineMd(escapeHtml(c))}</td>`).join("")}</tr>`).join("")
      }</tbody></table>`);
      continue;
    }
    // Lists
    if (/^[-*]\s+/.test(ln)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inlineMd(escapeHtml(lines[i].replace(/^[-*]\s+/, "")))}</li>`); i++;
      }
      out.push(`<ul>${items.join("")}</ul>`); continue;
    }
    if (/^\d+\.\s+/.test(ln)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inlineMd(escapeHtml(lines[i].replace(/^\d+\.\s+/, "")))}</li>`); i++;
      }
      out.push(`<ol>${items.join("")}</ol>`); continue;
    }
    // Blockquote
    if (/^>\s+/.test(ln)) { out.push(`<blockquote>${inlineMd(escapeHtml(ln.replace(/^>\s+/,"")))}</blockquote>`); i++; continue; }
    // Empty line
    if (!ln.trim()) { i++; continue; }
    // Paragraph (collect contiguous)
    const buf = [ln]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|>\s|[-*]\s|\d+\.\s|\|)/.test(lines[i])) { buf.push(lines[i]); i++; }
    out.push(`<p>${inlineMd(escapeHtml(buf.join(" ")))}</p>`);
  }
  return out.join("\n");
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");

function authed(req: Request): boolean {
  if (process.env.COCKPIT_AUTH_GATE !== "on") return true;
  return (req.headers.get("authorization") ?? "") === `Bearer ${process.env.COCKPIT_AGENT_TOKEN}`;
}

const BRAND_CSS = `
  @page { size: A4; margin: 25mm 22mm; }
  html { font-family: 'Lora', Georgia, serif; font-size: 11pt; color: #000; line-height: 1.55; }
  body { margin: 0; }
  h1, h2, h3 { font-family: 'Cormorant Garamond', 'Times New Roman', serif; color: #084838; letter-spacing: -0.01em; }
  h1 { font-size: 28pt; margin: 0 0 8pt; border-bottom: 2pt solid #084838; padding-bottom: 6pt; }
  h2 { font-size: 18pt; margin: 18pt 0 6pt; }
  h3 { font-size: 14pt; margin: 14pt 0 4pt; }
  p { margin: 0 0 8pt; }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 10pt; }
  th, td { padding: 4pt 6pt; border-bottom: 0.5pt solid rgba(54,60,61,0.3); text-align: left; }
  th { font-family: 'Cormorant Garamond', serif; color: #084838; text-transform: uppercase; letter-spacing: 0.06em; font-size: 9pt; font-weight: 600; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  code, pre { font-family: 'JetBrains Mono', Menlo, monospace; font-size: 9.5pt; background: rgba(8,72,56,0.04); padding: 1pt 4pt; border-radius: 2pt; }
  .nk-cover { text-align: center; padding: 80pt 0; }
  .nk-cover h1 { border: 0; font-size: 36pt; }
  .nk-meta { font-family: 'JetBrains Mono', monospace; font-size: 9pt; color: rgba(54,60,61,0.7); text-transform: uppercase; letter-spacing: 0.08em; }
  .nk-footer { position: fixed; bottom: 12mm; left: 22mm; right: 22mm; font-size: 8pt; color: rgba(54,60,61,0.6); border-top: 0.5pt solid rgba(54,60,61,0.3); padding-top: 4pt; display: flex; justify-content: space-between; }
`;

function renderHtml(args: { markdown_source: string; doc_type: string; meta: Record<string, unknown> }): string {
  const { markdown_source, doc_type, meta } = args;
  const title = String(meta.title ?? "Untitled");
  const version = String(meta.version ?? "1.0");
  const status = String(meta.status ?? "Draft");
  const date = String(meta.date ?? new Date().toISOString().slice(0, 10));
  const bodyHtml = mdToHtml(markdown_source);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Lora:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
    <style>${BRAND_CSS}</style></head>
    <body>
      <section class="nk-cover">
        <div class="nk-meta">${doc_type.toUpperCase()} · ${status.toUpperCase()} · v${version}</div>
        <h1>${title}</h1>
        <div class="nk-meta">${date} · The Namkhan</div>
      </section>
      <article>${bodyHtml}</article>
      <div class="nk-footer">
        <span>Green Tea Sole Co Ltd · trading as The Namkhan · TIN 180291201900 · License 007298</span>
        <span>v${version} · ${date}</span>
      </div>
    </body></html>`;
}

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { markdown_source, doc_type = "internal", meta = {} } = body as {
    markdown_source?: string; doc_type?: string; meta?: Record<string, unknown>;
  };
  if (!markdown_source) return NextResponse.json({ ok: false, error: "markdown_source required" }, { status: 400 });

  const html = renderHtml({ markdown_source, doc_type, meta });
  const workerUrl = process.env.PDF_WORKER_URL;

  // Path 1 — external worker provisioned (Fly.io / Render): POST html, get PDF/A bytes back.
  if (workerUrl) {
    try {
      const r = await fetch(workerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.PDF_WORKER_TOKEN ?? ""}` },
        body: JSON.stringify({ html, doc_type, meta }),
      });
      if (!r.ok) return NextResponse.json({ ok: false, error: `pdf_worker ${r.status}: ${(await r.text()).slice(0, 200)}` }, { status: 502 });
      const buf = await r.arrayBuffer();
      await supabase.from("cockpit_audit_log").insert({
        agent: "skill-pdf-export", action: "pdf_a1b_rendered_worker", target: doc_type, success: true,
        metadata: { bytes: buf.byteLength, doc_type, title: meta.title }, reasoning: `PDF/A-1b rendered via worker (${buf.byteLength} bytes).`,
      });
      return new NextResponse(buf, { headers: { "Content-Type": "application/pdf" } });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "worker_error" }, { status: 502 });
    }
  }

  // Path 2 — no worker: return rendered HTML with print-ready CSS so PBS can Save-as-PDF via Chrome.
  // This path is INTENTIONALLY non-blocking: HTML output IS a valid deliverable. The agent that
  // called this can ship the HTML to its own ticket, render to PDF locally, or proceed without PDF.
  const filename = String(meta.title ?? "document").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
  await supabase.from("cockpit_audit_log").insert({
    agent: "skill-pdf-export", action: "pdf_html_rendered", target: doc_type, success: true,
    metadata: { doc_type, title: meta.title, html_len: html.length, worker_configured: false, output: "html_with_print_css" },
    reasoning: "Rendered branded HTML with print-CSS (A4, brand colours, headers, footer). Open in Chrome → Cmd+P → Save as PDF. Equivalent visual output to PDF/A worker for non-archival use.",
  });
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${filename}.html"`,
      "X-Cowork-Output-Format": "html-print-ready",
      "X-Cowork-Pdf-Worker": "not_configured",
    },
  });
}
