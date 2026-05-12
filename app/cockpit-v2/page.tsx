'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Page from '@/components/page/Page';
// === Inline SVG icons (replaces lucide-react to avoid npm install) ===
// Generated from lucide v0.x glyph paths; stroke-width 2, currentColor.
const _IconBase = ({ size = 16, children, ...p }) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden {...p}>
    {children}
  </svg>
);
const Users = (props) => <_IconBase {...props}><path d='M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'/><path d='M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'/><path d='M23 21v-2a4 4 0 0 0-3-3.87'/><path d='M16 3.13a4 4 0 0 1 0 7.75'/></_IconBase>;
const Database = (props) => <_IconBase {...props}><path d='M3 5a9 4 0 1 0 18 0 9 4 0 1 0-18 0z'/><path d='M3 5v6a9 4 0 0 0 18 0V5'/><path d='M3 11v6a9 4 0 0 0 18 0v-6'/></_IconBase>;
const BookOpen = (props) => <_IconBase {...props}><path d='M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z'/><path d='M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'/></_IconBase>;
const Activity = (props) => <_IconBase {...props}><path d='M22 12h-4l-3 9L9 3l-3 9H2'/></_IconBase>;
const Search = (props) => <_IconBase {...props}><path d='M21 21l-4.35-4.35'/><path d='M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z'/></_IconBase>;
const ChevronRight = (props) => <_IconBase {...props}><path d='M9 18l6-6-6-6'/></_IconBase>;
const ChevronDown = (props) => <_IconBase {...props}><path d='M6 9l6 6 6-6'/></_IconBase>;
const Edit3 = (props) => <_IconBase {...props}><path d='M12 20h9'/><path d='M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'/></_IconBase>;
const Save = (props) => <_IconBase {...props}><path d='M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z'/><path d='M17 21v-8H7v8'/><path d='M7 3v5h8'/></_IconBase>;
const X = (props) => <_IconBase {...props}><path d='M18 6L6 18'/><path d='M6 6l12 12'/></_IconBase>;
const AlertCircle = (props) => <_IconBase {...props}><path d='M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z'/><path d='M12 8v4'/><path d='M12 16h.01'/></_IconBase>;
const CheckCircle2 = (props) => <_IconBase {...props}><path d='M22 11.08V12a10 10 0 1 1-5.93-9.14'/><path d='M22 4L12 14.01l-3-3'/></_IconBase>;
const Clock = (props) => <_IconBase {...props}><path d='M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z'/><path d='M12 6v6l4 2'/></_IconBase>;
const Filter = (props) => <_IconBase {...props}><path d='M22 3H2l8 9.46V19l4 2v-8.54L22 3z'/></_IconBase>;
const Wallet = (props) => <_IconBase {...props}><path d='M21 12V7H5a2 2 0 0 1 0-4h14v4'/><path d='M3 5v14a2 2 0 0 0 2 2h16v-5'/><path d='M18 12a2 2 0 0 0 0 4h4v-4z'/></_IconBase>;
const Shield = (props) => <_IconBase {...props}><path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/></_IconBase>;
const Cpu = (props) => <_IconBase {...props}><path d='M9 3v2'/><path d='M15 3v2'/><path d='M9 19v2'/><path d='M15 19v2'/><path d='M3 9h2'/><path d='M3 15h2'/><path d='M19 9h2'/><path d='M19 15h2'/><path d='M4 7h16v10H4z'/><path d='M9 9h6v6H9z'/></_IconBase>;
const Layers = (props) => <_IconBase {...props}><path d='M12 2L2 7l10 5 10-5-10-5z'/><path d='M2 17l10 5 10-5'/><path d='M2 12l10 5 10-5'/></_IconBase>;
const GitBranch = (props) => <_IconBase {...props}><path d='M6 3v12'/><path d='M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'/><path d='M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'/><path d='M15 6a9 9 0 0 0-9 9'/></_IconBase>;
const TrendingUp = (props) => <_IconBase {...props}><path d='M23 6l-9.5 9.5-5-5L1 18'/><path d='M17 6h6v6'/></_IconBase>;
const ArrowUpRight = (props) => <_IconBase {...props}><path d='M7 17L17 7'/><path d='M7 7h10v10'/></_IconBase>;
const DollarSign = (props) => <_IconBase {...props}><path d='M12 1v22'/><path d='M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'/></_IconBase>;
const Hash = (props) => <_IconBase {...props}><path d='M4 9h16'/><path d='M4 15h16'/><path d='M10 3L8 21'/><path d='M16 3l-2 18'/></_IconBase>;
const Lock = (props) => <_IconBase {...props}><path d='M5 11h14v10H5z'/><path d='M7 11V7a5 5 0 0 1 10 0v4'/></_IconBase>;
const Sparkles = (props) => <_IconBase {...props}><path d='M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z'/></_IconBase>;


// ============================================================================
// DATA SNAPSHOT — pulled live 2026-05-11 20:30 UTC from Supabase (kpenyneooigsyuuomgct)
// To go live: replace AGENTS/MEMORY/etc. with fetch() calls to PostgREST.
// ============================================================================

const SNAPSHOT_TS = '2026-05-11 20:30 UTC';

