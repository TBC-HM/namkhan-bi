// app/cockpit-v2/skills/[id]/page.tsx
//
// Skill detail · what it does, who has it, who used it, errors.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sbCockpit } from '../../_lib/supabase-cockpit';
import { TOKENS, SERIF, MONO } from '../../_components/tokens';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps { params: { id: string } }

export default async function SkillDetailPage({ params }: PageProps) {
  const skillId = Number(params.id);
  if (!skillId) notFound();

  const [{ data: skill }, { data: grants }, { data: calls }] = await Promise.all([
    sbCockpit.from('cap_skills')
      .select('*')
      .eq('id', skillId)
      .maybeSingle(),
    sbCockpit.from('cap_agent_skills')
      .select('role, enabled, created_at')
      .eq('skill_id', skillId),
    sbCockpit.from('cap_skill_calls')
      .select('id, role, status, duration_ms, cost_usd_milli, created_at, error, input, output')
      .eq('skill_id', skillId)
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  if (!skill) notFound();

  const failed = (calls ?? []).filter((c) => c.status === 'error' || c.status === 'failed');
  const okCalls = (calls ?? []).filter((c) => c.status !== 'error' && c.status !== 'failed');

  return (
    <div style={{ color: TOKENS.text }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <Link href="/cockpit-v2/skills" style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, textDecoration: 'none' }}>
          ← Skills
        </Link>
        <h1 style={{ fontFamily: SERIF, fontSize: 26, color: TOKENS.ink, margin: 0, fontWeight: 500 }}>{skill.name}</h1>
        {skill.category && <Pill>{skill.category}</Pill>}
        {skill.authority_level && <Pill color={TOKENS.brass}>{skill.authority_level}</Pill>}
        {skill.requires_pbs_approval && <Pill color="#E07856">approval gated</Pill>}
        {skill.archived_at && <Pill>archived</Pill>}
      </header>

      {skill.description && (
        <p style={{ fontFamily: SERIF, fontSize: 14, color: TOKENS.text, margin: '0 0 18px', lineHeight: 1.55 }}>
          {skill.description}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 18 }}>
        <Stat label="Granted to"     value={(grants ?? []).filter((g) => g.enabled !== false).length} />
        <Stat label="Recent calls"   value={(calls ?? []).length} />
        <Stat label="Errors"         value={failed.length} tone={failed.length > 0 ? '#E07856' : TOKENS.forest} />
        <Stat label="Cost/call (est)" value={skill.estimated_cost_usd_milli != null ? `${skill.estimated_cost_usd_milli}m$` : '—'} />
        <Stat label="Impl. type"      value={skill.implementation_type ?? '—'} />
        <Stat label="Cost class"      value={skill.cost_class ?? '—'} />
      </div>

      <Section title="Handler / implementation">
        <div style={{ padding: 12, background: TOKENS.bgDeep, fontFamily: MONO, fontSize: 11 }}>
          <div style={{ color: TOKENS.text3, marginBottom: 6 }}>handler:</div>
          <code style={{ color: TOKENS.text, wordBreak: 'break-all' }}>{skill.handler ?? '— (none defined)'}</code>
          {skill.error_codes && (
            <>
              <div style={{ color: TOKENS.text3, marginTop: 10, marginBottom: 6 }}>error codes:</div>
              <pre style={{ margin: 0, color: TOKENS.text2, whiteSpace: 'pre-wrap' }}>{JSON.stringify(skill.error_codes, null, 2)}</pre>
            </>
          )}
          {skill.input_schema && (
            <>
              <div style={{ color: TOKENS.text3, marginTop: 10, marginBottom: 6 }}>input schema:</div>
              <pre style={{ margin: 0, color: TOKENS.text2, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>{JSON.stringify(skill.input_schema, null, 2)}</pre>
            </>
          )}
        </div>
      </Section>

      <Section title={`Agents granted (${(grants ?? []).filter((g) => g.enabled !== false).length})`}>
        {(grants ?? []).length === 0 ? (
          <Empty>No agent has this skill. Orphan capability — wasted dev effort.</Empty>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12 }}>
            {(grants ?? []).map((g) => (
              <Link key={g.role} href={`/cockpit-v2/agent/${g.role}`}
                style={{
                  padding: '6px 12px', background: TOKENS.bgRaised,
                  border: `1px solid ${g.enabled === false ? TOKENS.text3 : TOKENS.brass}`,
                  color: g.enabled === false ? TOKENS.text3 : TOKENS.ink,
                  borderRadius: 2, fontFamily: MONO, fontSize: 11, textDecoration: 'none',
                }}>
                {g.role}{g.enabled === false && ' (disabled)'}
              </Link>
            ))}
          </div>
        )}
      </Section>

      {failed.length > 0 && (
        <Section title={`Errors · last ${failed.length}`} tone="bad">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 11 }}>
            <thead>
              <tr style={{ background: TOKENS.bgDeep, borderBottom: `1px solid ${TOKENS.border}` }}>
                <th style={th()}>when</th>
                <th style={th()}>agent</th>
                <th style={th()}>error</th>
              </tr>
            </thead>
            <tbody>
              {failed.slice(0, 10).map((c) => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${TOKENS.borderSoft}` }}>
                  <td style={tdR()}>{new Date(c.created_at).toLocaleString()}</td>
                  <td style={tdR()}>
                    {c.role ? <Link href={`/cockpit-v2/agent/${c.role}`} style={{ color: TOKENS.brass, textDecoration: 'none' }}>{c.role}</Link> : '—'}
                  </td>
                  <td style={{ ...tdR(), color: '#E07856' }}>{typeof c.error === 'string' ? c.error.slice(0, 200) : JSON.stringify(c.error).slice(0, 200)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title={`Recent successful calls (${okCalls.length})`}>
        {okCalls.length === 0 ? <Empty>No successful calls.</Empty> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 11 }}>
            <thead>
              <tr style={{ background: TOKENS.bgDeep, borderBottom: `1px solid ${TOKENS.border}` }}>
                <th style={th()}>when</th>
                <th style={th()}>agent</th>
                <th style={{ ...th(), textAlign: 'right' }}>duration</th>
                <th style={{ ...th(), textAlign: 'right' }}>cost</th>
              </tr>
            </thead>
            <tbody>
              {okCalls.slice(0, 15).map((c) => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${TOKENS.borderSoft}` }}>
                  <td style={tdR()}>{new Date(c.created_at).toLocaleString()}</td>
                  <td style={tdR()}>
                    {c.role ? <Link href={`/cockpit-v2/agent/${c.role}`} style={{ color: TOKENS.brass, textDecoration: 'none' }}>{c.role}</Link> : '—'}
                  </td>
                  <td style={{ ...tdR(), textAlign: 'right' }}>{c.duration_ms ?? '—'}ms</td>
                  <td style={{ ...tdR(), textAlign: 'right' }}>{c.cost_usd_milli != null ? `${c.cost_usd_milli}m$` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color?: string }) {
  const c = color ?? TOKENS.text3;
  return <span style={{
    fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
    color: c, border: `1px solid ${c}`, padding: '1px 6px', borderRadius: 2,
  }}>{children}</span>;
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div style={{ padding: '10px 12px', background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 2 }}>
      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: TOKENS.text3 }}>{label}</div>
      <div style={{ fontFamily: SERIF, fontSize: 18, color: tone ?? TOKENS.ink, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Section({ title, tone, children }: { title: string; tone?: 'bad'; children: React.ReactNode }) {
  const c = tone === 'bad' ? '#E07856' : TOKENS.ink;
  return (
    <section style={{ marginBottom: 18 }}>
      <h2 style={{ fontFamily: SERIF, fontSize: 14, color: c, margin: '0 0 8px', fontWeight: 500 }}>{title}</h2>
      <div style={{ border: `1px solid ${tone === 'bad' ? '#E07856' : TOKENS.border}`, borderRadius: 2, overflow: 'hidden' }}>{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 16, color: TOKENS.text3, fontFamily: MONO, fontSize: 12, fontStyle: 'italic' }}>{children}</div>;
}

function th(): React.CSSProperties {
  return { padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 10,
    letterSpacing: '0.12em', textTransform: 'uppercase', color: TOKENS.text3 };
}
function tdR(): React.CSSProperties {
  return { padding: '6px 12px', color: TOKENS.text, fontVariantNumeric: 'tabular-nums' };
}
