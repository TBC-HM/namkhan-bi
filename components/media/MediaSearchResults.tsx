'use client';
// components/media/MediaSearchResults.tsx
// ticket #114 — 4-column thumbnail grid for cockpit chat media search results

import React from 'react';
import Link from 'next/link';

interface MediaSearchRow {
  asset_id: string;
  filename: string;
  thumbnail_url: string | null;
  qc_score: number | null;
  tier: string | null;
  asset_type: string | null;
  caption: string | null;
  alt_text: string | null;
  tag_slugs?: string[] | null;
}

interface MediaSearchResultsProps {
  results: MediaSearchRow[];
  parsedIntent: Record<string, unknown>;
}

// QC score → colour band (mirrors marketing.qc_score_bands logic)
function qcColor(score: number | null): string {
  if (score === null) return '#6b7280'; // grey — unknown
  if (score >= 85) return '#16a34a';   // green — excellent
  if (score >= 65) return '#ca8a04';   // amber — good
  return '#dc2626';                     // red — marginal
}

function qcLabel(score: number | null): string {
  if (score === null) return 'N/A';
  return `${Math.round(score)}`;
}

function ParsedIntentBlock({ intent }: { intent: Record<string, unknown> }) {
  const entries = Object.entries(intent).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return null;

  return (
    <div
      style={{
        background: 'var(--moss, #1a2e21)',
        color: '#d1fae5',
        borderRadius: 8,
        padding: '10px 14px',
        marginBottom: 16,
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      <strong style={{ color: '#6ee7b7', display: 'block', marginBottom: 4 }}>
        🔍 Parsed intent
      </strong>
      {entries.map(([k, v]) => (
        <span key={k} style={{ marginRight: 12 }}>
          <span style={{ color: '#86efac' }}>{k}:</span>{' '}
          <span style={{ color: '#ecfdf5' }}>
            {Array.isArray(v) ? (v as unknown[]).join(', ') : String(v)}
          </span>
        </span>
      ))}
      <div style={{ marginTop: 6, color: '#6ee7b7', fontSize: 11 }}>
        Not what you meant? Rephrase and try again.
      </div>
    </div>
  );
}

export default function MediaSearchResults({ results, parsedIntent }: MediaSearchResultsProps) {
  return (
    <div>
      <ParsedIntentBlock intent={parsedIntent} />

      {results.length === 0 ? (
        <div
          style={{
            padding: '20px 0',
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: 14,
          }}
        >
          No matches found. Try different keywords or remove filters.
        </div>
      ) : (
        <>
          <div
            style={{
              fontSize: 12,
              color: '#6b7280',
              marginBottom: 10,
            }}
          >
            {results.length} asset{results.length !== 1 ? 's' : ''} found
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 144px)',
              gap: 12,
            }}
          >
            {results.map((row) => (
              <Link
                key={row.asset_id}
                href={`/marketing/media/${row.asset_id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div
                  style={{
                    width: 144,
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: '#1f2937',
                    border: '1px solid #374151',
                    cursor: 'pointer',
                    transition: 'box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow =
                      '0 0 0 2px var(--moss-glow, #6b9379)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    style={{
                      width: 144,
                      height: 144,
                      background: '#111827',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {row.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.thumbnail_url}
                        alt={row.alt_text ?? row.filename}
                        width={144}
                        height={144}
                        style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                      />
                    ) : (
                      <span style={{ color: '#4b5563', fontSize: 28 }}>🖼</span>
                    )}

                    {/* QC Score badge — top-right */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        background: qcColor(row.qc_score),
                        color: '#fff',
                        borderRadius: 4,
                        padding: '2px 5px',
                        fontSize: 11,
                        fontWeight: 700,
                        lineHeight: 1.2,
                      }}
                    >
                      {qcLabel(row.qc_score)}
                    </div>

                    {/* Asset type badge — top-left */}
                    {row.asset_type && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 6,
                          left: 6,
                          background: 'rgba(0,0,0,0.55)',
                          color: '#e5e7eb',
                          borderRadius: 4,
                          padding: '2px 5px',
                          fontSize: 10,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {row.asset_type}
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <div
                    style={{
                      padding: '6px 8px',
                      fontSize: 11,
                      color: '#d1d5db',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={row.caption ?? row.filename}
                  >
                    {row.caption ?? row.filename}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
