'use client';

// app/holding/it/cockpit/docs/DocsView.tsx
//
// Modernized 2026-07-21 (bug #40) — chrome moved to canonical design
// primitives (Container / MetricRow / KpiTile / SubTabStrip typography)
// on paper-white + hairline background. All features preserved:
//   · category-grouped doc tabs (Operating · Architecture · Integrations · Strategy)
//   · every published doc_type from documentation.documents
//   · doc header with version + status pills + last-updated meta
//   · markdown body
//   · knowledge-surfaces map with SQL pointers
//
// Design tokens come from `.cockpit-design` scope: --paper, --ink, --hairline,
// --primary, --ink-soft. Hardcoded #FFFFFF background per token-ladder burn
// rule (var(--paper-warm) resolves dark on Namkhan).

import { useState, useMemo, type CSSProperties } from 'react';
import { Container, MetricRow } from '@/app/(cockpit)/_design';
import { Markdown } from '../_components/Markdown';
import type { Document } from '../_lib/types';

const MONO = 'JetBrains Mono, ui-monospace, monospace';

const DOC_LABELS: Record<string, string> = {
  // operating + discipline
  claude_md:      'CLAUDE.md · Operating manual',
  deployment:     'Deployment Guide',
  security:       'Multi-Tenancy & Security',
  // architecture + design
  architecture:   'ARCHITECTURE.md · Platform architecture',
  data_model:     'Data Model / ERD',
  design_system:  'TBC Design System',
  api:            'API Documentation',
  // integration
  integration:    'Integration State (Mews · Factorial · HR)',
  factorial_md:   'Factorial HR · Integration reference',
  // strategy
  prd:            'Product Requirements (PRD)',
  vision_roadmap: 'Product Vision & Roadmap',
};

// Doc taxonomy — brief documentation-architecture-v2 §5(a). Grouping is
// DB-driven (documents.category); this array fixes order + labels only.
// Every doc_type MUST be classified (A3: zero orphans) — an "Unclassified"
// bucket renders in terracotta if a future doc_type is added without one.
const DOC_CATEGORIES: Array<{ key: string; label: string }> = [
  { key: 'product',      label: 'Product · what it does' },
  { key: 'architecture', label: 'Architecture · how it works' },
  { key: 'operations',   label: 'Operations · how to run it' },
  { key: 'interfaces',   label: 'Interfaces · APIs & contracts' },
  { key: 'governance',   label: 'Governance · rules & security' },
];

// Freshness vs the doc's own review SLA (mirrors public.v_doc_taxonomy):
// fresh (< SLA) · due (1-2× SLA) · overdue (> 2× SLA). Tones follow the
// cockpit freshness-matrix pattern (forest / sand / terracotta).
export function docFreshness(d: { last_updated_at: string | null; review_interval_days: number | null }):
  { key: 'fresh' | 'due' | 'overdue' | 'unknown'; label: string; tone: string } {
  if (!d.last_updated_at || !d.review_interval_days) return { key: 'unknown', label: '—', tone: 'var(--ink-soft, #5A5A5A)' };
  const ageDays = (Date.now() - new Date(d.last_updated_at).getTime()) / 86_400_000;
  const label = `${Math.round(ageDays)}d / SLA ${d.review_interval_days}d`;
  if (ageDays > d.review_interval_days * 2) return { key: 'overdue', label, tone: 'var(--status-red, #B8542A)' };
  if (ageDays > d.review_interval_days)     return { key: 'due',     label, tone: 'var(--sand, #B8A878)' };
  return { key: 'fresh', label, tone: 'var(--primary, #1F3A2E)' };
}

