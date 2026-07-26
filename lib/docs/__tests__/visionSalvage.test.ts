// @ts-nocheck — no test runner deps installed in this repo; runtime test only.
/**
 * Unit tests for the Vision-OCR salvage parser (D1) and the PDF split planner
 * (D2) — autospec-brain_module-20260725 / A2.
 *
 * NOTE: the repo has no test runner in package.json (vitest absent; adding one
 * requires PBS approval per the Dependency Law). These tests are plain
 * assert-based and were executed at build time via an esbuild+node harness.
 * Run manually with:
 *   npx esbuild lib/docs/__tests__/visionSalvage.test.ts --bundle --platform=node \
 *     --external:pdf-lib --outfile=/tmp/salvage.test.js && node /tmp/salvage.test.js
 */

import { strict as assert } from 'assert';
import { salvageVisionPayload } from '../visionOcr';
import { planSegments } from '../pdfSplit';

// ── salvageVisionPayload ────────────────────────────────────────────────────

// 1 · well-formed JSON passes straight through
{
  const ok = JSON.stringify({ extracted_text: 'Loan addendum between Green Tea and The Namkhan.', doc_type: 'legal', title: 'Addendum' });
  const r = salvageVisionPayload(ok);
  assert.ok(r, 'well-formed JSON must salvage');
  assert.equal(r.extracted_text, 'Loan addendum between Green Tea and The Namkhan.');
  assert.equal(r.parsed.doc_type, 'legal');
}

// 2 · TRUNCATED JSON (the production failure mode: max_tokens cut the wrapper)
{
  const longText = 'SHARE PLEDGE AGREEMENT\\n\\nBetween the parties '.repeat(50);
  const truncated = `{"extracted_text": "${longText}`; // no closing quote, no brace
  const r = salvageVisionPayload(truncated);
  assert.ok(r, 'truncated JSON must salvage');
  assert.ok(r.extracted_text.includes('SHARE PLEDGE AGREEMENT'), 'recovered text content');
  assert.ok(r.extracted_text.includes('\n\n'), 'escapes unescaped');
  assert.equal(r.parsed, null, 'no classification recoverable from truncation');
}

// 3 · text closed but wrapper malformed after it → text + best-effort fields
{
  const s = `{"extracted_text": "Lao contract ສັນຍາກູ້ຢືມ full text here, forty+ characters of content.", "doc_type": "legal", "title": "ສັນຍາ"`; // missing final }
  const r = salvageVisionPayload(s);
  assert.ok(r, 'malformed-after-text must salvage');
  assert.ok(r.extracted_text.includes('ສັນຍາກູ້ຢືມ'), 'Lao text recovered');
}

// 4 · plain text (model ignored the JSON contract) → whole payload is the text
{
  const s = 'BCEL ACCOUNT STATEMENT\nPeriod: Jan 2026\nBalance: 1,234,567 LAK\nMore lines of content here.';
  const r = salvageVisionPayload(s);
  assert.ok(r, 'plain text must salvage');
  assert.equal(r.extracted_text, s);
  assert.equal(r.parsed, null);
}

// 5 · garbage too short to be useful → null (caller records truthful failure)
{
  assert.equal(salvageVisionPayload('{"x":'), null);
  assert.equal(salvageVisionPayload('ok'), null);
}

// ── planSegments ────────────────────────────────────────────────────────────

// small doc → single whole segment
{
  const p = planSegments(20, 1_000_000);
  assert.equal(p.length, 1);
  assert.deepEqual(p[0], { pageFrom: 1, pageTo: 20 });
}

// 170-page doc (>100-page Anthropic limit) → segmented, full coverage, no overlap
{
  const p = planSegments(170, 15_000_000);
  assert.ok(p.length >= 3, '170 pages must split into >=3 segments of <=60');
  assert.equal(p[0].pageFrom, 1);
  assert.equal(p[p.length - 1].pageTo, 170);
  for (let i = 1; i < p.length; i++) assert.equal(p[i].pageFrom, p[i - 1].pageTo + 1, 'contiguous');
  for (const seg of p) assert.ok(seg.pageTo - seg.pageFrom + 1 <= 90, 'segment under page cap');
}

// 26.4MB / 80-page doc (the HTTP-413 case) → split by bytes even though pages fit
{
  const p = planSegments(80, 26_400_000);
  assert.ok(p.length >= 2, 'oversize bytes must force a split');
  const bytesPerPage = 26_400_000 / 80;
  for (const seg of p) {
    const segBytes = (seg.pageTo - seg.pageFrom + 1) * bytesPerPage;
    assert.ok(segBytes <= 20 * 1024 * 1024, 'estimated segment bytes under cap');
  }
}

console.log('visionSalvage.test.ts — all assertions passed');