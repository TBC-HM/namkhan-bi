import DeptCockpit from "@/components/engine/DeptCockpit";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <DeptCockpit
      dept_label="Revenue"
      dept_slug="revenue"
      hod_role="revenue_hod"
      worker_roles={["pricing_analyst", "pace_analyst", "channel_analyst", "reporting_writer"]}
      dashboard_href="/revenue/dashboard"
      description="Vector owns pace, pickup, BAR, comp set, parity. SLH-tier truth on numbers."
    />
  );
}
