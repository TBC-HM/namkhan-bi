'use client';

// app/cockpit-v2/docs/DocsView.tsx
//
// PBS 2026-05-17: opened from 3 hardcoded docs to ALL 11 published doc_types,
// grouped by category. Also surfaces the 5 OTHER knowledge surfaces below the
// docs panel — so PBS or any agent can navigate every place "knowledge" lives.

import { useState, useMemo } from 'react';
import { TOKENS, SERIF, MONO } from '../_components/tokens';
import { Pill } from '../_components/Pill';
import { Markdown } from '../_components/Markdown';
import type { Document } from '../_lib/types';

const DOC_LABELS: Record<string, string> = {
  // operating + discipline
  claude_md:     'CLAUDE.md · Operating manual',
  deployment:    'Deployment Guide',
  security:      'Multi-Tenancy & Security',
  // architecture + design
  architecture:  'ARCHITECTURE.md · Platform architecture',
  data_model:    'Data Model / ERD',
  design_system: 'TBC Design System',
  api:           'API Documentation',
  // integration
  integration:   'Integration State (Mews · Factorial · HR)',
  factorial_md:  'Factorial HR · Integration reference',
  // strategy
  prd:           'Product Requirements (PRD)',
  vision_roadmap:'Product Vision & Roadmap',
};

const DOC_CATEGORIES: Array<{ key: string; label: string; types: string[] }> = [
  { key: 'op',     label: 'Operating & discipline',     types: ['claude_md', 'deployment', 'security'] },
  { key: 'arch',   label: 'Architecture & design',      types: ['architecture', 'data_model', 'design_system', 'api'] },
  { key: 'integ',  label: 'Integrations',               types: ['integration', 'factorial_md'] },
  { key: 'strat',  label: 'Strategy',                   types: ['prd', 'vision_roadmap'] },
];

// Surfaces beyond documentation.documents that agents read from. Not a code
// dependency — purely a navigation guide for PBS.
const KNOWLEDGE_SURFACES: Array<{ surface: string; what: string; example: string; rows_hint: string }> = [
  {
    surface: 'documentation.documents',
    what:    '11 doc_types — what you are looking at on this page',
    example: "SELECT doc_type, version, last_updated_at FROM documentation.documents WHERE status='published';",
    rows_hint: '11 active',
  },
  {
    surface: 'public.cockpit_agent_memory',
    what:    'Standing rules + learnings. importance ≥ 9 = broadcast to every agent at session start',
    example: "SELECT id, content, importance, agent_handle FROM cockpit_agent_memory WHERE importance >= 9 ORDER BY id DESC;",
    rows_hint: '217 rules (latest id=344)',
  },
  {
    surface: 'public.cockpit_agent_prompts',
    what:    'Per-agent persona + tool framing. One row per agent role (Felix, Carla, Vera, Sherlock, etc.)',
    example: "SELECT role, version, department, active, length(prompt) FROM cockpit_agent_prompts WHERE active = true ORDER BY role;",
    rows_hint: '96 active',
  },
  {
    surface: 'cockpit.cap_skills',
    what:    'Skill catalog — what an agent can actually invoke (route, permission, trust tier)',
    example: "SELECT name, description, trust_tier FROM cockpit.cap_skills ORDER BY name;",
    rows_hint: '101 skills',
  },
  {
    surface: 'dms.documents',
    what:    'Long-form KB — contracts, audits, case files, agent recovery patches. Pulled on demand.',
    example: "SELECT title, doc_subtype, source, created_at FROM dms.documents WHERE source ILIKE 'claude_%recovery' ORDER BY created_at DESC;",
    rows_hint: 'thousands · filter by source / project / doc_type',
  },
  {
    surface: 'deploy.deployments (NEW 2026-05-17)',
    what:    'Every Vercel deployment — commit, state, prod alias, deployer. Bridges GitHub ↔ Vercel ↔ tickets',
    example: "SELECT vercel_deploy_id, commit_sha, state, deployer FROM public.v_current_prod;  -- what is live RIGHT NOW",
    rows_hint: '14 backfilled · auto-grow via webhook (TODO)',
  },
];

