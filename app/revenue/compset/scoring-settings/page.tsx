// app/revenue/compset/scoring-settings/page.tsx
// Revenue · Comp Set · Scoring — versioned config of the date picker weights.
// Server component that loads:
//   - active config (public.v_compset_scoring_config WHERE is_active=true)
//   - all event types (public.v_compset_event_types)
//   - version history (public.v_compset_scoring_config + audit join)
//   - active-config preview dates (public.compset_pick_scrape_dates)
//
// The editor itself is client-side (ScoringSettingsEditor).
//
// API routes used by editor:
//   POST /api/compset/scoring/draft     -> compset_create_scoring_config_draft
//   POST /api/compset/scoring/activate  -> compset_activate_scoring_config

import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import StatusPill from '@/components/ui/StatusPill';
import { supabase } from '@/lib/supabase';
import { fmtIsoDate, EMPTY } from '@/lib/format';

import ScoringSettingsEditor from '../_components/scoring/ScoringSettingsEditor';
import EventTypesTable from '../_components/scoring/EventTypesTable';
import VersionHistoryTable from '../_components/scoring/VersionHistoryTable';
import { buildVersionRows } from '../_components/scoring/types';
import ScrapeDatesPreview from '../_components/ScrapeDatesPreview';

import type {
  EventTypeRow,
  ScoringConfigAuditRow,
  ScoringConfigRow,
} from '../_components/scoring/types';
import type { ScrapeDateRow } from '../_components/types';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

async function loadAll() {
  const [activeR, allConfigsR, auditsR, eventsR, pickR] = await Promise.all([
    supabase.from('v_compset_scoring_config').select('*').eq('is_active', true).maybeSingle(),
    supabase.from('v_compset_scoring_config').select('*').order('version', { ascending: false }),
    supabase.from('v_compset_scoring_config_audit').select('*').order('changed_at', { ascending: false }),
    supabase
      .from('v_compset_event_types')
      .select('*')
      .order('default_demand_score', { ascending: false, nullsFirst: false }),
    supabase.rpc('compset_pick_scrape_dates', {
      p_max_dates: 8,
      p_horizon_days: 120,
      p_min_score: 40,
    }),
  ]);

  return {
    active: (activeR.data ?? null) as ScoringConfigRow | null,
    allConfigs: (allConfigsR.data ?? []) as ScoringConfigRow[],
    audits: (auditsR.data ?? []) as ScoringConfigAuditRow[],
    eventTypes: (eventsR.data ?? []) as EventTypeRow[],
    pickDates: (pickR.data ?? []) as ScrapeDateRow[],
  };
}

const PANEL_STYLE: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  padding: '22px 24px',
  marginTop: 18,
};

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontStyle: 'italic',
  fontSize: 'var(--t-xl)',
  fontWeight: 500,
  margin: 0,
};

const STATUS_LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  textTransform: 'uppercase',
  letterSpacing: 'var(--ls-extra)',
  color: 'var(--brass)',
  display: 'block',
  marginBottom: 6,
};

const STATUS_VALUE_STYLE: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontStyle: 'italic',
  fontSize: 'var(--t-2xl)',
  fontWeight: 500,
  lineHeight: 1.1,
  letterSpacing: 'var(--ls-tight)',
};

const STATUS_SUB_STYLE: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  color: 'var(--ink-mute)',
  marginTop: 6,
};

