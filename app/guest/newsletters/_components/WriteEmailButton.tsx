'use client';
// app/guest/newsletters/_components/WriteEmailButton.tsx
// PBS 2026-07-23 · One-click writer for concept-only drafts (Broadcasts page).
// POSTs /api/marketing/newsletter/propose-one with { campaign_id } — the route
// loads the concept from the campaign row, runs the composer + Saya → Veda
// chain (~30s) and persists subject / body_md / hero_asset_id server-side.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const BRAND = '#1F3A2E';
const RED = '#B03826';

export default function WriteEmailButton({ campaign_id, property_id }: { campaign_id: string; property_id: number }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');

  async function write() {
    if (state === 'busy' || state === 'done') return;
    setState('busy');
    try {
      const r = await fetch('/api/marketing/newsletter/propose-one', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ property_id, campaign_id }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j?.ok && j?.persisted?.ok) {
        setState('done');
        router.refresh();
      } else {
        setState('failed');
      }
    } catch {
      setState('failed');
    }
  }

  const label =
    state === 'busy' ? 'Writing… ~30s' :
    state === 'done' ? 'Written' :
    state === 'failed' ? 'Failed — retry' :
    'Write email';

  return (
    <button
      onClick={write}
      disabled={state === 'busy' || state === 'done'}
      title="AI-write this draft: hero photo, prose, product blocks and signature are generated from the concept and saved."
      style={{
        display: 'inline-block', padding: '4px 10px', marginLeft: 6, fontSize: 11, fontWeight: 600,
        background: state === 'failed' ? RED : BRAND, color: '#FFFFFF', border: 'none', borderRadius: 4,
        cursor: state === 'busy' || state === 'done' ? 'default' : 'pointer', opacity: state === 'busy' ? 0.75 : 1,
      }}
    >
      {label}
    </button>
  );
}
