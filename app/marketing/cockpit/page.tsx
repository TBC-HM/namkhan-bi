import DeptCockpit from "@/components/engine/DeptCockpit";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <DeptCockpit
      dept_label="Marketing"
      dept_slug="marketing"
      hod_role="marketing_hod"
      worker_roles={["copy_lead", "social_lead", "seo_lead", "media_lead"]}
      dashboard_href="/marketing/dashboard"
      description="Lumen owns direct booking, brand floor, OTA scores, campaigns."
    />
  );
}
