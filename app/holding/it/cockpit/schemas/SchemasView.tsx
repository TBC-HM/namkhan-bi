'use client';

// app/holding/it/cockpit/schemas/SchemasView.tsx
// Client-side renderer for the Schemas tab. Groups inventory rows by
// schema_name, shows row-count estimate, grant presence and last-DDL
// timestamp. Search box filters both schema name and object name.
//
// Author: IT-team agent · 2026-05-13 · #77.

import { useMemo, useState } from 'react';
import { TOKENS, SERIF, MONO } from '../_components/tokens';
import type { SchemaObject } from '../_lib/types';

function fmtCount(n: number): string {
  if (n <= 0) return '—';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0) + 'k';
  return (n / 1_000_000).toFixed(1) + 'M';
}

function fmtAge(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const mins = Math.floor((Date.now() - t) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 60) return `${days}d ago`;
  return iso.slice(0, 10);
}

export function SchemasView({ objects }: { objects: SchemaObject[] }) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return objects;
    return objects.filter(
      (o) =>
        o.schema_name.toLowerCase().includes(needle) ||
        o.object_name.toLowerCase().includes(needle),
    );
  }, [objects, q]);

  const grouped = useMemo(() => {
    const m = new Map<string, SchemaObject[]>();
    for (const o of filtered) {
      const list = m.get(o.schema_name) ?? [];
      list.push(o);
      m.set(o.schema_name, list);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const totalObjects = objects.length;
  const totalSchemas = useMemo(
    () => new Set(objects.map((o) => o.schema_name)).size,
    [objects],
  );

  return (
    <div style={{ color: TOKENS.ink, fontFamily: 'var(--sans)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 18,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <h2 style={{ fontFamily: SERIF, fontSize: 22, color: TOKENS.ink, margin: 0 }}>
          Schemas
        </h2>
        <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
          {totalSchemas} schemas · {totalObjects} objects
        </div>
        <div style={{ marginLeft: 'auto', minWidth: 260 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search schema or object…"
            style={{
              width: '100%',
              padding: '8px 12px',
              background: TOKENS.bgRaised,
              border: `1px solid ${TOKENS.border}`,
              color: TOKENS.ink,
              fontFamily: MONO,
              fontSize: 12,
              borderRadius: 2,
              outline: 'none',
            }}
          />
        </div>
      </div>

      {grouped.length === 0 && (
        <div
          style={{
            padding: 24,
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.bgRaised,
            color: TOKENS.text2,
            fontSize: 13,
            borderRadius: 2,
          }}
        >
          No objects match “{q}”.
        </div>
      )}

      {grouped.map(([schema, rows]) => (
        <section
          key={schema}
          style={{
            marginBottom: 24,
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.bgRaised,
            borderRadius: 2,
          }}
        >
          <header
            style={{
              padding: '12px 18px',
              borderBottom: `1px solid ${TOKENS.border}`,
              display: 'flex',
              alignItems: 'baseline',
              gap: 14,
            }}
          >
            <span
              style={{
                fontFamily: SERIF,
                fontSize: 16,
                color: TOKENS.sand,
                letterSpacing: 0.4,
              }}
            >
              {schema}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
              {rows.length} objects
            </span>
          </header>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: MONO,
              fontSize: 12,
            }}
          >
            <thead>
              <tr style={{ color: TOKENS.text3, textAlign: 'left' }}>
                <th style={th}>Object</th>
                <th style={th}>Kind</th>
                <th style={{ ...th, textAlign: 'right' }}>Rows (est)</th>
                <th style={th}>Grants</th>
                <th style={th}>Last DDL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr
                  key={`${o.schema_name}.${o.object_name}.${o.object_kind}`}
                  style={{ borderTop: `1px solid ${TOKENS.borderSoft}` }}
                >
                  <td style={tdName}>{o.object_name}</td>
                  <td style={td}>
                    <span
                      style={{
                        padding: '1px 6px',
                        background:
                          o.object_kind === 'table'
                            ? 'rgba(122,155,106,0.16)'
                            : o.object_kind === 'view'
                              ? 'rgba(154,136,102,0.18)'
                              : o.object_kind === 'matview'
                                ? 'rgba(196,160,107,0.18)'
                                : 'rgba(233,225,206,0.10)',
                        color: TOKENS.text2,
                        borderRadius: 2,
                        fontSize: 10,
                        letterSpacing: 0.5,
                      }}
                    >
                      {o.object_kind}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: TOKENS.text2 }}>
                    {fmtCount(o.est_row_count)}
                  </td>
                  <td style={td}>
                    {o.has_grants ? (
                      <span style={{ color: TOKENS.moss }}>granted</span>
                    ) : (
                      <span style={{ color: TOKENS.text3 }}>—</span>
                    )}
                  </td>
                  <td style={{ ...td, color: TOKENS.text2 }}>{fmtAge(o.last_ddl_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '8px 14px',
  fontWeight: 500,
  fontSize: 10,
  letterSpacing: 1,
  textTransform: 'uppercase',
};

const td: React.CSSProperties = {
  padding: '6px 14px',
};

const tdName: React.CSSProperties = {
  ...td,
  color: TOKENS.ink,
};
