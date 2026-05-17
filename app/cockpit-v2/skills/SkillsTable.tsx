'use client';

// app/cockpit-v2/skills/SkillsTable.tsx
// Filterable, sortable list. Click row → /skills/[id].

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { TOKENS, SERIF, MONO } from '../_components/tokens';

interface SkillRow {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  authority_level: string | null;
  requires_pbs_approval: boolean | null;
  estimated_cost_usd_milli: number | null;
  active: boolean;
  archived: boolean;
  implementation_type: string | null;
  agentCount: number;
  calls7d: number;
  errors7d: number;
  cost7d: number;
}

export function SkillsTable({ rows }: { rows: SkillRow[] }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'orphan' | 'archived' | 'approval' | 'active_used'>('all');
  const [sort, setSort] = useState<'name' | 'agents' | 'calls' | 'errors' | 'cost'>('name');

  const filtered = useMemo(() => {
    let out = rows.slice();
    if (filter === 'orphan')     out = out.filter((r) => r.agentCount === 0 && !r.archived);
    if (filter === 'archived')   out = out.filter((r) => r.archived);
    if (filter === 'approval')   out = out.filter((r) => r.requires_pbs_approval);
    if (filter === 'active_used') out = out.filter((r) => !r.archived && r.calls7d > 0);
    const Q = q.trim().toLowerCase();
    if (Q) {
      out = out.filter((r) =>
        r.name.toLowerCase().includes(Q) ||
        (r.description ?? '').toLowerCase().includes(Q) ||
        (r.category ?? '').toLowerCase().includes(Q)
      );
    }
    out.sort((a, b) => {
      if (sort === 'name')   return a.name.localeCompare(b.name);
      if (sort === 'agents') return b.agentCount - a.agentCount;
      if (sort === 'calls')  return b.calls7d - a.calls7d;
      if (sort === 'errors') return b.errors7d - a.errors7d;
      return b.cost7d - a.cost7d;
    });
    return out;
  }, [rows, q, filter, sort]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search" placeholder="Search name / description / category"
          value={q} onChange={(e) => setQ(e.target.value)}
          style={{
            padding: '6px 10px', minWidth: 280, flex: 1,
            background: TOKENS.bgRaised, color: TOKENS.text,
            border: `1px solid ${TOKENS.border}`, borderRadius: 2,
            fontFamily: MONO, fontSize: 12,
          }}
        />
        {(['all', 'active_used', 'orphan', 'approval', 'archived'] as const).map((k) => {
          const active = filter === k;
          return (
            <button key={k} type="button" onClick={() => setFilter(k)}
              style={{
                padding: '5px 12px', fontFamily: MONO, fontSize: 10,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                background: active ? TOKENS.ink : 'transparent',
                color: active ? TOKENS.bg : TOKENS.text,
                border: `1px solid ${active ? TOKENS.ink : TOKENS.border}`,
                borderRadius: 2, cursor: 'pointer',
              }}>{k.replace('_', ' ')}</button>
          );
        })}
        <select value={sort} onChange={(e) => setSort(e.target.value as any)}
          style={{
            padding: '5px 10px', fontFamily: MONO, fontSize: 11,
            background: TOKENS.bgRaised, color: TOKENS.text,
            border: `1px solid ${TOKENS.border}`, borderRadius: 2,
          }}>
          <option value="name">sort by name</option>
          <option value="agents">sort by agents granted</option>
          <option value="calls">sort by calls (7d)</option>
          <option value="errors">sort by errors (7d)</option>
          <option value="cost">sort by cost (7d)</option>
        </select>
      </div>

      <div style={{ border: `1px solid ${TOKENS.border}`, borderRadius: 2, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 11 }}>
          <thead>
            <tr style={{ background: TOKENS.bgRaised, borderBottom: `1px solid ${TOKENS.border}` }}>
              <th style={th()}>name</th>
              <th style={th()}>category</th>
              <th style={th()}>authority</th>
              <th style={{ ...th(), textAlign: 'right' }}>agents</th>
              <th style={{ ...th(), textAlign: 'right' }}>calls 7d</th>
              <th style={{ ...th(), textAlign: 'right' }}>errors</th>
              <th style={{ ...th(), textAlign: 'right' }}>cost 7d</th>
              <th style={th()}>flags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${TOKENS.borderSoft}` }}>
                <td style={td()}>
                  <Link href={`/cockpit-v2/skills/${r.id}`}
                    style={{ color: TOKENS.ink, fontWeight: 600, textDecoration: 'none' }}>
                    {r.name}
                  </Link>
                  {r.description && (
                    <div style={{ color: TOKENS.text3, fontSize: 10, marginTop: 2, maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.description.length > 110 ? r.description.slice(0, 110) + '…' : r.description}
                    </div>
                  )}
                </td>
                <td style={{ ...td(), color: TOKENS.text2 }}>{r.category ?? '—'}</td>
                <td style={{ ...td(), color: TOKENS.text2 }}>{r.authority_level ?? '—'}</td>
                <td style={{ ...td(), textAlign: 'right', color: r.agentCount === 0 ? '#E07856' : TOKENS.text }}>
                  {r.agentCount}
                </td>
                <td style={{ ...td(), textAlign: 'right', color: r.calls7d === 0 ? TOKENS.text3 : TOKENS.text }}>
                  {r.calls7d}
                </td>
                <td style={{ ...td(), textAlign: 'right', color: r.errors7d > 0 ? '#E07856' : TOKENS.text3 }}>
                  {r.errors7d}
                </td>
                <td style={{ ...td(), textAlign: 'right', color: TOKENS.text2 }}>
                  ${r.cost7d.toFixed(3)}
                </td>
                <td style={{ ...td() }}>
                  {r.requires_pbs_approval && <Tag color={TOKENS.brass}>approval</Tag>}
                  {r.archived && <Tag color={TOKENS.text3}>archived</Tag>}
                  {!r.active && !r.archived && <Tag color="#E07856">inactive</Tag>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: 20, color: TOKENS.text3, fontFamily: MONO, fontSize: 12 }}>
          No skills match.
        </div>
      )}
    </div>
  );
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
      color, border: `1px solid ${color}`, padding: '1px 6px', borderRadius: 2,
      marginRight: 4, whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

function th(): React.CSSProperties {
  return { padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 10,
    letterSpacing: '0.12em', textTransform: 'uppercase', color: TOKENS.text3 };
}
function td(): React.CSSProperties {
  return { padding: '8px 12px', verticalAlign: 'top', fontVariantNumeric: 'tabular-nums' };
}