const AGENTS = [
  // HOLDING — Felix, Kit, IT workers
  { role: 'lead', display_name: 'Felix', avatar: '🛠️', color: 'var(--moss)', tagline: 'CEO of holding & Platform Architect · highest authority · single window for PBS', scope: 'holding', property_id: null, hierarchy_level: 'ceo', reports_to: null, dept: 'executive', status: 'active' },
  { role: 'it_manager', display_name: 'Captain Kit', avatar: '🧭', color: 'var(--oxblood-mid)', tagline: 'Head of IT · code, deploys, infra', scope: 'holding', property_id: null, hierarchy_level: 'hod', reports_to: 'lead', dept: 'it', status: 'active' },
  { role: 'intake_runner', display_name: 'Runner', avatar: '🏃', color: 'var(--oxblood-mid)', tagline: 'Triages new intake items, hands them to Kit', scope: 'holding', property_id: null, hierarchy_level: 'worker', reports_to: 'it_manager', dept: 'it', status: 'active' },
  { role: 'code_writer', display_name: 'Carla', avatar: '🪛', color: 'var(--brass)', tagline: 'Implements specs into PRs', scope: 'holding', property_id: null, hierarchy_level: 'worker', reports_to: 'it_manager', dept: 'it', status: 'active' },
  { role: 'frontend', display_name: 'Pixel Pia', avatar: '🎨', color: 'var(--oxblood-mid)', tagline: 'UI specialist — pages, components, styling', scope: 'holding', property_id: null, hierarchy_level: 'worker', reports_to: 'it_manager', dept: 'it', status: 'active' },
  { role: 'backend', display_name: 'Schema Sage', avatar: '⚙️', color: 'var(--oxblood-mid)', tagline: 'Schema, API routes, RLS, cron', scope: 'holding', property_id: null, hierarchy_level: 'worker', reports_to: 'it_manager', dept: 'it', status: 'active' },
  { role: 'code_spec_writer', display_name: 'Quill Quincy', avatar: '✍️', color: 'var(--oxblood-mid)', tagline: 'GH-issue-ready specs from approved tickets', scope: 'holding', property_id: null, hierarchy_level: 'worker', reports_to: 'it_manager', dept: 'it', status: 'active' },
  { role: 'documentarian', display_name: 'Scribe Scott', avatar: '📚', color: 'var(--oxblood-mid)', tagline: 'Docs, ADRs, runbooks', scope: 'holding', property_id: null, hierarchy_level: 'worker', reports_to: 'it_manager', dept: 'it', status: 'active' },
  { role: 'researcher', display_name: 'Detective Data', avatar: '🔍', color: 'var(--oxblood-mid)', tagline: 'Data, metrics, investigation', scope: 'holding', property_id: null, hierarchy_level: 'worker', reports_to: 'it_manager', dept: 'it', status: 'active' },
  { role: 'reviewer', display_name: 'Sheriff Sigma', avatar: '🛡️', color: 'var(--oxblood-mid)', tagline: 'Pre-build risk + must-have tests', scope: 'holding', property_id: null, hierarchy_level: 'worker', reports_to: 'it_manager', dept: 'it', status: 'active' },
  { role: 'security', display_name: 'Sentinel Sergei', avatar: '🛡️', color: 'var(--oxblood-mid)', tagline: 'Supabase advisors + RLS hardening', scope: 'holding', property_id: null, hierarchy_level: 'worker', reports_to: 'it_manager', dept: 'it', status: 'active' },
  { role: 'skill_creator', display_name: 'Forge Astra', avatar: '🔨', color: 'var(--oxblood-mid)', tagline: 'Designs new tools and skills', scope: 'holding', property_id: null, hierarchy_level: 'worker', reports_to: 'it_manager', dept: 'it', status: 'active' },
  { role: 'tester', display_name: 'QA Quinn', avatar: '🧪', color: 'var(--oxblood-mid)', tagline: 'Test plans (unit / integration / e2e)', scope: 'holding', property_id: null, hierarchy_level: 'worker', reports_to: 'it_manager', dept: 'it', status: 'active' },
  { role: 'api_specialist', display_name: 'Atlas Anders', avatar: '🌐', color: 'var(--oxblood-mid)', tagline: 'External system docs maintainer', scope: 'holding', property_id: null, hierarchy_level: 'worker', reports_to: 'it_manager', dept: 'it', status: 'active' },
  { role: 'designer', display_name: 'Brand Bea', avatar: '✨', color: 'var(--oxblood-mid)', tagline: 'Brand & design-system enforcement', scope: 'holding', property_id: null, hierarchy_level: 'worker', reports_to: 'it_manager', dept: 'it', status: 'active' },
  // NAMKHAN
  { role: 'hotel_ceo_namkhan', display_name: 'Nova', avatar: '🌟', color: 'var(--moss)', tagline: 'AI Hotel CEO @ Namkhan · paired with Narout · owns P&L, guest experience', scope: 'property', property_id: 260955, hierarchy_level: 'ceo', reports_to: 'lead', dept: 'executive', status: 'active' },
  { role: 'revenue_hod', display_name: 'Vector', avatar: '📈', color: 'var(--oxblood-mid)', tagline: 'Head of Revenue · 20yr SLH-tier', scope: 'property', property_id: 260955, hierarchy_level: 'hod', reports_to: 'hotel_ceo_namkhan', dept: 'revenue', status: 'active' },
  { role: 'marketing_hod', display_name: 'Lumen', avatar: '💡', color: 'var(--oxblood-mid)', tagline: 'Head of Marketing · direct-booking discipline', scope: 'property', property_id: 260955, hierarchy_level: 'hod', reports_to: 'hotel_ceo_namkhan', dept: 'marketing', status: 'active' },
  { role: 'finance_hod', display_name: 'Intel', avatar: '📊', color: 'var(--oxblood-mid)', tagline: 'Head of Finance · USALI 11', scope: 'property', property_id: 260955, hierarchy_level: 'hod', reports_to: 'hotel_ceo_namkhan', dept: 'finance', status: 'active' },
  { role: 'operations_hod', display_name: 'Forge', avatar: '🔥', color: 'var(--oxblood-mid)', tagline: 'Head of Operations · SLH standard in Lao reality', scope: 'property', property_id: 260955, hierarchy_level: 'hod', reports_to: 'hotel_ceo_namkhan', dept: 'operations', status: 'active' },
  { role: 'sales_hod', display_name: 'Mercer', avatar: '🎯', color: 'var(--oxblood-mid)', tagline: 'Head of Sales · qualifies hard, disqualifies fast', scope: 'property', property_id: 260955, hierarchy_level: 'hod', reports_to: 'hotel_ceo_namkhan', dept: 'sales', status: 'active' },
  { role: 'ops_lead', display_name: 'Operator Olive', avatar: '📞', color: 'var(--oxblood-mid)', tagline: 'Out-of-IT-scope handoff (Cloudbeds, accounting)', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'hotel_ceo_namkhan', dept: 'general', status: 'active' },
  { role: 'none', display_name: 'Generalist Glen', avatar: '🃏', color: 'var(--ink-mute)', tagline: 'Fallback dispatcher', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'hotel_ceo_namkhan', dept: 'general', status: 'active' },
  // Namkhan dormant workers (collapsed)
  { role: 'pricing_analyst', display_name: 'Pricing Analyst', avatar: '💹', color: 'var(--brass)', tagline: 'Comp set + rate proposals', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'revenue_hod', dept: 'revenue', status: 'dormant' },
  { role: 'pace_analyst', display_name: 'Pace Analyst', avatar: '⏱️', color: 'var(--brass)', tagline: 'OTB + pickup + cancellations', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'revenue_hod', dept: 'revenue', status: 'dormant' },
  { role: 'channel_analyst', display_name: 'Channel Analyst', avatar: '🛒', color: 'var(--brass)', tagline: 'Channel mix + commission', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'revenue_hod', dept: 'revenue', status: 'dormant' },
  { role: 'reporting_writer', display_name: 'Reporting Writer', avatar: '📝', color: 'var(--brass)', tagline: 'Daily/weekly/monthly USALI brief', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'revenue_hod', dept: 'revenue', status: 'dormant' },
  { role: 'copy_lead', display_name: 'Copy Lead', avatar: '✒️', color: 'var(--brass)', tagline: 'Captions + blog + email', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'marketing_hod', dept: 'marketing', status: 'dormant' },
  { role: 'social_lead', display_name: 'Social Lead', avatar: '📱', color: 'var(--brass)', tagline: 'Content calendar + posting cadence', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'marketing_hod', dept: 'marketing', status: 'dormant' },
  { role: 'seo_lead', display_name: 'SEO Lead', avatar: '🔎', color: 'var(--brass)', tagline: 'Site/meta + OTA listing optimization', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'marketing_hod', dept: 'marketing', status: 'dormant' },
  { role: 'media_lead', display_name: 'Media Lead', avatar: '📷', color: 'var(--brass)', tagline: 'RAW + video + asset library', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'marketing_hod', dept: 'marketing', status: 'dormant' },
  { role: 'fx_tracker', display_name: 'FX Tracker', avatar: '💱', color: 'var(--brass)', tagline: 'LAK/USD daily + month-end', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'finance_hod', dept: 'finance', status: 'dormant' },
  { role: 'usali_categorizer', display_name: 'USALI Categorizer', avatar: '🏷️', color: 'var(--brass)', tagline: 'Cloudbeds tx → USALI mapping', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'finance_hod', dept: 'finance', status: 'dormant' },
  { role: 'variance_analyst', display_name: 'Variance Analyst', avatar: '📐', color: 'var(--brass)', tagline: 'Actual vs budget + LY', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'finance_hod', dept: 'finance', status: 'dormant' },
  { role: 'report_writer', display_name: 'Report Writer', avatar: '📔', color: 'var(--brass)', tagline: 'Monthly P&L + cash flow narrative', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'finance_hod', dept: 'finance', status: 'dormant' },
  { role: 'fb_analyst', display_name: 'F&B Analyst', avatar: '🍽️', color: 'var(--brass)', tagline: 'Roots recipe + cost', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'operations_hod', dept: 'operations', status: 'dormant' },
  { role: 'housekeeping_supervisor', display_name: 'Housekeeping Supervisor', avatar: '🧹', color: 'var(--brass)', tagline: 'Room status + par stock', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'operations_hod', dept: 'operations', status: 'dormant' },
  { role: 'incident_coordinator', display_name: 'Incident Coordinator', avatar: '🚨', color: 'var(--brass)', tagline: 'Guest issues + maintenance escalation', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'operations_hod', dept: 'operations', status: 'dormant' },
  { role: 'supplier_manager', display_name: 'Supplier Manager', avatar: '🚚', color: 'var(--brass)', tagline: 'Vendor coordination', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'operations_hod', dept: 'operations', status: 'dormant' },
  { role: 'b2b_account_manager', display_name: 'B2B Account Manager', avatar: '🤝', color: 'var(--brass)', tagline: 'DMC/agency + group quotes', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'sales_hod', dept: 'sales', status: 'dormant' },
  { role: 'inquiry_triager', display_name: 'Inquiry Triager', avatar: '📥', color: 'var(--brass)', tagline: 'First response classification', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'sales_hod', dept: 'sales', status: 'dormant' },
  { role: 'quote_drafter', display_name: 'Quote Drafter', avatar: '🧾', color: 'var(--brass)', tagline: 'Package + pricing draft', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'sales_hod', dept: 'sales', status: 'dormant' },
  { role: 'followup_writer', display_name: 'Follow-up Writer', avatar: '📨', color: 'var(--brass)', tagline: 'Nurture sequence', scope: 'property', property_id: 260955, hierarchy_level: 'worker', reports_to: 'sales_hod', dept: 'sales', status: 'dormant' },
  // DONNA — Orion + 5 HODs active, 2 general active, dept workers dormant
  { role: 'hotel_ceo_donna', display_name: 'Orion', avatar: '🌌', color: 'var(--moss)', tagline: 'AI Hotel CEO @ Donna Portals · paired with Maxi · onboards ~2 weeks', scope: 'property', property_id: 1000001, hierarchy_level: 'ceo', reports_to: 'lead', dept: 'executive', status: 'active' },
  { role: 'revenue_hod_donna', display_name: 'Vector (Donna)', avatar: '📈', color: 'var(--oxblood-mid)', tagline: 'Head of Revenue · 20yr SLH-tier', scope: 'property', property_id: 1000001, hierarchy_level: 'hod', reports_to: 'hotel_ceo_donna', dept: 'revenue', status: 'active' },
  { role: 'marketing_hod_donna', display_name: 'Lumen (Donna)', avatar: '💡', color: 'var(--oxblood-mid)', tagline: 'Head of Marketing · direct-booking discipline', scope: 'property', property_id: 1000001, hierarchy_level: 'hod', reports_to: 'hotel_ceo_donna', dept: 'marketing', status: 'active' },
  { role: 'finance_hod_donna', display_name: 'Intel (Donna)', avatar: '📊', color: 'var(--oxblood-mid)', tagline: 'Head of Finance · USALI 11', scope: 'property', property_id: 1000001, hierarchy_level: 'hod', reports_to: 'hotel_ceo_donna', dept: 'finance', status: 'active' },
  { role: 'operations_hod_donna', display_name: 'Forge (Donna)', avatar: '🔥', color: 'var(--oxblood-mid)', tagline: 'Head of Operations', scope: 'property', property_id: 1000001, hierarchy_level: 'hod', reports_to: 'hotel_ceo_donna', dept: 'operations', status: 'active' },
  { role: 'sales_hod_donna', display_name: 'Mercer (Donna)', avatar: '🎯', color: 'var(--oxblood-mid)', tagline: 'Head of Sales', scope: 'property', property_id: 1000001, hierarchy_level: 'hod', reports_to: 'hotel_ceo_donna', dept: 'sales', status: 'active' },
  { role: 'ops_lead_donna', display_name: 'Operator Olivia', avatar: '📞', color: 'var(--oxblood-mid)', tagline: 'Out-of-IT-scope handoff (Mews, EU bank)', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'hotel_ceo_donna', dept: 'general', status: 'active' },
  { role: 'generalist_donna', display_name: 'Generalist Greta', avatar: '🃏', color: 'var(--ink-mute)', tagline: 'Fallback dispatcher at Donna', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'hotel_ceo_donna', dept: 'general', status: 'active' },
  // Donna dormant dept workers (one of each kind, collapsed)
  { role: 'pricing_analyst_donna', display_name: 'Pricing Analyst (Donna)', avatar: '💹', color: 'var(--brass)', tagline: 'Comp set + rate proposals', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'revenue_hod_donna', dept: 'revenue', status: 'dormant' },
  { role: 'pace_analyst_donna', display_name: 'Pace Analyst (Donna)', avatar: '⏱️', color: 'var(--brass)', tagline: 'OTB + pickup', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'revenue_hod_donna', dept: 'revenue', status: 'dormant' },
  { role: 'channel_analyst_donna', display_name: 'Channel Analyst (Donna)', avatar: '🛒', color: 'var(--brass)', tagline: 'Channel mix + commission', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'revenue_hod_donna', dept: 'revenue', status: 'dormant' },
  { role: 'reporting_writer_donna', display_name: 'Reporting Writer (Donna)', avatar: '📝', color: 'var(--brass)', tagline: 'Daily/weekly USALI brief', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'revenue_hod_donna', dept: 'revenue', status: 'dormant' },
  { role: 'copy_lead_donna', display_name: 'Copy Lead (Donna)', avatar: '✒️', color: 'var(--brass)', tagline: 'Captions + blog + email', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'marketing_hod_donna', dept: 'marketing', status: 'dormant' },
  { role: 'social_lead_donna', display_name: 'Social Lead (Donna)', avatar: '📱', color: 'var(--brass)', tagline: 'Content calendar', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'marketing_hod_donna', dept: 'marketing', status: 'dormant' },
  { role: 'seo_lead_donna', display_name: 'SEO Lead (Donna)', avatar: '🔎', color: 'var(--brass)', tagline: 'Site/meta + OTA listing', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'marketing_hod_donna', dept: 'marketing', status: 'dormant' },
  { role: 'media_lead_donna', display_name: 'Media Lead (Donna)', avatar: '📷', color: 'var(--brass)', tagline: 'RAW + video + asset library', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'marketing_hod_donna', dept: 'marketing', status: 'dormant' },
  { role: 'fx_tracker_donna', display_name: 'FX Tracker (Donna)', avatar: '💱', color: 'var(--brass)', tagline: 'EUR daily + month-end', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'finance_hod_donna', dept: 'finance', status: 'dormant' },
  { role: 'usali_categorizer_donna', display_name: 'USALI Categorizer (Donna)', avatar: '🏷️', color: 'var(--brass)', tagline: 'Mews tx → USALI mapping', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'finance_hod_donna', dept: 'finance', status: 'dormant' },
  { role: 'variance_analyst_donna', display_name: 'Variance Analyst (Donna)', avatar: '📐', color: 'var(--brass)', tagline: 'Actual vs budget + LY', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'finance_hod_donna', dept: 'finance', status: 'dormant' },
  { role: 'report_writer_donna', display_name: 'Report Writer (Donna)', avatar: '📔', color: 'var(--brass)', tagline: 'Monthly P&L narrative', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'finance_hod_donna', dept: 'finance', status: 'dormant' },
  { role: 'fb_analyst_donna', display_name: 'F&B Analyst (Donna)', avatar: '🍽️', color: 'var(--brass)', tagline: 'Recipe + cost', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'operations_hod_donna', dept: 'operations', status: 'dormant' },
  { role: 'housekeeping_supervisor_donna', display_name: 'Housekeeping Supervisor (Donna)', avatar: '🧹', color: 'var(--brass)', tagline: 'Room status + par stock', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'operations_hod_donna', dept: 'operations', status: 'dormant' },
  { role: 'incident_coordinator_donna', display_name: 'Incident Coordinator (Donna)', avatar: '🚨', color: 'var(--brass)', tagline: 'Guest issues + maintenance', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'operations_hod_donna', dept: 'operations', status: 'dormant' },
  { role: 'supplier_manager_donna', display_name: 'Supplier Manager (Donna)', avatar: '🚚', color: 'var(--brass)', tagline: 'Vendor coordination', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'operations_hod_donna', dept: 'operations', status: 'dormant' },
  { role: 'b2b_account_manager_donna', display_name: 'B2B Account Manager (Donna)', avatar: '🤝', color: 'var(--brass)', tagline: 'DMC/agency + group quotes', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'sales_hod_donna', dept: 'sales', status: 'dormant' },
  { role: 'inquiry_triager_donna', display_name: 'Inquiry Triager (Donna)', avatar: '📥', color: 'var(--brass)', tagline: 'First response classification', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'sales_hod_donna', dept: 'sales', status: 'dormant' },
  { role: 'quote_drafter_donna', display_name: 'Quote Drafter (Donna)', avatar: '🧾', color: 'var(--brass)', tagline: 'Package + pricing draft', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'sales_hod_donna', dept: 'sales', status: 'dormant' },
  { role: 'followup_writer_donna', display_name: 'Follow-up Writer (Donna)', avatar: '📨', color: 'var(--brass)', tagline: 'Nurture sequence', scope: 'property', property_id: 1000001, hierarchy_level: 'worker', reports_to: 'sales_hod_donna', dept: 'sales', status: 'dormant' },
];