// Surfaces beyond documentation.documents that agents read from.
const KNOWLEDGE_SURFACES: Array<{
  surface: string; what: string; example: string; rows_hint: string;
}> = [
  {
    surface: 'documentation.documents',
    what: '11 doc_types — what you are looking at on this page',
    example: "SELECT doc_type, version, last_updated_at FROM documentation.documents WHERE status='published';",
    rows_hint: '11 active',
  },
  {
    surface: 'public.cockpit_agent_memory',
    what: 'Standing rules + learnings. importance ≥ 9 = broadcast to every agent at session start',
    example: "SELECT id, content, importance, agent_handle FROM cockpit_agent_memory WHERE importance >= 9 ORDER BY id DESC;",
    rows_hint: '217 rules (latest id=344)',
  },
  {
    surface: 'public.cockpit_agent_prompts',
    what: 'Per-agent persona + tool framing. One row per agent role (Felix, Carla, Vera, Sherlock, etc.)',
    example: "SELECT role, version, department, active, length(prompt) FROM cockpit_agent_prompts WHERE active = true ORDER BY role;",
    rows_hint: '96 active',
  },
  {
    surface: 'cockpit.cap_skills',
    what: 'Skill catalog — what an agent can actually invoke (route, permission, trust tier)',
    example: "SELECT name, description, trust_tier FROM cockpit.cap_skills ORDER BY name;",
    rows_hint: '101 skills',
  },
  {
    surface: 'dms.documents',
    what: 'Long-form KB — contracts, audits, case files, agent recovery patches. Pulled on demand.',
    example: "SELECT title, doc_subtype, source, created_at FROM dms.documents WHERE source ILIKE 'claude_%recovery' ORDER BY created_at DESC;",
    rows_hint: 'thousands · filter by source / project / doc_type',
  },
  {
    surface: 'deploy.deployments',
    what: 'Every Vercel deployment — commit, state, prod alias, deployer. Bridges GitHub ↔ Vercel ↔ tickets',
    example: "SELECT vercel_deploy_id, commit_sha, state, deployer FROM public.v_current_prod;  -- what is live RIGHT NOW",
    rows_hint: '14+ · auto-grow via webhook',
  },
];

export function DocsView({ docs }: { docs: Document[] }) {
  const [active, setActive] = useState(docs[0]?.doc_type ?? '');
  const current = useMemo(
    () => docs.find((d) => d.doc_type === active) ?? docs[0] ?? null,
    [docs, active],
  );

  // Group docs by DB-driven taxonomy category (A3: zero orphans expected).
  const grouped = useMemo(() => {
    const result = DOC_CATEGORIES.map((cat) => ({
      ...cat,
      docs: docs.filter((d) => d.category === cat.key),
    }));
    const orphans = docs.filter((d) => !d.category);
    if (orphans.length) {
      result.push({ key: 'unclassified', label: '⚠ Unclassified — assign a category', docs: orphans });
    }
    return result.filter((g) => g.docs.length > 0);
  }, [docs]);

  // Freshness vs each doc's own review SLA (not a flat 30/90d window).
  const stats = useMemo(() => {
    const f = docs.map((d) => docFreshness(d).key);
    return {
      total: docs.length,
      fresh: f.filter((k) => k === 'fresh').length,
      due: f.filter((k) => k === 'due').length,
      overdue: f.filter((k) => k === 'overdue').length,
      orphans: docs.filter((d) => !d.category).length,
    };
  }, [docs]);

  if (!docs.length) {
    return (
      <div className="cockpit-design" style={S.shell}>
        <div style={S.emptyBox}>No published documents.</div>
      </div>
    );
  }

  return (
    <div className="cockpit-design" style={S.shell}>
      {/* Roster of docs — MetricRow strip. */}
      <MetricRow
        size="sm"
        tiles={[
          { label: 'Docs',        value: stats.total,   footnote: 'all doc_types' },
          { label: 'Fresh',       value: stats.fresh,   footnote: 'within review SLA', status: stats.fresh > 0 ? 'green' : 'grey' },
          { label: 'Due',         value: stats.due,     footnote: 'past SLA',          status: stats.due > 0 ? 'amber' : 'green' },
          { label: 'Overdue 2×',  value: stats.overdue, footnote: 'review now',        status: stats.overdue > 0 ? 'red' : 'green' },
          { label: 'Unclassified', value: stats.orphans, footnote: 'A3 target: 0',     status: stats.orphans > 0 ? 'red' : 'green' },
        ]}
      />

      {/* Doc tree — canonical SubTabStrip typography, category-labelled sections. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {grouped.map((cat) => (
          <div key={cat.key}>
            <div style={S.catLabel}>
              {cat.label} <span style={{ opacity: 0.6 }}>· {cat.docs.length}</span>
            </div>
            <nav style={S.subTabStrip} role="tablist" aria-label={cat.label}>
              {cat.docs.map((d) => {
                const isActive = (current?.doc_type ?? '') === d.doc_type;
                const style: CSSProperties = { ...S.subTab, ...(isActive ? S.subTabActive : null) };
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActive(d.doc_type)}
                    style={style}
                  >
                    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                      <span>{DOC_LABELS[d.doc_type] || d.doc_type}</span>
                      <span style={S.subTabMeta}>
                        v{d.version} · {d.owner ?? 'unowned'} ·{' '}
                        <span style={{ color: docFreshness(d).tone, fontWeight: 600 }}>
                          {docFreshness(d).label}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Selected doc body — Container primitive. */}
      {current && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Container
            title={current.title}
            subtitle={`doc_type=${current.doc_type} · ${current.category ?? 'unclassified'} · owner ${current.owner ?? '—'} · review every ${current.review_interval_days ?? '—'}d (${docFreshness(current).key}) · last by ${current.last_updated_by || '—'} · ${current.last_updated_at ? new Date(current.last_updated_at).toLocaleString() : '—'}`}
            action={
              <div style={{ display: 'flex', gap: 6 }}>
                <VersionPill>v{current.version}</VersionPill>
                <StatusPill>{current.status}</StatusPill>
              </div>
            }
          >
            <Markdown source={current.content_md} />
          </Container>
        </div>
      )}

      {/* Knowledge-surfaces map — Container with card grid. */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Knowledge surfaces · where every agent reads from"
          subtitle={`The ${docs.length} docs above live in documentation.documents. Agents also read from ${KNOWLEDGE_SURFACES.length - 1} other surfaces — use these SQL pointers to inspect each.`}
          expandable={false}
        >
          <div style={{ display: 'grid', gap: 10 }}>
            {KNOWLEDGE_SURFACES.map((s) => (
              <div key={s.surface} style={S.surfaceCard}>
                <div style={S.surfaceHead}>
                  <code style={S.surfaceName}>{s.surface}</code>
                  <span style={S.surfaceHint}>· {s.rows_hint}</span>
                </div>
                <div style={S.surfaceWhat}>{s.what}</div>
                <pre style={S.surfaceCode}>{s.example}</pre>
              </div>
            ))}
          </div>
        </Container>
      </div>
    </div>
  );
}

