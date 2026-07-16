'use client';
// app/marketing/contacts/_components/ContactsClient.tsx
// PBS 2026-07-16 — client-side sort + filter over the top-500 payload, plus
// "Run extraction now" + "Add to Leads" per-row actions.

import { useMemo, useState, useTransition } from 'react';

export interface ContactRow {
  email: string;
  display_name: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  message_count: number;
  direction_mix: { in?: number; out?: number } | null;
  source_accounts: string[] | null;
  domain: string;
  is_internal: boolean;
  updated_at: string | null;
}

export interface DomainRow {
  domain: string;
  contact_count: number;
  total_messages: number;
  most_recent: string | null;
}

export interface RunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  gmail_account: string;
  messages_scanned: number;
  new_contacts: number;
  updated_contacts: number;
  status: 'running' | 'succeeded' | 'failed';
  error_message: string | null;
}

type SortKey = 'email' | 'display_name' | 'domain' | 'first_seen_at' | 'last_seen_at' | 'message_count';

const HAIRLINE = '#E6DFCC';
const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const BRAND = '#084838';
const PAPER = '#FFFFFF';

const cellStyle: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: 12,
  color: INK,
  borderBottom: '1px solid ' + HAIRLINE,
  verticalAlign: 'top',
  textAlign: 'left',
};
const headStyle: React.CSSProperties = {
  padding: '8px',
  fontSize: 11,
  fontWeight: 600,
  color: INK_SOFT,
  background: PAPER,
  borderBottom: '1px solid ' + HAIRLINE,
  textAlign: 'left',
  cursor: 'pointer',
  userSelect: 'none',
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try { return new Date(d).toISOString().slice(0, 10); } catch { return '—'; }
}

