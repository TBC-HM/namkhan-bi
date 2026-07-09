'use client';

// app/operations/sops/_components/SopBrowser.tsx
// PBS 2026-07-08 · 2026-07-07 (Generate) · 2026-07-08 (Proposals):
// Client-side search + grouped SOP list. Surfaces AI-generated SOPs with a
// small "AI" chip on the code cell. Renders "+ Generate SOP" and
// "+ Propose SOPs" buttons when their respective href props are passed.
// SOPs are property-scoped (see /operations/sops page.tsx filter).

import { useMemo, useState } from 'react';

export interface SopRow {
  sop_code: string; title: string; dept_code: string;
  primary_audience: string | null; short_summary: string | null;
  language: string; status: string; version: string;
  visual_required: boolean;
  kb_links_count: number | null; legal_links_count: number | null; susty_links_count: number | null;
  created_at: string; updated_at: string;
  // PBS 2026-07-07: exposed by v_sop_catalog for the Generate feature. Optional so
  // pre-existing callers don't need to change; the browser only surfaces `source`
  // as an "AI" chip when non-null.
  property_id?: number | null;
  source?: string | null;
}

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_S = '#3A3A3A';
const INK_M = '#5A5A5A';
const CREAM = '#F5F0E1';
const PRIMARY = '#084838';

// PBS 2026-07-09 pm: compact row action button style shared by Preview / Send / Edit.
const rowBtn: React.CSSProperties = {
  display: 'inline-block', padding: '3px 10px', fontSize: 11, fontWeight: 600,
  color: PRIMARY, background: WHITE, border: '1px solid ' + PRIMARY,
  borderRadius: 4, textDecoration: 'none', whiteSpace: 'nowrap',
};

const th: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  color: INK_S, borderBottom: '1px solid ' + HAIR, background: WHITE,
};

function normDept(code: string): string {
  const cu = code.toUpperCase().replace(/^OPS_/, '').replace(/^COMM_/, '');
  const map: Record<string, string> = {
    HOUSEKEEPING: 'Housekeeping',
    F_AND_B: 'F&B', FB: 'F&B',
    FRONT_OFFICE: 'Front Office',
    ENGINEERING: 'Engineering',
    GOVERNANCE: 'Governance',
    PROCUREMENT: 'Procurement',
    HR: 'HR', SPA: 'Spa',
    MARKETING: 'Marketing', REVENUE: 'Revenue', SALES: 'Sales',
    FINANCE: 'Finance', IT: 'IT',
  };
  return map[cu] ?? code;
}

