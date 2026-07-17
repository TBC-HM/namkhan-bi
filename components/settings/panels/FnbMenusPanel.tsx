// components/settings/panels/FnbMenusPanel.tsx
// PBS 2026-07-18 · CRUD for property.fnb_menus + property.fnb_menu_items.
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const HAIR = '#E6DFCC';
const INK = '#1B1B1B';
const INK_M = '#5A5A5A';
const FOREST = '#084838';

interface Menu {
  menu_id: number; property_id: number; facility_id: number | null;
  name: string; meal_period: string | null;
  season_valid_from: string | null; season_valid_until: string | null;
  is_active: boolean; notes: string | null; display_order: number | null;
  items?: Item[];
}
interface Item {
  item_id: number; menu_id: number;
  section: string | null; name: string; description: string | null;
  price_usd: number | null; price_lak: number | null;
  price_includes_vat_service: boolean;
  allergens: string[] | null;
  is_signature: boolean; is_vegetarian: boolean; is_vegan: boolean;
  is_active: boolean; display_order: number | null;
}
interface MenuDraft {
  menu_id: number | null; facility_id: string;
  name: string; meal_period: string;
  season_valid_from: string; season_valid_until: string;
  is_active: boolean; notes: string; display_order: string;
}
interface ItemDraft {
  item_id: number | null; menu_id: number;
  section: string; name: string; description: string;
  price_usd: string; price_lak: string;
  price_includes_vat_service: boolean;
  allergens_csv: string;
  is_signature: boolean; is_vegetarian: boolean; is_vegan: boolean;
  is_active: boolean; display_order: string;
}

const MEAL_PERIODS_REG = ['breakfast','brunch','lunch','dinner','all-day','snacks','drinks'];
const MEAL_PERIODS_GRP = ['group set','group buffet','wedding','private event','conference','celebration'];

interface Props {
  menus: Menu[];
  facilities: any[];
  propertyId: number;
  scope: 'regular' | 'group';
}

