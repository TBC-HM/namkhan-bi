// app/cockpit/bugs/page.tsx
// Bug-report list (PBS ask 22, 2026-05-13). Lists rows from public.cockpit_bugs
// in reverse-chron with status + page. Fed by both the global × widget and
// the dept-entry "Report a bug" box.

import { unstable_noStore as noStore } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

export const runtime     = 'nodejs';
export const dynamic     = 'force-dynamic';
export const fetchCache  = 'force-no-store';
export const revalidate  = 0;

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://build-placeholder.supabase.co'),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || 'build-placeholder-key'),
);

type BugRow = {
  id: number;
  dept_slug: string | null;
  body: string;
  status: string;
  page_url: string | null;
  viewport: string | null;
  user_agent: string | null;
  property_id: string | null;
  reporter_user_id: string | null;
  created_at: string;
};

const STATUS_DOT: Record<string, string> = {
  new:        '#c0584c',
  acked:      '#d68a3a',
  processing: '#a8d05a',
  done:       '#3f8a4a',
  wont_fix:   '#7d7565',
};

function fmtRelative(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60)     return `${Math.round(diff)}s ago`;
  if (diff < 3600)   return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.round(diff / 3600)}h ago`;
  return d.toISOString().slice(0, 10);
}

function pagePath(url: string | null): string {
  if (!url) return '—';
  try { return new URL(url).pathname || '/'; } catch { return url; }
}

export default async function BugsPage() {
  noStore();
  const { data, error } = await supabase
    .from('cockpit_bugs')
    .select('id, dept_slug, body, status, page_url, viewport, user_agent, property_id, reporter_user_id, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const rows: BugRow[] = (data as BugRow[] | null) ?? [];

  return (
    <main
      style={{
        minHeight:  '100vh',
        background: 'var(--surf-0, #0a0a0a)',
        color:      'var(--text-2, #d8cca8)',
        fontFamily: "'Inter Tight', system-ui, sans-serif",
        padding:    '40px 24px 80px',
      }}
    >
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h1
          style={{
            fontFamily:    'Fraunces, Georgia, serif',
            fontStyle:     'italic',
            fontWeight:    400,
            fontSize:      'var(--t-3, 28px)',
            color:         'var(--text-4, #efe6d3)',
            marginBottom:  4,
          }}
        >Bugs</h1>
        <div
          style={{
            fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
            fontSize:      11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color:         'var(--text-mute, #9b907a)',
            marginBottom:  20,
          }}
        >Last 200 · reverse chronological</div>

        {error && (
          <div
            style={{
              background:   'var(--surf-1, #0f0d0a)',
              border:       '1px solid var(--border-2, #2a261d)',
              borderRadius: 8,
              padding:      12,
              color:        '#c0584c',
              fontSize:     12,
              marginBottom: 16,
            }}
          >Error loading bugs: {error.message}</div>
        )}

        {rows.length === 0 && !error && (
          <div
            style={{
              border:       '1px dashed var(--border-2, #2a261d)',
              borderRadius: 10,
              padding:      40,
              textAlign:    'center',
              color:        'var(--text-mute, #9b907a)',
              fontSize:     13,
            }}
          >
            No bugs reported yet. Click the × in the bottom-right of any page to file one.
          </div>
        )}

        {rows.length > 0 && (
          <div
            style={{
              border:       '1px solid var(--border-2, #2a261d)',
              borderRadius: 10,
              overflow:     'hidden',
              background:   'var(--surf-1, #0f0d0a)',
            }}
          >
            <table
              style={{
                width:          '100%',
                borderCollapse: 'collapse',
                fontSize:       12,
              }}
            >
              <thead>
                <tr style={{
                  background: 'var(--surf-2, #15110b)',
                  color:      'var(--text-mute, #9b907a)',
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize:   10,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>What</th>
                  <th style={thStyle}>Page</th>
                  <th style={thStyle}>Dept</th>
                  <th style={thStyle}>Property</th>
                  <th style={thStyle}>When</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border-1, #1f1c15)' }}>
                    <td style={tdStyle}>
                      <span style={{
                        display:       'inline-flex',
                        alignItems:    'center',
                        gap:           6,
                      }}>
                        <span
                          aria-hidden
                          style={{
                            display:      'inline-block',
                            width:        8,
                            height:       8,
                            borderRadius: 999,
                            background:   STATUS_DOT[r.status] ?? '#7d7565',
                          }}
                        />
                        <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11 }}>
                          {r.status}
                        </span>
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-4, #efe6d3)', maxWidth: 320 }}>
                      {r.body}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, color: 'var(--text-2, #d8cca8)' }}>
                      {pagePath(r.page_url)}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-mute, #9b907a)' }}>
                      {r.dept_slug ?? '—'}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-mute, #9b907a)' }}>
                      {r.property_id ?? '—'}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-mute, #9b907a)', whiteSpace: 'nowrap' }}>
                      {fmtRelative(r.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

const thStyle: React.CSSProperties = {
  textAlign:  'left',
  padding:    '10px 12px',
  fontWeight: 400,
};
const tdStyle: React.CSSProperties = {
  padding:        '10px 12px',
  verticalAlign:  'top',
};
