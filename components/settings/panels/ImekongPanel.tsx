// components/settings/panels/ImekongPanel.tsx
// PBS 2026-07-12 — Imekong tab: boat spec + cruise packages.
'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PanelHeader, EmptyState } from './_shared';
import { supabase } from '@/lib/supabase';
import { btnPrimary, btnGhost, rowStyle, ErrorBanner, SavedFlash, LabeledInput, LabeledCheckbox, LabeledSelect, LabeledTextarea, ArrayInput, FormShell, DeleteConfirm, pill } from './_settings_ui';

type Boat = {
  boat_id: number; property_id: number; name: string;
  model: string | null; year_built: number | null;
  length_m: number | null; width_m: number | null; draft_m: number | null;
  engine_type: string | null; engine_hp: number | null;
  top_speed_knots: number | null; fuel_capacity_l: number | null; home_port: string | null;
  capacity_pax: number | null; capacity_seated: number | null;
  capacity_standing: number | null; capacity_dining: number | null; crew_size: number | null;
  amenities: string[] | null; hero_image_url: string | null; gallery_urls: string[] | null;
  description: string | null; notes: string | null; is_active: boolean | null;
};

type Cruise = {
  cruise_id: number; property_id: number; boat_id: number | null;
  name: string; cruise_type: string | null;
  route_from: string | null; route_to: string | null;
  duration_min: number | null; capacity_pax: number | null;
  price_amount: number | null; price_currency: string | null;
  price_includes_vat_service: boolean | null;
  dmc_price_amount: number | null; dmc_discount_pct: number | null;
  price_notes: string | null;
  service_time_from: string | null; service_time_to: string | null;
  available_season_codes: string[] | null;
  is_complimentary: boolean | null; is_active: boolean | null;
  bookable_via: string | null; age_restriction: string | null;
  description: string | null; notes: string | null; display_order: number | null;
};

interface BoatDraft {
  boat_id: number | null; name: string; model: string; year_built: string;
  length_m: string; width_m: string; draft_m: string;
  engine_type: string; engine_hp: string; top_speed_knots: string; fuel_capacity_l: string;
  home_port: string; capacity_pax: string; capacity_seated: string;
  capacity_standing: string; capacity_dining: string; crew_size: string;
  amenities: string[]; hero_image_url: string; gallery_urls: string[];
  description: string; notes: string; is_active: boolean;
}
const EMPTY_BOAT: BoatDraft = {
  boat_id: null, name: '', model: '', year_built: '',
  length_m: '', width_m: '', draft_m: '',
  engine_type: '', engine_hp: '', top_speed_knots: '', fuel_capacity_l: '',
  home_port: '', capacity_pax: '', capacity_seated: '',
  capacity_standing: '', capacity_dining: '', crew_size: '',
  amenities: [], hero_image_url: '', gallery_urls: [],
  description: '', notes: '', is_active: true,
};
const toBoatDraft = (b: Boat): BoatDraft => ({
  boat_id: b.boat_id, name: b.name ?? '',
  model: b.model ?? '', year_built: b.year_built?.toString() ?? '',
  length_m: b.length_m?.toString() ?? '', width_m: b.width_m?.toString() ?? '', draft_m: b.draft_m?.toString() ?? '',
  engine_type: b.engine_type ?? '', engine_hp: b.engine_hp?.toString() ?? '',
  top_speed_knots: b.top_speed_knots?.toString() ?? '', fuel_capacity_l: b.fuel_capacity_l?.toString() ?? '',
  home_port: b.home_port ?? '',
  capacity_pax: b.capacity_pax?.toString() ?? '', capacity_seated: b.capacity_seated?.toString() ?? '',
  capacity_standing: b.capacity_standing?.toString() ?? '', capacity_dining: b.capacity_dining?.toString() ?? '',
  crew_size: b.crew_size?.toString() ?? '',
  amenities: b.amenities ?? [], hero_image_url: b.hero_image_url ?? '', gallery_urls: b.gallery_urls ?? [],
  description: b.description ?? '', notes: b.notes ?? '', is_active: b.is_active !== false,
});