export default async function ScoringSettingsPage() {
  const data = await loadAll();
  const versionRows = buildVersionRows(data.allConfigs, data.audits);
  const latestAudit = data.audits[0] ?? null;

  return (
    <>
      <PageHeader
        pillar="Revenue"
        tab="Comp Set · Scoring"
        title={
          <>
            Tune the <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>weights</em>,
            change what the agent shops.
          </>
        }
        lede="Versioned weights for the date picker · every save is auditable · activation is one click."
        rightSlot={
          <Link href="/revenue/compset" style={backLinkStyle}>
            ← BACK TO COMP SET
          </Link>
        }
      />

      {/* STATUS ROW */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginTop: 18,
        }}
      >
        <div style={statusCellStyle}>
          <span style={STATUS_LABEL_STYLE}>Active version</span>
          {data.active ? (
            <>
              <span style={STATUS_VALUE_STYLE}>v{data.active.version}</span>
              <div style={STATUS_SUB_STYLE}>
                Activated {fmtIsoDate(data.active.activated_at)}
              </div>
            </>
          ) : (
            <>
              <span style={{ ...STATUS_VALUE_STYLE, color: 'var(--ink-faint)' }}>
                {EMPTY}
              </span>
              <div style={STATUS_SUB_STYLE}>No active config — save one to start.</div>
            </>
          )}
        </div>
        <div style={statusCellStyle}>
          <span style={STATUS_LABEL_STYLE}>Total versions</span>
          <span style={STATUS_VALUE_STYLE}>{data.allConfigs.length}</span>
          <div style={STATUS_SUB_STYLE}>
            {data.allConfigs.filter((c) => c.retired_at).length} retired
          </div>
        </div>
        <div style={statusCellStyle}>
          <span style={STATUS_LABEL_STYLE}>Last edit</span>
          {latestAudit ? (
            <>
              <span
                style={{
                  ...STATUS_VALUE_STYLE,
                  fontSize: 'var(--t-lg)',
                  fontStyle: 'normal',
                  fontFamily: 'var(--sans)',
                }}
              >
                {latestAudit.action}
              </span>
              <div style={STATUS_SUB_STYLE}>
                {fmtIsoDate(latestAudit.changed_at)}
                {latestAudit.changed_by ? ` · ${latestAudit.changed_by.slice(0, 8)}` : ''}
              </div>
              {latestAudit.reason && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 'var(--t-sm)',
                    color: 'var(--ink-soft)',
                    fontStyle: 'italic',
                  }}
                >
                  &ldquo;{latestAudit.reason}&rdquo;
                </div>
              )}
            </>
          ) : (
            <>
              <span
                style={{
                  ...STATUS_VALUE_STYLE,
                  color: 'var(--ink-faint)',
                  fontSize: 'var(--t-lg)',
                  fontStyle: 'italic',
                  fontFamily: 'var(--serif)',
                }}
              >
                never
              </span>
              <div style={STATUS_SUB_STYLE}>Audit log is empty.</div>
            </>
          )}
        </div>
      </div>

      {/* EDITOR (client) */}
      {data.active ? (
        <ScoringSettingsEditor active={data.active} />
      ) : (
        <div
          style={{
            ...PANEL_STYLE,
            textAlign: 'center',
            color: 'var(--ink-mute)',
          }}
        >
          No active scoring config exists yet. Run the
          <code style={inlineCodeStyle}>compset_create_scoring_config_draft</code>
          RPC to seed v1, then refresh.
        </div>
      )}

      {/* SECTION: Calendar event scores (read-only) */}
      <div style={{ ...PANEL_STYLE, padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--paper-deep)',
          }}
        >
          <div className="t-eyebrow">CALENDAR EVENT SCORES</div>
          <h2 style={{ ...SECTION_TITLE_STYLE, marginTop: 6 }}>
            Default demand by event type
          </h2>
          <div
            style={{
              color: 'var(--ink-mute)',
              fontSize: 'var(--t-sm)',
              marginTop: 4,
            }}
          >
            17 event types govern how big a date scores during a known event.
            Edit per-event scores from the marketing calendar.
          </div>
        </div>
        <EventTypesTable rows={data.eventTypes} />
        <div
          style={{
            padding: '12px 22px',
            borderTop: '1px solid var(--paper-deep)',
            background: 'var(--paper)',
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-loose)',
            textTransform: 'uppercase',
            color: 'var(--ink-mute)',
          }}
        >
          Edit event scores → /marketing/calendar (TBD)
        </div>
      </div>

      {/* SECTION: Live preview */}
      <div style={PANEL_STYLE}>
        <div style={{ marginBottom: 6 }}>
          <div className="t-eyebrow">LIVE PREVIEW</div>
          <h2 style={{ ...SECTION_TITLE_STYLE, marginTop: 6 }}>
            What the active config picks today
          </h2>
        </div>
        <div
          style={{
            background: 'var(--st-warn-bg)',
            border: '1px solid var(--st-warn-bd)',
            borderRadius: 4,
            padding: '10px 14px',
            marginTop: 12,
            marginBottom: 10,
            fontSize: 'var(--t-sm)',
            color: 'var(--ink-soft)',
          }}
        >
          Preview reflects the <strong>active</strong> config, not your draft.
          Draft preview computed client-side coming in v2.
        </div>
        <div style={{ margin: '0 -24px -22px' }}>
          <ScrapeDatesPreview
            dates={data.pickDates}
            mode="active_config"
            horizonDays={120}
            minScore={40}
          />
        </div>
      </div>

      {/* SECTION: Version history */}
      <div style={{ ...PANEL_STYLE, padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--paper-deep)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div className="t-eyebrow">VERSION HISTORY</div>
            <h2 style={{ ...SECTION_TITLE_STYLE, marginTop: 6 }}>
              Every save · every activation
            </h2>
            <div
              style={{
                color: 'var(--ink-mute)',
                fontSize: 'var(--t-sm)',
                marginTop: 4,
              }}
            >
              {versionRows.length} version{versionRows.length === 1 ? '' : 's'}
              {' · '}
              {data.audits.length} audit row{data.audits.length === 1 ? '' : 's'}
            </div>
          </div>
          {data.active && (
            <div style={{ textAlign: 'right' }}>
              <StatusPill tone="active">
                ACTIVE · v{data.active.version}
              </StatusPill>
            </div>
          )}
        </div>
        <VersionHistoryTable rows={versionRows} />
      </div>
    </>
  );
}

const statusCellStyle: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  padding: '14px 16px',
  minHeight: 108,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-start',
};

const backLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 14px',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  fontWeight: 600,
  borderRadius: 4,
  border: '1px solid var(--paper-deep)',
  background: 'var(--paper-warm)',
  color: 'var(--ink-soft)',
  textDecoration: 'none',
};

const inlineCodeStyle: React.CSSProperties = {
  margin: '0 6px',
  padding: '1px 6px',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  background: 'var(--paper)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 3,
};
