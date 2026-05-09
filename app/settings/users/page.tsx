// app/settings/users/page.tsx — REDESIGN 2026-05-05 (recovery)
import Page from '@/components/page/Page';
import StatusPill from '@/components/ui/StatusPill';
import { getCurrentUser, canEdit, roleLabel } from '@/lib/currentUser';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const user = await getCurrentUser();
  const canSee = canEdit(user.role, 'owner');

  if (!canSee) {
    return (
      <Page eyebrow="Settings · Users & roles" title={<>Who has <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>access</em>.</>}>
        <div style={{ marginTop: 18, padding: 32, background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderLeft: '3px solid var(--st-bad)', borderRadius: 8 }}>
          <strong>Owner only.</strong> You're signed in as <strong>{roleLabel(user.role)}</strong>.
        </div>
      </Page>
    );
  }

  const { data: users } = await supabase
    .from('app_users')
    .select('id, email, display_name, role, initials, active, last_seen_at, created_at')
    .order('created_at');
  const list = (users ?? []) as any[];
  const active = list.filter((u) => u.active).length;
  const owners = list.filter((u) => (u.role ?? '').toLowerCase() === 'owner').length;
  const seenLast30d = list.filter((u) => u.last_seen_at && new Date(u.last_seen_at) > new Date(Date.now() - 30 * 86_400_000)).length;

  return (
    <Page eyebrow="Settings · Users & roles" title={<>Who has <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>access</em>.</>}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', padding: '10px 16px', background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, marginTop: 14 }}>
        <span className="t-eyebrow">SOURCE</span>
        <StatusPill tone="active">app_users</StatusPill>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>· UI-gated · single password is the real boundary today</span>
      </div>
      <div style={{ marginTop: 18 }}>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-xl)', fontWeight: 500, marginBottom: 6 }}>Users <span style={{ marginLeft: 8, fontFamily: 'var(--mono)', fontStyle: 'normal', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>{list.length}</span></div>
        <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr>
              <th style={th}>User</th><th style={th}>Email</th><th style={th}>Role</th>
              <th style={{ ...th, textAlign: 'right' }}>Last seen</th>
              <th style={{ ...th, textAlign: 'center' }}>Status</th>
            </tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic' }}>No users registered.</td></tr>}
              {list.map((u) => (
                <tr key={u.id}>
                  <td style={td}><strong>{u.display_name ?? '—'}</strong></td>
                  <td style={{ ...td, color: 'var(--ink-mute)' }}>{u.email}</td>
                  <td style={td}>{roleLabel(u.role)}</td>
                  <td style={{ ...td, textAlign: 'right', color: 'var(--ink-mute)' }}>{u.last_seen_at ? new Date(u.last_seen_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td style={{ ...td, textAlign: 'center' }}><StatusPill tone={u.active ? 'active' : 'inactive'}>{u.active ? 'ACTIVE' : 'INACTIVE'}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Page>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', background: 'var(--paper-deep)', borderBottom: '1px solid var(--paper-deep)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', fontWeight: 600 };
const td: React.CSSProperties = { padding: '6px 12px', borderBottom: '1px solid var(--paper-deep)', fontSize: 12, color: 'var(--ink)' };
