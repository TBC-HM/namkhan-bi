// app/operations/menus/page.tsx
// ADR-156 Menu Studio editor (Namkhan). Operations > Menus.
import { revalidatePath } from 'next/cache';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PID = 260955;
const PATH = '/operations/menus';

async function runReview(formData: FormData) { 'use server';
  await getSupabaseAdmin().rpc('fn_menu_run_review', { p_menu_id: Number(formData.get('menu_id')) }); revalidatePath(PATH); }
async function publishMenu(formData: FormData) { 'use server';
  await getSupabaseAdmin().rpc('fn_menu_publish', { p_menu_id: Number(formData.get('menu_id')), p_by: 'pbs' }); revalidatePath(PATH); }
async function decideReview(formData: FormData) { 'use server';
  await getSupabaseAdmin().rpc('fn_menu_review_decide', { p_review_id: Number(formData.get('review_id')), p_decision: String(formData.get('decision')), p_by: 'pbs' }); revalidatePath(PATH); }
async function dismissItem(formData: FormData) { 'use server';
  await getSupabaseAdmin().rpc('fn_menu_set_item_active', { p_item_id: Number(formData.get('item_id')), p_active: false }); revalidatePath(PATH); }
async function createMenu(formData: FormData) { 'use server';
  await getSupabaseAdmin().rpc('fn_menu_create', { p: { property_id: PID, kind: String(formData.get('kind') || 'food'), title: String(formData.get('title') || 'New menu'), created_by: 'pbs' } }); revalidatePath(PATH); }
async function compileFromPos() { 'use server';
  await getSupabaseAdmin().rpc('fn_menu_compile_from_pos', { p_property_id: PID, p_title: 'Restaurant (POS-compiled)' }); revalidatePath(PATH); }

