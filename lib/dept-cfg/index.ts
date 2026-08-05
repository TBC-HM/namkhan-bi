// ═══════════════════════════════════════════════════════════════════════════
// Department-Configuration manifest (single source of truth)
// ═══════════════════════════════════════════════════════════════════════════
//
// GOVERNANCE NOTE (rule 530 — hot file):
// This file is registered in governance.push_hot_files. Every push MUST call
// fn_gh_declare_read first (captures the read-time sha), then push via
// fn_gh_push_file — the bridge applies a CAS check server-side to prevent
// silent clobber in parallel-edit windows.

import type { DeptCfg } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// PBS 2026-07-16 revenue report suite (Revenue module — performance ·
// monthly recap · budget vs actual · compset · parity). Report-grid tiles
// link to /h/[pid]/reports/SLUG. See app/h/[property_id]/reports/page.tsx.
const REVENUE_REPORT_TYPES = [
  { slug: 'perf',       label: 'Performance',       desc: 'KPI trends by segment', icon: '📊', color: '#084838' },
  { slug: 'recap',      label: 'Monthly recap',     desc: 'Board-ready summary',   icon: '📅', color: '#065F46' },
  { slug: 'budget',     label: 'Budget vs Actual',  desc: 'Variance deep-dive',    icon: '🎯', color: '#047857' },
  { slug: 'compset',    label: 'Compset',           desc: 'Lighthouse pulse',      icon: '🔭', color: '#059669' },
  { slug: 'parity',     label: 'Parity',            desc: 'Channel gap tracker',   icon: '⚖️',  color: '#10B981' },
] as const;

const REVENUE_CFG: DeptCfg = {
  slug: 'revenue',
  pillTitle: 'Revenue',
  hodName: 'Vector',
  hodEmoji: '⚓',
  ownerRole: 'revenue_hod',
  hodTagline: 'Ask Vector anything about revenue.',
  chatPlaceholder: 'e.g. how are we pacing for next weekend?',
  storageKeyPrefix: 'rev',
  // PBS 2026-07-06 late evening: canonical Revenue nav — 6 top-level groups.
  // Three of them are HUBS with sub-tabs (rendered on their landing pages as an
  // inline strip below the main tab bar):
  //   Demand & Pace  → Demand / Pace / Pickup / Cancellations
  //   Performance    → Rooms / Channels / Rate Plans / Markets
  //   Market & Control → Comp Set / Leakage / Parity
  // The parent tab links to the first child so clicking it always lands somewhere useful.
  subPages: [
    // PBS 2026-07-07 evening: HoD + Overview split. /revenue = HoD chat cockpit.
    // /revenue/overview = new dept-wide summary landing with Pulse + Calendar sub-tabs.
    // PBS 2026-07-07 night: Overview tab lands on /revenue/pulse (dept summary
    // page is no longer used). Sub-strip on Pulse shows Calendar (sibling filter
    // hides Pulse itself).
    { label: 'HoD',             href: '/revenue'          },
    // PBS 2026-07-15: Briefing = revenue-area guardrail inbox with accept/
    // dismiss/snooze CTAs and a learning loop that scores whether accepts
    // actually moved the KPI. See app/revenue/briefing/page.tsx.
    { label: 'Briefing',        href: '/revenue/briefing' },
    { label: 'Overview',        href: '/revenue/pulse'    },
    { label: 'Demand & Pace',   href: '/revenue/demand'   },
    { label: 'Performance',     href: '/revenue/rooms'    },
    { label: 'Market & Control',href: '/revenue/compset'  },
    // PBS 2026-08-04 (brief revenue-module-v1, owner answer to open_question):
    // Rate Desk = the rate-action cockpit (pace board · action queue · compset ·
    // decision ledger) at app/h/[property_id]/revenue/cockpit. Stored Namkhan-
    // anchored on purpose: rewriteSubPagesForProperty swaps /h/260955 → the
    // active property (same pattern as Reports), and Namkhan renders it as-is.
    // NOT '/revenue/cockpit' — that legacy unprefixed URL renders the engine
    // DeptCockpit (a different, URL-only surface), not the Rate Desk.
    { label: 'Rate Desk',       href: '/h/260955/revenue/cockpit' },
    { label: 'Forecast',       href: '/revenue/forecast' },
  ],
  quickChips: [
    { label: 'Pulse',    href: '/revenue/pulse'    },
    { label: 'Demand',   href: '/revenue/demand'   },
    { label: 'Pace',     href: '/revenue/pace'     },
    { label: 'Pickup',   href: '/revenue/pickup'   },
    { label: 'Rooms',    href: '/revenue/rooms'    },
    { label: 'Channels', href: '/revenue/channels' },
    { label: 'Compset',  href: '/revenue/compset'  },
    { label: 'Briefing', href: '/revenue/briefing' },
  ],
  attentionRoutes: [
    { matcher: 'parity',  href: '/revenue/parity'   },
    { matcher: 'comp',    href: '/revenue/compset'  },
    { matcher: 'compset', href: '/revenue/compset'  },
    { matcher: 'pace',    href: '/revenue/pace'     },
    { matcher: 'channel', href: '/revenue/channels' },
    { matcher: 'rate',    href: '/revenue/pricing'  },
    { matcher: 'bar',     href: '/revenue/pricing'  },
    { matcher: 'forecast', href: '/revenue/forecast' },
  ],
  defaultDrilldown: '/revenue/pulse',
  kpiTiles: [
    { k: 'OCC',    v: '78%',  d: '+4 vs LY'        },
    { k: 'ADR',    v: '$182', d: '+$6 vs STLY'     },
    { k: 'RevPAR', v: '$142', d: '+$11 vs LY'      },
    { k: 'PACE',   v: '−14%', d: 'next 30d vs STLY' },
  ],
  reportTypes: REVENUE_REPORT_TYPES,
  brandHex: '#084838',
};