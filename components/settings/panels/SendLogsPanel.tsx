// components/settings/panels/SendLogsPanel.tsx
// PBS 2026-07-15: unified "Send Logs" tab — every send that went out for THIS
// property across all Namkhan-BI areas (revenue reports, guest newsletters,
// sales outbound email, marketing campaigns, reputation reports). Replaces
// the noisy send-log container previously wedged into the Revenue HoD landing.
//
// Reads: public.v_all_sends_unified (UNION view — service-role granted).
// Filter: property_id = current + property_id IS NULL (reputation digests
// have no property scope; still surface them so operator can see them).
'use client';

import { useEffect, useMemo, useState } from 'react';
import { PanelHeader, EmptyState } from './_shared';
import { supabase } from '@/lib/supabase';

type Row = {
  source_area: string;
  source_id: string;
  sent_at: string | null;
  recipient: string | null;
  subject: string | null;
  status: string | null;
  property_id: number | null;
  meta: Record<string, unknown> | null;
};

const AREA_LABELS: Record<string, string> = {
  revenue_report:      'Revenue report',
  guest_newsletter:    'Guest newsletter',
  sales_email:         'Sales email',
  marketing_campaign:  'Marketing campaign',
  reputation_report:   'Reputation report',
};

function areaBadgeColor(area: string): string {
  switch (area) {
    case 'revenue_report':     return '#1F3A2E';
    case 'guest_newsletter':   return '#5A3E1F';
    case 'sales_email':        return '#1F4A5A';
    case 'marketing_campaign': return '#5A1F4A';
    case 'reputation_report':  return '#5A5A1F';
    default:                   return '#5A5A5A';
  }
}

function statusPillColor(status: string | null): { bg: string; fg: string } {
  const s = (status ?? '').toLowerCase();
  if (s === 'sent' || s === 'sent_ok' || s === 'delivered' || s === 'published' || s === 'ok') return { bg: '#E8F0EA', fg: '#1F5C2C' };
  if (s === 'failed' || s === 'error' || s === 'bounced') return { bg: '#F5E4E4', fg: '#8B1F1F' };
  if (s === 'queued' || s === 'scheduled' || s === 'pending') return { bg: '#F5EFE0', fg: '#5A4A1F' };
  return { bg: '#F5F0E1', fg: '#5A5A5A' };
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

export default function SendLogsPanel({ propertyId }: { propertyId: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [q, setQ] = useState<string>('');
  const [sortKey, setSortKey] = useState<'sent_at' | 'source_area' | 'recipient' | 'subject' | 'status'>('sent_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    let alive = true;
    (async () => {
      // Include NULL property rows (reputation digests are not property-scoped
      // in the source table).
      const { data, error } = await supabase
        .from('v_all_sends_unified')
        .select('source_area, source_id, sent_at, recipient, subject, status, property_id, meta')
        .or(`property_id.eq.${propertyId},property_id.is.null`)
        .order('sent_at', { ascending: false })
        .limit(500);
      if (!alive) return;
      if (error) { setErr(error.message); setRows([]); return; }
      setRows((data ?? []) as Row[]);
    })();
    return () => { alive = false; };
  }, [propertyId]);

  const areaOptions = useMemo(() => {
    const set = new Set<string>();
    (rows ?? []).forEach((r) => set.add(r.source_area));
    return ['all', ...Array.from(set).sort()];
  }, [rows]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    (rows ?? []).forEach((r) => r.status && set.add(r.status));
    return ['all', ...Array.from(set).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    const src = rows ?? [];
    const qLower = q.trim().toLowerCase();
    const out = src.filter((r) => {
      if (areaFilter !== 'all' && r.source_area !== areaFilter) return false;
      if (statusFilter !== 'all' && (r.status ?? '') !== statusFilter) return false;
      if (qLower) {
        const hay = [r.recipient, r.subject, r.source_area, r.status].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      return true;
    });
    out.sort((a, b) => {
      const av = (a[sortKey] as string) ?? '';
      const bv = (b[sortKey] as string) ?? '';
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return out;
  }, [rows, areaFilter, statusFilter, q, sortKey, sortDir]);

  function toggleSort(k: typeof sortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'sent_at' ? 'desc' : 'asc'); }
  }

  const arrow = (k: typeof sortKey) => (sortKey === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  return (
    <div style={{ padding: 16 }}>
      <PanelHeader
        title="Send Logs"
        subtitle="Every send that has left the building for this property — revenue reports · guest newsletters · sales outbound · marketing campaigns · reputation digests. Last 500 rows, newest first."
      />

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <label style={{ fontSize: 11, color: '#5A5A5A' }}>
          Area{' '}
          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #E6DFCC', background: '#FFFFFF', borderRadius: 3 }}
          >
            {areaOptions.map((a) => (
              <option key={a} value={a}>{a === 'all' ? 'All areas' : (AREA_LABELS[a] ?? a)}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: '#5A5A5A' }}>
          Status{' '}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #E6DFCC', background: '#FFFFFF', borderRadius: 3 }}
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>
            ))}
          </select>
        </label>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search recipient or subject…"
          style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #E6DFCC', background: '#FFFFFF', borderRadius: 3, flex: '1 1 240px', minWidth: 180 }}
        />
        <span style={{ fontSize: 11, color: '#5A5A5A' }}>
          {filtered.length}{rows && rows.length !== filtered.length ? ` of ${rows.length}` : ''} sends
        </span>
      </div>

      {err && (
        <div style={{ padding: 10, border: '1px solid #F5E4E4', background: '#FCF3F3', color: '#8B1F1F', fontSize: 12, borderRadius: 3, marginBottom: 12 }}>
          {err}
        </div>
      )}

      {rows === null && (
        <div style={{ padding: 24, textAlign: 'center', color: '#5A5A5A', fontSize: 12 }}>Loading…</div>
      )}

      {rows !== null && filtered.length === 0 && !err && (
        <EmptyState message="No sends match the current filters." />
      )}

      {filtered.length > 0 && (
        <div style={{ border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F5F0E1', color: '#1B1B1B' }}>
                {([
                  ['sent_at',     'Sent at'],
                  ['source_area', 'Area'],
                  ['recipient',   'Recipient'],
                  ['subject',     'Subject'],
                  ['status',      'Status'],
                ] as const).map(([k, label]) => (
                  <th
                    key={k}
                    onClick={() => toggleSort(k)}
                    style={{
                      textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #E6DFCC',
                      cursor: 'pointer', userSelect: 'none', fontWeight: 600, whiteSpace: 'nowrap',
                    }}
                  >
                    {label}{arrow(k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const pill = statusPillColor(r.status);
                return (
                  <tr key={`${r.source_area}:${r.source_id}`} style={{ borderBottom: '1px solid #F1EBD9' }}>
                    <td style={{ padding: '8px 10px', color: '#1B1B1B', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {fmtDate(r.sent_at)}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span
                        style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 99,
                          background: '#F5F0E1', color: areaBadgeColor(r.source_area),
                          border: `1px solid ${areaBadgeColor(r.source_area)}22`,
                          fontWeight: 600, letterSpacing: '0.02em',
                        }}
                      >
                        {AREA_LABELS[r.source_area] ?? r.source_area}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', color: '#1B1B1B' }}>{r.recipient ?? '—'}</td>
                    <td style={{ padding: '8px 10px', color: '#1B1B1B' }}>{r.subject ?? '—'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span
                        style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 99,
                          background: pill.bg, color: pill.fg, fontWeight: 600, letterSpacing: '0.02em',
                        }}
                      >
                        {r.status ?? '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
