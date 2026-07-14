'use client';

import TenantLink from '@/components/nav/TenantLink';
import { useState, useRef, useEffect } from 'react';
import type { CurrentUser } from '@/lib/currentUser';
import { roleLabel } from '@/lib/currentUser';

export default function UserMenu({ user }: { user: CurrentUser }) {
  const [open, setOpen] = useState(false);
  const [gmailConnected, setGmailConnected] = useState<{ connected: boolean; address?: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

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
