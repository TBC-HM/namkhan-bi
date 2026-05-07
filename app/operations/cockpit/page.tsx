import DeptCockpit from "@/components/engine/DeptCockpit";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <DeptCockpit
      dept_label="Operations"
      dept_slug="operations"
      hod_role="operations_hod"
      worker_roles={["housekeeping_supervisor", "fb_analyst", "incident_coordinator", "supplier_manager"]}
      dashboard_href="/operations/dashboard"
      description="Forge owns SLH-in-Lao-reality, F&B cost, par stock, incidents."
    />
  );
}