interface CruiseDraft {
  cruise_id: number | null; boat_id: string; name: string; cruise_type: string;
  route_from: string; route_to: string; duration_min: string; capacity_pax: string;
  price_amount: string; price_currency: string; price_includes_vat_service: boolean;
  dmc_price_amount: string; dmc_discount_pct: string; price_notes: string;
  service_time_from: string; service_time_to: string; available_season_codes: string[];
  is_complimentary: boolean; is_active: boolean;
  bookable_via: string; age_restriction: string;
  description: string; notes: string; display_order: string;
}
const EMPTY_CRUISE: CruiseDraft = {
  cruise_id: null, boat_id: '', name: '', cruise_type: '',
  route_from: '', route_to: '', duration_min: '', capacity_pax: '',
  price_amount: '', price_currency: 'USD', price_includes_vat_service: true,
  dmc_price_amount: '', dmc_discount_pct: '', price_notes: '',
  service_time_from: '', service_time_to: '', available_season_codes: [],
  is_complimentary: false, is_active: true,
  bookable_via: '', age_restriction: '',
  description: '', notes: '', display_order: '',
};
const toCruiseDraft = (c: Cruise): CruiseDraft => ({
  cruise_id: c.cruise_id, boat_id: c.boat_id?.toString() ?? '', name: c.name ?? '',
  cruise_type: c.cruise_type ?? '',
  route_from: c.route_from ?? '', route_to: c.route_to ?? '',
  duration_min: c.duration_min?.toString() ?? '',
  capacity_pax: c.capacity_pax?.toString() ?? '',
  price_amount: c.price_amount?.toString() ?? '',
  price_currency: c.price_currency ?? 'USD',
  price_includes_vat_service: c.price_includes_vat_service !== false,
  dmc_price_amount: c.dmc_price_amount?.toString() ?? '',
  dmc_discount_pct: c.dmc_discount_pct?.toString() ?? '',
  price_notes: c.price_notes ?? '',
  service_time_from: c.service_time_from ? String(c.service_time_from).slice(0, 5) : '',
  service_time_to:   c.service_time_to   ? String(c.service_time_to).slice(0, 5)   : '',
  available_season_codes: c.available_season_codes ?? [],
  is_complimentary: !!c.is_complimentary, is_active: c.is_active !== false,
  bookable_via: c.bookable_via ?? '', age_restriction: c.age_restriction ?? '',
  description: c.description ?? '', notes: c.notes ?? '',
  display_order: c.display_order?.toString() ?? '',
});

const CRUISE_TYPE_OPTS = ['', 'sunset', 'day', 'private', 'dinner', 'breakfast', 'multiday'];
const ENGINE_OPTS = ['', 'outboard', 'inboard', 'electric', 'hybrid'];

interface Season { season_id: number; season_code: string; display_name: string | null; }

