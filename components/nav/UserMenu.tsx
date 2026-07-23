'use client';

import TenantLink from '@/components/nav/TenantLink';
import { useState, useRef, useEffect } from 'react';
import type { CurrentUser } from '@/lib/currentUser';
import { roleLabel } from '@/lib/currentUser';
import { createBrowserClient } from '@supabase/ssr';

export default function UserMenu({ user }: { user: CurrentUser }) {
  const [open, setOpen] = useState(false);
  const [gmailConnected, setGmailConnected] = useState<{ connected: boolean; address?: string } | null>(null);
  // PBS 2026-07-16: pull unread count into the User dropdown so the mailbox
  // pill lives beside Settings/Notifications/Sign-out, not floating loose in
  // the topbar. GmailNavDropdown stays mounted globally (for the drawer), but
  // its visible chip belongs here.
  const [unread, setUnread] = useState<number | null>(null);
  // PBS 2026-07-16 · Item 5 — gate Mail Analytics link on holding_role ∈
  // (owner, admin). Same JWT-claim pattern as HeaderPills.tsx.
  const [isAdmin, setIsAdmin] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );
        const sess = await sb.auth.getSession();
        const token = sess.data.session?.access_token;
        if (!token) return;
        const parts = token.split('.');
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const pad = b64.length % 4 === 0 ? b64 : b64 + '='.repeat(4 - (b64.length % 4));
        const claims = JSON.parse(atob(pad));
        const role = String(claims.holding_role ?? '');
        if (!cancelled) setIsAdmin(role === 'owner' || role === 'admin');
      } catch { /* silent — leave false */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open]);

  // Lazy-load Gmail connection status when the dropdown opens.
  useEffect(() => {
    if (!open || gmailConnected !== null) return;
    let cancelled = false;
    fetch('/api/user/gmail/status', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : { connected: false })
      .then((j) => { if (!cancelled) setGmailConnected(j as { connected: boolean; address?: string }); })
      .catch(() => { if (!cancelled) setGmailConnected({ connected: false }); });
    return () => { cancelled = true; };
  }, [open, gmailConnected]);

  // PBS 2026-07-16: unread mail count lives in the User dropdown now.
  // Uses the same /api/mail/messages backend that GmailNavDropdown reads;
  // we just need a headcount, not the payload.
  useEffect(() => {
    if (!open || unread !== null) return;
    let cancelled = false;
    fetch('/api/mail/messages?labelIds=UNREAD&maxResults=1', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : { resultSizeEstimate: 0 })
      .then((j) => { if (!cancelled) setUnread(Number(j?.resultSizeEstimate ?? 0)); })
      .catch(() => { if (!cancelled) setUnread(0); });
    return () => { cancelled = true; };
  }, [open, unread]);

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className={`user-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="user-avatar">{user.initials}</span>
        <span className="user-meta-stack">
          <span className="user-name">{user.display_name}</span>
          <span className="user-role">{roleLabel(user.role)}</span>
        </span>
        <span className="user-caret" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="user-dropdown" role="menu">
          <div className="user-dropdown-head">
            <div className="user-avatar lg">{user.initials}</div>
            <div>
              <div className="user-dropdown-name">{user.display_name}</div>
              <div className="user-dropdown-email">{user.email}</div>
              <div className="user-dropdown-role">{roleLabel(user.role)}</div>
            </div>
          </div>
          <div className="user-dropdown-divider" />
          <TenantLink href="/mail" className="user-dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
            <span className="user-dropdown-icon">📥</span>
            Inbox
            {unread != null && unread > 0 && (
              <span className="user-dropdown-coming" style={{ background: '#084838', color: '#FFFFFF', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </TenantLink>
          {/* PBS 2026-07-16 · Item 5 — Mail Analytics moved out of the inbox
              sidebar. Admin-only (holding_role owner|admin). */}
          {isAdmin && (
            <TenantLink href="/mail/analytics" className="user-dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
              <span className="user-dropdown-icon">📈</span>Mail Analytics
            </TenantLink>
          )}
          {/* TBC University · 2026-07-23 — help portal + ask window. Plain <a>
              (not TenantLink): /university is platform-wide, never /h/-prefixed. */}
          <a href="/university" className="user-dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
            <span className="user-dropdown-icon">🎓</span>TBC University
          </a>
          <TenantLink href="/settings" className="user-dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
            <span className="user-dropdown-icon">⚙</span>Settings
          </TenantLink>
          <TenantLink href="/settings/notifications" className="user-dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
            <span className="user-dropdown-icon">🔔</span>Notifications
          </TenantLink>
          <a
            href="/api/user/gmail/connect"
            className="user-dropdown-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <span className="user-dropdown-icon">✉</span>
            {gmailConnected?.connected ? 'Reconnect Email' : 'Connect Email'}
            {gmailConnected?.connected && gmailConnected.address && (
              <span className="user-dropdown-coming" title={gmailConnected.address} style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {gmailConnected.address}
              </span>
            )}
          </a>
          <button type="button" className="user-dropdown-item disabled" role="menuitem" disabled>
            <span className="user-dropdown-icon">⇄</span>Switch property
            <span className="user-dropdown-coming">single property</span>
          </button>
          <div className="user-dropdown-divider" />
          <a href="/api/logout" className="user-dropdown-item logout" role="menuitem">
            <span className="user-dropdown-icon">↩</span>Sign out
          </a>
        </div>
      )}
    </div>
  );
}
