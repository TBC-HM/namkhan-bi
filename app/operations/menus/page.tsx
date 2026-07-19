// app/operations/menus/page.tsx
// ADR-156 Menu Studio — design-system, tabbed, section-structured, waits for AI jobs.
import { revalidatePath } from 'next/cache';
import { DashboardPage } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

const PID = 260955;
const PATH = '/operations/menus';

async function callEdge(slug: string, body: any) {
  const sb = getSupabaseAdmin();
  const { data: secret } = await sb.rpc('fn_read_vault_secret', { p_name: 'gh_bridge_caller_secret' });
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  try {
    await fetch(base + '/functions/v1/' + slug, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-bridge-secret': String(secret || '') }, body: JSON.stringify(body) });
  } catch (_) { /* edge fn still completes server-side */ }
}

async function runReview(fd: FormData) { 'use server'; await callEdge('menu-review', { menu_id: Number(fd.get('menu_id')) }); revalidatePath(PATH); }
async function repairCatalog() { 'use server'; await callEdge('menu-catalog-repair', { property_id: PID }); revalidatePath(PATH); }
async function runIngest(fd: FormData) { 'use server'; const text = String(fd.get('text') || ''); if (text.trim().length > 4) await callEdge('menu-ingest', { property_id: PID, title: String(fd.get('title') || 'Imported menu'), text }); revalidatePath(PATH); }
async function publishMenu(fd: FormData) { 'use server'; await getSupabaseAdmin().rpc('fn_menu_publish', { p_menu_id: Number(fd.get('menu_id')), p_by: 'pbs' }); revalidatePath(PATH); }
async function decideReview(fd: FormData) { 'use server'; await getSupabaseAdmin().rpc('fn_menu_review_decide', { p_review_id: Number(fd.get('review_id')), p_decision: String(fd.get('decision')), p_by: 'pbs' }); revalidatePath(PATH); }
async function dismissItem(fd: FormData) { 'use server'; await getSupabaseAdmin().rpc('fn_menu_set_item_active', { p_item_id: Number(fd.get('item_id')), p_active: false }); revalidatePath(PATH); }
async function createMenu(fd: FormData) { 'use server'; await getSupabaseAdmin().rpc('fn_menu_create', { p: { property_id: PID, kind: String(fd.get('kind') || 'food'), title: String(fd.get('title') || 'New menu'), created_by: 'pbs' } }); revalidatePath(PATH); }
async function addSection(fd: FormData) { 'use server'; const t = String(fd.get('title') || '').trim(); if (t) await getSupabaseAdmin().rpc('fn_menu_add_section', { p_menu_id: Number(fd.get('menu_id')), p_title: t, p_sort: 0 }); revalidatePath(PATH); }
async function addItem(fd: FormData) { 'use server'; const name = String(fd.get('name') || '').trim(); if (!name) { revalidatePath(PATH); return; } const p: any = { menu_id: Number(fd.get('menu_id')), section_id: Number(fd.get('section_id')), name }; const price = fd.get('price_usd'); if (price) p.price_usd = Number(price); const d = fd.get('description'); if (d) p.description = String(d); await getSupabaseAdmin().rpc('fn_menu_upsert_item', { p }); revalidatePath(PATH); }

const T: any = {
  card: { background: 'var(--paper,#fff)', border: '1px solid var(--hairline,#E6DFCC)', borderRadius: 10, padding: 16 },
  h: { fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-soft,#5A5A5A)', margin: '0 0 12px' },
  muted: { color: 'var(--ink-soft,#5A5A5A)', fontSize: 12 },
  btn: { padding: '7px 12px', background: 'var(--primary,#1F3A2E)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  ghost: { padding: '7px 12px', background: 'transparent', color: 'var(--ink,#1B1B1B)', border: '1px solid var(--hairline,#E6DFCC)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  input: { padding: '7px 9px', border: '1px solid var(--hairline,#E6DFCC)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: 'var(--paper,#fff)', color: 'var(--ink,#1B1B1B)' },
  link: { color: 'var(--primary,#1F3A2E)', textDecoration: 'none', fontSize: 13 },
  th: { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-soft,#5A5A5A)', padding: '6px 8px', borderBottom: '1px solid var(--hairline,#E6DFCC)' },
  td: { padding: '6px 8px', borderBottom: '1px solid var(--hairline,#E6DFCC)', fontSize: 13, color: 'var(--ink,#1B1B1B)' },
  sec: { fontSize: 13, fontWeight: 600, color: 'var(--primary,#1F3A2E)', margin: '14px 0 6px', paddingBottom: 4, borderBottom: '1px solid var(--hairline,#E6DFCC)' },
};
function chip(kind: string) {
  const map: any = { best: ['#2E7D32', 'rgba(46,125,50,0.12)', 'best'], worst: ['#B8542A', 'rgba(184,84,42,0.12)', 'slow'], published: ['#2E7D32', 'rgba(46,125,50,0.12)', 'published'], draft: ['#5A5A5A', 'var(--bg,#F4EFE2)', 'draft'] };
  const c = map[kind]; if (!c) return null;
  return <span style={{ fontSize: 10, color: c[0], background: c[1], padding: '1px 7px', borderRadius: 99, marginLeft: 6 }}>{c[2]}</span>;
}
function SubTabs({ active }: { active: string }) {
  const tabs: [string, string][] = [['menus', 'Menus'], ['catalog', 'POS Catalog (reference)'], ['import', 'New / Import']];
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--hairline,#E6DFCC)' }}>
      {tabs.map(([k, l]) => { const on = active === k; return <a key={k} href={'/operations/menus?tab=' + k} style={{ padding: '6px 12px', fontSize: 13, fontWeight: on ? 600 : 500, color: on ? 'var(--ink,#1B1B1B)' : 'var(--ink-soft,#5A5A5A)', borderBottom: on ? '2px solid var(--primary,#1F3A2E)' : '2px solid transparent', textDecoration: 'none' }}>{l}</a>; })}
    </div>
  );
}
function itemRow(i: any) {
  return (
    <div key={i.item_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--hairline,#E6DFCC)' }}>
      <div><span style={{ color: 'var(--ink,#1B1B1B)', fontSize: 13 }}>{i.name}</span>{chip(i.seller_band)}{i.description ? <div style={T.muted}>{i.description}</div> : null}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, color: 'var(--ink,#1B1B1B)' }}>{i.price_usd != null ? '$' + Number(i.price_usd).toFixed(2) : ''}</span><form action={dismissItem}><input type="hidden" name="item_id" value={i.item_id} /><button style={{ ...T.ghost, padding: '3px 8px', fontSize: 11 }}>Remove</button></form></div>
    </div>
  );
}

export default async function MenuStudio({ searchParams }: { searchParams?: Record<string, string | undefined> }) {
  const tab = (searchParams?.tab) || 'menus';
  const selId = Number(searchParams?.menu || 0);
  const sb = getSupabaseAdmin();
  const { data: menus } = await sb.from('v_menu_editor').select('*').eq('property_id', PID).order('updated_at', { ascending: false });
  const list = menus ?? [];
  const opsTabs = OPERATIONS_SUBPAGES.map((t: any, i: number) => ({ key: 'ops' + i, label: t.label, href: t.href }));

  let view: any;
  if (tab === 'catalog') {
    const { data: cat } = await sb.from('v_menu_catalog').select('*').eq('property_id', PID).eq('is_junk', false).order('revenue_12m', { ascending: false });
    view = (
      <div style={T.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div><div style={T.h}>Source of truth · POS catalog (reference only)</div><div style={T.muted}>Cleaned + deduped from POS sales. Use it to price and prioritise items — it is NOT a menu. Build menus in the Menus tab.</div></div>
          <form action={repairCatalog}><button style={T.btn}>Repair from POS ↻</button></form>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
          <thead><tr><th style={T.th}>Category</th><th style={T.th}>Group</th><th style={T.th}>Merged</th><th style={{ ...T.th, textAlign: 'right' }}>12m rev</th><th style={{ ...T.th, textAlign: 'right' }}>Avg price</th><th style={T.th}></th></tr></thead>
          <tbody>
            {(cat ?? []).map((c: any) => (<tr key={c.catalog_id}><td style={T.td}>{c.name}</td><td style={T.td}>{c.group_label}</td><td style={T.td}>{c.alias_count}</td><td style={{ ...T.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.revenue_12m != null ? '$' + Math.round(c.revenue_12m).toLocaleString() : '—'}</td><td style={{ ...T.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.avg_price != null ? '$' + Number(c.avg_price).toFixed(2) : '—'}</td><td style={T.td}>{chip(c.seller_band)}</td></tr>))}
            {(cat ?? []).length === 0 ? <tr><td style={T.td} colSpan={6}><span style={T.muted}>Empty — click Repair from POS.</span></td></tr> : null}
          </tbody>
        </table>
      </div>
    );
  } else if (tab === 'import') {
    view = (
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ ...T.card, flex: '1 1 260px' }}>
          <div style={T.h}>New menu</div>
          <div style={{ ...T.muted, marginBottom: 8 }}>One menu per surface — Drinks, Lunch, Dinner, Kids… each gets its own QR.</div>
          <form action={createMenu} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input name="title" placeholder="Menu name (e.g. Dinner)" style={T.input} />
            <select name="kind" style={T.input} defaultValue="food">{['food', 'drink', 'minibar', 'room_service', 'kids', 'spa', 'activity', 'experience', 'retreat', 'event'].map((k) => <option key={k} value={k}>{k}</option>)}</select>
            <button style={T.btn}>Create menu</button>
          </form>
        </div>
        <div style={{ ...T.card, flex: '1 1 340px' }}>
          <div style={T.h}>Import existing menu (paste)</div>
          <form action={runIngest} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input name="title" placeholder="Menu name" style={T.input} />
            <textarea name="text" placeholder="Paste one menu's text — sections, dishes, prices. Creates a structured menu." rows={6} style={{ ...T.input, resize: 'vertical' }} />
            <button style={T.btn}>Import (waits ~15s)</button>
          </form>
          <div style={{ ...T.muted, marginTop: 8 }}>Paste ONE menu at a time. PDF/photo upload is the next add.</div>
        </div>
      </div>
    );
  } else {
    const sel = selId ? list.find((m: any) => m.id === selId) : list[0];
    let items: any[] = [], reviews: any[] = [], sections: any[] = [];
    if (sel) {
      items = (await sb.from('v_menu_items_full').select('*').eq('menu_id', sel.id)).data ?? [];
      reviews = (await sb.from('v_menu_reviews').select('*').eq('menu_id', sel.id).eq('status', 'pending').order('dimension')).data ?? [];
      sections = (await sb.from('v_menu_sections').select('*').eq('menu_id', sel.id).order('section_id')).data ?? [];
    }
    const activeItems = items.filter((i: any) => i.is_active);
    view = (
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ ...T.card, width: 280, flexShrink: 0 }}>
          <div style={T.h}>Menus ({list.length})</div>
          {list.length === 0 ? <div style={T.muted}>None yet — use New / Import.</div> : null}
          {list.map((m: any) => { const on = sel && m.id === sel.id; return (
            <a key={m.id} href={'/operations/menus?tab=menus&menu=' + m.id} style={{ display: 'block', padding: '8px 10px', borderRadius: 8, textDecoration: 'none', marginBottom: 4, background: on ? 'var(--bg,#F4EFE2)' : 'transparent' }}>
              <div style={{ color: 'var(--ink,#1B1B1B)', fontSize: 13, fontWeight: on ? 600 : 500 }}>{m.title}{chip(m.status === 'published' ? 'published' : 'draft')}</div>
              <div style={T.muted}>{m.kind} · {m.item_count} items · {m.pending_reviews} to review</div>
            </a>); })}
        </div>
        <div style={{ flex: '1 1 360px', minWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!sel ? <div style={T.card}><span style={T.muted}>Pick a menu, or create one in New / Import.</span></div> : (
            <>
              <div style={T.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div><div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink,#1B1B1B)' }}>{sel.title}{chip(sel.status === 'published' ? 'published' : 'draft')}</div><div style={T.muted}>{sel.kind}</div></div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <form action={runReview}><input type="hidden" name="menu_id" value={sel.id} /><button style={T.ghost}>Run AI review (~15s)</button></form>
                    <form action={publishMenu}><input type="hidden" name="menu_id" value={sel.id} /><button style={T.btn}>Publish → QR</button></form>
                  </div>
                </div>
                <div style={{ marginTop: 10, ...T.muted }}>{sel.status === 'published' ? <>QR (permanent): <a style={T.link} target="_blank" rel="noreferrer" href={'/p/m/' + sel.qr_slug}>{'/p/m/' + sel.qr_slug} ↗</a></> : 'Not published — publish to generate the permanent QR link.'}</div>
              </div>
              <div style={T.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ ...T.h, margin: 0 }}>Structure</div>
                  <form action={addSection} style={{ display: 'flex', gap: 6 }}><input type="hidden" name="menu_id" value={sel.id} /><input name="title" placeholder="New section (e.g. Starters)" style={T.input} /><button style={T.ghost}>Add section</button></form>
                </div>
                {sections.length === 0 ? <div style={{ ...T.muted, marginTop: 10 }}>Add a section to start — Starters, Mains, Desserts, Drinks…</div> : null}
                {sections.map((sc: any) => (
                  <div key={sc.section_id}>
                    <div style={T.sec}>{sc.title}</div>
                    {activeItems.filter((i: any) => i.section_id === sc.section_id).map((i: any) => itemRow(i))}
                    <form action={addItem} style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <input type="hidden" name="menu_id" value={sel.id} /><input type="hidden" name="section_id" value={sc.section_id} />
                      <input name="name" placeholder="Item name" style={{ ...T.input, flex: '2 1 140px' }} />
                      <input name="price_usd" placeholder="$" style={{ ...T.input, width: 70 }} />
                      <input name="description" placeholder="Description (optional)" style={{ ...T.input, flex: '3 1 180px' }} />
                      <button style={T.ghost}>Add</button>
                    </form>
                  </div>
                ))}
                {activeItems.filter((i: any) => !i.section_id).length > 0 ? (<><div style={T.sec}>Unsectioned</div>{activeItems.filter((i: any) => !i.section_id).map((i: any) => itemRow(i))}</>) : null}
              </div>
              <div style={T.card}>
                <div style={T.h}>AI suggestions ({reviews.length})</div>
                {reviews.length === 0 ? <div style={T.muted}>None pending. Click Run AI review.</div> : null}
                {reviews.map((r: any) => (
                  <div key={r.review_id} style={{ padding: '8px 0', borderBottom: '1px solid var(--hairline,#E6DFCC)' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--sand,#B8A878)' }}>{r.dimension}{r.item_name ? ' · ' + r.item_name : ''}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink,#1B1B1B)', margin: '2px 0' }}>{r.comment}</div>
                    {r.proposed_value ? <div style={{ fontSize: 12, color: 'var(--primary,#1F3A2E)', fontStyle: 'italic' }}>{'→ ' + (r.proposed_value.name || r.proposed_value.description || '')}</div> : null}
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <form action={decideReview}><input type="hidden" name="review_id" value={r.review_id} /><input type="hidden" name="decision" value="accepted" /><button style={T.btn}>Accept</button></form>
                      <form action={decideReview}><input type="hidden" name="review_id" value={r.review_id} /><input type="hidden" name="decision" value="dismissed" /><button style={T.ghost}>Dismiss</button></form>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <DashboardPage title="Menu Studio" tabs={opsTabs}>
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SubTabs active={tab} />
        {view}
      </div>
    </DashboardPage>
  );
}
