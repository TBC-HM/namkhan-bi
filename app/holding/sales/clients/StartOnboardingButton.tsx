// app/holding/sales/clients/StartOnboardingButton.tsx
// Client-side button for PBS finding #41: start onboarding from a contract
// with one click, then surface the customer portal link with a copy control.
// Idempotent: POST /api/sales/onboarding/start returns the existing case's
// portal link (existed=true) on any later click.
'use client';

import { useState } from 'react';

const WHITE = '#FFFFFF'; const FOREST = '#084838'; const OK = '#0E7A4B';
const RED = '#B03826'; const INK_M = '#5A5A5A'; const HAIR = '#E6DFCC';

export default function StartOnboardingButton({
  contractId,
  hasOnboarding,
}: {
  contractId: string;
  hasOnboarding: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function start() {
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/sales/onboarding/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract_id: contractId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setPortalUrl(String(json.portal_url ?? ''));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('copy failed — select the link manually');
    }
  }

  if (portalUrl) {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', maxWidth: 360 }}>
        <a
          href={portalUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 11, color: FOREST, textDecoration: 'underline',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
            maxWidth: 220,
          }}
          title={portalUrl}
        >
          {portalUrl.replace(/^https?:\/\//, '')}
        </a>
        <button
          onClick={copy}
          style={{
            padding: '5px 10px', borderRadius: 4, border: `1px solid ${FOREST}`,
            background: copied ? OK : WHITE, color: copied ? WHITE : FOREST,
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {copied ? 'Copied ✓' : 'Copy link'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 4 }}>
      <button
        onClick={start}
        disabled={busy}
        style={{
          padding: '6px 14px', borderRadius: 4, border: 'none',
          background: busy ? HAIR : FOREST, color: busy ? INK_M : WHITE,
          fontSize: 12, fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {busy ? 'Working…' : hasOnboarding ? 'Portal link' : 'Start onboarding'}
      </button>
      {error && (
        <div style={{ fontSize: 11, color: RED, maxWidth: 240, textAlign: 'right' as const }}>{error}</div>
      )}
    </div>
  );
}