const inp: any = { padding: '8px 10px', border: '1px solid var(--tbl-border,#d8dcd2)', borderRadius: 6, fontSize: 'var(--t-sm,14px)', background: 'var(--tbl-bg,#fff)', color: 'var(--tbl-fg,#1a1a1a)' };
const hd: any = { fontSize: 'var(--t-xs,12px)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--tbl-fg-mute,rgba(26,26,26,0.55))', marginBottom: 8 };
const rowS: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--tbl-border,#eee)' };
const card: any = { border: '1px solid var(--tbl-border,#e6e9df)', borderRadius: 8, padding: 10, marginBottom: 8, background: 'var(--tbl-card,rgba(0,0,0,0.02))' };
const btnPrimary: any = { padding: '8px 14px', background: 'var(--brass,#7a6a3a)', color: 'var(--tbl-on-brass,#fff)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 'var(--t-sm,13px)' };
const btnPublish: any = { padding: '8px 14px', background: 'var(--ok,#2a8a5a)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 'var(--t-sm,13px)' };
const btnAccept: any = { padding: '5px 12px', background: 'var(--ok,#2a8a5a)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 'var(--t-xs,12px)' };
const btnGhost: any = { padding: '5px 12px', background: 'transparent', color: 'var(--tbl-fg,#555)', border: '1px solid var(--tbl-border,#ccc)', borderRadius: 6, cursor: 'pointer', fontSize: 'var(--t-xs,12px)' };
const tagBest: any = { fontSize: 10, background: 'rgba(42,138,90,0.14)', color: 'var(--ok,#2a8a5a)', padding: '1px 6px', borderRadius: 10, marginLeft: 6 };
const tagWorst: any = { fontSize: 10, background: 'rgba(170,68,68,0.14)', color: 'var(--warn,#a44)', padding: '1px 6px', borderRadius: 10, marginLeft: 6 };
const muted: any = { fontSize: 'var(--t-xs,12px)', color: 'var(--tbl-fg-mute,rgba(26,26,26,0.5))' };

export default async function MenusEditor() {
  const sb = getSupabaseAdmin();
  const { data: menus } = await sb.from('v_menu_editor').select('*').eq('property_id', PID).order('updated_at', { ascending: false });
  const list = menus ?? [];

  const panels = await Promise.all(list.map(async (m: any) => {
    const { data: items } = await sb.from('v_menu_items_full').select('*').eq('menu_id', m.id).order('section_title').order('name');
    const { data: reviews } = await sb.from('v_menu_reviews').select('*').eq('menu_id', m.id).eq('status', 'pending').order('dimension');
    const active = (items ?? []).filter((i: any) => i.is_active);
    return (
      <Panel key={m.id} title={m.title + ' · ' + m.status} eyebrow={m.kind} expandable={false}>
        <div style={{ padding: 12, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 340px', minWidth: 300 }}>
            <div style={hd}>Items ({active.length})</div>
            {active.map((i: any) => (
              <div key={i.item_id} style={rowS}>
                <div>
                  <b>{i.name}</b>{i.seller_band === 'best' ? <span style={tagBest}>best seller</span> : i.seller_band === 'worst' ? <span style={tagWorst}>slow</span> : null}
                  <div style={muted}>{i.section_title}{i.price_usd != null ? ' · $' + Number(i.price_usd).toFixed(2) : ''}</div>
                </div>
                <form action={dismissItem}><input type="hidden" name="item_id" value={i.item_id} /><button style={btnGhost}>Remove</button></form>
              </div>
            ))}
          </div>
          <div style={{ flex: '1 1 340px', minWidth: 300 }}>
            <div style={hd}>AI suggestions ({(reviews ?? []).length})</div>
            {(reviews ?? []).length === 0 ? <div style={muted}>None pending. Run AI review below.</div> : null}
            {(reviews ?? []).map((r: any) => (
              <div key={r.review_id} style={card}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--brass,#7a6a3a)', letterSpacing: 1 }}>{r.dimension}{r.item_name ? ' · ' + r.item_name : ''}</div>
                <div style={{ fontSize: 'var(--t-sm,13px)', margin: '3px 0', color: 'var(--tbl-fg,#1a1a1a)' }}>{r.comment}</div>
                {r.proposed_value ? <div style={{ fontSize: 12, color: 'var(--ok,#2a8a5a)', fontStyle: 'italic' }}>{'→ ' + (r.proposed_value.name || r.proposed_value.description || '')}</div> : null}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <form action={decideReview}><input type="hidden" name="review_id" value={r.review_id} /><input type="hidden" name="decision" value="accepted" /><button style={btnAccept}>Accept</button></form>
                  <form action={decideReview}><input type="hidden" name="review_id" value={r.review_id} /><input type="hidden" name="decision" value="dismissed" /><button style={btnGhost}>Dismiss</button></form>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--tbl-border,#eee)', alignItems: 'center', flexWrap: 'wrap' }}>
          <form action={runReview}><input type="hidden" name="menu_id" value={m.id} /><button style={btnPrimary}>Run AI review</button></form>
          <form action={publishMenu}><input type="hidden" name="menu_id" value={m.id} /><button style={btnPublish}>Publish → QR</button></form>
          {m.status === 'published' ? <a href={'/p/m/' + m.qr_slug} target="_blank" rel="noreferrer" style={{ fontSize: 'var(--t-sm,13px)', color: 'var(--ok,#2a8a5a)' }}>{'View QR menu ↗ (' + m.qr_slug + ')'}</a> : <span style={muted}>not published yet</span>}
        </div>
      </Panel>
    );
  }));

  return (
    <Page eyebrow="Operations · Menus" title="Menu Studio" subPages={OPERATIONS_SUBPAGES}>
      <Panel title="Start a menu" eyebrow="new" expandable={false}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: 12, alignItems: 'flex-end' }}>
          <form action={createMenu} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input name="title" placeholder="Menu title" style={inp} />
            <select name="kind" style={inp} defaultValue="food">
              {['food', 'drink', 'minibar', 'room_service', 'kids', 'spa', 'activity', 'experience', 'retreat', 'event'].map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <button type="submit" style={btnPrimary}>Create blank</button>
          </form>
          <form action={compileFromPos}><button style={btnGhost}>Compile from POS sales</button></form>
          <span style={muted}>Upload an existing menu (PDF/photo) — coming next.</span>
        </div>
      </Panel>
      {list.length === 0 ? <Panel title="No menus yet" eyebrow="empty" expandable={false}><div style={{ padding: 16 }}>Create one, or compile from POS sales.</div></Panel> : null}
      {panels}
    </Page>
  );
}