const SCHEMAS = [
  { name: 'cockpit', tables: 36, views: 3, matviews: 0, rows: 3611, category: 'platform', desc: 'Agent platform: identity, capability, knowledge, governance, execution, audit, intake', rls: 'service+role', usage_anon: false },
  { name: 'documentation', tables: 6, views: 0, matviews: 0, rows: 86, category: 'platform', desc: 'Architecture, ADRs, operating manual — canonical', rls: 'authenticated', usage_anon: true },
  { name: 'tenancy', tables: 5, views: 0, matviews: 0, rows: 0, category: 'platform', desc: 'Multi-tenant control', rls: 'service+role', usage_anon: false },
  { name: 'app', tables: 6, views: 0, matviews: 0, rows: 0, category: 'platform', desc: 'Roles, users, JWT helpers', rls: 'service+role', usage_anon: true },
  { name: 'auth_ext', tables: 1, views: 1, matviews: 0, rows: 0, category: 'platform', desc: 'Extended auth — user_roles', rls: 'self-read', usage_anon: false },
  { name: 'governance', tables: 19, views: 6, matviews: 0, rows: 3429, category: 'platform', desc: 'Data quality, controls, audit', rls: 'service+role', usage_anon: false },
  { name: 'ingest', tables: 5, views: 0, matviews: 0, rows: 0, category: 'platform', desc: 'Raw PMS ingest payloads', rls: 'owner+gm+agent', usage_anon: false },
  { name: 'core', tables: 6, views: 0, matviews: 0, rows: 0, category: 'platform', desc: 'Properties, organizations', rls: 'service+role', usage_anon: false },
  { name: 'plan', tables: 5, views: 0, matviews: 0, rows: 4312, category: 'platform', desc: 'Planning + roadmap', rls: 'authenticated', usage_anon: false },
  { name: 'knowledge', tables: 5, views: 0, matviews: 0, rows: 75, category: 'platform', desc: 'RAG document store', rls: 'authenticated', usage_anon: false },
  { name: 'pms', tables: 27, views: 0, matviews: 0, rows: 324564, category: 'property', desc: 'Cloudbeds + Mews PMS data — reservations, guests, transactions', rls: 'tenant+role', usage_anon: false },
  { name: 'frontoffice', tables: 9, views: 0, matviews: 0, rows: 0, category: 'property', desc: 'Reception, check-in/out flow', rls: 'tenant+role', usage_anon: false },
  { name: 'revenue', tables: 36, views: 20, matviews: 0, rows: 8358, category: 'property', desc: 'Pricing, RMS, channel mix, pace', rls: 'tenant+role', usage_anon: true },
  { name: 'fb', tables: 7, views: 0, matviews: 0, rows: 0, category: 'property', desc: 'Food & beverage recipes', rls: 'tenant+role', usage_anon: false },
  { name: 'pos', tables: 3, views: 0, matviews: 0, rows: 18130, category: 'property', desc: 'POS transactions (Roots)', rls: 'tenant+role', usage_anon: false },
  { name: 'activities', tables: 6, views: 0, matviews: 0, rows: 0, category: 'property', desc: 'Activity bookings + catalog', rls: 'tenant+role', usage_anon: false },
  { name: 'spa', tables: 5, views: 0, matviews: 0, rows: 0, category: 'property', desc: 'Spa bookings + treatments', rls: 'tenant+role', usage_anon: false },
  { name: 'content', tables: 18, views: 10, matviews: 0, rows: 122, category: 'property', desc: 'Property factsheets, rooms, retreats, meetings, calendar', rls: 'tenant+role', usage_anon: true },
  { name: 'media', tables: 17, views: 5, matviews: 0, rows: 3561, category: 'property', desc: 'DAM: assets, taxonomy, tags, renders, requests', rls: 'tenant+role', usage_anon: false },
  { name: 'marketing', tables: 10, views: 26, matviews: 0, rows: 0, category: 'property', desc: 'Campaigns, reviews, social, brand, GBP, influencers', rls: 'tenant+role', usage_anon: true },
  { name: 'finance', tables: 35, views: 33, matviews: 1, rows: 8405, category: 'property', desc: 'USALI P&L (gl_*), fixed assets (fa_*), bank, AP/AR', rls: 'owner+gm+auditor', usage_anon: false },
  { name: 'ops', tables: 24, views: 8, matviews: 0, rows: 4670, category: 'property', desc: 'Operations: housekeeping, maintenance, par stock', rls: 'tenant+role', usage_anon: true },
  { name: 'inv', tables: 10, views: 7, matviews: 0, rows: 1708, category: 'property', desc: 'Inventory + sustainability (palm-oil-free, eco-cert)', rls: 'tenant+role', usage_anon: true },
  { name: 'procurement', tables: 12, views: 3, matviews: 0, rows: 0, category: 'property', desc: 'POs, suppliers, RFQs', rls: 'tenant+role', usage_anon: true },
  { name: 'utilities', tables: 4, views: 0, matviews: 0, rows: 0, category: 'property', desc: 'Power, water, gas readings', rls: 'tenant+role', usage_anon: false },
  { name: 'hr', tables: 11, views: 0, matviews: 0, rows: 28, category: 'property', desc: 'Positions, employees, payroll, leave', rls: 'owner+gm+hod', usage_anon: false },
  { name: 'training', tables: 5, views: 0, matviews: 0, rows: 0, category: 'property', desc: 'SOPs, certifications', rls: 'tenant+role', usage_anon: false },
  { name: 'guest', tables: 6, views: 2, matviews: 1, rows: 0, category: 'property', desc: 'Guest CRM, preferences, history', rls: 'tenant+role', usage_anon: true },
  { name: 'sales', tables: 30, views: 4, matviews: 0, rows: 2224, category: 'property', desc: 'Quotes, packages, leads, opportunities', rls: 'tenant+role', usage_anon: true },
  { name: 'contracts', tables: 5, views: 0, matviews: 0, rows: 0, category: 'property', desc: 'Vendor + employee contracts', rls: 'owner+gm', usage_anon: false },
  { name: 'dms', tables: 26, views: 2, matviews: 0, rows: 2035, category: 'property', desc: 'Document management', rls: 'tenant+role', usage_anon: false },
  { name: 'signals', tables: 5, views: 0, matviews: 0, rows: 0, category: 'property', desc: 'External signals: weather, flights', rls: 'authenticated', usage_anon: false },
  { name: 'web_analytics', tables: 18, views: 6, matviews: 0, rows: 0, category: 'property', desc: 'Site + SEO analytics', rls: 'tenant+role', usage_anon: false },
  { name: 'kpi', tables: 2, views: 18, matviews: 0, rows: 2522, category: 'property', desc: 'KPI rollups + daily snapshots', rls: 'authenticated', usage_anon: true },
  { name: 'pricing', tables: 4, views: 0, matviews: 0, rows: 19, category: 'property', desc: 'Pricing rules + segments', rls: 'tenant+role', usage_anon: false },
  { name: 'alerts', tables: 2, views: 0, matviews: 0, rows: 131, category: 'property', desc: 'Operational alerts', rls: 'tenant+role', usage_anon: false },
  { name: 'assets', tables: 5, views: 0, matviews: 0, rows: 57, category: 'property', desc: 'Fixed asset registry', rls: 'tenant+role', usage_anon: false },
  { name: 'news', tables: 2, views: 0, matviews: 0, rows: 12, category: 'property', desc: 'Internal news feed', rls: 'authenticated', usage_anon: false },
  { name: 'targeting', tables: 4, views: 0, matviews: 0, rows: 49, category: 'property', desc: 'Targeting + segmentation', rls: 'authenticated', usage_anon: false },
  { name: 'sales_targeting', tables: 2, views: 0, matviews: 0, rows: 0, category: 'property', desc: 'Sales targeting', rls: 'authenticated', usage_anon: false },
  { name: 'compiler', tables: 4, views: 0, matviews: 0, rows: 8, category: 'platform', desc: 'Build pipeline state', rls: 'service+role', usage_anon: false },
  { name: 'catalog', tables: 1, views: 1, matviews: 0, rows: 9, category: 'platform', desc: 'Catalog registry', rls: 'authenticated', usage_anon: false },
  { name: 'fa', tables: 0, views: 7, matviews: 0, rows: 0, category: 'compat', desc: 'COMPAT SHIM (finance.fa_*) — drop in Phase 9', rls: 'shim', usage_anon: true },
  { name: 'gl', tables: 0, views: 55, matviews: 0, rows: 0, category: 'compat', desc: 'COMPAT SHIM (finance.gl_*) — drop in Phase 9', rls: 'shim', usage_anon: true },
  { name: 'public', tables: 25, views: 235, matviews: 14, rows: 2768, category: 'platform', desc: 'Default schema + 101 compat shims (REVOKEd from anon 2026-05-11)', rls: 'mixed', usage_anon: true },
  { name: 'supabase_migrations', tables: 1, views: 0, matviews: 0, rows: 687, category: 'platform', desc: 'Migration history', rls: 'service-only', usage_anon: false },
];

