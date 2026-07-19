// app/operations/menus/page.tsx — ADR-156 Menu Studio (client-action pattern; buttons via /api/operations/menus)
import { DashboardPage } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { ActBtn, ActForm } from './_client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PID = 260955;

const T: any = {
  card: { background: 'var(--paper,#fff)', border: '1px solid var(--hairline,#E6DFCC)', borderRadius: 10, padding: 16 },
  h: { fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-soft,#5A5A5A)', margin: '0 0 12px' },
  muted: { color: 'var(--ink-soft,#5A5A5A)', fontSize: 12 },
  btn: { padding: '7px 12px', background: 'var(--primary,#1F3A2E)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  ghost: { padding: '7px 12px', background: 'transparent', color: 'var(--ink,#1B1B1B)', border: '1px solid var(--hairline,#E6DFCC)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  chip: { padding: '4px 9px', background: 'var(--bg,#F4EFE2)', color: 'var(--ink,#1B1B1B)', border: '1px solid var(--hairline,#E6DFCC)', borderRadius: 99, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' },
  small: { padding: '3px 8px', background: 'transparent', color: 'var(--ink-soft,#5A5A5A)', border: '1px solid var(--hairline,#E6DFCC)', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' },
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
  return <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--hairline,#E6DFCC)' }}>{tabs.map(([k, l]) => { const on = active === k; return <a key={k} href={'/operations/menus?tab=' + k} style={{ padding: '6px 12px', fontSize: 13, fontWeight: on ? 600 : 500, color: on ? 'var(--ink,#1B1B1B)' : 'var(--ink-soft,#5A5A5A)', borderBottom: on ? '2px solid var(--primary,#1F3A2E)' : '2px solid transparent', textDecoration: 'none' }}>{l}</a>; })}</div>;
}
function itemRow(i: any) {
  return (
    <div key={i.item_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--hairline,#E6DFCC)' }}>
      <div><span style={{ color: 'var(--ink,#1B1B1B)', fontSize: 13 }}>{i.name}</span>{chip(i.seller_band)}{i.description ? <div style={T.muted}>{i.description}</div> : null}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{i.price_usd != null ? '$' + Number(i.price_usd).toFixed(2) : ''}</span><ActBtn op="dismiss_item" params={{ item_id: i.item_id }} style={T.small}>Remove</ActBtn></div>
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
          <div><div style={T.h}>POS catalog — reference only</div><div style={T.muted}>Cleaned + deduped from POS sales (category level — no individual dishes exist in POS). Use it to price and prioritise. Build menus in the Menus tab; these names appear as section suggestions.</div></div>
          <ActBtn op="repair" style={T.btn}>Repair from POS ↻</ActBtn>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
          <thead><tr><th style={T.th}>Category</th><th style={T.th}>Group</th><th style={T.th}>Merged</th><th style={{ ...T.th, textAlign: 'right' }}>12m rev</th><th style={{ ...T.th, textAlign: 'right' }}>Avg price</th><th style={T.th}></th></tr></thead>
          <tbody>
            {(cat ?? []).map((c: any) => (<tr key={c.catalog_id}><td style={T.td}>{c.name}</td><td style={T.td}>{c.group_label}</td><td style={T.td}>{c.alias_count}</td><td style={{ ...T.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.revenue_12m != null ? '$' + Math.round(c.revenue_12m).toLocaleString() : '—'}</td><td style={{ ...T.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.avg_price != null ? '$' + Number(c.avg_price).toFixed(2) : '—'}</td><td style={T.td}>{chip(c.seller_band)}</td></tr>))}
            {(cat ?? []).length === 0 ? <tr><td style={T.td} colSpan={6}><span style={T.muted}>Empty — click Repair from POS (waits ~15s).</span></td></tr> : null}
          </tbody>
        </table>
      </div>
    );
  } else if (tab === 'import') {
    view = (
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ ...T.card, flex: '1 1 260px' }}>
          <div style={T.h}>New menu</div>
          <div style={{ ...T.muted, marginBottom: 8 }}>One per surface — Drinks, Lunch, Dinner, Kids… each gets its own QR.</div>
          <ActForm op="create" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input name="title" placeholder="Menu name (e.g. Dinner)" style={T.input} />
            <select name="kind" style={T.input} defaultValue="food">{['food', 'drink', 'minibar', 'room_service', 'kids', 'spa', 'activity', 'experience', 'retreat', 'event'].map((k) => <option key={k} value={k}>{k}</option>)}</select>
            <button type="submit" style={T.btn}>Create menu</button>
          </ActForm>
        </div>
        <div style={{ ...T.card, flex: '1 1 340px' }}>
          <div style={T.h}>Import existing menu (paste)</div>
          <ActForm op="ingest" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input name="title" placeholder="Menu name" style={T.input} />
            <textarea name="text" placeholder="Paste ONE menu's text — sections, dishes, prices." rows={6} style={{ ...T.input, resize: 'vertical' }} />
            <button type="submit" style={T.btn}>Import (waits ~15s)</button>
          </ActForm>
          <div style={{ ...T.muted, marginTop: 8 }}>PDF/photo upload is the next add.</div>
        </div>
      </div>
    );
  } else {
    const sel = selId ? list.find((m: any) => m.id === selId) : list[0];
    let items: any[] = [], reviews: any[] = [], sections: any[] = [], dishLib: any[] = [], catNames: string[] = [];
    if (sel) {
      items = (await sb.from('v_menu_items_full').select('*').eq('menu_id', sel.id)).data ?? [];
      reviews = (await sb.from('v_menu_reviews').select('*').eq('menu_id', sel.id).eq('status', 'pending').order('dimension')).data ?? [];
      sections = (await sb.from('v_menu_sections').select('*').eq('menu_id', sel.id).order('section_id')).data ?? [];
      dishLib = (await sb.from('v_menu_dish_library').select('*').eq('property_id', PID)).data ?? [];
      catNames = ((await sb.from('v_menu_catalog').select('name').eq('property_id', PID).eq('is_junk', false)).data ?? []).map((c: any) => c.name);
    }
    const activeItems = items.filter((i: any) => i.is_active);
    const menuKeys = new Set(activeItems.map((i: any) => String(i.name || '').toLowerCase().trim()));
    const reuse = dishLib.filter((d: any) => !menuKeys.has(d.dish_key)).slice(0, 18);
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
          {!sel ? <div style={T.card}><span style={T.muted}>Pick a menu on the left, or create one in New / Import.</span></div> : (
            <>
              <div style={T.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div><div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink,#1B1B1B)' }}>{sel.title}{chip(sel.status === 'published' ? 'published' : 'draft')}</div><div style={T.muted}>{sel.kind}</div></div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <ActBtn op="run_review" params={{ menu_id: sel.id }} style={T.ghost}>Run AI review (~15s)</ActBtn>
                    <ActBtn op="publish" params={{ menu_id: sel.id }} style={T.btn}>Publish → QR</ActBtn>
                  </div>
                </div>
                <div style={{ marginTop: 10, ...T.muted }}>{sel.status === 'published' ? <>QR (permanent): <a style={T.link} target="_blank" rel="noreferrer" href={'/p/m/' + sel.qr_slug}>{'/p/m/' + sel.qr_slug} ↗</a></> : 'Not published — publish to generate the permanent QR link.'}</div>
              </div>
              <div style={T.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ ...T.h, margin: 0 }}>Structure</div>
                  <ActForm op="add_section" params={{ menu_id: sel.id }} style={{ display: 'flex', gap: 6 }}>
                    <input name="title" list="poscats" placeholder="New section — type or pick" style={T.input} />
                    <button type="submit" style={T.ghost}>Add section</button>
                  </ActForm>
                  <datalist id="poscats">{catNames.map((n) => <option key={n} value={n} />)}</datalist>
                </div>
                {sections.length === 0 ? <div style={{ ...T.muted, marginTop: 10 }}>Add a section to start — Starters, Mains, Desserts, Drinks…</div> : null}
                {sections.map((sc: any) => (
                  <div key={sc.section_id}>
                    <div style={T.sec}>{sc.title}</div>
                    {activeItems.filter((i: any) => i.section_id === sc.section_id).map((i: any) => itemRow(i))}
                    <ActForm op="add_item" params={{ menu_id: sel.id, section_id: sc.section_id }} style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <input name="name" placeholder="Add a dish…" style={{ ...T.input, flex: '2 1 140px' }} />
                      <input name="price_usd" placeholder="$" style={{ ...T.input, width: 70 }} />
                      <input name="description" placeholder="Description (optional)" style={{ ...T.input, flex: '3 1 160px' }} />
                      <button type="submit" style={T.ghost}>Add</button>
                    </ActForm>
                    {reuse.length > 0 ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        <span style={{ ...T.muted, alignSelf: 'center' }}>reuse:</span>
                        {reuse.map((d: any) => <ActBtn key={d.dish_key} op="add_item" params={{ menu_id: sel.id, section_id: sc.section_id, name: d.name, price_usd: d.price }} style={T.chip}>{d.name} +</ActBtn>)}
                      </div>
                    ) : null}
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
                      <ActBtn op="decide" params={{ review_id: r.review_id, decision: 'accepted' }} style={T.btn}>Accept</ActBtn>
                      <ActBtn op="decide" params={{ review_id: r.review_id, decision: 'dismissed' }} style={T.ghost}>Dismiss</ActBtn>
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