function VersionPill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      fontFamily: MONO,
      color: '#FFFFFF',
      background: 'var(--primary, #1F3A2E)',
      border: '1px solid var(--primary, #1F3A2E)',
    }}>
      {children}
    </span>
  );
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      fontFamily: MONO,
      color: 'var(--ink-soft, #5A5A5A)',
      background: '#F4EFE2',
      border: '1px solid #E6DFCC',
    }}>
      {children}
    </span>
  );
}

const S: Record<string, CSSProperties> = {
  shell: {
    background: '#FFFFFF',
    color: 'var(--ink, #1B1B1B)',
    padding: 16,
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)',
  },
  emptyBox: {
    color: 'var(--ink-soft, #5A5A5A)',
    fontStyle: 'italic',
    padding: 24,
    textAlign: 'center',
    border: '1px dashed #E6DFCC',
    borderRadius: 6,
  },
  catLabel: {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--ink-soft, #5A5A5A)',
    marginBottom: 6,
  },
  // SubTabStrip typography (canonical: 4/8 pad · 12px · gap 8 · 2px underline)
  subTabStrip: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
    borderBottom: '1px solid #E6DFCC',
  },
  subTab: {
    background: 'transparent',
    border: 'none',
    padding: '4px 8px',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--ink-soft, #5A5A5A)',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    fontFamily: 'inherit',
    textAlign: 'left',
    minWidth: 200,
  },
  subTabActive: {
    color: 'var(--ink, #1B1B1B)',
    borderBottomColor: 'var(--primary, #1F3A2E)',
    fontWeight: 600,
  },
  subTabMeta: {
    fontFamily: MONO,
    fontSize: 10,
    opacity: 0.7,
  },
  surfaceCard: {
    border: '1px solid #E6DFCC',
    padding: '10px 12px',
    borderRadius: 4,
    background: '#FBF8EF',
  },
  surfaceHead: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  surfaceName: {
    fontFamily: MONO,
    fontSize: 12,
    color: 'var(--ink, #1B1B1B)',
    fontWeight: 600,
  },
  surfaceHint: {
    fontFamily: MONO,
    fontSize: 10,
    color: 'var(--ink-soft, #5A5A5A)',
  },
  surfaceWhat: {
    fontSize: 13,
    color: 'var(--ink, #1B1B1B)',
    margin: '4px 0 6px',
  },
  surfaceCode: {
    fontFamily: MONO,
    fontSize: 11,
    color: 'var(--ink-soft, #5A5A5A)',
    background: '#FFFFFF',
    padding: '6px 8px',
    borderRadius: 3,
    margin: 0,
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    border: '1px solid #E6DFCC',
  },
};
