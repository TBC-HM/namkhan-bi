'use client';
// Spa folio posting actions — retry button for failed posts.
// Brief: spa-module-v1-slice-folio-posting

import { useState } from 'react';
import { TOKENS, MONO } from '@/components/cockpit/tokens';

interface Props {
  bookingId: string;
  status: string;
  reservationId: string | null;
  postedToFolio: boolean | null;
  chargeId: string | null;
}

export default function FolioActions({ bookingId, status, reservationId, postedToFolio, chargeId }: Props) {
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Only show retry for completed bookings with a reservation that haven't posted successfully
  if (status !== 'completed' || !reservationId || postedToFolio) {
    return null;
  }

  const handleRetry = async () => {
    setWorking(true);
    setResult(null);
    try {
      const r = await fetch('/api/spa/bookings/folio-retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      const j = await r.json();
      if (r.ok && j.posted) {
        setResult(`✓ Posted (charge ${j.charge_id ?? 'ok'})`);
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setResult(`✗ ${j.note || j.error || 'Failed'}`);
      }
    } catch (e) {
      setResult(`✗ ${e instanceof Error ? e.message : 'Network error'}`);
    } finally {
      setWorking(false);
    }
  };

  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={handleRetry}
        disabled={working}
        style={{
          padding: '4px 8px',
          fontSize: 10,
          fontFamily: MONO,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          border: `1px solid ${TOKENS.border}`,
          borderRadius: 3,
          background: TOKENS.bgRaised,
          color: TOKENS.ink,
          cursor: working ? 'wait' : 'pointer',
          opacity: working ? 0.6 : 1,
        }}
      >
        {working ? 'Posting...' : 'Retry folio post'}
      </button>
      {result && (
        <span
          style={{
            fontSize: 10,
            fontFamily: MONO,
            color: result.startsWith('✓') ? TOKENS.forest : TOKENS.terracotta,
          }}
        >
          {result}
        </span>
      )}
    </span>
  );
}
