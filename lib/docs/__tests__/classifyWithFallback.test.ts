// lib/docs/__tests__/classifyWithFallback.test.ts
//
// Regression test for the 2026-09-09/10 incident: /api/docs/ingest returned 500
// and ABANDONED the uploaded file in documents-internal/_staging whenever the
// Anthropic classifier failed. PBS hit it twice with
//   Anthropic 400: "Your credit balance is too low to access the Anthropic API"
// and ~80 orphaned objects had accumulated in _staging since 2026-05-04.
//
// The contract these tests pin down: an AI outage must DEGRADE document upload,
// never fail it. classifyWithFallback never throws; it reports degraded=true and
// returns a usable classification so the route can still persist the document
// for a human to sort out.

import {
  classifyWithFallback,
  fallbackClassification,
  DEGRADED_STATUS,
  DEGRADED_CLASSIFICATION_STATUS,
} from '../classifier';

const CREDIT_ERROR =
  'Anthropic 400: {"type":"error","error":{"type":"invalid_request_error",' +
  '"message":"Your credit balance is too low to access the Anthropic API."}}';

const INPUT = {
  fileName: 'SLH Mystery Inspection 2026 - The Namkhan.pdf',
  mimeType: 'application/pdf',
  extractedText: 'MYSTERY INSPECTION PROGRAMME 2026 — overall survey score 94.7% PASS',
};

describe('classifyWithFallback', () => {
  it('does not throw when the classifier fails with the credit error', async () => {
    await expect(
      classifyWithFallback({ ...INPUT, _call: async () => { throw new Error(CREDIT_ERROR); } }),
    ).resolves.toBeDefined();
  });

  it('flags the result as degraded and surfaces the underlying error', async () => {
    const r = await classifyWithFallback({
      ...INPUT,
      _call: async () => { throw new Error(CREDIT_ERROR); },
    });
    expect(r.degraded).toBe(true);
    expect(r.error).toContain('credit balance is too low');
  });

  it('still returns a persistable classification when the AI is down', async () => {
    const { cls } = await classifyWithFallback({
      ...INPUT,
      _call: async () => { throw new Error(CREDIT_ERROR); },
    });
    // Every column the ingest INSERT reads must be present and of the right shape,
    // or the "degraded" path just moves the 500 downstream into Postgres.
    expect(typeof cls.doc_type).toBe('string');
    expect(cls.title.length).toBeGreaterThan(0);
    expect(Array.isArray(cls.keywords)).toBe(true);
    expect(Array.isArray(cls.tags)).toBe(true);
    expect(cls.parties).toEqual({});
    expect(['public', 'internal', 'confidential', 'restricted']).toContain(cls.sensitivity);
    expect(['en', 'lo', 'fr', 'es', 'mixed']).toContain(cls.language);
  });

  it('tags the document so a human can find every degraded ingest later', async () => {
    const { cls } = await classifyWithFallback({
      ...INPUT,
      _call: async () => { throw new Error(CREDIT_ERROR); },
    });
    expect(cls.tags).toContain('unclassified:classifier_unavailable');
  });

  it('passes the real classification straight through when the AI works', async () => {
    // Build the "AI succeeded" fixture WITHOUT inheriting the degraded tag —
    // otherwise this test can pass while classifyWithFallback wrongly tags a
    // successful classification as degraded.
    const good = {
      ...fallbackClassification(INPUT.fileName, INPUT.mimeType),
      title: 'Real AI Title',
      doc_type: 'audit' as const,
      tags: ['annual'],
    };
    const r = await classifyWithFallback({ ...INPUT, _call: async () => good });
    expect(r.degraded).toBe(false);
    expect(r.error).toBeNull();
    expect(r.cls.title).toBe('Real AI Title');
    expect(r.cls.tags).not.toContain('unclassified:classifier_unavailable');
  });

  it('degrades on a non-JSON classifier reply, not just on network failure', async () => {
    const r = await classifyWithFallback({
      ...INPUT,
      _call: async () => { throw new Error('Classifier returned non-JSON: <html>502 Bad Gateway'); },
    });
    expect(r.degraded).toBe(true);
    expect(r.cls.title.length).toBeGreaterThan(0);
  });
});

describe('fallbackClassification', () => {
  it('derives a human-readable title from the filename, without the extension', () => {
    const cls = fallbackClassification('SLH Mystery Inspection 2026 - The Namkhan.pdf', 'application/pdf');
    expect(cls.title).toBe('SLH Mystery Inspection 2026 - The Namkhan');
    expect(cls.title).not.toContain('.pdf');
  });

  it('defaults to the most conservative sensitivity, never public', () => {
    const cls = fallbackClassification('payroll-2026.xlsx', 'application/vnd.ms-excel');
    expect(cls.sensitivity).toBe('confidential');
  });

  it('survives a filename that is only an extension', () => {
    const cls = fallbackClassification('.pdf', 'application/pdf');
    expect(cls.title.length).toBeGreaterThan(0);
  });
});

describe('degraded status constants match the dms.documents CHECK constraints', () => {
  // documents_status_check allows: draft, in_review, approved, active, expired, retired, archived.
  // 'needs_review' — which the upload dropzone's UI copy promises — is NOT in that list
  // and would be rejected by Postgres.
  it('uses a status the database actually accepts', () => {
    expect(['draft', 'in_review', 'approved', 'active', 'expired', 'retired', 'archived'])
      .toContain(DEGRADED_STATUS);
    expect(DEGRADED_STATUS).not.toBe('needs_review');
  });

  it('leaves classification pending so the document re-classifies itself', () => {
    // brain_classification_status_chk allows: pending, classified, needs_human, human_confirmed.
    expect(['pending', 'classified', 'needs_human', 'human_confirmed'])
      .toContain(DEGRADED_CLASSIFICATION_STATUS);
    // 'pending' is load-bearing twice over:
    //  - fn_brain_claim_chunkable() indexes only classified/human_confirmed, so an
    //    unclassified document never reaches the brain as a guess;
    //  - fn_brain_claim_classify() (cron brain-classify-5min) re-picks 'pending',
    //    so the document classifies itself once Anthropic is reachable again.
    // 'needs_human' would satisfy the first and BREAK the second.
    expect(DEGRADED_CLASSIFICATION_STATUS).toBe('pending');
    expect(DEGRADED_CLASSIFICATION_STATUS).not.toBe('needs_human');
  });
});
