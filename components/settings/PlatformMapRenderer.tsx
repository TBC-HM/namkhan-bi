// components/settings/PlatformMapRenderer.tsx
// Self-contained markdown renderer for /settings/platform-map.
// Source of truth: content/settings/platform-map.md
// Parses [STATUS:xxx] tags inline and applies a colour pill.
// No external markdown deps — keeps the bundle small and Vercel build fast.

import React from 'react';

type Status =
  | 'LIVE'
  | 'READY'
  | 'PARTIAL'
  | 'NEXT'
  | 'GAP'
  | 'OUT'
  | 'DONE';

const STATUS_META: Record<Status, { label: string; bg: string; line: string; ink: string; dot: string }> = {
  LIVE:    { label: 'Live',    bg: '#e6efe8', line: '#2d6a4f', ink: '#1f3a2e', dot: '🟢' },
  READY:   { label: 'Ready',   bg: '#e6efe8', line: '#2d6a4f', ink: '#1f3a2e', dot: '🟢' },
  DONE:    { label: 'Done',    bg: '#e6efe8', line: '#2d6a4f', ink: '#1f3a2e', dot: '✅' },
  PARTIAL: { label: 'Partial', bg: '#f4ead0', line: '#a87b3a', ink: '#6a4a16', dot: '🟡' },
  NEXT:    { label: 'Next',    bg: '#f7ead4', line: '#c8893a', ink: '#a06020', dot: '🟠' },
  GAP:     { label: 'Gap',     bg: '#f5e3df', line: '#a13c2f', ink: '#8a2c20', dot: '🔴' },
  OUT:     { label: 'Out',     bg: '#ece7da', line: '#9a8e72', ink: '#4a443c', dot: '⚫' },
};

// ---------- Inline formatting (bold + code + italic) ----------
function renderInline(input: string, keyBase: string): React.ReactNode[] {
  // strip the trailing [STATUS:...] tag from rendering — handled separately
  const clean = input.replace(/`?\[STATUS:[A-Z]+\]`?\s*$/, '').trim();

  // Tokenize: ` `code` `, **bold**, *italic*, plain
  const out: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < clean.length) {
    if (clean[i] === '`') {
      const end = clean.indexOf('`', i + 1);
      if (end > i) {
        out.push(
          <code key={`${keyBase}-c-${k++}`} className="pm-code">
            {clean.slice(i + 1, end)}
          </code>
        );
        i = end + 1;
        continue;
      }
    }
    if (clean[i] === '*' && clean[i + 1] === '*') {
      const end = clean.indexOf('**', i + 2);
      if (end > i) {
        out.push(
          <strong key={`${keyBase}-b-${k++}`}>
            {renderInline(clean.slice(i + 2, end), `${keyBase}-bi-${k}`)}
          </strong>
        );
        i = end + 2;
        continue;
      }
    }
    if (clean[i] === '*') {
      const end = clean.indexOf('*', i + 1);
      if (end > i) {
        out.push(
          <em key={`${keyBase}-i-${k++}`}>
            {clean.slice(i + 1, end)}
          </em>
        );
        i = end + 1;
        continue;
      }
    }
    // accumulate plain text until next special char
    let j = i;
    while (j < clean.length && clean[j] !== '`' && clean[j] !== '*') j++;
    if (j > i) out.push(<React.Fragment key={`${keyBase}-t-${k++}`}>{clean.slice(i, j)}</React.Fragment>);
    i = j === i ? i + 1 : j;
  }
  return out;
}

function extractStatus(line: string): Status | null {
  const m = line.match(/\[STATUS:([A-Z]+)\]/);
  if (!m) return null;
  const s = m[1] as Status;
  if (s in STATUS_META) return s;
  return null;
}

function StatusPill({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span
      className="pm-pill"
      style={{
        background: m.bg,
        borderLeft: `3px solid ${m.line}`,
        color: m.ink,
      }}
    >
      <span aria-hidden="true">{m.dot}</span>
      <span style={{ fontWeight: 600 }}>{m.label}</span>
    </span>
  );
}

// ---------- Block parsing ----------
type Block =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; items: { text: string; status: Status | null }[] }
  | { type: 'table'; rows: string[][]; hasHeader: boolean }
  | { type: 'divider' }
  | { type: 'numlist'; items: string[] };

