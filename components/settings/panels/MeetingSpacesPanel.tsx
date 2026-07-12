// components/settings/panels/MeetingSpacesPanel.tsx
// PBS 2026-07-12 evening — Meeting Spaces overlay. Reads facilities WHERE is_meeting_space=true.
// Editing is done in the Facilities panel (this is a filtered view + capacity/rate summary).
'use client';

import { PanelHeader, EmptyState } from './_shared';
import { pill } from './_settings_ui';

type Row = {
  facility_id: number; name: string; category: string | null;
  size_sqm: number | null; meeting_ceiling_height_m: number | null;
  meeting_has_daylight: boolean | null; meeting_has_blackout: boolean | null; meeting_has_ac: boolean | null;
  meeting_has_projector: boolean | null; meeting_has_screen: boolean | null;
  meeting_has_sound_system: boolean | null; meeting_has_mic: boolean | null;
  meeting_has_whiteboard: boolean | null; meeting_has_flipchart: boolean | null;
  meeting_has_wifi: boolean | null; meeting_wifi_mbps: number | null;
  meeting_capacity_theatre: number | null; meeting_capacity_classroom: number | null;
  meeting_capacity_ushape: number | null; meeting_capacity_boardroom: number | null;
  meeting_capacity_banquet: number | null; meeting_capacity_cabaret: number | null;
  meeting_capacity_reception: number | null;
  meeting_half_day_rate: number | null; meeting_full_day_rate: number | null;
  meeting_setup_fee: number | null; meeting_rate_currency: string | null;
  meeting_catering_options: string[] | null; meeting_location_tag: string | null;
  meeting_notes: string | null;
};

export default function MeetingSpacesPanel({ data }: { data: Row[] }) {
  return (
    <div>
      <PanelHeader
        title="Meeting Spaces"
        subtitle={`${data.length} venue${data.length === 1 ? '' : 's'} · sourced from Facilities marked "usable as meeting space"`}
        action={<span style={{ fontSize: 11, color: '#5A5A5A' }}>Edit specs in the Facilities tab</span>}
      />
      {data.length === 0 ? (
        <EmptyState message="No meeting spaces yet. Open Facilities → edit a facility (e.g. Yoga Pavilion) → tick 'Usable as meeting space' + fill the meeting sub-form." />
      ) : (
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.map(r => {
            const kit: string[] = [];
            if (r.meeting_has_projector)    kit.push('projector');
            if (r.meeting_has_screen)       kit.push('screen');
            if (r.meeting_has_sound_system) kit.push('sound');
            if (r.meeting_has_mic)          kit.push('mic');
            if (r.meeting_has_whiteboard)   kit.push('whiteboard');
            if (r.meeting_has_flipchart)    kit.push('flipchart');
            const climate: string[] = [];
            if (r.meeting_has_ac)       climate.push('AC');
            if (r.meeting_has_daylight) climate.push('daylight');
            if (r.meeting_has_blackout) climate.push('blackout');
            return (
              <div key={r.facility_id} style={{ background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 4, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--serif, ui-serif, Georgia, serif)', fontSize: 18, fontWeight: 500 }}>{r.name}</span>
                  {r.meeting_location_tag && <span style={pill('#EAE1F0', '#4A2C7A')}>{r.meeting_location_tag}</span>}
                  {r.size_sqm && <span style={{ fontSize: 11, color: '#5A5A5A' }}>{r.size_sqm} m²</span>}
                  {r.meeting_ceiling_height_m && <span style={{ fontSize: 11, color: '#5A5A5A' }}>ceiling {r.meeting_ceiling_height_m} m</span>}
                  {r.meeting_has_wifi && <span style={pill('#E4F0E1', '#1F5C2C')}>Wi-Fi{r.meeting_wifi_mbps ? ` ${r.meeting_wifi_mbps}Mbps` : ''}</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, fontSize: 12 }}>
                  <MetaCell label="Theatre">{r.meeting_capacity_theatre ?? '—'}</MetaCell>
                  <MetaCell label="Classroom">{r.meeting_capacity_classroom ?? '—'}</MetaCell>
                  <MetaCell label="U-shape">{r.meeting_capacity_ushape ?? '—'}</MetaCell>
                  <MetaCell label="Boardroom">{r.meeting_capacity_boardroom ?? '—'}</MetaCell>
                  <MetaCell label="Banquet">{r.meeting_capacity_banquet ?? '—'}</MetaCell>
                  <MetaCell label="Cabaret">{r.meeting_capacity_cabaret ?? '—'}</MetaCell>
                  <MetaCell label="Reception">{r.meeting_capacity_reception ?? '—'}</MetaCell>
                </div>
                {(kit.length > 0 || climate.length > 0) && (
                  <div style={{ fontSize: 11, color: '#5A5A5A', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {kit.length     > 0 && <span>AV: {kit.join(' · ')}</span>}
                    {climate.length > 0 && <span>{climate.join(' · ')}</span>}
                  </div>
                )}
                <div style={{ fontSize: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {r.meeting_half_day_rate != null && <span>Half-day: <strong>{r.meeting_rate_currency ?? 'USD'} {r.meeting_half_day_rate}</strong></span>}
                  {r.meeting_full_day_rate != null && <span>Full-day: <strong>{r.meeting_rate_currency ?? 'USD'} {r.meeting_full_day_rate}</strong></span>}
                  {r.meeting_setup_fee     != null && <span>Setup fee: {r.meeting_rate_currency ?? 'USD'} {r.meeting_setup_fee}</span>}
                </div>
                {(r.meeting_catering_options ?? []).length > 0 && (
                  <div style={{ fontSize: 11, color: '#5A5A5A' }}>Catering: {(r.meeting_catering_options ?? []).join(', ')}</div>
                )}
                {r.meeting_notes && <div style={{ fontSize: 12, color: '#3A3A3A' }}>{r.meeting_notes}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetaCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}