const MEMORIES = [
  { id: 32, agent_handle: 'felix', memory_type: 'decision', importance: 10, content: 'When Supabase advisor reports security_definer_view ERRORs, the REAL question is not "are these views SECURITY DEFINER" but "can anon read them, and what do they expose". Procedure: (1) Get list from get_advisors. (2) For each flagged view, check has_table_privilege(anon, public.<view>, SELECT). (3) For the anon-readable ones, SET LOCAL ROLE anon; SELECT count(*) FROM <view>. (4) Triage by content: secrets/tokens > guest PII > financial > internal > analytical. (5) Emergency lockdown: REVOKE ALL ON <view> FROM anon. (6) Proper fix later: ALTER VIEW <view> SET (security_invoker=true), then re-GRANT for legitimate auth use. Phase 7 RLS sweep does NOT protect against SECURITY DEFINER views — they bypass RLS by design.', updated_at: '2026-05-11 20:10' },
  { id: 31, agent_handle: 'felix', memory_type: 'decision', importance: 9, content: 'When Cloudbeds sync starts failing, ALWAYS test cb-probe Edge Function FIRST before chasing PostgREST schema cache theories. The probe is a known-working diagnostic that bypasses sync logic. If probe returns 200 with bodyPreview status:401 access_denied, the API key is invalid — regenerate from Cloudbeds dashboard, not redeploy Edge Function. If probe returns 500 vault error, then it IS a PostgREST issue.', updated_at: '2026-05-11 19:56' },
  { id: 27, agent_handle: 'all', memory_type: 'fact', importance: 10, content: 'Donna Portals (property_id=1000001, Spain) human Hotel CEO = Maxi. Paired with AI Hotel CEO Orion (role=hotel_ceo_donna). Onboards ~2 weeks.', updated_at: '2026-05-11 19:03' },
  { id: 20, agent_handle: 'felix', memory_type: 'fact', importance: 10, content: 'HOTEL CEOs LOCKED 2026-05-11. Nova = AI Hotel CEO @ Namkhan (property_id=260955, paired with Narout). Orion = AI Hotel CEO @ Donna (property_id=1000001, paired with Maxi). Both report to Felix.', updated_at: '2026-05-11 19:03' },
  { id: 19, agent_handle: 'felix', memory_type: 'fact', importance: 10, content: 'FELIX IS THE ARCHITECT (locked 2026-05-11). Felix holds two hats at the highest level: CEO of the holding AND Platform Architect. Architecture decisions, ADRs, schema design, system design — all flow through Felix. There is no separate architect agent.', updated_at: '2026-05-11 18:02' },
  { id: 18, agent_handle: 'felix', memory_type: 'decision', importance: 10, content: 'INTAKE MODEL (locked 2026-05-11). No tasks. Only bugs. 1 bug = 1 row in cockpit.intake_items = 1 thread in cockpit.intake_comments. Lifecycle: HOD files (status=new) → Runner triages → Kit team works → deploys to stage → HOD approves (live) or rejects (bounces back).', updated_at: '2026-05-11 17:53' },
  { id: 9, agent_handle: 'all', memory_type: 'decision', importance: 10, content: 'IT is a HOLDING-LEVEL team, not per-property. ONE platform IT team at TBC HQ fixes bugs and ships code for ALL hotels. Property-level HODs = 5 only: Vector, Lumen, Intel, Forge, Mercer. NO Kit at property level.', updated_at: '2026-05-11 16:09' },
  { id: 7, agent_handle: 'all', memory_type: 'fact', importance: 10, content: 'Org chain (locked 2026-05-11). HOLDING: PBS + Felix. NAMKHAN: Narout + Nova. DONNA: Maxi + Orion. 5 HODs per property: Vector (revenue), Lumen (marketing), Intel (finance), Forge (operations), Mercer (sales).', updated_at: '2026-05-11 19:03' },
  { id: 6, agent_handle: 'all_agents', memory_type: 'preference', importance: 10, content: 'SOURCE OF TRUTH RULE. This Supabase project (namkhan-pms) is the authoritative store. ALL architecture, decisions, agent memory, DDL history live in this DB. Project knowledge files are snapshots and may be stale. If files disagree with DB, the DB wins.', updated_at: '2026-05-11 15:13' },
  { id: 28, agent_handle: 'felix', memory_type: 'fact', importance: 9, content: 'Compat shim rule. 158 compat objects remain (55 gl + 7 fa + 24 marketing→content + 72 public.*→non-anon) — DO NOT drop until namkhan-bi frontend is refactored to use canonical paths.', updated_at: '2026-05-11 19:08' },
  { id: 29, agent_handle: 'felix', memory_type: 'decision', importance: 9, content: 'Donna AI agent roster: 28 agents at property_id=1000001. CEO=Orion. 5 active HODs with _donna suffix. 2 active general workers. 20 dormant dept workers. Activate when functions are wired.', updated_at: '2026-05-11 19:20' },
  { id: 30, agent_handle: 'felix', memory_type: 'fact', importance: 9, content: 'HR data multi-tenant since 2026-05-11. All 11 hr.* tables have property_id NOT NULL FK + tenant-scoped RLS. When inserting any hr.* row, ALWAYS include property_id. Namkhan=260955, Donna=1000001.', updated_at: '2026-05-11 19:20' },
  { id: 24, agent_handle: 'felix', memory_type: 'decision', importance: 9, content: 'RLS policy patterns: (1) *_service ON ALL TO service_role. (2) *_tenant_read uses core.has_property_access. (3) *_write or *_role uses app.has_role. (4) *_authenticated_read uses true for global lookups. (5) HR + finance.ap/ar/bank gated to owner/gm/auditor.', updated_at: '2026-05-11 18:44' },
];

const ADRS = [
  { id: 14, title: 'ADR-018: Emergency revoke anon access to public.* SECURITY DEFINER views', decision: 'REVOKE SELECT FROM anon on all 101 SECURITY DEFINER views in public schema. Authenticated and service_role grants preserved.', impact: 'critical', decided_by: 'agent', approved_by_human: true, arm: 'platform', created_at: '2026-05-11 20:10' },
  { id: 13, title: 'ADR-017: Make kpi.freshness_log.property_id nullable', decision: 'Dropped NOT NULL constraint on kpi.freshness_log.property_id for global-scope matview freshness checks.', impact: 'low', decided_by: 'agent', approved_by_human: true, arm: 'frontoffice', created_at: '2026-05-11 19:38' },
  { id: 11, title: 'ADR-016: Donna onboarding prep — HR property_id + AI roster cloned', decision: 'Added property_id NOT NULL to all 11 hr.* tables. Cloned 27 AI agents to property_id=1000001 with _donna suffix (5 HODs active + 2 general workers active + 20 dept workers dormant).', impact: 'high', decided_by: 'PBS', approved_by_human: true, arm: null, created_at: '2026-05-11 19:20' },
  { id: 10, title: 'ADR-015: Phase 8 (safe tier) — drop dead compat', decision: 'Dropped 6 empty compat schemas + 22 dead views. Total 94 dead views removed. ZERO frontend impact. 158 risky shims remain pending frontend refactor.', impact: 'medium', decided_by: 'PBS', approved_by_human: true, arm: null, created_at: '2026-05-11 19:08' },
  { id: 8, title: 'ADR-014: Donna human Hotel CEO = Maxi', decision: 'Human Hotel CEO at Donna Portals = Maxi. Pairs with AI Hotel CEO Orion.', impact: 'low', decided_by: 'PBS', approved_by_human: true, arm: null, created_at: '2026-05-11 19:03' },
  { id: 7, title: 'ADR-013: Phase 7 RLS sweep — full coverage', decision: 'Enabled RLS + policies on ALL 79 gap tables across 14 schemas. Final state: 476 tables, 947 policies, 44 schemas, ZERO gaps.', impact: 'critical', decided_by: 'PBS', approved_by_human: true, arm: null, created_at: '2026-05-11 18:44' },
  { id: 6, title: 'ADR-012: Phase 4b inv/inventory merge (drop inventory schema)', decision: 'Backported 5 sustainability columns into inv.items. Migrated 97 rows. Dropped inventory schema entirely.', impact: 'high', decided_by: 'PBS', approved_by_human: true, arm: null, created_at: '2026-05-11 18:35' },
  { id: 5, title: 'ADR-011: Phase 5b marketing split (marketing → marketing/content/media)', decision: 'Split marketing schema (40 tables) into 3 schemas: marketing (10 tables), content (14), media (17). 48 compat shims remain.', impact: 'high', decided_by: 'PBS', approved_by_human: true, arm: null, created_at: '2026-05-11 18:27' },
  { id: 4, title: 'ADR-010: Phase 5a finance consolidation (gl + fa → finance.*)', decision: 'Merged gl + fa schemas into finance with subnamespaces gl_* and fa_*. Compat views remain. Zero data loss.', impact: 'high', decided_by: 'PBS', approved_by_human: true, arm: null, created_at: '2026-05-11 18:20' },
  { id: 2, title: 'ADR-009: Phase 1 Close-Out — 8-phase schema consolidation', decision: '8 sequenced phases, low-risk-first, with backward-compat views.', impact: 'critical', decided_by: 'felix', approved_by_human: true, arm: 'platform', created_at: '2026-05-11 17:05' },
];