function parseBlocks(md: string): Block[] {
  const lines = md.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // skip H1 (banner already shows "Platform Map")
    if (/^#\s/.test(line)) {
      i++;
      continue;
    }

    if (/^##\s/.test(line)) {
      blocks.push({ type: 'h2', text: line.replace(/^##\s+/, '').trim() });
      i++;
      continue;
    }
    if (/^###\s/.test(line)) {
      blocks.push({ type: 'h3', text: line.replace(/^###\s+/, '').trim() });
      i++;
      continue;
    }
    if (/^---\s*$/.test(line)) {
      blocks.push({ type: 'divider' });
      i++;
      continue;
    }
    if (/^>\s/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'quote', text: buf.join(' ') });
      continue;
    }
    // pipe table
    if (/^\|/.test(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      // parse rows
      const rows = tableLines
        .map((tl) =>
          tl
            .replace(/^\|/, '')
            .replace(/\|\s*$/, '')
            .split('|')
            .map((c) => c.trim())
        )
        .filter((r) => r.length);
      // detect separator row (---|---) and treat the row above as header
      let hasHeader = false;
      const sepIdx = rows.findIndex((r) => r.every((c) => /^:?-+:?$/.test(c)));
      let cleanRows = rows;
      if (sepIdx > 0) {
        hasHeader = true;
        cleanRows = rows.filter((_, idx) => idx !== sepIdx);
      } else {
        cleanRows = rows.filter((r) => !r.every((c) => /^:?-+:?$/.test(c)));
      }
      blocks.push({ type: 'table', rows: cleanRows, hasHeader });
      continue;
    }
    // numbered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'numlist', items });
      continue;
    }
    // bullet list
    if (/^-\s/.test(line)) {
      const items: { text: string; status: Status | null }[] = [];
      while (i < lines.length && /^-\s/.test(lines[i])) {
        const t = lines[i].replace(/^-\s+/, '');
        items.push({ text: t, status: extractStatus(t) });
        i++;
      }
      // sort GAP > NEXT > PARTIAL > READY > LIVE > DONE > OUT > null
      const order: Record<string, number> = {
        GAP: 0,
        NEXT: 1,
        PARTIAL: 2,
        READY: 3,
        LIVE: 4,
        DONE: 5,
        OUT: 6,
      };
      items.sort((a, b) => {
        const av = a.status ? (order[a.status] ?? 99) : 99;
        const bv = b.status ? (order[b.status] ?? 99) : 99;
        return av - bv;
      });
      blocks.push({ type: 'list', items });
      continue;
    }
    if (line.trim() === '') {
      i++;
      continue;
    }
    // emphasised italic last paragraph (e.g. *Last refreshed: ...*)
    blocks.push({ type: 'p', text: line.trim() });
    i++;
  }
  return blocks;
}

// ---------- Render ----------
export default function PlatformMapRenderer({ markdown }: { markdown: string }) {
  const blocks = parseBlocks(markdown);

  // Tally totals for owner overview
  const tally: Record<Status, number> = {
    LIVE: 0, READY: 0, DONE: 0, PARTIAL: 0, NEXT: 0, GAP: 0, OUT: 0,
  };
  blocks.forEach((b) => {
    if (b.type === 'list') {
      b.items.forEach((it) => {
        if (it.status) tally[it.status]++;
      });
    }
  });

  return (
    <div className="pm-root">
      <style>{css}</style>

      {/* ---- Tally + legend ---- */}
      <div className="pm-tally">
        {(['GAP', 'NEXT', 'PARTIAL', 'READY', 'LIVE', 'DONE', 'OUT'] as Status[]).map((s) => {
          const m = STATUS_META[s];
          return (
            <div
              key={s}
              className="pm-tally-item"
              style={{ background: m.bg, borderLeft: `3px solid ${m.line}` }}
            >
              <div className="pm-tally-count" style={{ color: m.ink }}>
                {tally[s]}
              </div>
              <div className="pm-tally-label" style={{ color: m.ink }}>
                {m.dot} {m.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Body ---- */}
      <div className="pm-body">
        {blocks.map((b, idx) => {
          if (b.type === 'divider') return <hr key={idx} className="pm-hr" />;
          if (b.type === 'h2') return <h2 key={idx} className="pm-h2">{b.text}</h2>;
          if (b.type === 'h3') return <h3 key={idx} className="pm-h3">{b.text}</h3>;
          if (b.type === 'quote') return <blockquote key={idx} className="pm-quote">{renderInline(b.text, `q-${idx}`)}</blockquote>;
          if (b.type === 'p') {
            const isMeta = /^\*.*\*$/.test(b.text);
            return (
              <p key={idx} className={isMeta ? 'pm-p-meta' : 'pm-p'}>
                {renderInline(b.text, `p-${idx}`)}
              </p>
            );
          }
          if (b.type === 'numlist') {
            return (
              <ol key={idx} className="pm-ol">
                {b.items.map((t, j) => (
                  <li key={j}>{renderInline(t, `nl-${idx}-${j}`)}</li>
                ))}
              </ol>
            );
          }
          if (b.type === 'list') {
            return (
              <ul key={idx} className="pm-ul">
                {b.items.map((it, j) => (
                  <li key={j} className={`pm-row pm-row-${it.status ?? 'none'}`}>
                    <div className="pm-row-text">{renderInline(it.text, `r-${idx}-${j}`)}</div>
                    {it.status && <StatusPill status={it.status} />}
                  </li>
                ))}
              </ul>
            );
          }
          if (b.type === 'table') {
            const head = b.hasHeader ? b.rows[0] : null;
            const body = b.hasHeader ? b.rows.slice(1) : b.rows;
            return (
              <div key={idx} className="pm-table-wrap">
                <table className="pm-table">
                  {head && (
                    <thead>
                      <tr>
                        {head.map((c, j) => (
                          <th key={j}>{renderInline(c, `th-${idx}-${j}`)}</th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {body.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) => (
                          <td key={k}>{renderInline(c, `td-${idx}-${j}-${k}`)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

const css = `
.pm-root { font-family: 'Inter','Helvetica Neue',Arial,sans-serif; color: var(--ink); }
.pm-tally {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px;
  margin: 4px 0 22px 0;
}
.pm-tally-item {
  padding: 10px 12px;
}
.pm-tally-count { font-family: 'Georgia',serif; font-size: 26px; line-height: 1; font-weight: 400; }
.pm-tally-label { font-size: 11px; margin-top: 4px; letter-spacing: 0.5px; }
.pm-body { font-size: 14px; line-height: 1.55; }
.pm-h2 {
  font-family: 'Georgia',serif; font-weight: 400; font-size: 22px;
  margin: 28px 0 8px 0; padding-bottom: 6px;
  border-bottom: 1px solid var(--line);
  color: var(--moss);
}
.pm-h3 {
  font-family: 'Inter',sans-serif; font-weight: 600; font-size: 13px;
  text-transform: uppercase; letter-spacing: 1.5px;
  margin: 18px 0 8px 0; color: var(--ink-soft);
}
.pm-p { margin: 8px 0; }
.pm-p-meta { margin: 16px 0 4px 0; font-size: 12px; color: var(--ink-mute); font-style: italic; }
.pm-quote {
  margin: 10px 0; padding: 10px 14px;
  border-left: 3px solid var(--brass);
  background: rgba(168,133,74,0.06);
  font-size: 13px; color: var(--ink-soft);
}
.pm-hr { border: none; border-top: 1px solid var(--line); margin: 24px 0; }
.pm-ul { list-style: none; padding: 0; margin: 4px 0 12px 0; }
.pm-row {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 10px 12px; margin-bottom: 4px;
  background: #fff; border: 1px solid var(--line-soft);
  border-radius: 2px;
}
.pm-row-text { flex: 1; min-width: 0; }
.pm-row-GAP     { border-left: 3px solid #a13c2f; }
.pm-row-NEXT    { border-left: 3px solid #c8893a; }
.pm-row-PARTIAL { border-left: 3px solid #a87b3a; }
.pm-row-READY,
.pm-row-LIVE,
.pm-row-DONE    { border-left: 3px solid #2d6a4f; }
.pm-row-OUT     { border-left: 3px solid #9a8e72; opacity: 0.7; }
.pm-row-none    { border-left: 3px solid var(--line); }
.pm-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; font-size: 11px; line-height: 1.2;
  white-space: nowrap; flex-shrink: 0;
}
.pm-code {
  font-family: ui-monospace,Menlo,Monaco,Consolas,monospace;
  font-size: 12px; padding: 1px 5px;
  background: var(--paper-deep); border-radius: 2px;
}
.pm-ol { padding-left: 22px; margin: 8px 0; }
.pm-ol li { margin-bottom: 6px; }
.pm-table-wrap { overflow-x: auto; margin: 10px 0 18px 0; }
.pm-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.pm-table th, .pm-table td {
  padding: 8px 10px; text-align: left;
  border-bottom: 1px solid var(--line-soft);
  vertical-align: top;
}
.pm-table th { font-weight: 600; background: var(--paper-deep); }
@media (max-width: 900px) {
  .pm-tally { grid-template-columns: repeat(4, 1fr); }
}
`;
