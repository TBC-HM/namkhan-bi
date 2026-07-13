'use client';
// app/marketing/youtube/_client/PipelineChevronExplorer.tsx
// PBS 2026-07-13 — Clickable pipeline chevrons with expandable per-stage detail panel.
// Only ONE stage open at a time. Receives pre-formatted plain data from server component.
import { useState } from 'react';
import StartProductionButton from './StartProductionButton';

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const INK_S  = '#3A3A3A';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';

export interface PipelineResearchItem { brief_id: string; generated_at_utc: string | null }
export interface PipelineRequestItem  { id: string; style: string | null; duration_seconds: number | null; angle_first_line: string; created_at: string | null }
export interface PipelineScriptItem   { id: string; kind: 'request' | 'job'; style: string | null; angle_first_line: string; created_at: string | null }
export interface PipelineRenderItem   { render_job_id: string; status: string; submitted_at_utc: string | null }
export interface PipelineApproveItem  { render_job_id: string; output_url: string | null; finished_at_utc: string | null }

type StageKey = 'research' | 'request' | 'script' | 'render' | 'approve';

interface Props {
  research: PipelineResearchItem[];
  request:  PipelineRequestItem[];
  script:   PipelineScriptItem[];
  render:   PipelineRenderItem[];
  approve:  PipelineApproveItem[];
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px', borderBottom: `1px solid ${HAIR}`, fontSize: 10, color: INK_M, textTransform: 'uppercase', letterSpacing: '.06em' };
const td: React.CSSProperties = { padding: '8px', borderBottom: `1px solid ${HAIR}`, color: INK, fontSize: 12 };
const tdMuted: React.CSSProperties = { ...td, color: INK_M };
const tdMono: React.CSSProperties = { ...td, fontFamily: 'monospace', color: INK_S };

function fmtTs(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toISOString().slice(0, 16).replace('T', ' '); } catch { return '—'; }
}

