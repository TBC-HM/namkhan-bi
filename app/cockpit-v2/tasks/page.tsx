// app/cockpit-v2/tasks/page.tsx
// Tasks list — V1 cockpit feature ported into V2 (#58).
// Server-rendered. Reads every row of cockpit_tickets, filtered by ?status.
// SLA countdown uses metadata.due_at if present, else +48h from created_at.
//
// Author: IT-team agent · 2026-05-13 · #58.

import Link from 'next/link';
import { fetchTickets } from '../_lib/data-port';
import { TOKENS, SERIF, MONO } from '../_components/tokens';
import { TicketActions } from './TicketActions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SLA_HOURS = 48;
const TERMINAL = new Set(['completed', 'archived', 'triage_failed', 'done']);

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

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function fmtHrs(hours: number): string {
  if (Math.abs(hours) < 1) return `${Math.round(hours * 60)}m`;
  if (Math.abs(hours) < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

type DueTone = 'good' | 'warn' | 'bad' | 'muted';
function dueState(t: {
  status: string;
  closed_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}): { label: string; tone: DueTone } {
  if (TERMINAL.has(t.status)) {
    return {
      label: t.closed_at ? `closed ${relTime(t.closed_at)} ago` : 'closed',
      tone: 'muted',
    };
  }
  const meta = t.metadata ?? {};
  const dueIso =
    (meta.due_at as string | undefined) ??
    new Date(new Date(t.created_at).getTime() + SLA_HOURS * 3600 * 1000).toISOString();
  const remainingHrs = (new Date(dueIso).getTime() - Date.now()) / 3600 / 1000;
  if (remainingHrs >= 0) {
    return {
      label: `due in ${fmtHrs(remainingHrs)}`,
      tone: remainingHrs < 6 ? 'warn' : 'good',
    };
  }
  return { label: `overdue ${fmtHrs(-remainingHrs)}`, tone: 'bad' };
}

const TONE_BG: Record<DueTone, string> = {
  good: 'rgba(122,155,106,0.18)',
  warn: 'rgba(196,160,107,0.20)',
  bad: 'rgba(184,95,78,0.22)',
  muted: 'rgba(233,225,206,0.06)',
};
const TONE_FG: Record<DueTone, string> = {
  good: TOKENS.moss,
  warn: TOKENS.ochre,
  bad: TOKENS.terracotta,
  muted: TOKENS.text3,
};

export default async function CockpitV2TasksPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const filter = searchParams?.status ?? 'all';
  const { tickets, countByStatus } = await fetchTickets(filter);
  const total = Object.values(countByStatus).reduce((a, b) => a + b, 0);

  return (
    <div style={{ color: TOKENS.ink, fontFamily: 'var(--sans)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 18,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <h2 style={{ fontFamily: SERIF, fontSize: 22, margin: 0 }}>Tasks</h2>
        <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
          every ticket — SLA {SLA_HOURS}h from creation unless metadata.due_at overrides
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 18,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <FilterChip href="/cockpit-v2/tasks" active={filter === 'all'} label="All" count={total} />
        {Object.entries(countByStatus)
          .sort((a, b) => b[1] - a[1])
          .map(([s, n]) => (
            <FilterChip
              key={s}
              href={`/cockpit-v2/tasks?status=${encodeURIComponent(s)}`}
              active={filter === s}
              label={s}
              count={n}
            />
          ))}
      </div>

      {tickets.length === 0 ? (
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
          No tickets match the current filter.
        </div>
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
          {tickets.map((t) => {
            const tone = STATUS_TONE[t.status] ?? {
              fg: TOKENS.text2,
              bg: 'rgba(233,225,206,0.08)',
            };
            const due = dueState(t);
            const summary = (t.parsed_summary ?? t.email_subject ?? '—').trim();
            return (
              <li
                key={t.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '70px 110px 130px 1fr 70px 140px',
                  gap: 14,
                  padding: '10px 16px',
                  borderBottom: `1px solid ${TOKENS.borderSoft}`,
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    color: TOKENS.text3,
                  }}
                >
                  #{t.id}
                </span>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 2,
                    background: tone.bg,
                    color: tone.fg,
                    fontSize: 10,
                    fontFamily: MONO,
                    letterSpacing: 0.4,
                    fontWeight: 600,
                    textAlign: 'center',
                  }}
                >
                  {t.status}
                </span>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 2,
                    background: TONE_BG[due.tone],
                    color: TONE_FG[due.tone],
                    fontFamily: MONO,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    textAlign: 'center',
                  }}
                >
                  {due.label}
                </span>
                <Link
                  href={`/cockpit-v2/tasks/${t.id}`}
                  style={{
                    color: TOKENS.ink,
                    textDecoration: 'none',
                    fontSize: 13,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={summary}
                >
                  {summary.replace(/\n/g, ' · ').slice(0, 220) || '—'}
                </Link>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    color: TOKENS.text3,
                    textAlign: 'right',
                  }}
                >
                  {relTime(t.updated_at)} ago
                </span>
                <TicketActions id={t.id} status={t.status} />
              </li>
            );
          })}
        </ol>
      )}

      <footer
        style={{
          marginTop: 24,
          fontFamily: MONO,
          fontSize: 11,
          color: TOKENS.text3,
          textAlign: 'center',
        }}
      >
        showing {tickets.length} of {total} tickets
      </footer>
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  const tone = STATUS_TONE[label] ?? { fg: TOKENS.sand, bg: TOKENS.bgDeep };
  return (
    <Link
      href={href}
      style={{
        padding: '5px 12px',
        borderRadius: 2,
        border: `1px solid ${active ? tone.fg : TOKENS.borderSoft}`,
        background: active ? tone.bg : 'transparent',
        color: active ? tone.fg : TOKENS.text3,
        fontFamily: MONO,
        fontSize: 11,
        letterSpacing: 0.5,
        textDecoration: 'none',
      }}
    >
      {label} · {count}
    </Link>
  );
}
