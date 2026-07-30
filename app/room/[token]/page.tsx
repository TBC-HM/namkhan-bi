// app/room/[token]/page.tsx — EXTERNAL data-room guest view.
// Brief dataroom-module-v1 (goal 49) · pattern mirrors /p/[token] (proposals).
//
// Token = only auth surface. Every request re-validates the grant inside
// public.fn_dataroom_guest_bundle (SECURITY DEFINER, service_role-only):
// revoked_at IS NULL AND expires_at > now() — so revoke is effective on the
// very next request (A4c). Invalid/expired/revoked token → 404, no hints.
// Zero platform navigation (middleware PUBLIC_PATHS + chrome components all
// hide on /room/). Existence-hiding: the bundle returns ONLY the granted
// room's sections + non-retired items — nothing else exists for the guest.
//
// Watermark: CSS overlay (guest email · room · timestamp) — a deterrent, not
// DRM (research R4, honest-limits note in the brief).

import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface GuestBundle {
  room: { name: string; slug: string; template: string };
  guest: { email: string; display_name: string | null };
  can_download: boolean;
  expires_at: string | null;
  last_login_at: string | null;
  sections: Array<{ id: string; code: string; title: string; pillar: string | null; sort: number }>;
  items: Array<{
    id: string; section_id: string; title: string; kind: string;
    mode: string | null; download_allowed: boolean; added_at: string;
  }>;
}

const INK = '#1B1B1B';
const MUTE = '#6B6B6B';
const HAIRLINE = '#E6DFCC';
const GREEN = '#1F3A2E';

export default async function RoomGuestPage({ params }: { params: { token: string } }) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_dataroom_guest_bundle', { p_token: params.token });
  if (error || !data) notFound();
  const bundle = data as GuestBundle;

  const bySection = new Map<string, GuestBundle['items']>();
  for (const it of bundle.items) {
    const arr = bySection.get(it.section_id) ?? [];
    arr.push(it);
    bySection.set(it.section_id, arr);
  }
  const lastLogin = bundle.last_login_at ? new Date(bundle.last_login_at) : null;
  const newItems = lastLogin
    ? bundle.items.filter((i) => new Date(i.added_at) > lastLogin)
    : [];
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const wmText = `${bundle.guest.email} · ${bundle.room.name} · ${now} UTC`;

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px 80px', color: INK, position: 'relative' }}>
      {/* watermark overlay — deterrent only (research R4) */}
      <div aria-hidden style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50,
        display: 'flex', flexWrap: 'wrap', alignContent: 'space-around',
        justifyContent: 'space-around', opacity: 0.06, overflow: 'hidden',
      }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} style={{ transform: 'rotate(-24deg)', fontSize: 13, whiteSpace: 'nowrap', padding: 40 }}>
            {wmText}
          </span>
        ))}
      </div>

      <header style={{ borderBottom: `2px solid ${GREEN}`, paddingBottom: 16, marginBottom: 8 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTE }}>
          Secure data room
        </div>
        <h1 style={{ fontSize: 26, margin: '6px 0 4px', fontWeight: 600 }}>{bundle.room.name}</h1>
        <div style={{ fontSize: 13, color: MUTE }}>
          Shared with {bundle.guest.display_name ?? bundle.guest.email}
          {bundle.expires_at ? ` · access expires ${new Date(bundle.expires_at).toISOString().slice(0, 10)}` : ''}
          {' · all activity is logged'}
        </div>
      </header>

      {newItems.length > 0 && (
        <div style={{ background: '#F5F0E1', border: `1px solid ${HAIRLINE}`, borderRadius: 8, padding: '10px 14px', margin: '14px 0', fontSize: 13 }}>
          <strong>{newItems.length} new</strong> since your last visit:{' '}
          {newItems.slice(0, 5).map((i) => i.title).join(' · ')}
        </div>
      )}

      {bundle.sections.map((s) => {
        const items = bySection.get(s.id) ?? [];
        return (
          <section key={s.id} style={{ margin: '22px 0' }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span style={{ color: MUTE, fontSize: 12 }}>{s.code}</span> {s.title}
            </h2>
            {items.length === 0 ? (
              <div style={{ fontSize: 13, color: MUTE, padding: '8px 0', borderTop: `1px solid ${HAIRLINE}` }}>
                No documents in this section yet.
              </div>
            ) : items.map((it) => (
              <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: `1px solid ${HAIRLINE}`, fontSize: 14 }}>
                <span>
                  {it.title}
                  {newItems.some((n) => n.id === it.id) && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: GREEN, fontWeight: 600 }}>NEW</span>
                  )}
                </span>
                <span style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                  <a href={`/api/room/${params.token}/item/${it.id}?mode=view`} target="_blank" rel="noopener"
                     style={{ color: GREEN, textDecoration: 'underline', fontSize: 13 }}>
                    View
                  </a>
                  {bundle.can_download && it.download_allowed && (
                    <a href={`/api/room/${params.token}/item/${it.id}?mode=download`}
                       style={{ color: GREEN, textDecoration: 'underline', fontSize: 13 }}>
                      Download
                    </a>
                  )}
                </span>
              </div>
            ))}
          </section>
        );
      })}

      <footer style={{ marginTop: 48, paddingTop: 16, borderTop: `1px solid ${HAIRLINE}`, fontSize: 12, color: MUTE }}>
        Confidential. Access to this room is personal, logged, and revocable at any time.
      </footer>
    </main>
  );
}
