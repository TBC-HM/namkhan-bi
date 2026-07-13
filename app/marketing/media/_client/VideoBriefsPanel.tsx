// app/marketing/media/_client/VideoBriefsPanel.tsx
// PBS 2026-07-13 · Phase 2 unified video pipeline — brief listing panel.
// Renders every marketing.video_briefs row for the property, grouped by status.
// Entry point when planning a video. "+ New brief" opens NewVideoBriefForm.
//
// NOTE ON PATTERN: the task spec called for a server component under _server/,
// but VideoHub is 'use client' so async server children can''t nest directly.
// Instead: page.tsx fetches v_marketing_video_briefs, passes rows through
// MediaHub → VideoHub → here. Same net effect (server-loaded data, no client
// round-trip on first render) without the RSC boundary trap.
'use client';

import { useState, useMemo } from 'react';
import NewVideoBriefForm, { type PillarOption } from './NewVideoBriefForm';

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';
const AMBER  = '#B48A3A';
const RED    = '#B03826';

export interface VideoBriefRow {
  id: string;
  property_id: number;
  title: string;
  angle: string | null;
  target_pillars: string[] | null;
  target_channels: string[];
  aspect_variants: string[] | null;
  source_clip_ids: string[] | null;
  source_clip_count: number | null;
  aspect_variant_count: number | null;
  channel_count: number | null;
  duration_target_sec: number | null;
  origin: 'yt_title_calendar' | 'manual_media_studio' | 'campaign_ask';
  origin_ref_id: string | null;
  notes: string | null;
  status: 'draft' | 'ready_to_produce' | 'producing' | 'rendered' | 'published' | 'archived';
  created_at: string;
  updated_at: string;
}

interface Props {
  propertyId: number;
  briefs: VideoBriefRow[];
  pillars: PillarOption[];
}

const STATUS_ORDER: VideoBriefRow['status'][] = [
  'draft', 'ready_to_produce', 'producing', 'rendered', 'published', 'archived',
];

const STATUS_LABEL: Record<VideoBriefRow['status'], string> = {
  draft:             'Draft',
  ready_to_produce:  'Ready to produce',
  producing:         'Producing',
  rendered:          'Rendered',
  published:         'Published',
  archived:          'Archived',
};

const ORIGIN_LABEL: Record<VideoBriefRow['origin'], string> = {
  yt_title_calendar:   'YT',
  manual_media_studio: 'Manual',
  campaign_ask:        'Campaign',
};

const ORIGIN_COLOR: Record<VideoBriefRow['origin'], string> = {
  yt_title_calendar:   RED,
  manual_media_studio: FOREST,
  campaign_ask:        AMBER,
};

function fmtDate(iso: string): string {
  try { return new Date(iso).toISOString().slice(0, 10); }
  catch { return iso.slice(0, 10); }
}

export default function VideoBriefsPanel({ propertyId, briefs, pillars }: Props) {
  const [showNew, setShowNew] = useState(false);

  const grouped = useMemo(() => {
    const m = new Map<VideoBriefRow['status'], VideoBriefRow[]>();
    for (const s of STATUS_ORDER) m.set(s, []);
    for (const b of briefs) {
      const bucket = m.get(b.status) ?? [];
      bucket.push(b);
      m.set(b.status, bucket);
    }
    return m;
  }, [briefs]);

  return (
    <div>
      {/* Header + New button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>Video briefs</div>
          <div style={{ fontSize: 11, color: INK_M, marginTop: 2 }}>
            {briefs.length} brief{briefs.length === 1 ? '' : 's'} · property {propertyId}
          </div>
        </div>
        <button type="button" onClick={() => setShowNew(v => !v)}
                style={{ padding: '8px 14px', border: 'none', background: FOREST,
                         color: WHITE, borderRadius: 4, fontSize: 12, fontWeight: 700,
                         cursor: 'pointer' }}>
          {showNew ? 'Hide form' : '+ New brief'}
        </button>
      </div>

      {showNew && (
        <div style={{ marginBottom: 20 }}>
          <NewVideoBriefForm propertyId={propertyId} pillars={pillars}
                             onCreated={() => { setShowNew(false);
                                                 if (typeof window !== 'undefined') window.location.reload(); }}
                             onCancel={() => setShowNew(false)} />
        </div>
      )}

      {briefs.length === 0 && !showNew && (
        <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6,
                      padding: 24, textAlign: 'center', color: INK_M, fontSize: 13 }}>
          No video briefs yet. Click <strong>+ New brief</strong> to plan your first one.
        </div>
      )}

      {/* Grouped by status */}
      {STATUS_ORDER.map(status => {
        const rows = grouped.get(status) ?? [];
        if (rows.length === 0) return null;
        return (
          <div key={status} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                          color: INK_M, fontWeight: 700, marginBottom: 8 }}>
              {STATUS_LABEL[status]} · {rows.length}
            </div>
            <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6,
                          overflow: 'hidden' }}>
              {rows.map((b, i) => (
                <div key={b.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 60px 1.4fr 1fr 80px 90px',
                  gap: 12, padding: '10px 14px', alignItems: 'center',
                  borderTop: i === 0 ? 'none' : `1px solid ${HAIR}`,
                  fontSize: 12, color: INK,
                }}>
                  <div>
                    <div style={{ fontWeight: 600, color: INK, marginBottom: 2 }}>{b.title}</div>
                    {b.angle && (
                      <div style={{ fontSize: 11, color: INK_M, lineHeight: 1.3,
                                    overflow: 'hidden', textOverflow: 'ellipsis',
                                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {b.angle}
                      </div>
                    )}
                  </div>
                  <span style={{ background: ORIGIN_COLOR[b.origin], color: WHITE,
                                 fontSize: 10, fontWeight: 700, padding: '3px 8px',
                                 borderRadius: 3, textAlign: 'center', letterSpacing: '0.04em' }}>
                    {ORIGIN_LABEL[b.origin]}
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(b.target_channels ?? []).map(c => (
                      <span key={c} style={{ background: CREAM, color: INK, fontSize: 10,
                                              padding: '2px 6px', borderRadius: 3 }}>
                        {c}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(b.aspect_variants ?? []).map(a => (
                      <span key={a} style={{ border: `1px solid ${HAIR}`, color: INK_M,
                                              fontSize: 10, padding: '2px 6px', borderRadius: 3 }}>
                        {a}
                      </span>
                    ))}
                  </div>
                  <div style={{ textAlign: 'right', color: INK_M, fontSize: 11 }}>
                    {b.source_clip_count ?? 0} clip{(b.source_clip_count ?? 0) === 1 ? '' : 's'}
                  </div>
                  <div style={{ textAlign: 'right', color: INK_M, fontSize: 11 }}>
                    {fmtDate(b.created_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
