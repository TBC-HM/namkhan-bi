// app/h/[property_id]/settings/property/links/page.tsx
// ADR-236 — Newsletter link catalog editor.
//
// PBS 2026-08-05: "regarding the urls there is a newsletter tab in settings, there we should
// put a list of usable urls which we add and edit."
//
// WHY THIS EXISTS: finding #18 — 78 measured HTTP 404s in live campaigns, every one from a
// URL that was already IN this catalog. The writer inserts product links deterministically
// from these rows and is explicitly forbidden from writing URLs itself, so the AI was correct
// and the DATA was wrong. There has never been a surface to fix that data. This is it.
//
// Property-scoped, so Donna (1000001) builds its own list rather than inheriting Namkhan URLs.
//
// Reads : public.v_link_catalog_admin (joins the review engine's measured link failures)
// Writes: public.fn_link_catalog_upsert / fn_link_catalog_toggle (claude_md §0.5 — wrappers)

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, MONO } from '@/components/cockpit/tokens';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Row = {
  id: number; property_id: number; url: string; title: string | null; section: string | null;
  anchor_hint: string | null; description: string | null; active: boolean;
  is_pinned: boolean | null; last_verified_at: string | null;
  measured_failure_status: string | null; has_measured_failure: boolean;
};

async function saveLink(formData: FormData) {
  'use server';
  const propertyId = Number(formData.get('property_id'));
  const idRaw = String(formData.get('id') ?? '');
  const sb = getSupabaseAdmin();
  await (sb as any).rpc('fn_link_catalog_upsert', {
    p_property_id: propertyId,
    p_url: String(formData.get('url') ?? ''),
    p_title: String(formData.get('title') ?? ''),
    p_section: String(formData.get('section') ?? 'general'),
    p_anchor_hint: String(formData.get('anchor_hint') ?? ''),
    p_description: String(formData.get('description') ?? ''),
    p_is_pinned: formData.get('is_pinned') === 'on',
    p_id: idRaw ? Number(idRaw) : null,
    p_actor: 'PBS',
  });
  revalidatePath(`/h/${propertyId}/settings/property/links`);
}

async function toggleLink(formData: FormData) {
  'use server';
  const propertyId = Number(formData.get('property_id'));
  const sb = getSupabaseAdmin();
  await (sb as any).rpc('fn_link_catalog_toggle', {
    p_id: Number(formData.get('id')),
    p_active: String(formData.get('next_active')) === 'true',
    p_reason: String(formData.get('reason') ?? ''),
    p_actor: 'PBS',
  });
  revalidatePath(`/h/${propertyId}/settings/property/links`);
}

const card: React.CSSProperties = {
  background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8, padding: '14px 16px',
};
const lbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase' as const, color: TOKENS.text2,
};
const inp: React.CSSProperties = {
  padding: '6px 8px', fontSize: 13, border: `1px solid ${TOKENS.border}`,
  borderRadius: 4, background: '#FFFFFF', color: TOKENS.ink, width: '100%',
};
const btn: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 4,
  cursor: 'pointer', border: 'none', background: '#1F3A2E', color: '#FFFFFF',
};

