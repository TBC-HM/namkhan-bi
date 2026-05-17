'use client';

// app/cockpit-v2/deploys/DeploysView.tsx
// Lists recent Vercel deploys for namkhan-bi + namkhan-bi-staging via
// /api/cockpit/deployments (already deployed). Also runs HEAD smoke checks
// against a small set of cockpit-v2 routes so PBS can see at a glance which
// routes are alive.
//
// Author: IT-team agent · 2026-05-13 · #58.

import { useEffect, useState } from 'react';
import { TOKENS, SERIF, MONO } from '../_components/tokens';

type Deploy = {
  uid: string;
  state: string;
  created_at: string;
  sha: string;
  ref: string;
  message: string;
  url: string | null;
  source: 'vercel' | 'audit_log';
};

type DeployPayload = Record<
  string,
  | { deploys: Deploy[]; source: string; vercel_note?: string }
  | string
  | undefined
> & { fetched_at?: string };

const SMOKE_ROUTES = [
  '/cockpit-v2/team',
  '/cockpit-v2/tasks',
  '/cockpit-v2/chat',
  '/cockpit-v2/notify',
  '/cockpit-v2/users',
  '/cockpit-v2/health',
  '/cockpit-v2/deploys',
  '/cockpit-v2/cost',
];

function ageMin(iso: string | null): string {
  if (!iso) return '—';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}

function stateColor(state: string): string {
  if (state === 'READY' || state === 'ready' || state === 'succeeded')
    return TOKENS.moss;
  if (state === 'BUILDING' || state === 'QUEUED' || state === 'INITIALIZING')
    return TOKENS.ochre;
  if (state === 'ERROR' || state === 'CANCELED') return TOKENS.oxblood;
  return TOKENS.text2;
}

