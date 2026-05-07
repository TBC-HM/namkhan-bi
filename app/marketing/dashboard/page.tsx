// app/marketing/dashboard/page.tsx — Marketing engine dashboard, real data only.
import EngineDashboard, { type EngineConfig } from "@/components/engine/EngineDashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const cfg: EngineConfig = {
  dept_label: "Marketing",
  hod_role: "marketing_hod",
  hod_display_name: "Lumen",
  scope: "Last 30 days",
  kpis: [
    { label: "OTB next 90d", view: "v_overview_live", column: "otb_next_90d", format: "int" },
    { label: "Cancellation %", view: "v_overview_live", column: "cancellation_pct", format: "pct" },
    { label: "DQ open issues", view: "v_overview_dq", column: "open_total", format: "int" },
    { label: "DQ critical", view: "v_overview_dq", column: "open_critical", format: "int" },
  ],
  panels: [
    {
      title: "Channel mix categorized · last 30d",
      view: "v_channel_mix_categorized_30d",
      columns: [
        { key: "channel_group", label: "Channel" },
        { key: "bookings", label: "Bookings", format: "int" },
        { key: "room_nights", label: "Room nights", format: "int" },
        { key: "gross_revenue", label: "Gross rev", format: "usd" },
        { key: "avg_adr", label: "ADR", format: "usd" },
      ],
      order_by: { col: "gross_revenue", ascending: false },
      limit: 12,
    },
    {
      title: "Comp set ranking · latest",
      view: "v_compset_ranking_latest",
      columns: [
        { key: "channel", label: "Channel" },
        { key: "search_destination", label: "Search" },
        { key: "position", label: "Position", format: "int" },
        { key: "is_above_fold", label: "Above fold" },
        { key: "movement", label: "Movement" },
      ],
      order_by: { col: "shop_date", ascending: false },
      limit: 15,
    },
    {
      title: "OTA uploads · most recent",
      view: "v_ota_uploads",
      columns: [
        { key: "ota", label: "OTA" },
        { key: "asset_type", label: "Asset" },
        { key: "status", label: "Status" },
        { key: "uploaded_at", label: "Uploaded" },
      ],
      order_by: { col: "uploaded_at", ascending: false },
      limit: 12,
    },
    {
      title: "Parity breaches · open",
      view: "v_parity_open_breaches",
      columns: [
        { key: "channel", label: "Channel" },
        { key: "rate_plan", label: "Rate plan" },
        { key: "delta_usd", label: "Δ$", format: "usd" },
        { key: "severity", label: "Severity" },
        { key: "first_seen", label: "First seen" },
      ],
      limit: 12,
    },
  ],
  chat_route: "/api/cockpit/chat",
};

export default function Page() { return <EngineDashboard cfg={cfg} />; }
