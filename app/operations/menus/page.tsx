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

async function runReview(formData: FormData) {
  'use server';
  const menuId = Number(formData.get('menu_id'));
  await getSupabaseAdmin().rpc('fn_menu_run_review', { p_menu_id: menuId });
  revalidatePath(PATH);
}
async function publishMenu(formData: FormData) {
  'use server';
  const menuId = Number(formData.get('menu_id'));
  await getSupabaseAdmin().rpc('fn_menu_publish', { p_menu_id: menuId, p_by: 'pbs' });
  revalidatePath(PATH);
}
async function decideReview(formData: FormData) {
  'use server';
  const reviewId = Number(formData.get('review_id'));
  const decision = String(formData.get('decision'));
  await getSupabaseAdmin().rpc('fn_menu_review_decide', { p_review_id: reviewId, p_decision: decision, p_by: 'pbs' });
  revalidatePath(PATH);
}
async function dismissItem(formData: FormData) {
  'use server';
  const itemId = Number(formData.get('item_id'));
  await getSupabaseAdmin().rpc('fn_menu_set_item_active', { p_item_id: itemId, p_active: false });
  revalidatePath(PATH);
}
async function createMenu(formData: FormData) {
  'use server';
  const title = String(formData.get('title') || 'New menu');
  const kind = String(formData.get('kind') || 'food');
  await getSupabaseAdmin().rpc('fn_menu_create', { p: { property_id: PID, kind, title, created_by: 'pbs' } });
  revalidatePath(PATH);
}

const inp: any = { padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14 };
const hd: any = { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#8a7', marginBottom: 8 };
const rowS: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #f0f0f0' };
const reviewCard: any = { border: '1px solid #e6e9df', borderRadius: 8, padding: 10, marginBottom: 8, background: '#fbfcf8' };
const btnPrimary: any = { padding: '8px 14px', background: '#3a4a2a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 };
const btnPublish: any = { padding: '8px 14px', background: '#2a8a5a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 };
const btnAccept: any = { padding: '5px 12px', background: '#2a8a5a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 };
const btnGhost: any = { padding: '5px 12px', background: '#fff', color: '#555', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 };
const tagBest: any = { fontSize: 10, background: '#dff0d8', color: '#2a8a5a', padding: '1px 6px', borderRadius: 10, marginLeft: 4 };
const tagWorst: any = { fontSize: 10, background: '#f7e0e0', color: '#a44', padding: '1px 6px', borderRadius: 10, marginLeft: 4 };

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
                  <div style={{ fontSize: 12, color: '#667' }}>{i.section_title}{i.price_usd != null ? ' · $' + Number(i.price_usd).toFixed(2) : ''}</div>
                </div>
                <form action={dismissItem}><input type="hidden" name="item_id" value={i.item_id} /><button style={btnGhost}>Remove</button></form>
              </div>
            ))}
          </div>
          <div style={{ flex: '1 1 340px', minWidth: 300 }}>
            <div style={hd}>AI suggestions ({(reviews ?? []).length})</div>
            {(reviews ?? []).length === 0 ? <div style={{ fontSize: 13, color: '#667' }}>None pending. Run AI review below.</div> : null}
            {(reviews ?? []).map((r: any) => (
              <div key={r.review_id} style={reviewCard}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#8a7', letterSpacing: 1 }}>{r.dimension}{r.item_name ? ' · ' + r.item_name : ''}</div>
                <div style={{ fontSize: 13, margin: '3px 0' }}>{r.comment}</div>
                {r.proposed_value ? <div style={{ fontSize: 12, color: '#295', fontStyle: 'italic' }}>{'→ ' + (r.proposed_value.name || r.proposed_value.description || '')}</div> : null}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <form action={decideReview}><input type="hidden" name="review_id" value={r.review_id} /><input type="hidden" name="decision" value="accepted" /><button style={btnAccept}>Accept</button></form>
                  <form action={decideReview}><input type="hidden" name="review_id" value={r.review_id} /><input type="hidden" name="decision" value="dismissed" /><button style={btnGhost}>Dismiss</button></form>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #eee', alignItems: 'center', flexWrap: 'wrap' }}>
          <form action={runReview}><input type="hidden" name="menu_id" value={m.id} /><button style={btnPrimary}>Run AI review</button></form>
          <form action={publishMenu}><input type="hidden" name="menu_id" value={m.id} /><button style={btnPublish}>Publish → QR</button></form>
          {m.status === 'published' ? <a href={'/p/m/' + m.qr_slug} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#2a8a5a' }}>{'View QR menu ↗ (' + m.qr_slug + ')'}</a> : <span style={{ fontSize: 12, color: '#999' }}>not published yet</span>}
        </div>
      </Panel>
    );
  }));

  return (
    <Page eyebrow="Operations · Menus" title="Menu Studio" subPages={OPERATIONS_SUBPAGES}>
      <Panel title="Create a menu" eyebrow="new" expandable={false}>
        <form action={createMenu} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 12 }}>
          <input name="title" placeholder="Menu title" style={inp} />
          <select name="kind" style={inp} defaultValue="food">
            {['food', 'drink', 'minibar', 'room_service', 'kids', 'spa', 'activity', 'experience', 'retreat', 'event'].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <button type="submit" style={btnPrimary}>Create</button>
        </form>
      </Panel>
      {list.length === 0 ? <Panel title="No menus yet" eyebrow="empty" expandable={false}><div style={{ padding: 16 }}>Create your first menu above.</div></Panel> : null}
      {panels}
    </Page>
  );
}
