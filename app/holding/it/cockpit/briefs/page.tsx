// app/holding/it/cockpit/briefs/page.tsx
// Bug #83 (real build) — Build Briefs cockpit. Cockpit-native design (TOKENS).
// Index: v_build_briefs_index sorted drafts-first, queue header, status filter.

import React from 'react';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, MONO } from '../_components/tokens';
import BriefActions from './_components/BriefActions';
import { BriefQuestionInline } from './_components/BriefQuestionPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type BriefRow = {
  slug: string; title: string; status: string; version: number;
  assigned_to: string | null; tags: string[] | null;
  last_updated_at: string | null; shipped_at: string | null; md_length: number | null;
  open_question: { question: string; options: { label: string; consequence: string; recommended?: boolean }[]; asked_by?: string } | null;
};

const STATUS_ORDER: Record<string, number> = {
  draft: 0, ready: 1, in_progress: 2, needs_input: 3, shipped: 4, archived: 5,
};

const STATUS_TOKEN: Record<string, string> = {
  draft:       'var(--status-red)',
  ready:       'var(--status-amber)',
  in_progress: 'var(--status-green)',
  shipped:     'var(--status-green)',
  archived:    'var(--status-grey)',
  needs_input: 'var(--status-amber)',
};

export default async function BriefsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFilter = '' } = await searchParams;
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('v_build_briefs_index').select('*');
  const all = (data ?? []) as BriefRow[];

  const counts: Record<string, number> = {};
  for (const r of all) counts[r.status] = (counts[r.status] ?? 0) + 1;

  const filtered = statusFilter
    ? all.filter((b) => b.status === statusFilter)
    : [...all].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));

  const inFlight = (counts['in_progress'] ?? 0) + (counts['ready'] ?? 0);

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1100, color: TOKENS.ink, fontFamily: 'inherit' }}>
      {/* Page headline */}
      <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: TOKENS.ink }}>Build Briefs</div>
          <div style={{ fontSize: 12, color: TOKENS.text2, marginTop: 3 }}>
            Queue — <strong style={{ color: 'var(--status-amber)' }}>{inFlight}</strong> in flight ·{' '}
            <strong style={{ color: 'var(--status-green)' }}>{counts['shipped'] ?? 0}</strong> shipped ·{' '}
            <strong style={{ color: 'var(--status-red)' }}>{counts['draft'] ?? 0}</strong> draft
          </div>
        </div>
        {(counts['needs_input'] ?? 0) > 0 && (
          <a href="/holding/it/cockpit/questions" style={{
            fontSize: 12, fontWeight: 700, padding: '8px 16px', borderRadius: 6, textDecoration: 'none',
            background: 'var(--status-amber)', color: '#1B1B1B',
          }}>
            ❓ Answer questions ({counts['needs_input']})
          </a>
        )}
      </div>

      {/* Status filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['', 'draft', 'ready', 'in_progress', 'shipped', 'archived'] as const).map((s) => (
          <Link
            key={s}
            href={s ? `/holding/it/cockpit/briefs?status=${s}` : '/holding/it/cockpit/briefs'}
            style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 12, textDecoration: 'none',
              background: statusFilter === s ? TOKENS.forest : TOKENS.bg,
              color: statusFilter === s ? '#fff' : TOKENS.text2,
              border: `1px solid ${TOKENS.border}`,
            }}
          >
            {s || 'All'} ({s ? (counts[s] ?? 0) : all.length})
          </Link>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${TOKENS.border}`, background: TOKENS.bg }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: TOKENS.text2, width: '40%' }}>Brief</th>
              <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 500, color: TOKENS.text2 }}>Status</th>
              <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 500, color: TOKENS.text2 }}>v</th>
              <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 500, color: TOKENS.text2 }}>Last edit</th>
              <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 500, color: TOKENS.text2 }}>Tags</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: TOKENS.text2 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <React.Fragment key={b.slug}>
              <tr style={{ borderBottom: b.status === 'needs_input' ? 'none' : `1px solid ${TOKENS.border}` }}>
                <td style={{ padding: '10px 12px' }}>
                  <Link
                    href={`/holding/it/cockpit/briefs/${b.slug}`}
                    style={{ color: TOKENS.forest, textDecoration: 'none', fontWeight: 600, fontSize: 12.5 }}
                  >
                    {b.title}
                  </Link>
                  <div style={{ color: TOKENS.text3, fontSize: 10, marginTop: 2, fontFamily: MONO }}>{b.slug}</div>
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_TOKEN[b.status] ?? 'var(--status-grey)', flexShrink: 0 }} />
                    <span style={{ color: STATUS_TOKEN[b.status] ?? TOKENS.text2, fontSize: 11, fontFamily: MONO }}>{b.status}</span>
                  </span>
                </td>
                <td style={{ padding: '10px 8px', color: TOKENS.text2, fontFamily: MONO }}>v{b.version}</td>
                <td style={{ padding: '10px 8px', color: TOKENS.text2, fontFamily: MONO, whiteSpace: 'nowrap' }}>
                  {b.last_updated_at ? b.last_updated_at.slice(0, 10) : '—'}
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {(b.tags ?? []).slice(0, 2).map((t) => (
                      <span key={t} style={{
                        fontSize: 10, padding: '1px 5px', background: TOKENS.bg,
                        borderRadius: 4, color: TOKENS.text2, border: `1px solid ${TOKENS.border}`,
                      }}>{t}</span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <BriefActions slug={b.slug} currentStatus={b.status} />
                </td>
              </tr>
              {b.status === 'needs_input' && (
                <tr style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
                  <td colSpan={6} style={{ padding: '0 12px 10px', background: TOKENS.bg }}>
                    <BriefQuestionInline slug={b.slug} question={b.open_question} />
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: TOKENS.text2 }}>
                  No briefs{statusFilter ? ` with status "${statusFilter}"` : ''}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
