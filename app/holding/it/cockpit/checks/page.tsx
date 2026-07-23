// app/holding/it/cockpit/checks/page.tsx
//
// Consistency checks — 7 SQL queries surfaced live from
// public.v_cockpit_consistency_checks. Built 2026-05-17 as part of the
// "manager of a multi-tenant agent fleet" cockpit redesign — catches
// broken edges (orphan skills, dead agents, stale prompts, etc.) before
// they bite.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, SERIF, MONO } from '../_components/tokens';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface CheckRow {
  check_id: string;
  description: string;
  entity: string;
  entity_key: string;
}

const CHECK_LABEL: Record<string, string> = {
  agent_with_no_skills: 'Agent with no skills',
  orphan_skill:         'Orphan skill (granted to 0 agents)',
  dead_agent_30d:       'Dead agent (0 invocations in 30d)',
  orphan_memory_rule:   'Orphan memory rule (no matching agent)',
  stale_prompt_60d:     'Stale prompt (unedited 60+ days)',
  stale_ticket_7d:      'Stale ticket (non-terminal 7+ days)',
  recent_build_error:   'Build errored in last 24h',
};

const CHECK_SEVERITY: Record<string, 'critical' | 'warn' | 'info'> = {
  recent_build_error:   'critical',
  agent_with_no_skills: 'critical',
  orphan_skill:         'warn',
  orphan_memory_rule:   'warn',
  stale_ticket_7d:      'warn',
  dead_agent_30d:       'info',
  stale_prompt_60d:     'info',
};

async function fetchChecks(): Promise<CheckRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('v_cockpit_consistency_checks').select('*');
  if (error) {
    console.error('[cockpit-v2/checks] fetch error', error);
    return [];
  }
  return (data as CheckRow[]) ?? [];
}

export default async function ChecksPage() {
  const rows = await fetchChecks();

  // group by check_id
  const grouped = new Map<string, CheckRow[]>();
  for (const r of rows) {
    if (!grouped.has(r.check_id)) grouped.set(r.check_id, []);
    grouped.get(r.check_id)!.push(r);
  }

  // ordered by severity
  const order: Array<{ id: string; sev: 'critical' | 'warn' | 'info' }> = [
    { id: 'recent_build_error',   sev: 'critical' },
    { id: 'agent_with_no_skills', sev: 'critical' },
    { id: 'orphan_skill',         sev: 'warn' },
    { id: 'orphan_memory_rule',   sev: 'warn' },
    { id: 'stale_ticket_7d',      sev: 'warn' },
    { id: 'dead_agent_30d',       sev: 'info' },
    { id: 'stale_prompt_60d',     sev: 'info' },
  ];

  const sevColor: Record<string, string> = {
    critical: '#E07856',
    warn:     TOKENS.brass,
    info:     TOKENS.text3,
  };

  return (
    <div style={{ padding: 24, color: TOKENS.text, background: TOKENS.bg, minHeight: '100vh' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 28, margin: 0, color: TOKENS.ink, fontWeight: 500 }}>
          Consistency checks
        </h1>
        <p style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, marginTop: 6 }}>
          {rows.length} findings · live from <code>public.v_cockpit_consistency_checks</code> · 7 check types
        </p>
      </header>

      <div style={{ display: 'grid', gap: 14 }}>
        {order.map((o) => {
          const list = grouped.get(o.id) ?? [];
          const color = sevColor[o.sev];
          return (
            <section
              key={o.id}
              style={{
                background: TOKENS.bgRaised,
                border: `1px solid ${TOKENS.border}`,
                borderLeft: `3px solid ${color}`,
                padding: '14px 16px',
                borderRadius: 2,
              }}
            >
              <header style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color,
                    fontWeight: 600,
                  }}
                >
                  {o.sev}
                </span>
                <h2 style={{ fontFamily: SERIF, fontSize: 16, margin: 0, color: TOKENS.ink, fontWeight: 500 }}>
                  {CHECK_LABEL[o.id]}
                </h2>
                <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 12, color: TOKENS.text2 }}>
                  {list.length} {list.length === 1 ? 'finding' : 'findings'}
                </span>
              </header>

              {list.length === 0 ? (
                <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, fontStyle: 'italic' }}>
                  ✓ clean
                </div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontFamily: MONO, fontSize: 11 }}>
                  {list.slice(0, 20).map((r, i) => (
                    <li
                      key={i}
                      style={{
                        padding: '4px 0',
                        borderBottom:
                          i < list.length - 1 ? `1px solid ${TOKENS.borderSoft}` : 'none',
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,1fr) 90px',
                        gap: 10,
                      }}
                    >
                      <span style={{ color: TOKENS.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.entity}
                      </span>
                      <span style={{ color: TOKENS.text3, textAlign: 'right' }}>{r.entity_key}</span>
                    </li>
                  ))}
                  {list.length > 20 && (
                    <li style={{ paddingTop: 6, color: TOKENS.text3, fontStyle: 'italic' }}>
                      … and {list.length - 20} more
                    </li>
                  )}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