export function DeploysView() {
  const [payload, setPayload] = useState<DeployPayload | null>(null);
  const [pending, setPending] = useState(true);
  const [smoke, setSmoke] = useState<Record<string, number | 'err'>>({});
  const [refreshedAt, setRefreshedAt] = useState<number>(Date.now());

  async function loadDeploys() {
    try {
      setPending(true);
      const res = await fetch('/api/cockpit/deployments', { cache: 'no-store' });
      if (res.ok) {
        const j = (await res.json()) as DeployPayload;
        setPayload(j);
        setRefreshedAt(Date.now());
      }
    } finally {
      setPending(false);
    }
  }

  async function runSmoke() {
    const out: Record<string, number | 'err'> = {};
    await Promise.all(
      SMOKE_ROUTES.map(async (r) => {
        try {
          const res = await fetch(r, { method: 'HEAD', cache: 'no-store' });
          out[r] = res.status;
        } catch {
          out[r] = 'err';
        }
      }),
    );
    setSmoke(out);
  }

  useEffect(() => {
    loadDeploys();
    runSmoke();
    const id = window.setInterval(loadDeploys, 60_000);
    const id2 = window.setInterval(runSmoke, 60_000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(id2);
    };
  }, []);

  const sections: Array<{ slug: string; deploys: Deploy[]; note?: string }> = [];
  if (payload) {
    for (const slug of ['namkhan-bi', 'namkhan-bi-staging']) {
      const entry = payload[slug];
      if (entry && typeof entry === 'object' && 'deploys' in entry) {
        sections.push({
          slug,
          deploys: entry.deploys ?? [],
          note: entry.vercel_note,
        });
      }
    }
  }

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
        <h2 style={{ fontFamily: SERIF, fontSize: 22, margin: 0 }}>Deploys</h2>
        <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
          {payload ? (
            <>refreshed {ageMin(new Date(refreshedAt).toISOString())}</>
          ) : (
            'loading…'
          )}
          {pending && (
            <span style={{ marginLeft: 6, color: TOKENS.sand }}>
              · fetching
            </span>
          )}
        </div>
      </div>

      {/* Smoke checks */}
      <section
        style={{
          marginBottom: 22,
          border: `1px solid ${TOKENS.border}`,
          background: TOKENS.bgRaised,
          borderRadius: 2,
        }}
      >
        <div
          style={{
            padding: '8px 12px',
            borderBottom: `1px solid ${TOKENS.border}`,
            fontFamily: MONO,
            fontSize: 10,
            color: TOKENS.text3,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          Live route smoke (HEAD)
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 0,
          }}
        >
          {SMOKE_ROUTES.map((r) => {
            const s = smoke[r];
            const ok = typeof s === 'number' && s >= 200 && s < 400;
            const tone =
              s == null
                ? TOKENS.text3
                : ok
                  ? TOKENS.moss
                  : TOKENS.terracotta;
            return (
              <div
                key={r}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '8px 12px',
                  borderBottom: `1px solid ${TOKENS.borderSoft}`,
                  borderRight: `1px solid ${TOKENS.borderSoft}`,
                }}
              >
                <a
                  href={r}
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    color: TOKENS.text2,
                    textDecoration: 'none',
                  }}
                >
                  {r}
                </a>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    color: tone,
                    fontWeight: 600,
                  }}
                >
                  {s == null ? '…' : s}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Deploys per slug */}
      {sections.length === 0 ? (
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
          {pending ? 'Loading deploys…' : 'No deploys returned.'}
        </div>
      ) : (
        sections.map((sec) => (
          <section
            key={sec.slug}
            style={{
              marginBottom: 22,
              border: `1px solid ${TOKENS.border}`,
              background: TOKENS.bgRaised,
              borderRadius: 2,
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                borderBottom: `1px solid ${TOKENS.border}`,
                display: 'flex',
                gap: 14,
                alignItems: 'baseline',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: TOKENS.text3,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                }}
              >
                {sec.slug}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text2 }}>
                {sec.deploys.length} deploys
              </span>
              {sec.note && (
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    color: TOKENS.ochre,
                  }}
                >
                  {sec.note}
                </span>
              )}
            </div>
            {sec.deploys.length === 0 ? (
              <div style={{ padding: 14, color: TOKENS.text3, fontSize: 12 }}>
                No deploys in window.
              </div>
            ) : (
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr>
                    <th style={th}>When</th>
                    <th style={th}>State</th>
                    <th style={th}>Ref</th>
                    <th style={th}>SHA</th>
                    <th style={th}>Message</th>
                    <th style={th}>URL</th>
                  </tr>
                </thead>
                <tbody>
                  {sec.deploys.map((d) => (
                    <tr
                      key={d.uid}
                      style={{ borderBottom: `1px solid ${TOKENS.borderSoft}` }}
                    >
                      <td style={{ ...td, fontFamily: MONO, color: TOKENS.text3 }}>
                        {ageMin(d.created_at)}
                      </td>
                      <td
                        style={{
                          ...td,
                          fontFamily: MONO,
                          color: stateColor(d.state),
                          fontWeight: 600,
                        }}
                      >
                        {d.state}
                      </td>
                      <td style={{ ...td, fontFamily: MONO, color: TOKENS.text2 }}>
                        {d.ref}
                      </td>
                      <td style={{ ...td, fontFamily: MONO, color: TOKENS.text3 }}>
                        {d.sha || '—'}
                      </td>
                      <td
                        style={{
                          ...td,
                          maxWidth: 380,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={d.message}
                      >
                        {d.message || '—'}
                      </td>
                      <td style={td}>
                        {d.url ? (
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontFamily: MONO,
                              fontSize: 11,
                              color: TOKENS.ochre,
                            }}
                          >
                            ↗
                          </a>
                        ) : (
                          <span style={{ color: TOKENS.text3 }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontFamily: MONO,
  fontSize: 10,
  letterSpacing: 0.6,
  color: TOKENS.text3,
  textTransform: 'uppercase',
  background: TOKENS.bgDeep,
  borderBottom: `1px solid ${TOKENS.border}`,
};
const td: React.CSSProperties = { padding: '6px 12px' };