export default function PipelineChevronExplorer(props: Props) {
  const { research, request, script, render, approve } = props;
  const [open, setOpen] = useState<StageKey | null>(null);

  const stages: { key: StageKey; label: string; n: number }[] = [
    { key: 'research', label: 'Research', n: research.length },
    { key: 'request',  label: 'Request',  n: request.length },
    { key: 'script',   label: 'Script',   n: script.length },
    { key: 'render',   label: 'Render',   n: render.length },
    { key: 'approve',  label: 'Approve',  n: approve.length },
  ];
  const total = stages.reduce((s, x) => s + x.n, 0);

  const cardStyle: React.CSSProperties = { background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 20, gridColumn: '1 / -1' };
  const sectionH: React.CSSProperties = { fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: INK_M, marginBottom: 12, fontWeight: 500 };

  if (total === 0) {
    return (
      <div style={{ ...cardStyle, background: CREAM }}>
        <div style={{ fontSize: 12, color: INK_S }}>
          <strong>Pipeline dormant.</strong> Request a video below to kick off Research → Script → Render → Approve.
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={sectionH}>Pipeline · in flight · click a stage to expand</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        {stages.map((s) => {
          const isOpen = open === s.key;
          const active = s.n > 0;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setOpen(isOpen ? null : s.key)}
              style={{
                padding: 12,
                background: active ? '#E8F0EC' : CREAM,
                border: `1px solid ${isOpen ? FOREST : HAIR}`,
                borderRadius: 3,
                textAlign: 'center',
                cursor: 'pointer',
                outline: 'none',
                boxShadow: isOpen ? `inset 0 -3px 0 ${FOREST}` : 'none',
                transition: 'box-shadow 120ms, border-color 120ms',
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, color: active ? FOREST : INK_M }}>{s.n}</div>
              <div style={{ fontSize: 10, color: INK_M, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
            </button>
          );
        })}
      </div>

      {open && (
        <div style={{ marginTop: 16, borderTop: `1px solid ${HAIR}`, paddingTop: 16 }}>
          <div style={{ ...sectionH, marginBottom: 8 }}>
            {stages.find((s) => s.key === open)?.label} · detail
          </div>
          <StageBody stage={open} research={research} request={request} script={script} render={render} approve={approve} />
        </div>
      )}
    </div>
  );
}

function StageBody({ stage, research, request, script, render, approve }: { stage: StageKey } & Props) {
  const empty = <div style={{ fontSize: 12, color: INK_M, padding: '8px 0' }}>No items in this stage.</div>;

  if (stage === 'research') {
    if (research.length === 0) return empty;
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={th}>Brief</th>
          <th style={th}>Generated</th>
        </tr></thead>
        <tbody>{research.map((b) => (
          <tr key={b.brief_id}>
            <td style={tdMono}>{b.brief_id.slice(0, 8)}</td>
            <td style={tdMuted}>{fmtTs(b.generated_at_utc)}</td>
          </tr>
        ))}</tbody>
      </table>
    );
  }

  if (stage === 'request') {
    if (request.length === 0) return empty;
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={th}>ID</th>
          <th style={th}>Style</th>
          <th style={th}>Length</th>
          <th style={th}>Angle</th>
          <th style={th}>Created</th>
          <th style={{ ...th, textAlign: 'right' }}>Action</th>
        </tr></thead>
        <tbody>{request.map((r) => (
          <tr key={r.id}>
            <td style={tdMono}>{r.id.slice(0, 8)}</td>
            <td style={tdMuted}>{r.style ?? '—'}</td>
            <td style={tdMuted}>{r.duration_seconds != null ? `${r.duration_seconds}s` : '—'}</td>
            <td style={td}>{r.angle_first_line}</td>
            <td style={{ ...tdMuted, fontSize: 11 }}>{fmtTs(r.created_at)}</td>
            <td style={{ ...td, textAlign: 'right' }}>
              <StartProductionButton requestId={r.id} />
            </td>
          </tr>
        ))}</tbody>
      </table>
    );
  }

  if (stage === 'script') {
    if (script.length === 0) return empty;
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={th}>ID</th>
          <th style={th}>Source</th>
          <th style={th}>Style</th>
          <th style={th}>Angle</th>
          <th style={th}>Created</th>
        </tr></thead>
        <tbody>{script.map((s) => (
          <tr key={`${s.kind}:${s.id}`}>
            <td style={tdMono}>{s.id.slice(0, 8)}</td>
            <td style={tdMuted}>{s.kind === 'request' ? 'request' : 'render job'}</td>
            <td style={tdMuted}>{s.style ?? '—'}</td>
            <td style={td}>{s.angle_first_line}</td>
            <td style={{ ...tdMuted, fontSize: 11 }}>{fmtTs(s.created_at)}</td>
          </tr>
        ))}</tbody>
      </table>
    );
  }

  if (stage === 'render') {
    if (render.length === 0) return empty;
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={th}>Job</th>
          <th style={th}>Status</th>
          <th style={th}>Submitted</th>
        </tr></thead>
        <tbody>{render.map((j) => (
          <tr key={j.render_job_id}>
            <td style={tdMono}>{j.render_job_id.slice(0, 8)}</td>
            <td style={tdMuted}>{j.status}</td>
            <td style={{ ...tdMuted, fontSize: 11 }}>{fmtTs(j.submitted_at_utc)}</td>
          </tr>
        ))}</tbody>
      </table>
    );
  }

  // approve
  if (approve.length === 0) return empty;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>
        <th style={th}>Job</th>
        <th style={th}>Finished</th>
        <th style={th}>Preview</th>
      </tr></thead>
      <tbody>{approve.map((j) => (
        <tr key={j.render_job_id}>
          <td style={tdMono}>{j.render_job_id.slice(0, 8)}</td>
          <td style={tdMuted}>{fmtTs(j.finished_at_utc)}</td>
          <td style={td}>{j.output_url
            ? <a href={j.output_url} target="_blank" rel="noreferrer noopener" style={{ color: FOREST }}>Watch ↗</a>
            : '—'}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}