export default function ImekongPanel({ boats, cruises, propertyId }: {
  boats: Boat[]; cruises: Cruise[]; propertyId: number;
}) {
  const router = useRouter();
  const [boatDraft, setBoatDraft] = useState<BoatDraft | null>(null);
  const [cruiseDraft, setCruiseDraft] = useState<CruiseDraft | null>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelBoat, setConfirmDelBoat] = useState<number | null>(null);
  const [confirmDelCruise, setConfirmDelCruise] = useState<number | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from('v_seasons')
        .select('season_id, season_code, display_name').eq('property_id', propertyId)
        .order('date_start', { ascending: true });
      if (s) setSeasons(s as any);
    })();
  }, [propertyId]);

  const seasonCodes = Array.from(new Set(seasons.map(s => s.season_code))).filter(Boolean);

  function toggleSeason(code: string) {
    if (!cruiseDraft) return;
    const has = cruiseDraft.available_season_codes.includes(code);
    setCruiseDraft({
      ...cruiseDraft,
      available_season_codes: has
        ? cruiseDraft.available_season_codes.filter(c => c !== code)
        : [...cruiseDraft.available_season_codes, code],
    });
  }

  function saveBoat() {
    if (!boatDraft) return;
    if (!boatDraft.name.trim()) { setError('Boat name is required'); return; }
    setError(null);
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_upsert_property_boat', {
        p_boat_id: boatDraft.boat_id, p_property_id: propertyId,
        p_name: boatDraft.name.trim(), p_model: boatDraft.model.trim() || null,
        p_year_built: boatDraft.year_built ? Number(boatDraft.year_built) : null,
        p_length_m: boatDraft.length_m ? Number(boatDraft.length_m) : null,
        p_width_m: boatDraft.width_m ? Number(boatDraft.width_m) : null,
        p_draft_m: boatDraft.draft_m ? Number(boatDraft.draft_m) : null,
        p_engine_type: boatDraft.engine_type || null,
        p_engine_hp: boatDraft.engine_hp ? Number(boatDraft.engine_hp) : null,
        p_top_speed_knots: boatDraft.top_speed_knots ? Number(boatDraft.top_speed_knots) : null,
        p_fuel_capacity_l: boatDraft.fuel_capacity_l ? Number(boatDraft.fuel_capacity_l) : null,
        p_home_port: boatDraft.home_port.trim() || null,
        p_capacity_pax: boatDraft.capacity_pax ? Number(boatDraft.capacity_pax) : null,
        p_capacity_seated: boatDraft.capacity_seated ? Number(boatDraft.capacity_seated) : null,
        p_capacity_standing: boatDraft.capacity_standing ? Number(boatDraft.capacity_standing) : null,
        p_capacity_dining: boatDraft.capacity_dining ? Number(boatDraft.capacity_dining) : null,
        p_crew_size: boatDraft.crew_size ? Number(boatDraft.crew_size) : null,
        p_amenities: boatDraft.amenities.length > 0 ? boatDraft.amenities : null,
        p_hero_image_url: boatDraft.hero_image_url.trim() || null,
        p_gallery_urls: boatDraft.gallery_urls.length > 0 ? boatDraft.gallery_urls : null,
        p_description: boatDraft.description.trim() || null,
        p_notes: boatDraft.notes.trim() || null,
        p_is_active: boatDraft.is_active,
      });
      if (e) { setError(e.message); return; }
      setBoatDraft(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      router.refresh();
    });
  }
  function delBoat(id: number) {
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_delete_property_boat', { p_boat_id: id, p_property_id: propertyId });
      if (e) { setError(e.message); return; }
      setConfirmDelBoat(null); router.refresh();
    });
  }

  function saveCruise() {
    if (!cruiseDraft) return;
    if (!cruiseDraft.name.trim()) { setError('Cruise name is required'); return; }
    setError(null);
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_upsert_boat_cruise', {
        p_cruise_id: cruiseDraft.cruise_id, p_property_id: propertyId,
        p_boat_id: cruiseDraft.boat_id ? Number(cruiseDraft.boat_id) : null,
        p_name: cruiseDraft.name.trim(), p_cruise_type: cruiseDraft.cruise_type || null,
        p_route_from: cruiseDraft.route_from.trim() || null,
        p_route_to: cruiseDraft.route_to.trim() || null,
        p_duration_min: cruiseDraft.duration_min ? Number(cruiseDraft.duration_min) : null,
        p_capacity_pax: cruiseDraft.capacity_pax ? Number(cruiseDraft.capacity_pax) : null,
        p_price_amount: cruiseDraft.price_amount ? Number(cruiseDraft.price_amount) : null,
        p_price_currency: cruiseDraft.price_currency || 'USD',
        p_price_includes_vat_service: cruiseDraft.price_includes_vat_service,
        p_dmc_price_amount: cruiseDraft.dmc_price_amount ? Number(cruiseDraft.dmc_price_amount) : null,
        p_dmc_discount_pct: cruiseDraft.dmc_discount_pct ? Number(cruiseDraft.dmc_discount_pct) : null,
        p_price_notes: cruiseDraft.price_notes.trim() || null,
        p_service_time_from: cruiseDraft.service_time_from || null,
        p_service_time_to: cruiseDraft.service_time_to || null,
        p_available_season_codes: cruiseDraft.available_season_codes.length > 0 ? cruiseDraft.available_season_codes : null,
        p_is_complimentary: cruiseDraft.is_complimentary,
        p_is_active: cruiseDraft.is_active,
        p_bookable_via: cruiseDraft.bookable_via.trim() || null,
        p_age_restriction: cruiseDraft.age_restriction.trim() || null,
        p_description: cruiseDraft.description.trim() || null,
        p_notes: cruiseDraft.notes.trim() || null,
        p_display_order: cruiseDraft.display_order ? Number(cruiseDraft.display_order) : null,
      });
      if (e) { setError(e.message); return; }
      setCruiseDraft(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      router.refresh();
    });
  }
  function delCruise(id: number) {
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_delete_boat_cruise', { p_cruise_id: id, p_property_id: propertyId });
      if (e) { setError(e.message); return; }
      setConfirmDelCruise(null); router.refresh();
    });
  }

  const boatOptions = boats.map(b => ({ id: b.boat_id, label: b.name }));

  return (
    <div>
      <PanelHeader title="Imekong" subtitle={`${boats.length} boat${boats.length === 1 ? '' : 's'} · ${cruises.length} cruise offering${cruises.length === 1 ? '' : 's'}`}
        action={<div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => setBoatDraft({ ...EMPTY_BOAT })} style={btnGhost}>+ Boat</button>
          <button type="button" onClick={() => setCruiseDraft({ ...EMPTY_CRUISE, boat_id: boats[0]?.boat_id?.toString() ?? '' })} style={btnPrimary}>+ Cruise</button>
        </div>} />
      <ErrorBanner error={error} />
      <SavedFlash show={saved} />

      {boatDraft && (
        <FormShell title={boatDraft.boat_id ? 'Edit boat' : 'New boat'} onSave={saveBoat} onCancel={() => { setBoatDraft(null); setError(null); }} busy={busy}>
          <LabeledInput label="Name *" value={boatDraft.name} onChange={(v) => setBoatDraft({ ...boatDraft, name: v })} placeholder="iMekong" />
          <LabeledInput label="Model" value={boatDraft.model} onChange={(v) => setBoatDraft({ ...boatDraft, model: v })} placeholder="longtail / motor yacht" />
          <LabeledInput label="Year built" value={boatDraft.year_built} onChange={(v) => setBoatDraft({ ...boatDraft, year_built: v })} type="number" />
          <LabeledInput label="Length (m)" value={boatDraft.length_m} onChange={(v) => setBoatDraft({ ...boatDraft, length_m: v })} type="number" />
          <LabeledInput label="Width (m)" value={boatDraft.width_m} onChange={(v) => setBoatDraft({ ...boatDraft, width_m: v })} type="number" />
          <LabeledInput label="Draft (m)" value={boatDraft.draft_m} onChange={(v) => setBoatDraft({ ...boatDraft, draft_m: v })} type="number" />
          <LabeledSelect label="Engine type" value={boatDraft.engine_type} onChange={(v) => setBoatDraft({ ...boatDraft, engine_type: v })} options={ENGINE_OPTS} />
          <LabeledInput label="Engine (HP)" value={boatDraft.engine_hp} onChange={(v) => setBoatDraft({ ...boatDraft, engine_hp: v })} type="number" />
          <LabeledInput label="Top speed (knots)" value={boatDraft.top_speed_knots} onChange={(v) => setBoatDraft({ ...boatDraft, top_speed_knots: v })} type="number" />
          <LabeledInput label="Fuel capacity (L)" value={boatDraft.fuel_capacity_l} onChange={(v) => setBoatDraft({ ...boatDraft, fuel_capacity_l: v })} type="number" />
          <LabeledInput label="Home port" value={boatDraft.home_port} onChange={(v) => setBoatDraft({ ...boatDraft, home_port: v })} span={2} />
          <LabeledInput label="Capacity · pax" value={boatDraft.capacity_pax} onChange={(v) => setBoatDraft({ ...boatDraft, capacity_pax: v })} type="number" />
          <LabeledInput label="Seated" value={boatDraft.capacity_seated} onChange={(v) => setBoatDraft({ ...boatDraft, capacity_seated: v })} type="number" />
          <LabeledInput label="Standing" value={boatDraft.capacity_standing} onChange={(v) => setBoatDraft({ ...boatDraft, capacity_standing: v })} type="number" />
          <LabeledInput label="Dining" value={boatDraft.capacity_dining} onChange={(v) => setBoatDraft({ ...boatDraft, capacity_dining: v })} type="number" />
          <LabeledInput label="Crew size" value={boatDraft.crew_size} onChange={(v) => setBoatDraft({ ...boatDraft, crew_size: v })} type="number" />
          <ArrayInput label="Amenities (comma-sep)" value={boatDraft.amenities} onChange={(v) => setBoatDraft({ ...boatDraft, amenities: v })} placeholder="wc, bar, shade, life jackets" span={3} />
          <LabeledInput label="Hero image URL" value={boatDraft.hero_image_url} onChange={(v) => setBoatDraft({ ...boatDraft, hero_image_url: v })} type="url" span={3} />
          <LabeledTextarea label="Description" value={boatDraft.description} onChange={(v) => setBoatDraft({ ...boatDraft, description: v })} span={3} rows={3} />
          <LabeledTextarea label="Notes" value={boatDraft.notes} onChange={(v) => setBoatDraft({ ...boatDraft, notes: v })} span={3} />
          <div style={{ gridColumn: '1 / -1' }}>
            <LabeledCheckbox label="Active" checked={boatDraft.is_active} onChange={(v) => setBoatDraft({ ...boatDraft, is_active: v })} />
          </div>
        </FormShell>
      )}

      {cruiseDraft && (
        <FormShell title={cruiseDraft.cruise_id ? 'Edit cruise' : 'New cruise'} onSave={saveCruise} onCancel={() => { setCruiseDraft(null); setError(null); }} busy={busy}>
          <LabeledInput label="Name *" value={cruiseDraft.name} onChange={(v) => setCruiseDraft({ ...cruiseDraft, name: v })} span={2} placeholder="Sunset Cruise" />
          <LabeledSelect label="Type" value={cruiseDraft.cruise_type} onChange={(v) => setCruiseDraft({ ...cruiseDraft, cruise_type: v })} options={CRUISE_TYPE_OPTS} />
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A', fontWeight: 600, marginBottom: 4 }}>Boat</div>
            <select value={cruiseDraft.boat_id} onChange={(e) => setCruiseDraft({ ...cruiseDraft, boat_id: e.target.value })} style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #E6DFCC', borderRadius: 3, background: '#FFFFFF', color: '#1B1B1B', width: '100%' }}>
              <option value="">— pick a boat —</option>
              {boatOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <LabeledInput label="Route from" value={cruiseDraft.route_from} onChange={(v) => setCruiseDraft({ ...cruiseDraft, route_from: v })} />
          <LabeledInput label="Route to" value={cruiseDraft.route_to} onChange={(v) => setCruiseDraft({ ...cruiseDraft, route_to: v })} />
          <LabeledInput label="Duration (min)" value={cruiseDraft.duration_min} onChange={(v) => setCruiseDraft({ ...cruiseDraft, duration_min: v })} type="number" />
          <LabeledInput label="Capacity (pax)" value={cruiseDraft.capacity_pax} onChange={(v) => setCruiseDraft({ ...cruiseDraft, capacity_pax: v })} type="number" />
          <LabeledInput label="Service from" value={cruiseDraft.service_time_from} onChange={(v) => setCruiseDraft({ ...cruiseDraft, service_time_from: v })} type="time" />
          <LabeledInput label="Service to" value={cruiseDraft.service_time_to} onChange={(v) => setCruiseDraft({ ...cruiseDraft, service_time_to: v })} type="time" />
          {/* PRICE */}
          <LabeledInput label="Price (all-in)" value={cruiseDraft.price_amount} onChange={(v) => setCruiseDraft({ ...cruiseDraft, price_amount: v })} type="number" />
          <LabeledInput label="Currency" value={cruiseDraft.price_currency} onChange={(v) => setCruiseDraft({ ...cruiseDraft, price_currency: v })} />
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 6 }}>
            <LabeledCheckbox label="Price incl VAT + service" checked={cruiseDraft.price_includes_vat_service} onChange={(v) => setCruiseDraft({ ...cruiseDraft, price_includes_vat_service: v })} />
          </div>
          <LabeledInput label="DMC price (net)" value={cruiseDraft.dmc_price_amount} onChange={(v) => {
            const guest = Number(cruiseDraft.price_amount || 0); const dmc = Number(v || 0);
            const pct = guest > 0 && dmc > 0 ? ((1 - dmc/guest) * 100).toFixed(2) : cruiseDraft.dmc_discount_pct;
            setCruiseDraft({ ...cruiseDraft, dmc_price_amount: v, dmc_discount_pct: v ? pct : '' });
          }} type="number" />
          <LabeledInput label="DMC discount %" value={cruiseDraft.dmc_discount_pct} onChange={(v) => {
            const guest = Number(cruiseDraft.price_amount || 0); const pct = Number(v || 0);
            const dmc = guest > 0 && pct >= 0 ? (guest * (1 - pct/100)).toFixed(2) : cruiseDraft.dmc_price_amount;
            setCruiseDraft({ ...cruiseDraft, dmc_discount_pct: v, dmc_price_amount: v ? dmc : '' });
          }} type="number" />
          <div style={{ fontSize: 11, color: '#5A5A5A', alignSelf: 'flex-end', paddingBottom: 8 }}>
            {cruiseDraft.price_amount && cruiseDraft.dmc_price_amount ? `Guest ${cruiseDraft.price_currency} ${cruiseDraft.price_amount} → DMC ${cruiseDraft.price_currency} ${cruiseDraft.dmc_price_amount}${cruiseDraft.dmc_discount_pct ? ` (–${cruiseDraft.dmc_discount_pct}%)` : ''}` : 'Auto-computes'}
          </div>
          {/* SEASONS */}
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A', fontWeight: 600, marginBottom: 6 }}>Available in seasons</div>
            {seasonCodes.length === 0 ? (
              <div style={{ fontSize: 11, color: '#5A5A5A' }}>No seasons defined. Leave empty = year-round.</div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {seasonCodes.map(code => {
                  const on = cruiseDraft.available_season_codes.includes(code);
                  return (
                    <button key={code} type="button" onClick={() => toggleSeason(code)} style={{
                      padding: '5px 12px', fontSize: 12, borderRadius: 14, cursor: 'pointer',
                      border: '1px solid ' + (on ? '#1F3A2E' : '#E6DFCC'),
                      background: on ? '#1F3A2E' : '#FFFFFF', color: on ? '#FFFFFF' : '#1B1B1B',
                      fontWeight: on ? 600 : 400,
                    }}>{on ? '✓ ' : ''}{code}</button>
                  );
                })}
              </div>
            )}
          </div>
          <LabeledInput label="Bookable via" value={cruiseDraft.bookable_via} onChange={(v) => setCruiseDraft({ ...cruiseDraft, bookable_via: v })} />
          <LabeledInput label="Age restriction" value={cruiseDraft.age_restriction} onChange={(v) => setCruiseDraft({ ...cruiseDraft, age_restriction: v })} />
          <LabeledInput label="Display order" value={cruiseDraft.display_order} onChange={(v) => setCruiseDraft({ ...cruiseDraft, display_order: v })} type="number" />
          <LabeledTextarea label="Description" value={cruiseDraft.description} onChange={(v) => setCruiseDraft({ ...cruiseDraft, description: v })} span={3} />
          <LabeledTextarea label="Price notes" value={cruiseDraft.price_notes} onChange={(v) => setCruiseDraft({ ...cruiseDraft, price_notes: v })} span={3} rows={2} />
          <LabeledTextarea label="Notes" value={cruiseDraft.notes} onChange={(v) => setCruiseDraft({ ...cruiseDraft, notes: v })} span={3} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16 }}>
            <LabeledCheckbox label="Complimentary" checked={cruiseDraft.is_complimentary} onChange={(v) => setCruiseDraft({ ...cruiseDraft, is_complimentary: v })} />
            <LabeledCheckbox label="Active" checked={cruiseDraft.is_active} onChange={(v) => setCruiseDraft({ ...cruiseDraft, is_active: v })} />
          </div>
        </FormShell>
      )}

      {/* BOATS LIST */}
      <div style={{ padding: '12px 20px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5A5A5A', marginBottom: 6 }}>Boats</div>
        {boats.length === 0 ? <EmptyState message="No boats yet." /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {boats.map(b => (
              <div key={b.boat_id} style={rowStyle}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{b.name}</span>
                    {b.model && <span style={pill('#F5F0E1', '#5A5A5A')}>{b.model}</span>}
                    {b.length_m && <span style={{ fontSize: 11, color: '#5A5A5A' }}>{b.length_m}m</span>}
                    {b.capacity_pax && <span style={{ fontSize: 11, color: '#5A5A5A' }}>{b.capacity_pax} pax</span>}
                    {b.engine_type && <span style={pill('#F5F0E1', '#5A5A5A')}>{b.engine_type}{b.engine_hp ? ` ${b.engine_hp}HP` : ''}</span>}
                    {b.is_active === false && <span style={pill('#F5F0E1', '#8A8A8A')}>inactive</span>}
                  </div>
                  {b.description && <div style={{ fontSize: 12, marginTop: 4 }}>{b.description}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => setBoatDraft(toBoatDraft(b))} style={btnGhost}>Edit</button>
                  {confirmDelBoat === b.boat_id ? <DeleteConfirm show busy={busy} onConfirm={() => delBoat(b.boat_id)} onCancel={() => setConfirmDelBoat(null)} /> :
                    <button type="button" onClick={() => setConfirmDelBoat(b.boat_id)} style={btnGhost}>Delete</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CRUISES LIST */}
      <div style={{ padding: '12px 20px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5A5A5A', marginBottom: 6 }}>Cruise packages</div>
        {cruises.length === 0 ? <EmptyState message="No cruises yet — add one to appear on the customer-facing menu." /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cruises.map(c => {
              const boat = boats.find(b => b.boat_id === c.boat_id);
              return (
                <div key={c.cruise_id} style={rowStyle}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</span>
                      {c.cruise_type && <span style={pill('#F5F0E1', '#5A5A5A')}>{c.cruise_type}</span>}
                      {boat && <span style={pill('#EAE1F0', '#4A2C7A')}>on {boat.name}</span>}
                      {(c.route_from || c.route_to) && <span style={{ fontSize: 11, color: '#5A5A5A' }}>{c.route_from ?? '?'} → {c.route_to ?? '?'}</span>}
                      {c.duration_min && <span style={{ fontSize: 11, color: '#5A5A5A' }}>{c.duration_min}m</span>}
                      {c.price_amount != null && <span style={pill('#E4F0E1', '#1F5C2C')}>{c.price_currency ?? 'USD'} {c.price_amount}{c.price_includes_vat_service ? ' (incl)' : ' (net)'}</span>}
                      {c.dmc_price_amount != null && <span style={pill('#EAE1F0', '#4A2C7A')}>DMC {c.price_currency ?? 'USD'} {c.dmc_price_amount}{c.dmc_discount_pct != null ? ` –${c.dmc_discount_pct}%` : ''}</span>}
                      {c.is_complimentary && <span style={pill('#E4F0E1', '#1F5C2C')}>complimentary</span>}
                      {c.is_active === false && <span style={pill('#F5F0E1', '#8A8A8A')}>inactive</span>}
                    </div>
                    {c.description && <div style={{ fontSize: 12, marginTop: 4 }}>{c.description}</div>}
                    {(c.service_time_from || c.service_time_to || (c.available_season_codes && c.available_season_codes.length > 0)) && (
                      <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {(c.service_time_from || c.service_time_to) && <span>service {String(c.service_time_from ?? '?').slice(0, 5)}–{String(c.service_time_to ?? '?').slice(0, 5)}</span>}
                        {c.available_season_codes && c.available_season_codes.length > 0 && <span>seasons: {c.available_season_codes.join(', ')}</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={() => setCruiseDraft(toCruiseDraft(c))} style={btnGhost}>Edit</button>
                    {confirmDelCruise === c.cruise_id ? <DeleteConfirm show busy={busy} onConfirm={() => delCruise(c.cruise_id)} onCancel={() => setConfirmDelCruise(null)} /> :
                      <button type="button" onClick={() => setConfirmDelCruise(c.cruise_id)} style={btnGhost}>Delete</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
