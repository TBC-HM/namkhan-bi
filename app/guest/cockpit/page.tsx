import DeptCockpit from "@/components/engine/DeptCockpit";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <DeptCockpit
      dept_label="Guest"
      dept_slug="guest"
      hod_role="operations_hod"
      worker_roles={["incident_coordinator", "housekeeping_supervisor"]}
      dashboard_href="/guest/dashboard"
      description="Interim under Forge. Profile directory, complaints, repeat-stay rate. Awaiting a dedicated Guest HoD assignment."
    />
  );
}
