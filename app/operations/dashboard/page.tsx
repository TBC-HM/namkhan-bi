// app/operations/dashboard/page.tsx — Operations engine dashboard, real data only.
import EngineDashboard, { type EngineConfig } from "@/components/engine/EngineDashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const cfg: EngineConfig = {
  dept_label: "Operations",
  hod_role: "operations_hod",
  hod_display_name: "Forge",
  scope: "Today · live",
  kpis: [
    { label: "In-house tonight", view: "v_overview_live", column: "occupied_tonight", format: "int" },
    { label: "Arriving today", view: "v_overview_live", column: "expected_arrivals_today", format: "int" },
    { label: "Departing today", view: "v_overview_live", column: "departing_today", format: "int" },
    { label: "DQ open", view: "v_overview_dq", column: "open_total", format: "int" },
  ],
  panels: [
    {
      title: "Today's arrivals",
      view: "v_arrivals_today",
      columns: [
        { key: "guest_name", label: "Guest" },
        { key: "guest_country", label: "Country" },
        { key: "room_type_name", label: "Room" },
        { key: "nights", label: "Nights", format: "int" },
        { key: "adults", label: "Ad", format: "int" },
        { key: "children", label: "Ch", format: "int" },
        { key: "status", label: "Status" },
      ],
      limit: 30,
    },
    {
      title: "Staff register",
      view: "v_staff_register_extended",
      columns: [
        { key: "full_name", label: "Name" },
        { key: "department", label: "Dept" },
        { key: "role_title", label: "Role" },
        { key: "status", label: "Status" },
        { key: "monthly_salary_usd", label: "Salary $/mo", format: "usd" },
      ],
      order_by: { col: "department", ascending: true },
      limit: 50,
    },
    {
      title: "Staff anomalies",
      view: "v_staff_anomalies",
      columns: [
        { key: "full_name", label: "Name" },
        { key: "anomaly_type", label: "Anomaly" },
        { key: "severity", label: "Severity" },
        { key: "detected_at", label: "Detected" },
      ],
      order_by: { col: "detected_at", ascending: false },
      limit: 15,
    },
    {
      title: "F&B item sales · top",
      view: "v_inv_item_sales",
      columns: [
        { key: "item_name", label: "Item" },
        { key: "category", label: "Category" },
        { key: "qty_sold_30d", label: "Qty 30d", format: "int" },
        { key: "revenue_30d", label: "Rev 30d", format: "usd" },
      ],
      order_by: { col: "revenue_30d", ascending: false },
      limit: 20,
    },
  ],
  chat_route: "/api/cockpit/chat",
};

export default function Page() { return <EngineDashboard cfg={cfg} />; }
