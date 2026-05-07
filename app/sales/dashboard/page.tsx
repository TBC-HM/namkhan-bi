// app/sales/dashboard/page.tsx — Sales engine dashboard, real data only.
import EngineDashboard, { type EngineConfig } from "@/components/engine/EngineDashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const cfg: EngineConfig = {
  dept_label: "Sales",
  hod_role: "sales_hod",
  hod_display_name: "Mercer",
  scope: "Today · live",
  kpis: [
    { label: "OTB next 90d", view: "v_overview_live", column: "otb_next_90d", format: "int" },
    { label: "Arriving today", view: "v_overview_live", column: "expected_arrivals_today", format: "int" },
    { label: "Cancellation %", view: "v_overview_live", column: "cancellation_pct", format: "pct" },
    { label: "No-show %", view: "v_overview_live", column: "no_show_pct", format: "pct" },
  ],
  panels: [
    {
      title: "DMC contracts",
      view: "v_dmc_contracts",
      columns: [
        { key: "partner_short_name", label: "Partner" },
        { key: "country", label: "Country" },
        { key: "computed_status", label: "Status" },
        { key: "days_to_expiry", label: "Days to expiry", format: "int" },
        { key: "pricing_model", label: "Pricing" },
      ],
      order_by: { col: "days_to_expiry", ascending: true },
      limit: 15,
    },
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
      title: "Lead time buckets",
      view: "v_lead_time_buckets",
      columns: [
        { key: "bucket", label: "Booking lead" },
        { key: "bookings", label: "Bookings", format: "int" },
        { key: "room_nights", label: "Room nights", format: "int" },
        { key: "avg_adr", label: "ADR", format: "usd" },
      ],
      limit: 10,
    },
    {
      title: "Today's arrivals",
      view: "v_arrivals_today",
      columns: [
        { key: "guest_name", label: "Guest" },
        { key: "guest_country", label: "Country" },
        { key: "room_type_name", label: "Room" },
        { key: "nights", label: "Nights", format: "int" },
        { key: "source_name", label: "Source" },
        { key: "total_amount", label: "Total", format: "usd" },
      ],
      limit: 30,
    },
  ],
  chat_route: "/api/cockpit/chat",
};

export default function Page() { return <EngineDashboard cfg={cfg} />; }
