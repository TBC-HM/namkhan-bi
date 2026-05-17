'use client';

// app/cockpit-v2/agent/[role]/AgentDebugView.tsx
//
// Inline prompt editor + cross-reference surface. Save button posts to
// /api/cockpit-v2/prompt which version-bumps + writes audit log per #78.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TOKENS, SERIF, MONO } from '../../_components/tokens';

interface Bundle {
  role: string;
  prompt: any;
  agent: any;
  skills: any[];
  memories: any[];
  audit: any[];
  deliveries: any[];
  docRefs: string[];
}

export function AgentDebugView({ bundle }: { bundle: Bundle }) {
  const router = useRouter();
  const [draft, setDraft] = useState<string>(bundle.prompt?.prompt ?? '');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'prompt'|'skills'|'memory'|'audit'|'deliveries'>('prompt');

  const dirty = draft !== (bundle.prompt?.prompt ?? '');

  async function save(dryRun: boolean) {
    setSaving(true); setSavedMsg(null); setErrMsg(null);
    try {
      const res = await fetch('/api/cockpit-v2/prompt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          role: bundle.role,
          prompt: draft,
          dry_run: dryRun,
          notes: `Edited via /cockpit-v2/agent/${bundle.role} debug surface`,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setSavedMsg(dryRun
        ? `Dry run OK · would publish as v${(bundle.prompt?.version ?? 0) + 1}`
        : `Saved v${j.version ?? '?'} · live for all future invocations`);
      if (!dryRun) router.refresh();
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  }

  const a = bundle.agent;
  const p = bundle.prompt;

  return (
    <div style={{ color: TOKENS.text }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <Link href="/cockpit-v2/team" style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, textDecoration: 'none' }}>
          ← Team
        </Link>
        <h1 style={{ fontFamily: SERIF, fontSize: 30, color: TOKENS.ink, margin: 0, fontWeight: 500 }}>
          {a?.display_name ?? bundle.role}
        </h1>
        <span style={{ fontFamily: MONO, fontSize: 12, color: TOKENS.brass }}>{bundle.role}</span>
        {a?.scope && <Pill>{a.scope}</Pill>}
        {a?.dept && <Pill>{a.dept}</Pill>}
        {a?.property_id && <Pill>property {a.property_id}</Pill>}
        {a?.hierarchy_level && <Pill>tier {a.hierarchy_level}</Pill>}
        {p?.version != null && <Pill color={TOKENS.brass}>prompt v{p.version}</Pill>}
        {p?.status && <Pill>{p.status}</Pill>}
      </header>

      {/* Tagline */}
      {a?.tagline && (
        <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 14, color: TOKENS.text2, margin: '0 0 8px' }}>
          {a.tagline}
        </p>
      )}

      {/* Quick links */}
      <div style={{ marginBottom: 18, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href={`/cockpit-v2/agent/${bundle.role}/runs`}
              style={{
                padding: '4px 10px', fontFamily: 'var(--mono, monospace)', fontSize: 11,
                color: TOKENS.brass, border: `1px solid ${TOKENS.brass}`,
                borderRadius: 2, textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
          View runs · feedback →
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {([
          { key: 'prompt',     label: 'Prompt',     n: p?.version ?? null,            tone: dirty ? TOKENS.brass : undefined },
          { key: 'skills',     label: 'Skills',     n: bundle.skills.length,           tone: undefined },
          { key: 'memory',     label: 'Memory',     n: bundle.memories.length,         tone: undefined },
          { key: 'audit',      label: 'Audit log',  n: bundle.audit.length,            tone: undefined },
          { key: 'deliveries', label: 'Deliveries', n: bundle.deliveries.length,       tone: undefined },
        ] as const).map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key as any)}
              style={{
                padding: '6px 14px',
                background: active ? TOKENS.ink : 'transparent',
                color: active ? TOKENS.bg : (t.tone ?? TOKENS.text),
                border: `1px solid ${active ? TOKENS.ink : TOKENS.border}`,
                borderRadius: 2,
                cursor: 'pointer',
                fontFamily: SERIF,
                fontSize: 13,
              }}
            >
              {t.label}{t.n != null && <span style={{ marginLeft: 6, opacity: 0.7 }}>· {t.n}</span>}
              {dirty && t.key === 'prompt' && <span style={{ marginLeft: 6, color: TOKENS.brass }}>●</span>}
            </button>
          );
        })}
      </div>

      {/* ───── PROMPT TAB ───── */}
      {activeTab === 'prompt' && (
        <section>
          {bundle.docRefs.length > 0 && (
            <div style={{ marginBottom: 8, fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
              docs referenced by this prompt:{' '}
              {bundle.docRefs.map((d, i) => (
                <span key={d} style={{ color: TOKENS.brass }}>
                  {i > 0 && ', '}{d}
                </span>
              ))}
            </div>
          )}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%', minHeight: 480,
              padding: 14, borderRadius: 2,
              border: `1px solid ${dirty ? TOKENS.brass : TOKENS.border}`,
              background: TOKENS.bgDeep,
              color: TOKENS.text,
              fontFamily: MONO, fontSize: 12, lineHeight: 1.55,
              resize: 'vertical',
            }}
          />
          <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" disabled={!dirty || saving} onClick={() => save(true)}
              style={btn(dirty, TOKENS.border)}>Dry-run</button>
            <button type="button" disabled={!dirty || saving} onClick={() => save(false)}
              style={btn(dirty, TOKENS.brass)}>Save new version</button>
            {dirty && (
              <button type="button" onClick={() => setDraft(p?.prompt ?? '')}
                style={btn(true, TOKENS.text3)}>Revert</button>
            )}
            <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, marginLeft: 'auto' }}>
              {p?.updated_at ? `last edit ${new Date(p.updated_at).toLocaleString()}` : '—'}
            </span>
          </div>
          {savedMsg && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: TOKENS.bgRaised,
              border: `1px solid ${TOKENS.forest}`, color: TOKENS.forest, fontFamily: MONO, fontSize: 12 }}>
              ✓ {savedMsg}
            </div>
          )}
          {errMsg && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: TOKENS.bgRaised,
              border: `1px solid #E07856`, color: '#E07856', fontFamily: MONO, fontSize: 12 }}>
              ✗ {errMsg}
            </div>
          )}
        </section>
      )}

      {/* ───── SKILLS TAB ───── */}
      {activeTab === 'skills' && (
        <section>
          {bundle.skills.length === 0 ? (
            <Empty msg="No skills granted. Agent cannot invoke any tool." tone="warn" />
          ) : (
            <Tbl headers={['name','category','authority','approval?','cost/call','active']}
                 rows={bundle.skills.map((s) => [
                   s.name,
                   s.category ?? '—',
                   s.authority_level ?? '—',
                   s.requires_pbs_approval ? 'yes' : 'no',
                   s.estimated_cost_usd_milli != null ? `${s.estimated_cost_usd_milli}m$` : '—',
                   s.enabled === false ? 'disabled' : (s.active === false ? 'archived' : 'on'),
                 ])} />
          )}
        </section>
      )}

      {/* ───── MEMORY TAB ───── */}
      {activeTab === 'memory' && (
        <section>
          {bundle.memories.length === 0 ? (
            <Empty msg="No memory rules target this agent (and no 'all' broadcasts either)." tone="warn" />
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {bundle.memories.map((m) => (
                <li key={m.id} style={{
                  padding: '10px 12px',
                  border: `1px solid ${TOKENS.border}`,
                  borderLeft: `3px solid ${m.importance >= 10 ? '#E07856' : (m.importance >= 9 ? TOKENS.brass : TOKENS.border)}`,
                  background: TOKENS.bgRaised, borderRadius: 2, marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 4, alignItems: 'baseline' }}>
                    <Pill color={m.importance >= 10 ? '#E07856' : TOKENS.brass}>imp {m.importance}</Pill>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
                      handle={m.agent_handle} · {m.memory_type} · #{m.id} · {new Date(m.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: TOKENS.text, lineHeight: 1.5 }}>
                    {m.content}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ───── AUDIT LOG TAB ───── */}
      {activeTab === 'audit' && (
        <section>
          {bundle.audit.length === 0 ? (
            <Empty msg="Zero invocations recorded. Either dead agent, or audit_log.agent ≠ this role string." tone="warn" />
          ) : (
            <Tbl headers={['when','action','target','ok','tokens in/out','cost','dur ms']}
                 rows={bundle.audit.map((a: any) => [
                   new Date(a.created_at).toLocaleString(),
                   a.action ?? '—', a.target ?? '—',
                   a.success ? '✓' : '✗',
                   `${a.input_tokens ?? 0}/${a.output_tokens ?? 0}`,
                   a.cost_usd_milli != null ? `${a.cost_usd_milli}m$` : '—',
                   a.duration_ms ?? '—',
                 ])} />
          )}
        </section>
      )}

      {/* ───── DELIVERIES TAB ───── */}
      {activeTab === 'deliveries' && (
        <section>
          {bundle.deliveries.length === 0 ? (
            <Empty msg="No cockpit_tickets mention this role in the subject." tone="info" />
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {bundle.deliveries.map((d) => (
                <li key={d.id} style={{
                  padding: '10px 12px', border: `1px solid ${TOKENS.border}`,
                  background: TOKENS.bgRaised, borderRadius: 2, marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <Pill>{d.status}</Pill>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
                      #{d.id} · {d.source}/{d.arm}/{d.intent} · {new Date(d.created_at).toLocaleDateString()}
                    </span>
                    {d.pr_url && (
                      <a href={d.pr_url} target="_blank" rel="noreferrer"
                         style={{ marginLeft: 'auto', color: TOKENS.brass, fontFamily: MONO, fontSize: 11 }}>
                        PR ↗
                      </a>
                    )}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, color: TOKENS.text, whiteSpace: 'pre-wrap' }}>
                    {d.email_subject}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color?: string }) {
  const c = color ?? TOKENS.text3;
  return (
    <span style={{
      fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: c, border: `1px solid ${c}`, padding: '1px 6px', borderRadius: 2, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

function Empty({ msg, tone }: { msg: string; tone: 'warn'|'info' }) {
  const c = tone === 'warn' ? TOKENS.brass : TOKENS.text3;
  return (
    <div style={{
      padding: '16px 20px', border: `1px dashed ${c}`, color: c,
      fontFamily: MONO, fontSize: 12, borderRadius: 2,
    }}>{msg}</div>
  );
}

function Tbl({ headers, rows }: { headers: string[]; rows: (string|number)[][] }) {
  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${TOKENS.border}`, borderRadius: 2 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 11 }}>
        <thead>
          <tr style={{ background: TOKENS.bgRaised, borderBottom: `1px solid ${TOKENS.border}` }}>
            {headers.map((h) => (
              <th key={h} style={{
                padding: '8px 12px', textAlign: 'left', color: TOKENS.text3,
                fontWeight: 600, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${TOKENS.borderSoft}` }}>
              {row.map((c, j) => (
                <td key={j} style={{ padding: '6px 12px', color: TOKENS.text, fontVariantNumeric: 'tabular-nums' }}>
                  {c as any}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function btn(enabled: boolean, color: string): React.CSSProperties {
  return {
    padding: '8px 14px', borderRadius: 2,
    background: enabled ? color : 'transparent',
    color: enabled ? TOKENS.bg : color,
    border: `1px solid ${color}`,
    fontFamily: SERIF, fontSize: 13,
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.5,
  };
}