export default function ContactsClient({
  initialContacts,
  topDomains,
  initialRuns,
}: {
  initialContacts: ContactRow[];
  topDomains: DomainRow[];
  initialRuns: RunRow[];
}) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('message_count');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [runs, setRuns] = useState<RunRow[]>(initialRuns);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [addedLeads, setAddedLeads] = useState<Record<string, 'ok' | 'err'>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? initialContacts.filter((r) =>
          r.email.toLowerCase().includes(q)
          || (r.display_name ?? '').toLowerCase().includes(q)
          || (r.domain ?? '').toLowerCase().includes(q))
      : initialContacts.slice();
    base.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (sortKey) {
        case 'message_count':
          av = a.message_count; bv = b.message_count; break;
        case 'first_seen_at':
          av = a.first_seen_at ?? ''; bv = b.first_seen_at ?? ''; break;
        case 'last_seen_at':
          av = a.last_seen_at ?? ''; bv = b.last_seen_at ?? ''; break;
        case 'display_name':
          av = (a.display_name ?? '').toLowerCase(); bv = (b.display_name ?? '').toLowerCase(); break;
        case 'domain':
          av = a.domain ?? ''; bv = b.domain ?? ''; break;
        case 'email':
        default:
          av = a.email; bv = b.email; break;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return base;
  }, [initialContacts, query, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(k);
      setSortDir(k === 'message_count' ? 'desc' : 'asc');
    }
  }

  function runExtractionNow() {
    setRunMsg('Running… may take up to 5 minutes for a full mailbox.');
    startTransition(async () => {
      try {
        const r = await fetch('/api/marketing/contacts/extract', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ max_messages: 2000 }),
        });
        const j = await r.json();
        if (!r.ok || !j.ok) {
          setRunMsg('Failed: ' + (j.error ?? r.status));
          return;
        }
        const parts = (j.runs ?? []).map((x: { account_email: string; messages_scanned: number; new_contacts: number; updated_contacts: number; status: string }) =>
          `${x.account_email}: ${x.messages_scanned} msgs · +${x.new_contacts} new · ~${x.updated_contacts} upd (${x.status})`);
        setRunMsg('Done. ' + parts.join(' · ') + ' — reload to see fresh rows.');
      } catch (err) {
        setRunMsg('Error: ' + (err instanceof Error ? err.message : String(err)));
      }
    });
  }

  async function addToLeads(row: ContactRow) {
    setAddedLeads((s) => ({ ...s, [row.email]: 'ok' }));
    try {
      const guessedCompany = row.display_name?.trim() || row.domain || row.email.split('@')[1] || 'Unknown';
      const r = await fetch('/api/sales/leads/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          company_name: guessedCompany,
          type: 'other',
          origin: 'inbound',
          email: row.email,
          decision_maker_name: row.display_name ?? null,
          notes: `Added from Gmail contact extract. Seen in: ${(row.source_accounts ?? []).join(', ')}. Messages: ${row.message_count}.`,
        }),
      });
      const j = await r.json();
      if (!r.ok || j.error) {
        setAddedLeads((s) => ({ ...s, [row.email]: 'err' }));
      }
    } catch {
      setAddedLeads((s) => ({ ...s, [row.email]: 'err' }));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Action strip */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={runExtractionNow}
          disabled={pending}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 600,
            background: pending ? '#5A5A5A' : BRAND, color: '#FFFFFF',
            border: '1px solid ' + BRAND, borderRadius: 4,
            cursor: pending ? 'wait' : 'pointer',
          }}
        >
          {pending ? 'Extracting…' : 'Run extraction now'}
        </button>
        <input
          type="search"
          placeholder="Filter email / name / domain…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            padding: '6px 10px', fontSize: 12, minWidth: 260, flex: '1 1 260px',
            border: '1px solid ' + HAIRLINE, borderRadius: 4, background: PAPER, color: INK,
          }}
        />
        <div style={{ fontSize: 11, color: INK_SOFT }}>
          Showing {filtered.length} of top {initialContacts.length} (by message count)
        </div>
      </div>
      {runMsg && (
        <div style={{ fontSize: 11, color: INK_SOFT, padding: '4px 8px', background: '#F5F0E1', border: '1px solid ' + HAIRLINE, borderRadius: 4 }}>
          {runMsg}
        </div>
      )}

      {/* Top domains */}
      {topDomains.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: INK_SOFT, marginBottom: 4 }}>
            TOP 10 EXTERNAL DOMAINS
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {topDomains.map((d) => (
              <div
                key={d.domain}
                title={`${d.contact_count.toLocaleString()} contacts · last seen ${fmtDate(d.most_recent)}`}
                style={{
                  padding: '4px 10px', fontSize: 11, color: INK,
                  background: PAPER, border: '1px solid ' + HAIRLINE, borderRadius: 4,
                }}
              >
                <span style={{ fontWeight: 600 }}>{d.domain}</span>
                <span style={{ color: INK_SOFT, marginLeft: 6 }}>{d.total_messages.toLocaleString()} msgs · {d.contact_count} contacts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent runs */}
      {runs.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: INK_SOFT, marginBottom: 4 }}>
            LAST {runs.length} EXTRACTION RUN(S)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: PAPER, border: '1px solid ' + HAIRLINE, borderRadius: 4, overflow: 'hidden' }}>
            <thead>
              <tr>
                <th style={headStyle}>Started</th>
                <th style={headStyle}>Account</th>
                <th style={headStyle}>Msgs</th>
                <th style={headStyle}>+ new</th>
                <th style={headStyle}>~ upd</th>
                <th style={headStyle}>Status</th>
                <th style={headStyle}>Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td style={cellStyle}>{new Date(r.started_at).toLocaleString()}</td>
                  <td style={cellStyle}>{r.gmail_account}</td>
                  <td style={cellStyle}>{r.messages_scanned.toLocaleString()}</td>
                  <td style={cellStyle}>{r.new_contacts.toLocaleString()}</td>
                  <td style={cellStyle}>{r.updated_contacts.toLocaleString()}</td>
                  <td style={{ ...cellStyle, color: r.status === 'succeeded' ? BRAND : r.status === 'failed' ? '#B00020' : INK_SOFT, fontWeight: 600 }}>{r.status}</td>
                  <td style={{ ...cellStyle, color: '#B00020' }}>{r.error_message ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Contacts table */}
      <div style={{ overflowX: 'auto', background: PAPER, border: '1px solid ' + HAIRLINE, borderRadius: 4 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: PAPER }}>
          <thead>
            <tr>
              <th style={headStyle} onClick={() => toggleSort('email')}>Email {sortKey === 'email' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle} onClick={() => toggleSort('display_name')}>Name {sortKey === 'display_name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle} onClick={() => toggleSort('domain')}>Domain {sortKey === 'domain' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle} onClick={() => toggleSort('first_seen_at')}>First seen {sortKey === 'first_seen_at' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle} onClick={() => toggleSort('last_seen_at')}>Last seen {sortKey === 'last_seen_at' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle} onClick={() => toggleSort('message_count')}>Msgs {sortKey === 'message_count' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle}>Source</th>
              <th style={headStyle}>Internal?</th>
              <th style={headStyle}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const leadState = addedLeads[r.email];
              return (
                <tr key={r.email}>
                  <td style={cellStyle}>{r.email}</td>
                  <td style={cellStyle}>{r.display_name ?? <span style={{ color: INK_SOFT }}>—</span>}</td>
                  <td style={cellStyle}>{r.domain}</td>
                  <td style={cellStyle}>{fmtDate(r.first_seen_at)}</td>
                  <td style={cellStyle}>{fmtDate(r.last_seen_at)}</td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.message_count.toLocaleString()}</td>
                  <td style={{ ...cellStyle, fontSize: 11, color: INK_SOFT }}>{(r.source_accounts ?? []).join(', ')}</td>
                  <td style={cellStyle}>{r.is_internal ? <span style={{ color: INK_SOFT }}>staff</span> : <span style={{ color: BRAND, fontWeight: 600 }}>external</span>}</td>
                  <td style={cellStyle}>
                    {r.is_internal ? (
                      <span style={{ color: INK_SOFT, fontSize: 11 }}>—</span>
                    ) : leadState === 'ok' ? (
                      <span style={{ color: BRAND, fontSize: 11, fontWeight: 600 }}>added ✓</span>
                    ) : leadState === 'err' ? (
                      <span style={{ color: '#B00020', fontSize: 11 }}>failed</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addToLeads(r)}
                        style={{
                          padding: '3px 8px', fontSize: 11, fontWeight: 600,
                          background: PAPER, color: BRAND,
                          border: '1px solid ' + HAIRLINE, borderRadius: 3, cursor: 'pointer',
                        }}
                      >
                        + Lead
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ ...cellStyle, textAlign: 'center', color: INK_SOFT, padding: '20px' }}>
                  {query
                    ? 'No matches. Try a different search.'
                    : 'No contacts extracted yet. Click "Run extraction now" to populate.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
