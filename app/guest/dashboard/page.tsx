// app/guest/dashboard/page.tsx — Guest engine dashboard, real data only.
import EngineDashboard, { type EngineConfig } from "@/components/engine/EngineDashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const cfg: EngineConfig = {
  dept_label: "Guest",
  hod_role: "operations_hod",       // No dedicated guest HoD yet — Forge owns until PBS assigns
  hod_display_name: "Forge (interim)",
  scope: "Today · live",
  kpis: [
    { label: "Repeat guests %", view: "v_repeat_guests", column: "repeat_pct", format: "pct" },
    { label: "Total guests", view: "v_repeat_guests", column: "total_guests", format: "int" },
    { label: "Repeat count", view: "v_repeat_guests", column: "repeat_count", format: "int" },
    { label: "Arriving today", view: "v_overview_live", column: "expected_arrivals_today", format: "int" },
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
        { key: "total_amount", label: "Total", format: "usd" },
      ],
      limit: 30,
    },
    {
      title: "Guest directory · most recent",
      view: "v_guests_linked",
      columns: [
        { key: "first_name", label: "First" },
        { key: "last_name", label: "Last" },
        { key: "country", label: "Country" },
        { key: "total_stays", label: "Stays", format: "int" },
        { key: "total_spent", label: "Spent", format: "usd" },
        { key: "is_repeat", label: "Repeat" },
        { key: "last_stay_date", label: "Last stay" },
      ],
      order_by: { col: "last_stay_date", ascending: false },
      limit: 30,
    },
  ],
  chat_route: "/api/cockpit/chat",
};

export default function Page() { return <EngineDashboard cfg={cfg} />; }
