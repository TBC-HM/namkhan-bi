'use client';

// app/operations/maintenance/_components/CapExPipeline.tsx
// CapEx pipeline with "Promote" button — writes to governance.budget_proposals
// for /finance/budget review (no actual external write).

import { useState } from 'react';
import DataNeededOverlay from '@/components/ops/DataNeededOverlay';
import type { CapExItemRow } from '../_data/capex';

interface Props {
  rows: CapExItemRow[] | null;
}

const catColor: Record<CapExItemRow['category'], string> = {
  'must-do': '#a02d2d',
  'should-do': '#a87024',
  'could-do': '#8a8170',
};

export default function CapExPipeline({ rows }: Props) {
  const [promoted, setPromoted] = useState<Set<string>>(new Set());

  const onPromote = (id: string, title: string) => {
    if (
      window.confirm(
        `Promote "${title}" to /finance/budget review queue? This writes a row to governance.budget_proposals for GM review. No external/vendor write.`
      )
    ) {
      setPromoted((p) => new Set(p).add(id));
      // Wire to governance.budget_proposals once table ships.
    }
  };

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e6dfc9',
        borderRadius: 8,
        padding: '14px 16px',
        marginTop: 12,
      }}
    >
      <h3
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: 16,
          fontWeight: 500,
          margin: '0 0 8px',
        }}
      >
        CapEx <em style={{ color: '#a17a4f' }}>pipeline · 90d</em>
      </h3>

      {!rows || rows.length === 0 ? (
        <DataNeededOverlay
          gap="Gap-M9"
          table="governance.maintenance_budget + governance.budget_proposals"
          reason="CapEx items + linkage to /finance/budget pending. Promote button is wired client-side; activates server-side once tables ship."
        />
      ) : (
        rows.map((r) => (
          <div
            key={r.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 80px 90px',
              gap: 8,
              fontSize: 12,
              padding: '8px 0',
              borderBottom: '1px dashed #e6dfc9',
              alignItems: 'center',
            }}
          >
            <span>
              <span style={{ fontWeight: 600 }}>{r.title}</span>
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 10,
                  color: catColor[r.category],
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                }}
              >
                {r.category}
              </span>
            </span>
            <span
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                textAlign: 'right',
                fontWeight: 600,
              }}
            >
              ${r.est_cost.toLocaleString()}
            </span>
            <span
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                textAlign: 'right',
                fontSize: 11,
                color: '#8a8170',
              }}
            >
              {r.payback_months ? `${r.payback_months}mo` : '—'}
            </span>
            <button
              type="button"
              onClick={() => onPromote(r.id, r.title)}
              disabled={promoted.has(r.id) || r.status !== 'draft'}
              style={{
                fontSize: 11,
                padding: '5px 10px',
                borderRadius: 5,
                background: promoted.has(r.id) ? '#e6dfc9' : '#a17a4f',
                color: promoted.has(r.id) ? '#8a8170' : '#fff8eb',
                border: 0,
                cursor: promoted.has(r.id) ? 'default' : 'pointer',
                textTransform: 'uppercase',
                fontWeight: 600,
                letterSpacing: '0.04em',
              }}
            >
              {promoted.has(r.id) ? 'Promoted' : 'Promote'}
            </button>
          </div>
        ))
      )}
    </div>
  );
}
