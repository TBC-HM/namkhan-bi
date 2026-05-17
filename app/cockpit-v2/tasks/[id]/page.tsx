// app/cockpit-v2/tasks/[id]/page.tsx
// Ticket detail — V2 port. Reads cockpit_tickets row + cockpit_audit_log
// entries for the ticket. Shows summary, original email, metadata, links,
// audit trail.
//
// Author: IT-team agent · 2026-05-13 · #58.

import Link from 'next/link';
import { fetchTicket } from '../../_lib/data-port';
import { TOKENS, SERIF, MONO } from '../../_components/tokens';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATUS_TONE: Record<string, { fg: string; bg: string }> = {
  new: { fg: TOKENS.sand, bg: 'rgba(191,169,128,0.14)' },
  triaging: { fg: TOKENS.sand, bg: 'rgba(191,169,128,0.14)' },
  triaged: { fg: TOKENS.sky, bg: 'rgba(154,136,102,0.18)' },
  working: { fg: TOKENS.ochre, bg: 'rgba(196,160,107,0.18)' },
  awaits_user: { fg: TOKENS.terracotta, bg: 'rgba(184,95,78,0.16)' },
  open: { fg: TOKENS.terracotta, bg: 'rgba(184,95,78,0.16)' },
  completed: { fg: TOKENS.moss, bg: 'rgba(122,155,106,0.14)' },
  done: { fg: TOKENS.moss, bg: 'rgba(122,155,106,0.14)' },
  triage_failed: { fg: TOKENS.oxblood, bg: 'rgba(142,58,53,0.18)' },
  blocked: { fg: TOKENS.oxblood, bg: 'rgba(142,58,53,0.18)' },
  archived: { fg: TOKENS.text3, bg: 'rgba(233,225,206,0.05)' },
};

