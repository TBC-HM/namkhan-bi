'use client';

import React from 'react';
import Link from 'next/link';

export interface MediaSearchResult {
  asset_id: string;
  filename?: string;
  qc_score?: number;
  thumbnail_url?: string;
  asset_type?: string;
  tier?: string;
  [key: string]: unknown;
}

export interface ParsedIntent {
  subject?: string;
  asset_type?: string;
  channel?: string;
  excluded_tags?: string[];
  required_tags?: string[];
  [key: string]: unknown;
}

interface MediaSearchResultsProps {
  results: MediaSearchResult[];
  parsed_intent: ParsedIntent;
  supabaseUrl?: string;
}

function qcBadgeStyle(score: number | undefined): React.CSSProperties {
  if (score === undefined || score === null) {
    return { background: 'var(--moss)', color: '#fff' };
  }
  if (score >= 80) return { background: '#2d6a4f', color: '#fff' };
  if (score >= 60) return { background: '#b5a642', color: '#fff' };
  return { background: '#9b2226', color: '#fff' };
}

function resolveThumb(
  thumbnail_url: string | undefined,
  supabaseUrl: string
): string {
  if (!thumbnail_url) return '';
  if (thumbnail_url.startsWith('http')) return thumbnail_url;
  // Storage-relative path — prepend Supabase public storage base
  const base = supabaseUrl.replace(/\/$/, '');
  return `${base}/storage/v1/object/public/media-renders/${thumbnail_url.replace(/^\//, '')}`;
}

export default function MediaSearchResults({
  results,
  parsed_intent,
  supabaseUrl = '',
}: MediaSearchResultsProps) {
  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* parsed_intent block */}
      <div
        style={{
          background: 'var(--surface, #f5f2ee)',
          border: '1px solid var(--border, #e0dbd4)',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 16,
          fontSize: 13,
          color: 'var(--text-secondary, #6b6560)',
        }}
      >
        <strong style={{ color: 'var(--text-primary, #1a1410)' }}>
          Extracted search intent
        </strong>
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(parsed_intent).map(([k, v]) => (
            <span
              key={k}
              style={{
                background: 'var(--moss, #1a2e21)',
                color: '#fff',
                borderRadius: 4,
                padding: '2px 7px',
                fontSize: 12,
              }}
            >
              {k}: {Array.isArray(v) ? v.join(', ') : String(v ?? '—')}
            </span>
          ))}
          {Object.keys(parsed_intent).length === 0 && (
            <span style={{ color: 'var(--text-secondary, #6b6560)' }}>
              No intent extracted
            </span>
          )}
        </div>
      </div>

      {/* Results grid or empty state */}
      {results.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '32px 16px',
            color: 'var(--text-secondary, #6b6560)',
            fontSize: 14,
          }}
        >
          No matches found. Try rephrasing your search above.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
          }}
        >
          {results.map((asset) => {
            const thumb = resolveThumb(asset.thumbnail_url, supabaseUrl);
            const score = typeof asset.qc_score === 'number' ? asset.qc_score : undefined;
            const label = asset.filename ?? asset.asset_id ?? '—';
            return (
              <Link
                key={asset.asset_id}
                href={`/marketing/media/${asset.asset_id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div
                  style={{
                    border: '1px solid var(--border, #e0dbd4)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: 'var(--surface, #f5f2ee)',
                    cursor: 'pointer',
                    transition: 'box-shadow 0.15s',
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    style={{
                      width: '100%',
                      height: 144,
                      background: 'var(--border, #e0dbd4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt={label}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary, #6b6560)' }}>
                        No preview
                      </span>
                    )}
                    {/* QC badge */}
                    <span
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        borderRadius: 4,
                        padding: '2px 6px',
                        fontSize: 11,
                        fontWeight: 600,
                        ...qcBadgeStyle(score),
                      }}
                    >
                      {score !== undefined ? `QC ${score}` : 'QC —'}
                    </span>
                  </div>
                  {/* Label */}
                  <div
                    style={{
                      padding: '6px 8px',
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: 'var(--text-primary, #1a1410)',
                    }}
                    title={label}
                  >
                    {label}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