const INTAKE = [
  { id: 21, kind: 'task', dept_slug: 'it', priority: 'urgent', status: 'new', title: '🔒 P1: 100 SECURITY DEFINER views need security_invoker=true migration', property_id: 260955, created_at: '2026-05-11 20:10' },
  { id: 20, kind: 'bug', dept_slug: 'it', priority: 'urgent', status: 'new', title: '🚨 P0: GitHub PAT publicly readable via anon — MUST ROTATE NOW', property_id: 260955, created_at: '2026-05-11 20:10' },
  { id: 19, kind: 'bug', dept_slug: 'revenue', priority: 'low', status: 'new', title: 'ADR/RevPAR display scaled wrong in mv_kpi_daily', property_id: 260955, created_at: '2026-05-11 19:38' },
  { id: 18, kind: 'bug', dept_slug: 'it', priority: 'urgent', status: 'triaged', title: 'P0: Cloudbeds Edge Function failing — vault schema cache stuck', property_id: 260955, created_at: '2026-05-11 19:38' },
  { id: 17, kind: 'task', dept_slug: 'it', priority: 'normal', status: 'new', title: 'Phase 8 risky tier — drop remaining 158 compat shims', property_id: null, created_at: '2026-05-11 19:08' },
  { id: 16, kind: 'bug', dept_slug: 'it', priority: 'normal', status: 'new', title: 'New box next to bugs called "messages"', property_id: 260955, created_at: '2026-05-11 17:56' },
  { id: 15, kind: 'bug', dept_slug: 'it', priority: 'normal', status: 'new', title: 'Gmail refresh popup — wrong "last 24h" label', property_id: 260955, created_at: '2026-05-11 17:56' },
  { id: 14, kind: 'bug', dept_slug: 'it', priority: 'normal', status: 'new', title: 'Show old conversations on left side of chat', property_id: 260955, created_at: '2026-05-11 17:56' },
  { id: 13, kind: 'bug', dept_slug: 'it', priority: 'normal', status: 'new', title: 'Revenue page filters — rooms/sources/country dropdowns', property_id: 260955, created_at: '2026-05-11 17:56' },
  { id: 12, kind: 'bug', dept_slug: 'it', priority: 'normal', status: 'new', title: 'Hover-KPI tooltips on every dept entry page', property_id: 260955, created_at: '2026-05-11 17:56' },
  { id: 11, kind: 'bug', dept_slug: 'it', priority: 'normal', status: 'new', title: 'SLH logo footer polish', property_id: 260955, created_at: '2026-05-11 17:56' },
  { id: 10, kind: 'bug', dept_slug: 'it', priority: 'normal', status: 'new', title: 'Date-pill popup — add range + compare picker', property_id: 260955, created_at: '2026-05-11 17:56' },
  { id: 9, kind: 'bug', dept_slug: 'it', priority: 'normal', status: 'new', title: 'CTA integration audit — eliminate dashboard dead-ends', property_id: 260955, created_at: '2026-05-11 17:56' },
  { id: 8, kind: 'bug', dept_slug: 'it', priority: 'normal', status: 'new', title: 'Revive compset Nimble scraping agent', property_id: 260955, created_at: '2026-05-11 17:56' },
  { id: 7, kind: 'bug', dept_slug: 'it', priority: 'normal', status: 'new', title: '/finance/poster/report on old design', property_id: 260955, created_at: '2026-05-11 17:56' },
  { id: 6, kind: 'bug', dept_slug: 'it', priority: 'normal', status: 'new', title: 'Leakage + opportunity boxes — show age (h/min) per item', property_id: 260955, created_at: '2026-05-11 17:56' },
  { id: 5, kind: 'bug', dept_slug: 'it', priority: 'normal', status: 'new', title: '/cockpit/team — add per-pillar mini-graph per member', property_id: 260955, created_at: '2026-05-11 17:56' },
  { id: 4, kind: 'bug', dept_slug: 'it', priority: 'normal', status: 'new', title: '/cockpit/team members all show idle — show real status', property_id: 260955, created_at: '2026-05-11 17:56' },
  { id: 3, kind: 'bug', dept_slug: 'it', priority: 'high', status: 'new', title: 'Adapt the whole cockpit to the new design', property_id: 260955, created_at: '2026-05-11 17:56' },
  { id: 2, kind: 'bug', dept_slug: 'it', priority: 'normal', status: 'new', title: '/marketing/taxonomy still on old design', property_id: 260955, created_at: '2026-05-11 17:56' },
];

const DOCS = [
  { doc_type: 'architecture', title: 'The Beyond Circle — Platform Architecture (v0.15)', version: 15, chars: 11526, last_updated_at: '2026-05-11 20:15' },
  { doc_type: 'claude_md', title: 'CLAUDE.md — agent operating manual (v2.8)', version: 10, chars: 14162, last_updated_at: '2026-05-11 20:17' },
  { doc_type: 'vision_roadmap', title: 'Product Vision & Roadmap', version: 3, chars: 4438, last_updated_at: '2026-05-11 16:27' },
  { doc_type: 'prd', title: 'Product Requirements Document', version: 3, chars: 4392, last_updated_at: '2026-05-11 16:27' },
  { doc_type: 'data_model', title: 'Data Model / ERD', version: 3, chars: 4949, last_updated_at: '2026-05-11 16:27' },
  { doc_type: 'api', title: 'API Documentation', version: 3, chars: 4761, last_updated_at: '2026-05-11 16:27' },
  { doc_type: 'security', title: 'Multi-Tenancy & Security', version: 3, chars: 5637, last_updated_at: '2026-05-11 16:27' },
  { doc_type: 'integration', title: 'Integration & Deployment', version: 3, chars: 10422, last_updated_at: '2026-05-11 16:27' },
];

const ACTIVITY = [
  { minute: '20:08', command_tag: 'REVOKE', object_type: 'TABLE', n: 101, label: 'Emergency revoke anon → 101 public.* views' },
  { minute: '20:06', command_tag: 'REVOKE', object_type: 'TABLE', n: 6, label: 'Revoke cockpit_secrets from anon' },
  { minute: '19:36', command_tag: 'ALTER TABLE', object_type: 'table', n: 1, label: 'kpi.freshness_log.property_id → nullable' },
  { minute: '19:18', command_tag: 'CREATE POLICY', object_type: 'policy', n: 22, label: 'Donna HR multi-tenant policies' },
  { minute: '19:18', command_tag: 'CREATE INDEX', object_type: 'index', n: 11, label: 'HR property_id indexes' },
  { minute: '19:18', command_tag: 'ALTER TABLE', object_type: 'table', n: 33, label: 'hr.* property_id NOT NULL' },
  { minute: '19:06', command_tag: 'DROP SCHEMA', object_type: 'schema', n: 6, label: 'Phase 8 safe tier — drop empty schemas' },
  { minute: '19:06', command_tag: 'DROP VIEW', object_type: 'view', n: 94, label: 'Phase 8 — drop 94 dead compat views' },
  { minute: '18:43', command_tag: 'CREATE POLICY', object_type: 'policy', n: 25, label: 'Phase 7f RLS — workspace_users, tenancy' },
  { minute: '18:41', command_tag: 'CREATE POLICY', object_type: 'policy', n: 43, label: 'Phase 7e RLS — finance.ap/ar/bank' },
  { minute: '18:40', command_tag: 'CREATE POLICY', object_type: 'policy', n: 41, label: 'Phase 7d RLS — hr.*' },
  { minute: '18:39', command_tag: 'CREATE POLICY', object_type: 'policy', n: 77, label: 'Phase 7c RLS — ingest, targeting' },
  { minute: '18:38', command_tag: 'CREATE POLICY', object_type: 'policy', n: 23, label: 'Phase 7b RLS — sales_targeting' },
  { minute: '18:34', command_tag: 'DROP TABLE', object_type: 'table', n: 3, label: 'Phase 4b — drop inventory schema' },
];

const COSTS = [
  { agent: 'embed-kb', total_actions: 217, instrumented: 0, total_cost_usd: 0, latest: '17:00' },
  { agent: 'vercel', total_actions: 27, instrumented: 0, total_cost_usd: 0, latest: '15:11' },
  { agent: 'supabase-webhook', total_actions: 24, instrumented: 0, total_cost_usd: 0, latest: '16:23' },
  { agent: 'runner_v3', total_actions: 14, instrumented: 0, total_cost_usd: 0, latest: '10:48' },
  { agent: 'felix', total_actions: 9, instrumented: 0, total_cost_usd: 0, latest: '19:20' },
  { agent: 'pbs', total_actions: 2, instrumented: 0, total_cost_usd: 0, latest: '14:47' },
  { agent: 'it_manager', total_actions: 2, instrumented: 2, total_cost_usd: 0.194, latest: '09:53' },
  { agent: 'agent_runner', total_actions: 2, instrumented: 0, total_cost_usd: 0, latest: '23:19' },
  { agent: 'ops_lead', total_actions: 2, instrumented: 2, total_cost_usd: 0.065, latest: '09:53' },
  { agent: 'claude', total_actions: 1, instrumented: 0, total_cost_usd: 0, latest: '14:53' },
];

// ============================================================================
// DESIGN TOKENS — Soho House casual-luxury palette
// ============================================================================

const TOKENS = {
  bg:         '#0a0a0a',                  // page bg (matches <Page> shell)
  bgRaised:   '#13110e',                  // raised surface
  bgDeep:     '#0e0e0c',                  // recessed (matches N dropdown)
  ink:        '#e9e1ce',                  // primary text (sand-cream)
  inkSoft:    'rgba(233,225,206,0.78)',
  text:       '#e9e1ce',
  text2:      'rgba(233,225,206,0.6)',
  text3:      'rgba(233,225,206,0.4)',
  border:     'rgba(199,154,107,0.25)',   // brass-tinted hairline
  borderSoft: 'rgba(199,154,107,0.12)',
  sand:       '#bfa980',
  brass:      '#a8854a',                  // matches Page eyebrow brass
  terracotta: '#b85f4e',
  ochre:      '#c4a06b',
  oxblood:    '#8e3a35',
  forest:     '#7a9b6a',
  moss:       '#6b9379',
  sky:        '#9a8866',                  // no blue in brand — SLH gold
};

// ============================================================================
// COMPONENTS
// ============================================================================

