import DeptCockpit from "@/components/engine/DeptCockpit";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <DeptCockpit
      dept_label="Finance"
      dept_slug="finance"
      hod_role="finance_hod"
      worker_roles={["usali_categorizer", "fx_tracker", "variance_analyst", "report_writer"]}
      dashboard_href="/finance/dashboard"
      description="Intel owns USALI 11, LAK/USD FX, GOP, flow-through, cash forecast. Zero ledger-write authority."
    />
  );
}
