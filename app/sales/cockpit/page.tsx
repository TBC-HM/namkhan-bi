// app/sales/cockpit/page.tsx
import DeptCockpit from "@/components/engine/DeptCockpit";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <DeptCockpit
      dept_label="Sales"
      dept_slug="sales"
      hod_role="sales_hod"
      worker_roles={["inquiry_triager", "quote_drafter", "b2b_account_manager", "followup_writer"]}
      dashboard_href="/sales/dashboard"
      description="Mercer leads inquiries, B2B contracts, channel mix, conversion. Ask anything about the funnel."
    />
  );
}