const Pill = ({ children, color, bg }: { children: React.ReactNode; color?: string; bg?: string }) => (
  <span style={{
    display: 'inline-block', padding: '2px 8px', borderRadius: 999,
    fontSize: 10, fontWeight: 600, letterSpacing: 0.4,
    textTransform: 'uppercase', fontFamily: 'JetBrains Mono, ui-monospace, monospace',
    color: color || TOKENS.text2, background: bg || TOKENS.bgDeep,
    border: `1px solid ${bg ? 'transparent' : TOKENS.borderSoft}`,
  }}>{children}</span>
);

const StatusDot = ({ status }) => {
  const map = {
    active: TOKENS.moss, dormant: TOKENS.sand, disabled: TOKENS.text3,
    new: TOKENS.terracotta, triaged: TOKENS.ochre, working: TOKENS.sky,
    staged: TOKENS.brass, deployed: TOKENS.moss,
    critical: TOKENS.oxblood, high: TOKENS.terracotta, medium: TOKENS.ochre, low: TOKENS.sand, urgent: TOKENS.oxblood, normal: TOKENS.sand,
  };
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: map[status] || TOKENS.text3, marginRight: 6,
      boxShadow: status === 'active' || status === 'urgent' ? `0 0 0 3px ${map[status]}22` : 'none',
    }} />
  );
};

