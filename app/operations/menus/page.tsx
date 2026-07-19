// app/operations/menus/page.tsx
// ADR-156 Menu Studio — rebuilt on the TBC design system (DashboardPage + v6 tokens).
import { revalidatePath } from 'next/cache';
import { DashboardPage } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PID = 260955;
const PATH = '/operations/menus';

async function runReview(fd: FormData) { 'use server'; await getSupabaseAdmin().rpc('fn_menu_run_review', { p_menu_id: Number(fd.get('menu_id')) }); revalidatePath(PATH); }
async function publishMenu(fd: FormData) { 'use server'; await getSupabaseAdmin().rpc('fn_menu_publish', { p_menu_id: Number(fd.get('menu_id')), p_by: 'pbs' }); revalidatePath(PATH); }
async function decideReview(fd: FormData) { 'use server'; await getSupabaseAdmin().rpc('fn_menu_review_decide', { p_review_id: Number(fd.get('review_id')), p_decision: String(fd.get('decision')), p_by: 'pbs' }); revalidatePath(PATH); }
async function dismissItem(fd: FormData) { 'use server'; await getSupabaseAdmin().rpc('fn_menu_set_item_active', { p_item_id: Number(fd.get('item_id')), p_active: false }); revalidatePath(PATH); }
async function createMenu(fd: FormData) { 'use server'; await getSupabaseAdmin().rpc('fn_menu_create', { p: { property_id: PID, kind: String(fd.get('kind') || 'food'), title: String(fd.get('title') || 'New menu'), created_by: 'pbs' } }); revalidatePath(PATH); }
async function compileFromPos() { 'use server'; await getSupabaseAdmin().rpc('fn_menu_compile_from_pos', { p_property_id: PID, p_title: 'Restaurant (POS-compiled)' }); revalidatePath(PATH); }
async function repairCatalog() { 'use server'; await getSupabaseAdmin().rpc('fn_menu_run_catalog_repair', { p_property_id: PID }); revalidatePath(PATH); }
async function runIngest(fd: FormData) { 'use server'; const text = String(fd.get('text') || ''); if (text.trim().length > 4) await getSupabaseAdmin().rpc('fn_menu_run_ingest', { p_property_id: PID, p_title: String(fd.get('title') || 'Imported menu'), p_text: text }); revalidatePath(PATH); }