function rel(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function CockpitV2TicketPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return <div style={{ padding: 24, color: TOKENS.ink }}>Invalid ticket id</div>;
  }
  const { ticket: t, audit } = await fetchTicket(id);
  if (!t) {
    return (
      <div style={{ color: TOKENS.ink, fontFamily: 'var(--sans)' }}>
        <Link href="/cockpit-v2/tasks" style={{ color: TOKENS.ochre, fontSize: 13 }}>
          ← All tasks
        </Link>
        <h2 style={{ fontFamily: SERIF, fontSize: 22, marginTop: 16 }}>
          Ticket #{id}
        </h2>
        <div style={{ marginTop: 16, color: TOKENS.text2, fontSize: 13 }}>
          Not found.
        </div>
      </div>
    );
  }

  const meta = (t.metadata ?? {}) as Record<string, unknown>;
  const evidence = meta.evidence as Record<string, unknown> | undefined;
  const prUrl =
    t.pr_url || (evidence?.pr_url as string) || (meta.pr_url as string) || null;
  const previewUrl =
    t.preview_url || (evidence?.preview_url as string) || null;
  const parentTicket = meta.parent_ticket as number | undefined;
  const children = (meta.sliced_into_children_v2 ?? meta.sliced_into_children) as
    | number[]
    | undefined;
  const tone = STATUS_TONE[t.status] ?? {
    fg: TOKENS.text2,
    bg: 'rgba(233,225,206,0.08)',
  };

  return (
    <div
      style={{
        color: TOKENS.ink,
        fontFamily: 'var(--sans)',
        maxWidth: 1100,
      }}
    >
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <Link
          href="/cockpit-v2/tasks"
          style={{ color: TOKENS.ochre, fontSize: 13, textDecoration: 'none' }}
        >
          ← All tasks
        </Link>
        {parentTicket && (
          <Link
            href={`/cockpit-v2/tasks/${parentTicket}`}
            style={{ color: TOKENS.ochre, fontSize: 13, textDecoration: 'none' }}
          >
            ↑ Parent #{parentTicket}
          </Link>
        )}
      </div>

      <header
        style={{
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: `1px solid ${TOKENS.border}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 8,
          }}
        >
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 2,
              background: tone.bg,
              color: tone.fg,
              fontSize: 11,
              fontFamily: MONO,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            {t.status}
          </span>
          <h2 style={{ fontFamily: SERIF, fontSize: 24, margin: 0 }}>
            Ticket #{t.id}
          </h2>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
          source <span style={{ color: TOKENS.text2 }}>{t.source ?? '—'}</span>
          {' · '}arm <span style={{ color: TOKENS.text2 }}>{t.arm ?? '—'}</span>
          {' · '}intent <span style={{ color: TOKENS.text2 }}>{t.intent ?? '—'}</span>
          {' · created '}{rel(t.created_at)}
          {' · updated '}{rel(t.updated_at)}
          {t.iterations !== null && <> · {t.iterations} iter</>}
        </div>
      </header>

      {(prUrl || previewUrl || t.github_issue_url) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {prUrl && (
            <a
              href={prUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={linkBtn(TOKENS.moss)}
            >
              → PR ↗
            </a>
          )}
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={linkBtn(TOKENS.ochre)}
            >
              → Preview ↗
            </a>
          )}
          {t.github_issue_url && (
            <a
              href={t.github_issue_url}
              target="_blank"
              rel="noopener noreferrer"
              style={linkBtn(TOKENS.sand)}
            >
              → GitHub issue ↗
            </a>
          )}
        </div>
      )}

      {Array.isArray(children) && children.length > 0 && (
        <Section title={`Children (${children.length})`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {children.map((c) => (
              <Link
                key={c}
                href={`/cockpit-v2/tasks/${c}`}
                style={{
                  padding: '4px 10px',
                  background: TOKENS.bgDeep,
                  color: TOKENS.ochre,
                  borderRadius: 2,
                  fontFamily: MONO,
                  fontSize: 11,
                  textDecoration: 'none',
                  border: `1px solid ${TOKENS.borderSoft}`,
                }}
              >
                #{c}
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section title="Summary">
        <pre
          style={{
            background: TOKENS.bgRaised,
            border: `1px solid ${TOKENS.border}`,
            padding: 16,
            borderRadius: 2,
            fontSize: 13,
            lineHeight: 1.55,
            color: TOKENS.ink,
            whiteSpace: 'pre-wrap',
            overflow: 'auto',
            maxHeight: 500,
            fontFamily: 'var(--sans)',
            margin: 0,
          }}
        >
          {t.parsed_summary ?? '—'}
        </pre>
      </Section>

      {(t.email_subject || t.email_body) && (
        <Section title="Original email">
          {t.email_subject && (
            <div
              style={{
                color: TOKENS.sand,
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              {t.email_subject}
            </div>
          )}
          {t.email_body && (
            <pre
              style={{
                background: TOKENS.bgDeep,
                border: `1px solid ${TOKENS.borderSoft}`,
                padding: 12,
                borderRadius: 2,
                fontFamily: 'var(--sans)',
                fontSize: 12,
                color: TOKENS.text2,
                whiteSpace: 'pre-wrap',
                maxHeight: 360,
                overflowY: 'auto',
                margin: 0,
              }}
            >
              {t.email_body}
            </pre>
          )}
        </Section>
      )}

      {t.notes && (
        <Section title="Notes">
          <div
            style={{
              color: TOKENS.text2,
              fontSize: 12,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {t.notes}
          </div>
        </Section>
      )}

      <Section title={`Audit log (${audit.length})`}>
        {audit.length === 0 ? (
          <div style={{ color: TOKENS.text3, fontSize: 12 }}>—</div>
        ) : (
          <ol
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              border: `1px solid ${TOKENS.border}`,
              background: TOKENS.bgRaised,
              borderRadius: 2,
            }}
          >
            {audit.map((a, i) => {
              const am = (a.metadata ?? {}) as Record<string, unknown>;
              const url = (am.html_url as string) ?? (am.pr_url as string) ?? null;
              return (
                <li
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 120px 130px 1fr',
                    gap: 12,
                    padding: '8px 14px',
                    borderBottom: `1px solid ${TOKENS.borderSoft}`,
                    alignItems: 'baseline',
                  }}
                >
                  <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
                    {rel(a.created_at)}
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 12,
                      color: a.success === false ? TOKENS.oxblood : TOKENS.moss,
                      fontWeight: 600,
                    }}
                  >
                    {a.agent ?? '—'}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text2 }}>
                    {a.action ?? '—'}
                  </span>
                  <span style={{ fontSize: 12, color: TOKENS.ink }}>
                    {(a.reasoning ?? '').slice(0, 240) || '—'}
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ marginLeft: 6, color: TOKENS.ochre }}
                      >
                        ↗
                      </a>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      <Section title="Metadata">
        <pre
          style={{
            background: TOKENS.bgDeep,
            border: `1px solid ${TOKENS.borderSoft}`,
            padding: 12,
            borderRadius: 2,
            fontFamily: MONO,
            fontSize: 11,
            color: TOKENS.text2,
            overflow: 'auto',
            maxHeight: 280,
            margin: 0,
          }}
        >
          {JSON.stringify(meta, null, 2)}
        </pre>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h3
        style={{
          fontFamily: MONO,
          fontSize: 10,
          color: TOKENS.text3,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          margin: '0 0 8px',
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function linkBtn(color: string): React.CSSProperties {
  return {
    padding: '5px 12px',
    borderRadius: 2,
    border: `1px solid ${color}`,
    background: 'transparent',
    color,
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.5,
    textDecoration: 'none',
    fontWeight: 600,
  };
}