// =====================================================
// TAB: TEAM
// =====================================================
const TeamTab = ({ propertyFilter, setPropertyFilter }) => {
  const [collapsedDormant, setCollapsedDormant] = useState(true);

  // Build hierarchy
  const tree = useMemo(() => {
    const filtered = propertyFilter === 'all'
      ? AGENTS
      : propertyFilter === 'holding'
        ? AGENTS.filter(a => a.scope === 'holding')
        : AGENTS.filter(a => a.property_id === propertyFilter);

    const byParent = {};
    filtered.forEach(a => {
      const key = a.reports_to || 'ROOT';
      (byParent[key] = byParent[key] || []).push(a);
    });
    return byParent;
  }, [propertyFilter]);

  const stats = useMemo(() => {
    const inScope = propertyFilter === 'all' ? AGENTS
      : propertyFilter === 'holding' ? AGENTS.filter(a => a.scope === 'holding')
        : AGENTS.filter(a => a.property_id === propertyFilter);
    return {
      total: inScope.length,
      active: inScope.filter(a => a.status === 'active').length,
      dormant: inScope.filter(a => a.status === 'dormant').length,
      depts: new Set(inScope.map(a => a.dept)).size,
    };
  }, [propertyFilter]);

  return (
    <div>
      {/* Header strip */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { v: 'all', label: 'All scopes', n: AGENTS.length },
            { v: 'holding', label: 'Holding', n: AGENTS.filter(a => a.scope === 'holding').length },
            { v: 260955, label: 'Namkhan', n: AGENTS.filter(a => a.property_id === 260955).length },
            { v: 1000001, label: 'Donna Portals', n: AGENTS.filter(a => a.property_id === 1000001).length },
          ].map(t => (
            <button
              key={t.v}
              onClick={() => setPropertyFilter(t.v)}
              style={{
                padding: '8px 14px', border: `1px solid ${propertyFilter === t.v ? TOKENS.ink : TOKENS.border}`,
                background: propertyFilter === t.v ? TOKENS.ink : 'transparent',
                color: propertyFilter === t.v ? TOKENS.bg : TOKENS.text, fontSize: 13, fontWeight: 500,
                letterSpacing: 0.2, cursor: 'pointer', borderRadius: 2,
                fontFamily: '"Fraunces", "Times New Roman", serif',
              }}
            >
              {t.label} <span style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11, opacity: 0.7, marginLeft: 4 }}>{t.n}</span>
            </button>
          ))}
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, border: `1px solid ${TOKENS.border}` }}>
          {[
            { label: 'Roster', v: stats.total, sub: 'agents' },
            { label: 'Active', v: stats.active, sub: 'on shift' },
            { label: 'Dormant', v: stats.dormant, sub: 'awaiting work' },
            { label: 'Departments', v: stats.depts, sub: 'business units' },
          ].map((s, i) => (
            <div key={i} style={{ padding: '14px 18px', borderRight: i < 3 ? `1px solid ${TOKENS.borderSoft}` : 'none', background: TOKENS.bgRaised }}>
              <div style={{ fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: TOKENS.text3, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontFamily: '"Fraunces", serif', fontWeight: 500, color: TOKENS.ink, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 11, color: TOKENS.text2, marginTop: 4, fontStyle: 'italic' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tree */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
        {(propertyFilter === 'all' || propertyFilter === 'holding') && (
          <OrgGroup
            title="HOLDING"
            subtitle="property_id = NULL · platform-wide"
            ceo={AGENTS.find(a => a.role === 'lead')}
            tree={tree}
            roots={[AGENTS.find(a => a.role === 'lead')]}
            collapsedDormant={collapsedDormant}
            setCollapsedDormant={setCollapsedDormant}
          />
        )}
        {(propertyFilter === 'all' || propertyFilter === 260955) && (
          <OrgGroup
            title="NAMKHAN"
            subtitle="property_id = 260955 · Luang Prabang · Cloudbeds · LAK"
            ceo={AGENTS.find(a => a.role === 'hotel_ceo_namkhan')}
            tree={tree}
            roots={[AGENTS.find(a => a.role === 'hotel_ceo_namkhan')]}
            collapsedDormant={collapsedDormant}
            setCollapsedDormant={setCollapsedDormant}
          />
        )}
        {(propertyFilter === 'all' || propertyFilter === 1000001) && (
          <OrgGroup
            title="DONNA PORTALS"
            subtitle="property_id = 1000001 · Spain · Mews · EUR · onboards ~2w"
            ceo={AGENTS.find(a => a.role === 'hotel_ceo_donna')}
            tree={tree}
            roots={[AGENTS.find(a => a.role === 'hotel_ceo_donna')]}
            collapsedDormant={collapsedDormant}
            setCollapsedDormant={setCollapsedDormant}
          />
        )}
      </div>
    </div>
  );
};

const OrgGroup = ({ title, subtitle, ceo, tree, roots, collapsedDormant, setCollapsedDormant }) => {
  if (!ceo) return null;
  return (
    <div style={{ border: `1px solid ${TOKENS.border}`, background: TOKENS.bgRaised }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${TOKENS.borderSoft}`, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 20, fontFamily: '"Fraunces", serif', fontWeight: 600, color: TOKENS.ink, letterSpacing: 0.5 }}>{title}</div>
          <div style={{ fontSize: 11, color: TOKENS.text3, fontFamily: 'JetBrains Mono, ui-monospace, monospace', marginTop: 2 }}>{subtitle}</div>
        </div>
        <button
          onClick={() => setCollapsedDormant(c => !c)}
          style={{
            fontSize: 11, padding: '4px 10px', border: `1px solid ${TOKENS.border}`,
            background: 'transparent', color: TOKENS.text2, cursor: 'pointer', borderRadius: 2,
            fontFamily: 'JetBrains Mono, ui-monospace, monospace', letterSpacing: 0.4,
          }}
        >
          {collapsedDormant ? 'show dormant' : 'hide dormant'}
        </button>
      </div>
      <div style={{ padding: 20 }}>
        <AgentNode agent={ceo} tree={tree} depth={0} collapsedDormant={collapsedDormant} />
      </div>
    </div>
  );
};

const AgentNode = ({ agent, tree, depth, collapsedDormant }) => {
  const children = tree[agent.role] || [];
  const activeChildren = children.filter(c => c.status === 'active');
  const dormantChildren = children.filter(c => c.status === 'dormant');
  const visibleChildren = collapsedDormant ? activeChildren : children;

  return (
    <div style={{ marginLeft: depth === 0 ? 0 : 24, marginBottom: 8 }}>
      <AgentCard agent={agent} />
      {dormantChildren.length > 0 && collapsedDormant && depth > 0 && (
        <div style={{ marginLeft: 28, marginTop: 6, fontSize: 11, color: TOKENS.text3, fontStyle: 'italic' }}>
          + {dormantChildren.length} dormant
        </div>
      )}
      {visibleChildren.length > 0 && (
        <div style={{ marginTop: 12, borderLeft: `1px dashed ${TOKENS.border}`, paddingLeft: 0, marginLeft: 16 }}>
          {visibleChildren.map(c => (
            <AgentNode key={c.role} agent={c} tree={tree} depth={depth + 1} collapsedDormant={collapsedDormant} />
          ))}
        </div>
      )}
    </div>
  );
};

const AgentCard = ({ agent }) => {
  const levelLabel = agent.hierarchy_level === 'ceo'
    ? (agent.scope === 'holding' ? 'Holding CEO' : 'Hotel CEO')
    : agent.hierarchy_level === 'hod' ? 'HOD' : 'Worker';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px',
      background: TOKENS.bg, border: `1px solid ${TOKENS.borderSoft}`,
      borderRadius: 2, opacity: agent.status === 'dormant' ? 0.6 : 1,
    }}>
      <div style={{
        width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, background: TOKENS.bgDeep, borderRadius: '50%', flexShrink: 0,
      }}>
        {agent.avatar}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: TOKENS.ink, fontFamily: '"Fraunces", serif' }}>{agent.display_name}</span>
          <Pill>{levelLabel}</Pill>
          <Pill color={TOKENS.text3}>{agent.dept}</Pill>
          {agent.status === 'active' && <StatusDot status="active" />}
        </div>
        <div style={{ fontSize: 12, color: TOKENS.text2, lineHeight: 1.4 }}>{agent.tagline}</div>
        <div style={{ fontSize: 10, color: TOKENS.text3, fontFamily: 'JetBrains Mono, ui-monospace, monospace', marginTop: 3 }}>
          role={agent.role}{agent.reports_to ? ` · reports_to=${agent.reports_to}` : ''}
        </div>
      </div>
    </div>
  );
};

// =====================================================
// TAB: SCHEMAS
// =====================================================
const SchemasTab = () => {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    return SCHEMAS.filter(s => {
      if (category !== 'all' && s.category !== category) return false;
      if (q && !s.name.toLowerCase().includes(q.toLowerCase()) && !s.desc.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    }).sort((a, b) => b.tables - a.tables);
  }, [q, category]);

  const totals = useMemo(() => ({
    schemas: SCHEMAS.length,
    tables: SCHEMAS.reduce((s, r) => s + r.tables, 0),
    views: SCHEMAS.reduce((s, r) => s + r.views, 0),
    matviews: SCHEMAS.reduce((s, r) => s + r.matviews, 0),
    rows: SCHEMAS.reduce((s, r) => s + Math.max(0, r.rows), 0),
  }), []);

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0, border: `1px solid ${TOKENS.border}`, marginBottom: 20 }}>
        {[
          { label: 'Schemas', v: totals.schemas },
          { label: 'Tables', v: totals.tables },
          { label: 'Views', v: totals.views },
          { label: 'Matviews', v: totals.matviews },
          { label: 'Est. Rows', v: totals.rows.toLocaleString() },
        ].map((s, i) => (
          <div key={i} style={{ padding: '14px 18px', borderRight: i < 4 ? `1px solid ${TOKENS.borderSoft}` : 'none', background: TOKENS.bgRaised }}>
            <div style={{ fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: TOKENS.text3, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontFamily: '"Fraunces", serif', fontWeight: 500, color: TOKENS.ink, lineHeight: 1 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: TOKENS.text3 }} />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search schemas or descriptions…"
            style={{
              width: '100%', padding: '8px 12px 8px 34px', border: `1px solid ${TOKENS.border}`,
              background: TOKENS.bgRaised, fontSize: 13, fontFamily: 'inherit', borderRadius: 2, color: TOKENS.text,
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', 'platform', 'property', 'compat'].map(c => (
            <button
              key={c} onClick={() => setCategory(c)}
              style={{
                padding: '8px 12px', border: `1px solid ${category === c ? TOKENS.ink : TOKENS.border}`,
                background: category === c ? TOKENS.ink : TOKENS.bgRaised,
                color: category === c ? TOKENS.bg : TOKENS.text2, fontSize: 11, fontWeight: 500,
                letterSpacing: 0.4, textTransform: 'uppercase', cursor: 'pointer', borderRadius: 2,
                fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: TOKENS.text3, fontFamily: 'JetBrains Mono, ui-monospace, monospace', marginLeft: 'auto' }}>
          {filtered.length} of {SCHEMAS.length}
        </div>
      </div>

      {/* Table */}
      <div style={{ border: `1px solid ${TOKENS.border}`, background: TOKENS.bgRaised, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '24px 1.4fr 0.6fr 80px 80px 80px 110px 120px 40px',
          padding: '10px 16px', background: TOKENS.bgDeep, borderBottom: `1px solid ${TOKENS.border}`,
          fontSize: 10, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase',
          color: TOKENS.text3, fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        }}>
          <div></div>
          <div>Schema</div>
          <div>Category</div>
          <div style={{ textAlign: 'right' }}>Tables</div>
          <div style={{ textAlign: 'right' }}>Views</div>
          <div style={{ textAlign: 'right' }}>MV</div>
          <div style={{ textAlign: 'right' }}>Rows</div>
          <div>RLS</div>
          <div></div>
        </div>
        {filtered.map((s, i) => {
          const isOpen = selected === s.name;
          return (
            <div key={s.name}>
              <div
                onClick={() => setSelected(isOpen ? null : s.name)}
                style={{
                  display: 'grid', gridTemplateColumns: '24px 1.4fr 0.6fr 80px 80px 80px 110px 120px 40px',
                  padding: '12px 16px', borderBottom: `1px solid ${TOKENS.borderSoft}`,
                  alignItems: 'center', cursor: 'pointer',
                  background: isOpen ? TOKENS.bgDeep : 'transparent',
                  transition: 'background 120ms',
                }}
                onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = TOKENS.bg; }}
                onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent'; }}
              >
                <div>{isOpen ? <ChevronDown size={14} color={TOKENS.text2} /> : <ChevronRight size={14} color={TOKENS.text3} />}</div>
                <div>
                  <div style={{ fontSize: 14, fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: TOKENS.ink, fontWeight: 600 }}>
                    {s.name}{s.category === 'compat' && <span style={{ color: TOKENS.terracotta, marginLeft: 6, fontSize: 10 }}>↳ compat</span>}
                  </div>
                </div>
                <div><Pill color={s.category === 'platform' ? TOKENS.sky : s.category === 'property' ? TOKENS.moss : TOKENS.terracotta}>{s.category}</Pill></div>
                <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 13, color: TOKENS.text }}>{s.tables}</div>
                <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 13, color: TOKENS.text2 }}>{s.views || '—'}</div>
                <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 13, color: TOKENS.text2 }}>{s.matviews || '—'}</div>
                <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 12, color: TOKENS.text2 }}>
                  {s.rows > 0 ? s.rows.toLocaleString() : '—'}
                </div>
                <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: TOKENS.text2 }}>{s.rls}</div>
                <div>
                  {!s.usage_anon ? (
                    <Lock size={12} color={TOKENS.moss} />
                  ) : (
                    <span style={{ fontSize: 10, color: TOKENS.ochre, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>open</span>
                  )}
                </div>
              </div>
              {isOpen && (
                <div style={{ padding: '14px 50px', background: TOKENS.bgDeep, borderBottom: `1px solid ${TOKENS.borderSoft}` }}>
                  <div style={{ fontSize: 13, color: TOKENS.text, lineHeight: 1.5, marginBottom: 10 }}>{s.desc}</div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 11, color: TOKENS.text2, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
                    <span>anon USAGE: {s.usage_anon ? 'open' : 'blocked'}</span>
                    <span>RLS pattern: {s.rls}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =====================================================
// TAB: KNOWLEDGE
// =====================================================
const KnowledgeTab = () => {
  const [section, setSection] = useState('docs');
  const [editingId, setEditingId] = useState(null);
  const [editBuffer, setEditBuffer] = useState('');
  const [memories, setMemories] = useState(MEMORIES);
  const [adrs, setAdrs] = useState(ADRS);

  const startEdit = useCallback((type, id, content) => {
    setEditingId(`${type}:${id}`);
    setEditBuffer(content);
  }, []);

  const saveEdit = useCallback((type, id) => {
    if (type === 'memory') {
      setMemories(prev => prev.map(m => m.id === id ? { ...m, content: editBuffer, updated_at: new Date().toISOString().slice(0, 16).replace('T', ' ') } : m));
    } else if (type === 'adr') {
      setAdrs(prev => prev.map(a => a.id === id ? { ...a, decision: editBuffer } : a));
    }
    setEditingId(null);
    setEditBuffer('');
  }, [editBuffer]);

  return (
    <div>
      {/* Section selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${TOKENS.border}` }}>
        {[
          { v: 'docs', label: 'Documentation', n: DOCS.length, icon: BookOpen },
          { v: 'memory', label: 'Agent Memory', n: memories.length, icon: Cpu },
          { v: 'adr', label: 'Decisions (ADRs)', n: adrs.length, icon: GitBranch },
        ].map(s => {
          const Icon = s.icon;
          return (
            <button
              key={s.v}
              onClick={() => setSection(s.v)}
              style={{
                padding: '12px 18px', border: 'none', borderBottom: `2px solid ${section === s.v ? TOKENS.ink : 'transparent'}`,
                background: 'transparent', color: section === s.v ? TOKENS.ink : TOKENS.text2,
                fontSize: 13, fontWeight: section === s.v ? 600 : 500, cursor: 'pointer',
                fontFamily: '"Fraunces", serif', letterSpacing: 0.3,
                marginBottom: -1, display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <Icon size={14} />
              {s.label}
              <span style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11, opacity: 0.6 }}>{s.n}</span>
            </button>
          );
        })}
      </div>

      {section === 'docs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {DOCS.map(d => (
            <div key={d.doc_type} style={{
              padding: 18, border: `1px solid ${TOKENS.border}`, background: TOKENS.bgRaised, borderRadius: 2,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <Pill color={TOKENS.sky}>{d.doc_type}</Pill>
                <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: TOKENS.text3 }}>v{d.version}</span>
              </div>
              <div style={{ fontSize: 16, fontFamily: '"Fraunces", serif', fontWeight: 600, color: TOKENS.ink, marginBottom: 12, lineHeight: 1.3 }}>
                {d.title}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: TOKENS.text3, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
                <span>{d.chars.toLocaleString()} chars</span>
                <span>{d.last_updated_at}</span>
              </div>
              <button style={{
                marginTop: 14, width: '100%', padding: '8px 12px', border: `1px solid ${TOKENS.border}`,
                background: 'transparent', color: TOKENS.text2, fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit', borderRadius: 2, letterSpacing: 0.3,
              }}>
                <Edit3 size={11} style={{ marginRight: 6, verticalAlign: -1 }} />
                Edit content
              </button>
            </div>
          ))}
        </div>
      )}

      {section === 'memory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {memories.sort((a, b) => b.importance - a.importance).map(m => {
            const isEditing = editingId === `memory:${m.id}`;
            return (
              <div key={m.id} style={{
                padding: 16, border: `1px solid ${TOKENS.border}`,
                background: m.importance >= 10 ? TOKENS.bgRaised : TOKENS.bgRaised,
                borderLeft: `3px solid ${m.importance >= 10 ? TOKENS.oxblood : m.importance >= 9 ? TOKENS.terracotta : TOKENS.sand}`,
                borderRadius: 2,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Pill color={TOKENS.ink} bg={TOKENS.sand + '40'}>#{m.id}</Pill>
                  <Pill color={TOKENS.brass}>{m.agent_handle}</Pill>
                  <Pill color={TOKENS.text2}>{m.memory_type}</Pill>
                  <Pill color={TOKENS.oxblood}>importance {m.importance}</Pill>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: TOKENS.text3, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>{m.updated_at}</span>
                  {!isEditing && (
                    <button onClick={() => startEdit('memory', m.id, m.content)} style={{
                      padding: '4px 10px', border: `1px solid ${TOKENS.border}`, background: 'transparent',
                      color: TOKENS.text2, fontSize: 11, cursor: 'pointer', borderRadius: 2,
                      display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
                    }}>
                      <Edit3 size={10} /> Edit
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <div>
                    <textarea
                      value={editBuffer} onChange={e => setEditBuffer(e.target.value)}
                      style={{
                        width: '100%', minHeight: 120, padding: 10, border: `1px solid ${TOKENS.ink}`,
                        background: TOKENS.bg, color: TOKENS.text, fontSize: 13, lineHeight: 1.55,
                        fontFamily: 'inherit', resize: 'vertical', borderRadius: 2,
                      }}
                    />
                    <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                      <button onClick={() => saveEdit('memory', m.id)} style={{
                        padding: '6px 14px', border: 'none', background: TOKENS.ink, color: TOKENS.bg,
                        fontSize: 12, cursor: 'pointer', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
                      }}>
                        <Save size={11} /> Save
                      </button>
                      <button onClick={() => setEditingId(null)} style={{
                        padding: '6px 14px', border: `1px solid ${TOKENS.border}`, background: 'transparent',
                        color: TOKENS.text2, fontSize: 12, cursor: 'pointer', borderRadius: 2,
                        display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
                      }}>
                        <X size={11} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, lineHeight: 1.55, color: TOKENS.text }}>{m.content}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {section === 'adr' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {adrs.sort((a, b) => b.id - a.id).map(a => {
            const isEditing = editingId === `adr:${a.id}`;
            return (
              <div key={a.id} style={{
                padding: 16, border: `1px solid ${TOKENS.border}`, background: TOKENS.bgRaised,
                borderLeft: `3px solid ${a.impact === 'critical' ? TOKENS.oxblood : a.impact === 'high' ? TOKENS.terracotta : a.impact === 'medium' ? TOKENS.ochre : TOKENS.sand}`,
                borderRadius: 2,
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 15, fontFamily: '"Fraunces", serif', fontWeight: 600, color: TOKENS.ink, lineHeight: 1.3, flex: 1 }}>{a.title}</div>
                  <Pill color={a.impact === 'critical' ? TOKENS.oxblood : TOKENS.text2}>{a.impact}</Pill>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center', fontSize: 11, color: TOKENS.text3, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
                  <span>by {a.decided_by}</span>
                  {a.approved_by_human && <span style={{ color: TOKENS.moss }}><CheckCircle2 size={11} style={{ verticalAlign: -2, marginRight: 3 }} />human-approved</span>}
                  {a.arm && <span>· arm={a.arm}</span>}
                  <span style={{ marginLeft: 'auto' }}>{a.created_at}</span>
                  {!isEditing && (
                    <button onClick={() => startEdit('adr', a.id, a.decision)} style={{
                      padding: '4px 10px', border: `1px solid ${TOKENS.border}`, background: 'transparent',
                      color: TOKENS.text2, fontSize: 11, cursor: 'pointer', borderRadius: 2,
                      display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
                    }}>
                      <Edit3 size={10} /> Edit
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <div>
                    <textarea
                      value={editBuffer} onChange={e => setEditBuffer(e.target.value)}
                      style={{
                        width: '100%', minHeight: 120, padding: 10, border: `1px solid ${TOKENS.ink}`,
                        background: TOKENS.bg, color: TOKENS.text, fontSize: 13, lineHeight: 1.55,
                        fontFamily: 'inherit', resize: 'vertical', borderRadius: 2,
                      }}
                    />
                    <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                      <button onClick={() => saveEdit('adr', a.id)} style={{
                        padding: '6px 14px', border: 'none', background: TOKENS.ink, color: TOKENS.bg,
                        fontSize: 12, cursor: 'pointer', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
                      }}>
                        <Save size={11} /> Save
                      </button>
                      <button onClick={() => setEditingId(null)} style={{
                        padding: '6px 14px', border: `1px solid ${TOKENS.border}`, background: 'transparent',
                        color: TOKENS.text2, fontSize: 12, cursor: 'pointer', borderRadius: 2,
                        display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
                      }}>
                        <X size={11} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, lineHeight: 1.55, color: TOKENS.text }}>{a.decision}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// =====================================================
// TAB: ACTIVITY
// =====================================================
const ActivityTab = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const filteredIntake = useMemo(() => statusFilter === 'all' ? INTAKE : INTAKE.filter(i => i.status === statusFilter), [statusFilter]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontFamily: '"Fraunces", serif', fontWeight: 600, color: TOKENS.ink }}>Intake — bug box</div>
            <div style={{ fontSize: 11, color: TOKENS.text3, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>cockpit.intake_items</div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {['all', 'new', 'triaged'].map(f => (
              <button key={f} onClick={() => setStatusFilter(f)} style={{
                padding: '5px 10px', border: `1px solid ${statusFilter === f ? TOKENS.ink : TOKENS.border}`,
                background: statusFilter === f ? TOKENS.ink : 'transparent', color: statusFilter === f ? TOKENS.bg : TOKENS.text2,
                fontSize: 11, cursor: 'pointer', borderRadius: 2, fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                letterSpacing: 0.4, textTransform: 'uppercase',
              }}>{f}</button>
            ))}
          </div>
        </div>
        <div style={{ border: `1px solid ${TOKENS.border}`, background: TOKENS.bgRaised, maxHeight: 720, overflowY: 'auto' }}>
          {filteredIntake.map(i => (
            <div key={i.id} style={{
              padding: '12px 14px', borderBottom: `1px solid ${TOKENS.borderSoft}`,
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <div style={{ width: 28, textAlign: 'right', fontSize: 11, fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: TOKENS.text3, paddingTop: 1 }}>#{i.id}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: TOKENS.text, lineHeight: 1.4, marginBottom: 4 }}>{i.title}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 10, color: TOKENS.text3, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
                  <span><StatusDot status={i.priority} />{i.priority}</span>
                  <span>·</span>
                  <Pill>{i.kind}</Pill>
                  <Pill color={i.status === 'new' ? TOKENS.terracotta : TOKENS.sky}>{i.status}</Pill>
                  <span>dept={i.dept_slug}</span>
                  {i.property_id && <span>· prop={i.property_id}</span>}
                  <span style={{ marginLeft: 'auto' }}>{i.created_at}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontFamily: '"Fraunces", serif', fontWeight: 600, color: TOKENS.ink }}>DDL Activity — last 24h</div>
          <div style={{ fontSize: 11, color: TOKENS.text3, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>cockpit.aud_change_log</div>
        </div>
        <div style={{ border: `1px solid ${TOKENS.border}`, background: TOKENS.bgRaised }}>
          {ACTIVITY.map((a, i) => (
            <div key={i} style={{ padding: '10px 14px', borderBottom: i < ACTIVITY.length - 1 ? `1px solid ${TOKENS.borderSoft}` : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 44, fontSize: 11, fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: TOKENS.text3 }}>{a.minute}</div>
              <div style={{ width: 90 }}><Pill color={a.command_tag === 'DROP SCHEMA' || a.command_tag === 'DROP TABLE' || a.command_tag.startsWith('DROP') ? TOKENS.oxblood : a.command_tag === 'REVOKE' ? TOKENS.terracotta : TOKENS.sky}>{a.command_tag}</Pill></div>
              <div style={{ flex: 1, fontSize: 12, color: TOKENS.text }}>{a.label}</div>
              <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: TOKENS.text2 }}>×{a.n}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontFamily: '"Fraunces", serif', fontWeight: 600, color: TOKENS.ink }}>Agent Spend — last 30d</div>
            <div style={{ fontSize: 11, color: TOKENS.text3, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>cockpit.aud_audit_log — cost_usd_milli</div>
          </div>
          <div style={{ padding: 14, background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: TOKENS.terracotta, marginBottom: 8 }}>
              <AlertCircle size={14} /> <strong>Instrumentation pending.</strong>
            </div>
            <div style={{ fontSize: 11, color: TOKENS.text2, lineHeight: 1.5 }}>
              Cost columns exist (cost_usd_milli, input_tokens, output_tokens) but only 4 of 300 audit log rows have data.
              Wire instrumentation in Edge Function calls + cockpit.cap_skill_calls inserts.
              gov_agent_budgets is empty — set ceilings before traffic ramps.
            </div>
          </div>
          <div style={{ border: `1px solid ${TOKENS.border}`, background: TOKENS.bgRaised }}>
            <div style={{ padding: '8px 14px', borderBottom: `1px solid ${TOKENS.borderSoft}`, background: TOKENS.bgDeep, display: 'grid', gridTemplateColumns: '1fr 70px 90px 60px', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: TOKENS.text3, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
              <div>Agent</div>
              <div style={{ textAlign: 'right' }}>Actions</div>
              <div style={{ textAlign: 'right' }}>Spend (USD)</div>
              <div style={{ textAlign: 'right' }}>Latest</div>
            </div>
            {COSTS.map(c => (
              <div key={c.agent} style={{ padding: '8px 14px', borderBottom: `1px solid ${TOKENS.borderSoft}`, display: 'grid', gridTemplateColumns: '1fr 70px 90px 60px', alignItems: 'center', fontSize: 12 }}>
                <div style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: TOKENS.text }}>{c.agent}</div>
                <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: TOKENS.text }}>{c.total_actions}</div>
                <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: c.total_cost_usd > 0 ? TOKENS.ink : TOKENS.text3 }}>
                  {c.total_cost_usd > 0 ? `$${c.total_cost_usd.toFixed(3)}` : '—'}
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 10, color: TOKENS.text3 }}>{c.latest}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// =====================================================
// MAIN
// =====================================================
export default function CockpitV2Page() {
  const [tab, setTab] = useState('team');
  const [propertyFilter, setPropertyFilter] = useState('all');

  const tabs = [
    { v: 'team', label: 'Team', icon: Users, n: AGENTS.length },
    { v: 'schemas', label: 'Schemas', icon: Database, n: SCHEMAS.length },
    { v: 'knowledge', label: 'Knowledge', icon: BookOpen, n: DOCS.length + MEMORIES.length + ADRS.length },
    { v: 'activity', label: 'Activity', icon: Activity, n: INTAKE.length },
  ];

  return (
    <Page
      eyebrow="cockpit · v2 preview"
      title={<em>What&apos;s in the system right now?</em>}
      kpiTiles={[
        { k: 'AGENTS', v: String(AGENTS.length), d: 'identities' },
        { k: 'SCHEMAS', v: String(SCHEMAS.length), d: 'in DB' },
        { k: 'INTAKE', v: String(INTAKE.length), d: 'open bugs' },
      ]}
    >
      <div style={{ fontFamily: 'var(--sans)', color: '#e9e1ce' }}>
      {/* Tab bar */}
      <nav style={{
        background: TOKENS.bgRaised, borderBottom: `1px solid ${TOKENS.border}`,
        padding: '0 32px', display: 'flex', gap: 0,
      }}>
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.v;
          return (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              style={{
                padding: '16px 22px', border: 'none', background: 'transparent',
                color: active ? TOKENS.ink : TOKENS.text2,
                fontSize: 14, fontWeight: active ? 600 : 500, cursor: 'pointer',
                borderBottom: `2px solid ${active ? TOKENS.terracotta : 'transparent'}`,
                marginBottom: -1, display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: '"Fraunces", serif', letterSpacing: 0.5,
                transition: 'color 120ms',
              }}
            >
              <Icon size={15} strokeWidth={1.5} />
              {t.label}
              <span style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11, opacity: 0.55, fontWeight: 400 }}>
                {t.n}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Body */}
      <main style={{ padding: '28px 32px', maxWidth: 1600, margin: '0 auto' }}>
        {tab === 'team' && <TeamTab propertyFilter={propertyFilter} setPropertyFilter={setPropertyFilter} />}
        {tab === 'schemas' && <SchemasTab />}
        {tab === 'knowledge' && <KnowledgeTab />}
        {tab === 'activity' && <ActivityTab />}
      </main>

      </div>
    </Page>
  );
}