export function DocsView({ docs }: { docs: Document[] }) {
  const [active, setActive] = useState(docs[0]?.doc_type ?? '');
  const current = useMemo(
    () => docs.find((d) => d.doc_type === active) ?? docs[0] ?? null,
    [docs, active]
  );

  // Group docs by category for the tree-view
  const grouped = useMemo(() => {
    const byType = new Map(docs.map((d) => [d.doc_type, d] as const));
    const usedTypes = new Set<string>();
    const result = DOC_CATEGORIES.map((cat) => ({
      ...cat,
      docs: cat.types.map((t) => byType.get(t)).filter(Boolean) as Document[],
    }));
    DOC_CATEGORIES.forEach((cat) => cat.types.forEach((t) => usedTypes.add(t)));
    // Any extra doc_types not in our category map → "Other"
    const orphans = docs.filter((d) => !usedTypes.has(d.doc_type));
    if (orphans.length) {
      result.push({ key: 'other', label: 'Other', types: orphans.map((d) => d.doc_type), docs: orphans });
    }
    return result.filter((g) => g.docs.length > 0);
  }, [docs]);

  if (!docs.length)
    return <div style={{ color: TOKENS.text3, fontStyle: 'italic' }}>No published documents.</div>;

  return (
    <div>
      {/* Doc tree — grouped tabs by category */}
      <div style={{ marginBottom: 18 }}>
        {grouped.map((cat) => (
          <div key={cat.key} style={{ marginBottom: 10 }}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: TOKENS.text3,
                marginBottom: 6,
              }}
            >
              {cat.label} · {cat.docs.length}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {cat.docs.map((d) => {
                const isActive = (current?.doc_type ?? '') === d.doc_type;
                return (
                  <button
                    key={d.id}
                    onClick={() => setActive(d.doc_type)}
                    style={{
                      padding: '8px 12px',
                      border: `1px solid ${isActive ? TOKENS.ink : TOKENS.border}`,
                      background: isActive ? TOKENS.ink : 'transparent',
                      color: isActive ? TOKENS.bg : TOKENS.text,
                      cursor: 'pointer',
                      fontFamily: SERIF,
                      fontSize: 13,
                      borderRadius: 2,
                      textAlign: 'left',
                      minWidth: 200,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{DOC_LABELS[d.doc_type] || d.doc_type}</div>
                    <div style={{ fontFamily: MONO, fontSize: 10, opacity: 0.75, marginTop: 2 }}>
                      v{d.version} ·{' '}
                      {d.last_updated_at ? new Date(d.last_updated_at).toLocaleDateString() : '—'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Selected doc body */}
      {current && (
        <article
          style={{
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.bgRaised,
            padding: 24,
            borderRadius: 2,
            marginBottom: 24,
          }}
        >
          <header
            style={{
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: `1px solid ${TOKENS.borderSoft}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <h2
                style={{
                  fontFamily: SERIF,
                  fontSize: 26,
                  color: TOKENS.ink,
                  margin: 0,
                  fontWeight: 500,
                }}
              >
                {current.title}
              </h2>
              <Pill color={TOKENS.brass}>v{current.version}</Pill>
              <Pill>{current.status}</Pill>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, marginTop: 6 }}>
              doc_type={current.doc_type} · last_updated_by={current.last_updated_by || '—'} ·{' '}
              {current.last_updated_at ? new Date(current.last_updated_at).toLocaleString() : '—'} ·
              live read from documentation.documents
            </div>
          </header>
          <Markdown source={current.content_md} />
        </article>
      )}

      {/* Knowledge-surfaces map — where agents read from beyond this page */}
      <section
        style={{
          border: `1px solid ${TOKENS.border}`,
          background: TOKENS.bgRaised,
          padding: 20,
          borderRadius: 2,
        }}
      >
        <h3
          style={{
            fontFamily: SERIF,
            fontSize: 18,
            color: TOKENS.ink,
            margin: '0 0 6px',
            fontWeight: 500,
          }}
        >
          Knowledge surfaces · where every agent reads from
        </h3>
        <p
          style={{
            fontFamily: MONO,
            fontSize: 11,
            color: TOKENS.text3,
            margin: '0 0 16px',
            lineHeight: 1.5,
          }}
        >
          The {docs.length} docs above live in <code>documentation.documents</code>. Agents also
          read from 5 other surfaces. Use these SQL pointers to inspect each.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          {KNOWLEDGE_SURFACES.map((s) => (
            <div
              key={s.surface}
              style={{
                border: `1px solid ${TOKENS.borderSoft}`,
                padding: '10px 12px',
                borderRadius: 2,
                background: TOKENS.bg,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <code style={{ fontFamily: MONO, fontSize: 12, color: TOKENS.ink, fontWeight: 600 }}>
                  {s.surface}
                </code>
                <span style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.text3 }}>
                  · {s.rows_hint}
                </span>
              </div>
              <div
                style={{ fontFamily: SERIF, fontSize: 13, color: TOKENS.text, margin: '4px 0 6px' }}
              >
                {s.what}
              </div>
              <pre
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  color: TOKENS.text3,
                  background: TOKENS.bgRaised,
                  padding: '6px 8px',
                  borderRadius: 2,
                  margin: 0,
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {s.example}
              </pre>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
