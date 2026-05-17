// app/h/[property_id]/revenue/_surfaces.ts
// Canonical surface configs for Donna's revenue sub-routes. KPI labels and
// panel titles mirror the Namkhan reference pages so once a Donna PMS feed
// lands, the canonical layout is already correct.

import type { DonnaRevenueSurfaceConfig } from './_DonnaRevenueCanonical';

export const REVENUE_SURFACES: Record<string, DonnaRevenueSurfaceConfig> = {
  pulse: {
    slug: 'pulse',
    title: 'Pulse',
    kpis: ['Occupancy', 'ADR', 'RevPAR', 'TRevPAR', 'Cancel %', 'No-show %', 'Lead time (d)', 'ALOS'],
    panels: ["What's open", 'Today', 'Pace gap', 'Pace', 'Decisions queued'],
    tableColumns: ['Date', 'Occupancy', 'ADR', 'RevPAR', 'Pickup', 'Cancel %'],
  },
  pace: {
    slug: 'pace',
    title: 'Pace',
    kpis: ['OTB room nights', 'OTB revenue', 'OTB ADR', 'OTB occupancy', 'Cancel rate', 'vs STLY'],
    panels: ['Pace curves & buckets', 'Pickup · last 14d'],
    tableColumns: ['Stay month', 'OTB RN', 'OTB revenue', 'ADR', 'vs STLY RN', 'vs STLY revenue'],
  },
  channels: {
    slug: 'channels',
    title: 'Channels',
    kpis: ['Direct mix', 'OTA mix', 'Wholesale mix', 'Avg lead time', 'Channel cost / occ RN'],
    panels: [
      'Channel mix · weekly trend',
      'Net €/booking · cancel-adjusted',
      'Booking velocity · 28d',
      'OTA × Room Type matrix',
    ],
    tableColumns: ['Channel', 'Bookings', 'Net revenue', 'Commission %', 'Cancel %', 'Health'],
  },
  rateplans: {
    slug: 'rateplans',
    title: 'Rate plans',
    kpis: ['Sleeping plans 90d', 'Top 3 concentration', 'Active plans', 'Orphan plans'],
    panels: ['Plans', 'Sleeping plans', 'Orphan plans'],
    tableColumns: ['Plan code', 'Plan name', '30d bookings', 'ADR', 'Cancel %'],
  },
  pricing: {
    slug: 'pricing',
    title: 'Pricing',
    kpis: [
      'Current BAR',
      'Comp gap',
      'Occupancy fence',
      'Sellable · 14d',
      'Inventory cells',
      'Avg rate',
      'BAR floor',
      'Ceiling',
      'Stop-sell',
      'Min-stay',
    ],
    panels: ['Two-week glance', 'BAR ladder by room type'],
    tableColumns: ['Date', 'BAR', 'Comp median', 'Gap', 'Occ %', 'Sellable'],
  },
  compset: {
    slug: 'compset',
    title: 'Comp-set',
    kpis: ['Comp set size', 'Avg comp rate', 'Our rate', 'Rank · last scan'],
    panels: [
      'Comp-set agent',
      'Top insights',
      'Rate trend · DoW · promo intensity',
      'Agent run history · last 10',
      'Analytics',
    ],
    tableColumns: ['Hotel', 'Stars', 'Rate', 'Δ vs us', 'Promo', 'Last scanned'],
  },
  parity: {
    slug: 'parity',
    title: 'Parity',
    kpis: ['Parity score', 'Channels scanned', 'Anomalies · 30d', 'Worst gap'],
    panels: ['Parity scans · last 30d', 'Anomalies', 'Channel × date heatmap'],
    tableColumns: ['Channel', 'Our rate', 'Their rate', 'Gap', 'Direction', 'Scanned at'],
  },
  forecast: {
    slug: 'forecast',
    title: 'Forecast',
    kpis: ['Forecast accuracy', 'Confidence band', 'Pickup vs forecast', 'Days ahead'],
    panels: ['Pickup curves', 'Confidence intervals', 'Forecast vs actual · 30d'],
    tableColumns: ['Date', 'Forecast RN', 'Actual RN', 'Variance', 'Forecast revenue', 'Actual revenue'],
  },
};
