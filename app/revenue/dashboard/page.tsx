// app/revenue/dashboard/page.tsx
// Real Revenue dashboard — same visual as rm_dashboard.html, wired to live views.
// Author: PBS via Claude (Cowork) · 2026-05-07.

import EngineDashboard, { type EngineConfig } from "@/components/engine/EngineDashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const cfg: EngineConfig = {
  dept_label: "Revenue",
  hod_role: "revenue_hod",
  hod_display_name: "Vector",
  scope: "Today · live",
  kpis: [
    { label: "In-house tonight", view: "v_overview_live", column: "occupied_tonight", format: "int" },
    { label: "Arriving today", view: "v_overview_live", column: "expected_arrivals_today", format: "int" },
    { label: "OTB next 90d", view: "v_overview_live", column: "otb_next_90d", format: "int" },
    { label: "Cancellation %", view: "v_overview_live", column: "cancellation_pct", format: "pct" },
  ],
  panels: [
    {
      title: "Channel mix · last 30d",
      view: "v_channel_summary",
      columns: [
        { key: "channel_group", label: "Channel" },
        { key: "room_nights", label: "Room nights", format: "int" },
        { key: "revenue", label: "Revenue", format: "usd" },
        { key: "avg_adr", label: "ADR", format: "usd" },
        { key: "revenue_pct", label: "Share", format: "pct" },
      ],
      order_by: { col: "revenue", ascending: false },
      limit: 10,
    },
    {
      title: "Pace curve · current month",
      view: "v_pace_curve",
      columns: [
        { key: "day", label: "Day" },
        { key: "rooms_actual", label: "Actual", format: "int" },
        { key: "rooms_otb", label: "OTB", format: "int" },
        { key: "rooms_stly_daily_avg", label: "STLY avg", format: "int" },
        { key: "rooms_budget_daily_avg", label: "Budget avg", format: "int" },
      ],
      order_by: { col: "day", ascending: true },
      limit: 31,
    },
    {
      title: "Pickup · 30 day stays",
      view: "v_pickup_30d",
      columns: [
        { key: "stay_date", label: "Stay date" },
        { key: "otb_rooms", label: "OTB now", format: "int" },
        { key: "otb_rooms_7d_ago", label: "OTB 7d ago", format: "int" },
        { key: "otb_rooms_30d_ago", label: "OTB 30d ago", format: "int" },
      ],
      order_by: { col: "stay_date", ascending: true },
      limit: 30,
    },
    {
      title: "Comp set positioning",
      view: "v_compset_namkhan_vs_comp_avg",
      columns: [
        { key: "plan_name", label: "Plan" },
        { key: "namkhan_avg_rate", label: "Namkhan", format: "usd" },
        { key: "comp_avg_rate", label: "Comp avg", format: "usd" },
        { key: "price_diff_pct", label: "Δ%", format: "pct" },
        { key: "positioning", label: "Position" },
      ],
      limit: 12,
    },
  ],
  chat_route: "/api/cockpit/chat",
};

export default function Page() {
  return <EngineDashboard cfg={cfg} />;
}