export default async function LinkCatalogPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  const sb = getSupabaseAdmin();
  const { data } = await (sb as any)
    .from('v_link_catalog_admin')
    .select('*')
    .eq('property_id', propertyId)
    .order('active', { ascending: false })
    .order('section')
    .order('title');

  const rows = (data ?? []) as Row[];
  const active = rows.filter((r) => r.active);
  const inactive = rows.filter((r) => !r.active);
  const failing = rows.filter((r) => r.has_measured_failure && r.active);
  const sections = Array.from(new Set(rows.map((r) => r.section).filter(Boolean))) as string[];

  return (
    <div style={{ maxWidth: 1100, color: TOKENS.ink }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 2px' }}>Newsletter link catalog</h1>
      <p style={{ fontSize: 12, color: TOKENS.text2, margin: '0 0 18px', maxWidth: 780 }}>
        These are the <strong>only</strong> URLs the newsletter writer may use. It inserts them
        deterministically and is forbidden from inventing links — so a wrong row here becomes a
        wrong link in every email that uses it. Deactivating never deletes: the row keeps its
        history and the reason.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 18 }}>
        <div style={card}><div style={lbl}>Usable</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: MONO }}>{active.length}</div></div>
        <div style={card}><div style={lbl}>Deactivated</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: MONO, color: TOKENS.text2 }}>{inactive.length}</div></div>
        <div style={card}><div style={lbl}>Measured failing</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: MONO, color: failing.length ? '#B71C1C' : '#2E7D32' }}>
            {failing.length}</div>
          <div style={{ fontSize: 10.5, color: TOKENS.text2 }}>still active, seen failing in a real campaign</div></div>
        <div style={card}><div style={lbl}>Never verified</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: MONO }}>
            {active.filter((r) => !r.last_verified_at).length}</div></div>
      </div>

      {/* ── ADD ─────────────────────────────────────────────────── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ ...lbl, marginBottom: 10 }}>Add a URL</div>
        <form action={saveLink} style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <input type="hidden" name="property_id" value={propertyId} />
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={lbl}>URL</span>
            <input style={inp} name="url" placeholder="https://…" required />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={lbl}>Title / anchor text</span>
            <input style={inp} name="title" placeholder="Book a Stay" required />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={lbl}>Section</span>
            <input style={inp} name="section" list="sections" placeholder="booking" defaultValue="general" />
            <datalist id="sections">{sections.map((s) => <option key={s} value={s} />)}</datalist>
          </label>
          <button type="submit" style={btn}>Add</button>
        </form>
      </div>

      {/* ── LIST ────────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div style={{ ...card, color: TOKENS.text2, fontSize: 13 }}>
          No links for this property yet. The writer has nothing to link to — every email will
          go out without product links until at least one row exists.
        </div>
      ) : (
        <div style={{ border: `1px solid ${TOKENS.border}`, borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#FAFAF7', borderBottom: `1px solid ${TOKENS.border}` }}>
                {['SECTION', 'TITLE', 'URL', 'STATE', ''].map((h) => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: 10.5, color: TOKENS.text2, letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                // 403 is almost always a bot-block on HEAD (TripAdvisor, Instagram), not a dead
                // page — flagging it as broken would train the owner to ignore the column.
                const botBlocked = r.measured_failure_status === '403';
                const reallyDead = r.has_measured_failure && !botBlocked;
                return (
                  <tr key={r.id} style={{
                    borderBottom: i < rows.length - 1 ? `1px solid ${TOKENS.border}` : 'none',
                    background: !r.active ? '#FAFAF7' : reallyDead ? '#FFEBEE66' : undefined,
                    opacity: r.active ? 1 : 0.62,
                  }}>
                    <td style={{ padding: '9px 12px', fontFamily: MONO, fontSize: 11, color: TOKENS.text2 }}>{r.section ?? '—'}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 500 }}>
                      {r.title}
                      {r.is_pinned && <span style={{ marginLeft: 6, fontSize: 10, color: '#B26A00' }}>★ pinned</span>}
                    </td>
                    <td style={{ padding: '9px 12px', fontFamily: MONO, fontSize: 11, maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <a href={r.url} target="_blank" rel="noreferrer" style={{ color: TOKENS.forest }}>{r.url}</a>
                    </td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                      {reallyDead && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#B71C1C' }}>
                          HTTP {r.measured_failure_status} in a live campaign
                        </span>
                      )}
                      {botBlocked && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#B26A00' }}>
                          403 — likely bot-block, check by hand
                        </span>
                      )}
                      {!r.has_measured_failure && (
                        <span style={{ fontSize: 10, color: r.last_verified_at ? '#2E7D32' : TOKENS.text2 }}>
                          {r.last_verified_at ? 'verified' : 'never verified'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <form action={toggleLink} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <input type="hidden" name="property_id" value={propertyId} />
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="next_active" value={r.active ? 'false' : 'true'} />
                        {r.active && <input style={{ ...inp, width: 150, fontSize: 11, padding: '4px 6px' }} name="reason" placeholder="reason (optional)" />}
                        <button type="submit" style={{
                          ...btn, padding: '5px 11px', fontSize: 11,
                          background: r.active ? '#B71C1C' : '#1F3A2E',
                        }}>{r.active ? 'Deactivate' : 'Reactivate'}</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: 10.5, color: TOKENS.text3, marginTop: 14, maxWidth: 780 }}>
        &quot;Measured failing&quot; comes from the newsletter review engine, which HEADs every link it
        finds while grading a campaign — not from a guess. Editing a URL clears its verified
        stamp on purpose, so a changed link is re-checked before it ships.
      </p>
    </div>
  );
}