export default function SopBrowser({ sops, generateHref, proposalsHref }: { sops: SopRow[]; generateHref?: string; proposalsHref?: string }) {
  const [query, setQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sops.filter((s) => {
      if (deptFilter !== 'all' && normDept(s.dept_code) !== deptFilter) return false;
      if (!q) return true;
      return (
        s.sop_code.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        (s.primary_audience ?? '').toLowerCase().includes(q) ||
        (s.short_summary ?? '').toLowerCase().includes(q)
      );
    });
  }, [sops, query, deptFilter]);

  const byDept = useMemo(() => {
    const m = new Map<string, SopRow[]>();
    for (const s of filtered) {
      const key = normDept(s.dept_code);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(s);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  // Departments always present (from full list) for the filter dropdown
  const allDepts = useMemo(() => {
    const s = new Set<string>();
    for (const r of sops) s.add(normDept(r.dept_code));
    return Array.from(s).sort();
  }, [sops]);

  return (
    <>
      {/* Search + dept filter strip */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: 480 }}>
          <span aria-hidden style={{ position: 'absolute', left: 10, top: 8, fontSize: 12, color: INK_M }}>⌕</span>
          <input
            type="search"
            placeholder="Search SOPs — code, title, audience, summary"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%', padding: '6px 10px 6px 26px',
              border: '1px solid ' + HAIR, borderRadius: 4,
              fontSize: 12, fontFamily: 'inherit', color: INK, background: WHITE,
            }}
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          style={{
            padding: '6px 10px', border: '1px solid ' + HAIR, borderRadius: 4,
            fontSize: 12, fontFamily: 'inherit', color: INK, background: WHITE, cursor: 'pointer',
          }}
        >
          <option value="all">All departments</option>
          {allDepts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <span style={{ fontSize: 11, color: INK_M }}>
          {filtered.length} of {sops.length} SOP{sops.length === 1 ? '' : 's'}
        </span>
        {proposalsHref && (
          <a
            href={proposalsHref}
            style={{
              marginLeft: 'auto', padding: '6px 12px',
              background: WHITE, color: '#0F5B4A', border: '1px solid #0F5B4A',
              borderRadius: 4, fontSize: 11, fontWeight: 600,
              textDecoration: 'none', letterSpacing: '0.02em',
            }}
          >
            + Propose SOPs
          </a>
        )}
        {generateHref && (
          <a
            href={generateHref}
            style={{
              marginLeft: proposalsHref ? 0 : 'auto', padding: '6px 12px',
              background: '#0F5B4A', color: WHITE, border: '1px solid #0F5B4A',
              borderRadius: 4, fontSize: 11, fontWeight: 600,
              textDecoration: 'none', letterSpacing: '0.02em',
            }}
          >
            + Generate SOP
          </a>
        )}
      </div>

      {/* Dept chip nav */}
      {deptFilter === 'all' && !query && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {byDept.map(([dept, list]) => (
            <a key={dept} href={`#sops-${dept}`} style={{
              padding: '6px 12px', background: CREAM, color: INK_S,
              border: '1px solid ' + HAIR, borderRadius: 99,
              fontSize: 11, textDecoration: 'none', fontWeight: 500,
            }}>{dept} · {list.length}</a>
          ))}
        </div>
      )}

      {byDept.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: INK_M, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4 }}>
          No SOPs match &ldquo;{query}&rdquo;.
        </div>
      )}

      {byDept.map(([dept, list]) => (
        <div key={dept} id={`sops-${dept}`}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, margin: '12px 2px 8px' }}>
            {dept} · {list.length} SOP{list.length === 1 ? '' : 's'}
          </div>
          <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, overflowX: 'auto', marginBottom: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={th}>Code</th>
                  <th style={th}>Title</th>
                  <th style={th}>Audience</th>
                  <th style={th}>Summary</th>
                  <th style={{ ...th, textAlign: 'right', width: 70 }}>Ver.</th>
                  <th style={{ ...th, textAlign: 'right', width: 80 }}>Links</th>
                  <th style={{ ...th, textAlign: 'center', width: 180 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.sop_code} style={{ borderBottom: '1px solid ' + CREAM }}>
                    <td style={{ padding: '8px 12px', color: INK, fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11 }}>
                      {s.sop_code}
                      {(s.source === 'ai_generated' || s.source === 'ai_stub') && (
                        <span title={s.source === 'ai_stub' ? 'AI stub (deterministic)' : 'AI-generated (Claude)'} style={{ marginLeft: 6, padding: '1px 6px', background: CREAM, color: INK_S, borderRadius: 99, fontSize: 9, fontWeight: 600, letterSpacing: '0.04em' }}>
                          AI
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px', color: INK, fontWeight: 600 }}>{s.title}</td>
                    <td style={{ padding: '8px 12px', color: INK_M, fontSize: 11 }}>{s.primary_audience ?? '—'}</td>
                    <td style={{ padding: '8px 12px', color: INK_S, fontSize: 11, lineHeight: 1.4, maxWidth: 400 }}>{s.short_summary}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: INK_M, fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11 }}>{s.version}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: INK_M, fontSize: 10 }}>
                      {(s.kb_links_count ?? 0) > 0 && <span title="Knowledge base links">KB·{s.kb_links_count}</span>}
                      {(s.legal_links_count ?? 0) > 0 && <span title="Legal links" style={{ marginLeft: 6 }}>Legal·{s.legal_links_count}</span>}
                      {(s.susty_links_count ?? 0) > 0 && <span title="Sustainability links" style={{ marginLeft: 6 }}>Susty·{s.susty_links_count}</span>}
                    </td>
                    {/* PBS 2026-07-09 pm: Preview · Send · Edit per SOP row */}
                    <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <a href={`/operations/sops/${encodeURIComponent(s.sop_code)}/preview`} target="_blank" rel="noopener noreferrer"
                        style={rowBtn}>Preview</a>
                      <a href={`/operations/sops/${encodeURIComponent(s.sop_code)}/send`}
                        style={{ ...rowBtn, marginLeft: 6 }}>Send</a>
                      <a href={`/operations/sops/${encodeURIComponent(s.sop_code)}/edit`}
                        style={{ ...rowBtn, marginLeft: 6, background: PRIMARY, color: WHITE, border: '1px solid ' + PRIMARY }}>Edit</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
