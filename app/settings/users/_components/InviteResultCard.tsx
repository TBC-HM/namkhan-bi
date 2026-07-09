// app/settings/users/_components/InviteResultCard.tsx
// PBS 2026-07-09: display invite outcome — email status + copy-link fallback
// + WhatsApp share, so PBS is never blocked by unconfigured SMTP.
'use client';

import { useState, type CSSProperties } from 'react';

interface Props {
  email: string;
  actionLink: string | null;
  emailFired: boolean;
  onDismiss: () => void;
}

export default function InviteResultCard({ email, actionLink, emailFired, onDismiss }: Props) {
  const [copied, setCopied] = useState(false);

  const message = actionLink
    ? `Hi — here's your one-time link to set your password and log into namkhan-bi. Click, choose a password, and you're in. The link expires in 1 hour.\n\n${actionLink}`
    : '';

  const waHref = message ? `https://wa.me/?text=${encodeURIComponent(message)}` : undefined;
  const mailtoHref = message
    ? `mailto:${email}?subject=${encodeURIComponent('Your namkhan-bi invite')}&body=${encodeURIComponent(message)}`
    : undefined;

  async function copyLink() {
    if (!actionLink) return;
    try {
      await navigator.clipboard.writeText(actionLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  }
  async function copyMessage() {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0B5B3A' }}>
          {emailFired ? '✓' : '⚠'} Invitation for <span style={{ fontFamily: 'monospace' }}>{email}</span>
        </div>
        <button type="button" onClick={onDismiss} style={dismissBtn}>×</button>
      </div>
      <div style={{ fontSize: 11, color: '#3A3A3A', marginBottom: 6 }}>
        {emailFired
          ? 'Supabase Auth queued an invitation email. If it does not arrive within 2 minutes (SMTP may not be configured), share the link below directly.'
          : 'No email was queued. Share the link below directly.'}
      </div>
      {actionLink ? (
        <>
          <div style={linkBoxStyle}>{actionLink}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            <button type="button" onClick={copyLink} style={btnPrimary}>
              {copied ? 'Copied ✓' : 'Copy link'}
            </button>
            <button type="button" onClick={copyMessage} style={btnSecondary}>Copy ready-to-send message</button>
            {waHref && <a href={waHref} target="_blank" rel="noopener noreferrer" style={btnSecondaryLink}>WhatsApp</a>}
            {mailtoHref && <a href={mailtoHref} style={btnSecondaryLink}>Email</a>}
          </div>
          <div style={{ fontSize: 10, color: '#7A7A7A', marginTop: 6 }}>
            Link is valid for ~1 hour. Recipient clicks → sets a password → lands on /account/password.
          </div>
        </>
      ) : (
        <div style={{ fontSize: 11, color: '#B04A2F' }}>
          No action_link returned by server. Check /api/settings/users response.
        </div>
      )}
    </div>
  );
}

const cardStyle: CSSProperties = {
  marginTop: 8, padding: 10, background: '#F5FBEF', border: '1px solid #C7D9B4', borderRadius: 4,
};
const linkBoxStyle: CSSProperties = {
  padding: 8, background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 4,
  fontSize: 10, fontFamily: 'monospace', color: '#1B1B1B', wordBreak: 'break-all', lineHeight: 1.4,
};
const btnPrimary: CSSProperties = {
  padding: '5px 12px', borderRadius: 4, border: 'none',
  background: '#084838', color: '#FFFFFF', fontSize: 10,
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
};
const btnSecondary: CSSProperties = {
  padding: '5px 12px', borderRadius: 4, border: '1px solid #084838',
  background: '#FFFFFF', color: '#084838', fontSize: 10,
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
};
const btnSecondaryLink: CSSProperties = {
  padding: '5px 12px', borderRadius: 4, border: '1px solid #084838',
  background: '#FFFFFF', color: '#084838', fontSize: 10,
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700,
  textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
};
const dismissBtn: CSSProperties = {
  background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', color: '#5A5A5A', lineHeight: 1, padding: 2,
};