export default function FnbMenusPanel({ menus, facilities, propertyId, scope }: Props) {
  const router = useRouter();
  const [menuDraft, setMenuDraft] = useState<MenuDraft | null>(null);
  const [itemDraft, setItemDraft] = useState<ItemDraft | null>(null);
  const [expandedMenuId, setExpandedMenuId] = useState<number | null>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelMenu, setConfirmDelMenu] = useState<number | null>(null);
  const [confirmDelItem, setConfirmDelItem] = useState<number | null>(null);

  const facilityById = new Map<number, string>(facilities.map(f => [f.facility_id, f.name]));
  const defaultFacilityId = facilities[0]?.facility_id?.toString() ?? '';

  function openAddMenu() {
    setMenuDraft({
      menu_id: null, facility_id: defaultFacilityId,
      name: '', meal_period: scope === 'group' ? 'group set' : 'dinner',
      season_valid_from: '', season_valid_until: '',
      is_active: true, notes: '', display_order: '',
    });
    setError(null);
  }
  function openEditMenu(m: Menu) {
    setMenuDraft({
      menu_id: m.menu_id, facility_id: m.facility_id?.toString() ?? '',
      name: m.name ?? '', meal_period: m.meal_period ?? '',
      season_valid_from: m.season_valid_from ?? '',
      season_valid_until: m.season_valid_until ?? '',
      is_active: m.is_active ?? true, notes: m.notes ?? '',
      display_order: m.display_order?.toString() ?? '',
    });
    setError(null);
  }
  function saveMenu() {
    if (!menuDraft) return;
    if (!menuDraft.name.trim()) { setError('Menu name is required'); return; }
    setError(null);
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_upsert_property_fnb_menu', {
        p_menu_id: menuDraft.menu_id, p_property_id: propertyId,
        p_facility_id: menuDraft.facility_id ? Number(menuDraft.facility_id) : null,
        p_name: menuDraft.name.trim(),
        p_meal_period: menuDraft.meal_period || null,
        p_season_valid_from: menuDraft.season_valid_from || null,
        p_season_valid_until: menuDraft.season_valid_until || null,
        p_is_active: menuDraft.is_active,
        p_notes: menuDraft.notes.trim() || null,
        p_display_order: menuDraft.display_order ? Number(menuDraft.display_order) : null,
      });
      if (e) { setError(e.message); return; }
      setMenuDraft(null); router.refresh();
    });
  }
  function delMenu(id: number) {
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_delete_property_fnb_menu', { p_menu_id: id });
      if (e) { setError(e.message); return; }
      setConfirmDelMenu(null); router.refresh();
    });
  }

  function openAddItem(menuId: number) {
    setItemDraft({
      item_id: null, menu_id: menuId,
      section: '', name: '', description: '',
      price_usd: '', price_lak: '',
      price_includes_vat_service: true, allergens_csv: '',
      is_signature: false, is_vegetarian: false, is_vegan: false,
      is_active: true, display_order: '',
    });
    setError(null);
  }
  function openEditItem(it: Item) {
    setItemDraft({
      item_id: it.item_id, menu_id: it.menu_id,
      section: it.section ?? '', name: it.name ?? '', description: it.description ?? '',
      price_usd: it.price_usd?.toString() ?? '', price_lak: it.price_lak?.toString() ?? '',
      price_includes_vat_service: it.price_includes_vat_service ?? true,
      allergens_csv: (it.allergens ?? []).join(', '),
      is_signature: it.is_signature ?? false,
      is_vegetarian: it.is_vegetarian ?? false, is_vegan: it.is_vegan ?? false,
      is_active: it.is_active ?? true,
      display_order: it.display_order?.toString() ?? '',
    });
    setError(null);
  }
  function saveItem() {
    if (!itemDraft) return;
    if (!itemDraft.name.trim()) { setError('Item name is required'); return; }
    setError(null);
    startTransition(async () => {
      const allergens = itemDraft.allergens_csv.split(',').map(s => s.trim()).filter(Boolean);
      const { error: e } = await supabase.rpc('fn_upsert_property_fnb_menu_item', {
        p_item_id: itemDraft.item_id, p_menu_id: itemDraft.menu_id,
        p_section: itemDraft.section.trim() || null,
        p_name: itemDraft.name.trim(),
        p_description: itemDraft.description.trim() || null,
        p_price_usd: itemDraft.price_usd ? Number(itemDraft.price_usd) : null,
        p_price_lak: itemDraft.price_lak ? Number(itemDraft.price_lak) : null,
        p_price_includes_vat_service: itemDraft.price_includes_vat_service,
        p_allergens: allergens.length > 0 ? allergens : null,
        p_is_signature: itemDraft.is_signature,
        p_is_vegetarian: itemDraft.is_vegetarian, p_is_vegan: itemDraft.is_vegan,
        p_is_active: itemDraft.is_active,
        p_display_order: itemDraft.display_order ? Number(itemDraft.display_order) : null,
      });
      if (e) { setError(e.message); return; }
      setItemDraft(null); router.refresh();
    });
  }
  function delItem(id: number) {
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_delete_property_fnb_menu_item', { p_item_id: id });
      if (e) { setError(e.message); return; }
      setConfirmDelItem(null); router.refresh();
    });
  }

  const periods = scope === 'group' ? MEAL_PERIODS_GRP : MEAL_PERIODS_REG;

  return (
    <div style={{ padding: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: INK_M }}>
          {menus.length} {scope==='group'?'group ':''}menu{menus.length===1?'':'s'} · click a menu to add / edit items
        </div>
        {!menuDraft && (
          <button onClick={openAddMenu} style={btnPrimary} disabled={!defaultFacilityId}>+ Add {scope==='group'?'group ':''}menu</button>
        )}
      </div>

      {error && (
        <div style={{ background: '#FEECEA', border: '1px solid #E7A69A', borderRadius: 4, padding: 10, color: '#8A2820', fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {menuDraft && (
        <div style={{ background: '#F5F0E1', border: '1px solid ' + HAIR, borderRadius: 6, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 12 }}>{menuDraft.menu_id ? 'Edit menu' : 'New menu'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <L label="Name *"><input style={inp} value={menuDraft.name} onChange={e=>setMenuDraft({...menuDraft, name:e.target.value})} /></L>
            <L label="Facility">
              <select style={inp} value={menuDraft.facility_id} onChange={e=>setMenuDraft({...menuDraft, facility_id:e.target.value})}>
                {facilities.map(f => <option key={f.facility_id} value={f.facility_id}>{f.name}</option>)}
              </select>
            </L>
            <L label="Meal period">
              <select style={inp} value={menuDraft.meal_period} onChange={e=>setMenuDraft({...menuDraft, meal_period:e.target.value})}>
                {periods.map(p => <option key={p}>{p}</option>)}
              </select>
            </L>
            <L label="Valid from"><input type="date" style={inp} value={menuDraft.season_valid_from} onChange={e=>setMenuDraft({...menuDraft, season_valid_from:e.target.value})} /></L>
            <L label="Valid until"><input type="date" style={inp} value={menuDraft.season_valid_until} onChange={e=>setMenuDraft({...menuDraft, season_valid_until:e.target.value})} /></L>
            <L label="Display order"><input type="number" style={inp} value={menuDraft.display_order} onChange={e=>setMenuDraft({...menuDraft, display_order:e.target.value})} /></L>
            <L label="Notes" span={3}><textarea style={{...inp,minHeight:52}} value={menuDraft.notes} onChange={e=>setMenuDraft({...menuDraft, notes:e.target.value})} /></L>
            <L label="Active">
              <label style={{ fontSize: 12 }}><input type="checkbox" checked={menuDraft.is_active} onChange={e=>setMenuDraft({...menuDraft, is_active:e.target.checked})} /> active</label>
            </L>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <button onClick={()=>setMenuDraft(null)} disabled={busy} style={btnGhost}>Cancel</button>
            <button onClick={saveMenu} disabled={busy} style={btnPrimary}>{busy?'Saving…':'Save'}</button>
          </div>
        </div>
      )}

      {menus.length === 0 && !menuDraft ? (
        <div style={{ background: '#F5F0E1', border: '1px solid ' + HAIR, borderRadius: 4, padding: 24, textAlign: 'center', color: INK_M, fontSize: 12 }}>
          {!defaultFacilityId
            ? 'Add an F&B facility (Restaurant / Bar) first, then menus can be created.'
            : `No ${scope==='group'?'group ':''}menus yet. Click "+ Add ${scope==='group'?'group ':''}menu" to create one.`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {menus.map(m => {
            const items = m.items ?? [];
            const isOpen = expandedMenuId === m.menu_id;
            return (
              <div key={m.menu_id} style={{ background: '#FFFFFF', border: '1px solid ' + HAIR, borderRadius: 4 }}>
                <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={()=>setExpandedMenuId(isOpen ? null : m.menu_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: INK, fontSize: 14, padding: 0 }}>
                    {isOpen ? '▾' : '▸'}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>{m.name}</span>
                      {!m.is_active && <span style={{ fontSize: 10, background: '#EDEDED', color: '#8A8A8A', padding: '2px 6px', borderRadius: 3 }}>INACTIVE</span>}
                      {m.meal_period && <span style={{ fontSize: 11, color: INK_M }}>{m.meal_period}</span>}
                      {m.facility_id && facilityById.get(m.facility_id) && <span style={{ fontSize: 11, color: FOREST }}>· {facilityById.get(m.facility_id)}</span>}
                      <span style={{ fontSize: 11, color: INK_M }}>· {items.length} item{items.length===1?'':'s'}</span>
                    </div>
                  </div>
                  <button onClick={()=>openEditMenu(m)} style={btnGhost}>Edit menu</button>
                  {confirmDelMenu === m.menu_id ? (
                    <>
                      <button onClick={()=>delMenu(m.menu_id)} disabled={busy} style={btnDanger}>Confirm delete</button>
                      <button onClick={()=>setConfirmDelMenu(null)} style={btnGhost}>×</button>
                    </>
                  ) : (
                    <button onClick={()=>setConfirmDelMenu(m.menu_id)} style={btnGhost}>Delete</button>
                  )}
                </div>
                {isOpen && (
                  <div style={{ background: '#FBFAF6', padding: 14, borderTop: '1px solid ' + HAIR }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: INK_M, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Items</div>
                      {!itemDraft && <button onClick={()=>openAddItem(m.menu_id)} style={btnPrimarySmall}>+ Add item</button>}
                    </div>
                    {itemDraft && itemDraft.menu_id === m.menu_id && (
                      <div style={{ background: '#FFF', border: '1px solid ' + HAIR, borderRadius: 4, padding: 12, marginBottom: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>{itemDraft.item_id ? 'Edit item' : 'New item'}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                          <L label="Section"><input style={inp} value={itemDraft.section} onChange={e=>setItemDraft({...itemDraft, section:e.target.value})} placeholder="starter · main · dessert" /></L>
                          <L label="Name *"><input style={inp} value={itemDraft.name} onChange={e=>setItemDraft({...itemDraft, name:e.target.value})} /></L>
                          <L label="Display order"><input type="number" style={inp} value={itemDraft.display_order} onChange={e=>setItemDraft({...itemDraft, display_order:e.target.value})} /></L>
                          <L label="Price USD"><input type="number" style={inp} value={itemDraft.price_usd} onChange={e=>setItemDraft({...itemDraft, price_usd:e.target.value})} /></L>
                          <L label="Price LAK"><input type="number" style={inp} value={itemDraft.price_lak} onChange={e=>setItemDraft({...itemDraft, price_lak:e.target.value})} /></L>
                          <L label="Allergens (comma-sep)"><input style={inp} value={itemDraft.allergens_csv} onChange={e=>setItemDraft({...itemDraft, allergens_csv:e.target.value})} placeholder="nuts, gluten, shellfish" /></L>
                          <L label="Description" span={3}><textarea style={{...inp,minHeight:44}} value={itemDraft.description} onChange={e=>setItemDraft({...itemDraft, description:e.target.value})} /></L>
                          <L label="Flags" span={3}>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
                              <label><input type="checkbox" checked={itemDraft.price_includes_vat_service} onChange={e=>setItemDraft({...itemDraft, price_includes_vat_service:e.target.checked})} /> VAT/svc incl</label>
                              <label><input type="checkbox" checked={itemDraft.is_signature} onChange={e=>setItemDraft({...itemDraft, is_signature:e.target.checked})} /> signature</label>
                              <label><input type="checkbox" checked={itemDraft.is_vegetarian} onChange={e=>setItemDraft({...itemDraft, is_vegetarian:e.target.checked})} /> vegetarian</label>
                              <label><input type="checkbox" checked={itemDraft.is_vegan} onChange={e=>setItemDraft({...itemDraft, is_vegan:e.target.checked})} /> vegan</label>
                              <label><input type="checkbox" checked={itemDraft.is_active} onChange={e=>setItemDraft({...itemDraft, is_active:e.target.checked})} /> active</label>
                            </div>
                          </L>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                          <button onClick={()=>setItemDraft(null)} disabled={busy} style={btnGhost}>Cancel</button>
                          <button onClick={saveItem} disabled={busy} style={btnPrimarySmall}>{busy?'Saving…':'Save item'}</button>
                        </div>
                      </div>
                    )}
                    {items.length === 0 && !itemDraft ? (
                      <div style={{ fontSize: 11, color: INK_M, fontStyle: 'italic' }}>No items yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {items.map(it => (
                          <div key={it.item_id} style={{ background: '#FFF', border: '1px solid ' + HAIR, borderRadius: 3, padding: 8, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                            <div style={{ flex: 1 }}>
                              <div>
                                {it.section && <span style={{ color: INK_M, marginRight: 6 }}>[{it.section}]</span>}
                                <strong>{it.name}</strong>
                                {it.is_signature && <span style={{ marginLeft: 6, fontSize: 9, background: '#F5E6C8', color: '#B87F26', padding: '1px 5px', borderRadius: 3 }}>SIG</span>}
                                {it.is_vegan && <span style={{ marginLeft: 6, fontSize: 9, background: '#E1F0E4', color: '#1F5C2C', padding: '1px 5px', borderRadius: 3 }}>VG</span>}
                                {it.is_vegetarian && !it.is_vegan && <span style={{ marginLeft: 6, fontSize: 9, background: '#F0F6E4', color: '#4A6B1C', padding: '1px 5px', borderRadius: 3 }}>V</span>}
                                {it.price_usd != null && <span style={{ marginLeft: 8, color: INK_M }}>USD {it.price_usd}</span>}
                              </div>
                              {it.description && <div style={{ color: INK_M, fontSize: 11, marginTop: 2 }}>{it.description}</div>}
                            </div>
                            <button onClick={()=>openEditItem(it)} style={btnGhostSmall}>Edit</button>
                            {confirmDelItem === it.item_id ? (
                              <>
                                <button onClick={()=>delItem(it.item_id)} disabled={busy} style={btnDangerSmall}>Confirm</button>
                                <button onClick={()=>setConfirmDelItem(null)} style={btnGhostSmall}>×</button>
                              </>
                            ) : (
                              <button onClick={()=>setConfirmDelItem(it.item_id)} style={btnGhostSmall}>×</button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function L({ label, children, span=1 }: { label: string; children: React.ReactNode; span?: number }) {
  return <div style={{ gridColumn: span===3 ? '1 / -1' : span===2 ? 'span 2' : undefined }}>
    <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, marginBottom: 4 }}>{label}</div>
    {children}
  </div>;
}
const inp: React.CSSProperties = { width: '100%', padding: '6px 8px', border: '1px solid ' + HAIR, borderRadius: 3, background: '#FFF', fontSize: 12, fontFamily: 'inherit' };
const btnPrimary: React.CSSProperties = { padding: '6px 14px', background: FOREST, color: '#FFF', border: 'none', borderRadius: 3, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer' };
const btnPrimarySmall: React.CSSProperties = { ...btnPrimary, padding: '4px 10px', fontSize: 10 };
const btnGhost: React.CSSProperties = { padding: '6px 12px', background: 'transparent', color: INK_M, border: '1px solid ' + HAIR, borderRadius: 3, fontSize: 11, cursor: 'pointer' };
const btnGhostSmall: React.CSSProperties = { ...btnGhost, padding: '3px 8px', fontSize: 10 };
const btnDanger: React.CSSProperties = { padding: '6px 12px', background: '#C0584C', color: '#FFF', border: 'none', borderRadius: 3, fontSize: 11, cursor: 'pointer' };
const btnDangerSmall: React.CSSProperties = { ...btnDanger, padding: '3px 8px', fontSize: 10 };