const T: any = {
  card: { background: 'var(--paper,#fff)', border: '1px solid var(--hairline,#E6DFCC)', borderRadius: 10, padding: 16 },
  h: { fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-soft,#5A5A5A)', margin: '0 0 12px' },
  muted: { color: 'var(--ink-soft,#5A5A5A)', fontSize: 12 },
  btn: { padding: '7px 12px', background: 'var(--primary,#1F3A2E)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  ghost: { padding: '7px 12px', background: 'transparent', color: 'var(--ink,#1B1B1B)', border: '1px solid var(--hairline,#E6DFCC)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  input: { padding: '8px 10px', border: '1px solid var(--hairline,#E6DFCC)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: 'var(--paper,#fff)', color: 'var(--ink,#1B1B1B)' },
  link: { color: 'var(--primary,#1F3A2E)', textDecoration: 'none', fontSize: 13 },
  th: { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-soft,#5A5A5A)', padding: '6px 8px', borderBottom: '1px solid var(--hairline,#E6DFCC)' },
  td: { padding: '6px 8px', borderBottom: '1px solid var(--hairline,#E6DFCC)', fontSize: 13, color: 'var(--ink,#1B1B1B)' },
};
function chip(kind: string) {
  const map: any = { best: ['#2E7D32', 'rgba(46,125,50,0.12)', 'best'], worst: ['#B8542A', 'rgba(184,84,42,0.12)', 'slow'], published: ['#2E7D32', 'rgba(46,125,50,0.12)', 'published'], draft: ['#5A5A5A', 'var(--bg,#F4EFE2)', 'draft'], mid: ['#5A5A5A', 'var(--bg,#F4EFE2)', 'mid'] };
  const c = map[kind]; if (!c) return null;
  return <span style={{ fontSize: 10, color: c[0], background: c[1], padding: '1px 7px', borderRadius: 99, marginLeft: 6 }}>{c[2]}</span>;
}
function SubTabs({ active }: { active: string }) {
  const tabs: [string, string][] = [['menus', 'Menus'], ['catalog', 'POS Catalog'], ['import', 'Import']];
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--hairline,#E6DFCC)' }}>
      {tabs.map(([k, l]) => {
        const on = active === k;
        return <a key={k} href={'/operations/menus?tab=' + k} style={{ padding: '6px 12px', fontSize: 13, fontWeight: on ? 600 : 500, color: on ? 'var(--ink,#1B1B1B)' : 'var(--ink-soft,#5A5A5A)', borderBottom: on ? '2px solid var(--primary,#1F3A2E)' : '2px solid transparent', textDecoration: 'none' }}>{l}</a>;
      })}
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
          <div><div style={T.h}>Source of truth · POS catalog</div><div style={T.muted}>Cleaned + deduped from the POS transaction stream. Sales rolled up across all aliases; junk buckets hidden.</div></div>
          <form action={repairCatalog}><button style={T.btn}>Repair from POS ↻</button></form>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
          <thead><tr><th style={T.th}>Category</th><th style={T.th}>Group</th><th style={T.th}>Merged</th><th style={T.th}>12m revenue</th><th style={T.th}>Avg price</th><th style={T.th}></th></tr></thead>
          <tbody>
            {(cat ?? []).map((c: any) => (
              <tr key={c.catalog_id}><td style={T.td}>{c.name}</td><td style={T.td}>{c.group_label}</td><td style={T.td}>{c.alias_count}</td><td style={{ ...T.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.revenue_12m != null ? '$' + Math.round(c.revenue_12m).toLocaleString() : '—'}</td><td style={{ ...T.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.avg_price != null ? '$' + Number(c.avg_price).toFixed(2) : '—'}</td><td style={T.td}>{chip(c.seller_band)}</td></tr>
            ))}
            {(cat ?? []).length === 0 ? <tr><td style={T.td} colSpan={6}><span style={T.muted}>Empty — click Repair from POS (takes ~15s, then refresh).</span></td></tr> : null}
          </tbody>
        </table>
      </div>
    );
  } else if (tab === 'import') {
    view = (
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ ...T.card, flex: '1 1 260px' }}>
          <div style={T.h}>Create blank</div>
          <form action={createMenu} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input name="title" placeholder="Menu title (e.g. Dinner)" style={T.input} />
            <select name="kind" style={T.input} defaultValue="food">{['food', 'drink', 'minibar', 'room_service', 'kids', 'spa', 'activity', 'experience', 'retreat', 'event'].map((k) => <option key={k} value={k}>{k}</option>)}</select>
            <button style={T.btn}>Create</button>
          </form>
        </div>
        <div style={{ ...T.card, flex: '1 1 260px' }}>
          <div style={T.h}>Compile from POS sales</div>
          <div style={{ ...T.muted, marginBottom: 8 }}>Builds a menu from what actually sells (categories + prices). Then clean it with AI review.</div>
          <form action={compileFromPos}><button style={T.ghost}>Compile from POS</button></form>
        </div>
        <div style={{ ...T.card, flex: '1 1 320px' }}>
          <div style={T.h}>Import existing menu</div>
          <form action={runIngest} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input name="title" placeholder="Menu title" style={T.input} />
            <textarea name="text" placeholder="Paste your existing menu text here — sections, dishes, prices…" rows={6} style={{ ...T.input, resize: 'vertical' }} />
            <button style={T.btn}>Import menu</button>
          </form>
          <div style={{ ...T.muted, marginTop: 8 }}>Paste now; PDF/photo upload is the next add. Processing takes ~15s — refresh after.</div>
        </div>
      </div>
    );
  } else {
    const sel = selId ? list.find((m: any) => m.id === selId) : list[0];
    let items: any[] = [], reviews: any[] = [];
    if (sel) {
      const a = await sb.from('v_menu_items_full').select('*').eq('menu_id', sel.id).order('section_title').order('name'); items = a.data ?? [];
      const b = await sb.from('v_menu_reviews').select('*').eq('menu_id', sel.id).eq('status', 'pending').order('dimension'); reviews = b.data ?? [];
    }
    view = (
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ ...T.card, width: 300, flexShrink: 0 }}>
          <div style={T.h}>Menus ({list.length})</div>
          {list.length === 0 ? <div style={T.muted}>None yet. Use the Import tab.</div> : null}
          {list.map((m: any) => {
            const on = sel && m.id === sel.id;
            return <a key={m.id} href={'/operations/menus?tab=menus&menu=' + m.id} style={{ display: 'block', padding: '8px 10px', borderRadius: 8, textDecoration: 'none', marginBottom: 4, background: on ? 'var(--bg,#F4EFE2)' : 'transparent', border: '1px solid ' + (on ? 'var(--hairline,#E6DFCC)' : 'transparent') }}>
              <div style={{ color: 'var(--ink,#1B1B1B)', fontSize: 13, fontWeight: on ? 600 : 500 }}>{m.title}{chip(m.status === 'published' ? 'published' : 'draft')}</div>
              <div style={T.muted}>{m.kind} · {m.item_count} items · {m.pending_reviews} to review</div>
            </a>;
          })}
        </div>
        <div style={{ flex: '1 1 340px', minWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!sel ? <div style={T.card}><span style={T.muted}>Pick a menu, or create one in the Import tab.</span></div> : (
            <>
              <div style={T.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div><div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink,#1B1B1B)' }}>{sel.title}{chip(sel.status === 'published' ? 'published' : 'draft')}</div><div style={T.muted}>{sel.kind}</div></div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <form action={runReview}><input type="hidden" name="menu_id" value={sel.id} /><button style={T.ghost}>Run AI review</button></form>
                    <form action={publishMenu}><input type="hidden" name="menu_id" value={sel.id} /><button style={T.btn}>Publish → QR</button></form>
                  </div>
                </div>
                <div style={{ marginTop: 10, ...T.muted }}>{sel.status === 'published' ? <>QR (permanent): <a style={T.link} target="_blank" rel="noreferrer" href={'/p/m/' + sel.qr_slug}>{'/p/m/' + sel.qr_slug} ↗</a></> : 'Not published — publish to generate the permanent QR link.'}</div>
              </div>
              <div style={T.card}>
                <div style={T.h}>Items ({items.filter((i: any) => i.is_active).length})</div>
                {items.filter((i: any) => i.is_active).map((i: any) => (
                  <div key={i.item_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--hairline,#E6DFCC)' }}>
                    <div><span style={{ color: 'var(--ink,#1B1B1B)', fontSize: 13, fontWeight: 500 }}>{i.name}</span>{chip(i.seller_band)}<div style={T.muted}>{i.section_title}{i.price_usd != null ? ' · $' + Number(i.price_usd).toFixed(2) : ''}</div></div>
                    <form action={dismissItem}><input type="hidden" name="item_id" value={i.item_id} /><button style={T.ghost}>Remove</button></form>
                  </div>
                ))}
              </div>
              <div style={T.card}>
                <div style={T.h}>AI suggestions ({reviews.length})</div>
                {reviews.length === 0 ? <div style={T.muted}>None pending. Click Run AI review (takes ~15s, then refresh).</div> : null}
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
