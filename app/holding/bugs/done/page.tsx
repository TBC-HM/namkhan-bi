// app/holding/bugs/done/page.tsx
// Done log — bugs with status 'done' or 'wont_fix', read-only, newest first.

import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const T = {
  paper: '#FFFFFF', hairline: '#E6DFCC', warm: '#F5F0E1',
  ink: '#1B1B1B', inkSoft: '#5A5A5A', green: '#084838',
};

const HOLDING_NAV = [
  { label: 'Overview', href: '/holding' },
  { label: 'Properties', href: '/holding/properties' },
  { label: 'Users', href: '/holding/users' },
  { label: 'Bugs', href: '/holding/bugs' },
];

type DoneRow = {
  id: number; body: string | null; status: string;
  updated_at: string | null; done_at: string | null;
  fix_link: string | null; fix_label: string | null;
  dept_slug: string | null;
};

async function loadDone(): Promise<DoneRow[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('v_bugs_with_agent_state')
    .select('id, body, status, updated_at, done_at, fix_link, fix_label, dept_slug')
    .in('status', ['done', 'wont_fix'])
    .order('updated_at', { ascending: false })
    .limit(500);
  return (data ?? []) as DoneRow[];
}

export default async function BugsDonePage() {
  const rows = await loadDone();

  return (
    <div style={{ background: T.paper, minHeight: '100vh', color: T.ink, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top holding nav */}
      <nav style={{ borderBottom: `1px solid ${T.hairline}`, background: T.paper }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 0 }}>
          {HOLDING_NAV.map((item) => {
            const active = item.href === '/holding/bugs';
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'inline-block', padding: '12px 16px', fontSize: 13,
                fontWeight: active ? 600 : 400, color: active ? T.green : T.inkSoft,
                textDecoration: 'none',
                borderBottom: active ? `2px solid ${T.green}` : '2px solid transparent',
                marginBottom: -1,
              }}>{item.label}</Link>
            );
          })}
        </div>
      </nav>

      <div style={{ padding: 24 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          {/* Header + tabs */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: T.inkSoft, marginBottom: 4 }}>
              Holding › Bugs
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 22, fontWeight: 600, color: T.ink }}>Bug reports</div>
              <div style={{ display: 'flex', gap: 2, background: T.warm, borderRadius: 8, padding: 3, border: `1px solid ${T.hairline}` }}>
                <Link href="/holding/bugs" style={{
                  padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                  color: T.inkSoft, textDecoration: 'none', background: 'transparent',
                }}>Open</Link>
                <span style={{
                  padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  color: T.green, background: T.paper, cursor: 'default',
                }}>Done log</span>
              </div>
            </div>
            <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>
              {rows.length} resolved — done and won&apos;t-fix bugs. Read-only.
            </div>
          </div>

          {/* Table */}
          <div style={{ background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.hairline}`, background: T.warm }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: T.inkSoft, width: 48 }}>#</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: T.inkSoft }}>Bug</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: T.inkSoft }}>Status</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: T.inkSoft, whiteSpace: 'nowrap' }}>Resolved</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: T.inkSoft }}>Fix</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const resolvedAt = b.done_at ?? b.updated_at;
                  const title = (b.body ?? '').slice(0, 120).replace(/\n/g, ' ');
                  return (
                    <tr key={b.id} style={{ borderBottom: `1px solid ${T.hairline}` }}>
                      <td style={{ padding: '9px 12px', color: T.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{b.id}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ color: T.ink }}>{title || '(no body)'}</div>
                        {b.dept_slug && <div style={{ fontSize: 10, color: T.inkSoft, marginTop: 2 }}>{b.dept_slug}</div>}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                          background: b.status === 'done' ? 'rgba(8,72,56,0.10)' : 'rgba(90,90,90,0.10)',
                          color: b.status === 'done' ? 'var(--status-green)' : 'var(--status-grey)',
                        }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: b.status === 'done' ? 'var(--status-green)' : 'var(--status-grey)',
                          }} />
                          {b.status}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', color: T.inkSoft, whiteSpace: 'nowrap', fontSize: 11 }}>
                        {resolvedAt ? resolvedAt.slice(0, 10) : '—'}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        {b.fix_link ? (
                          <a href={b.fix_link} target="_blank" rel="noreferrer"
                            style={{ color: T.green, fontSize: 11, textDecoration: 'underline' }}>
                            {b.fix_label ?? 'link'}
                          </a>
                        ) : <span style={{ color: T.inkSoft }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: T.inkSoft }}>
                      No resolved bugs yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
