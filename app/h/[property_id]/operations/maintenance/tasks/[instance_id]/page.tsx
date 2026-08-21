// app/h/[property_id]/operations/maintenance/tasks/[instance_id]/page.tsx
// PM v3 slice 5 — task detail deep-link route
// PM v3 slice 6 — design-system conformance: paper-white card + hairline border,
// token colors only, no emoji. TaskDetail is content-only; this route supplies
// the page chrome (the hub supplies a right-side Drawer instead).
"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import TaskDetail from "../../_components/TaskDetail";
import * as S from "../../_components/pmStyles";
import OpsTopStrip from "@/app/(cockpit)/_design/OpsTopStrip";

type PMTask = {
  instance_id: string;
  task_id: string;
  task_code: string;
  title: string;
  description: string;
  scheduled_date: string;
  status: string;
  dept_id: number;
  provider: string;
  asset_id: number;
  asset_code: string;
  asset_name: string;
  estimated_minutes: number;
  assigned_to: string;
  verification_type: string;
  sop_doc_id: string;
  actual_minutes: number;
  completed_at: string;
  completed_by: string
};

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = Number(params?.property_id);
  const instanceId = params?.instance_id as string;
  const [task, setTask] = useState<PMTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    loadTask();
  }, [instanceId, propertyId]);

  async function loadTask() {
    try {
      const sb = createClient();
      const { data, error } = await sb
        .from("v_pm_calendar")
        .select("*")
        .eq("property_id", propertyId)
        .eq("instance_id", instanceId)
        .single();

      if (error) throw error;
      if (!data) throw new Error("Task not found");

      setTask(data as PMTask);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleComplete() {
    loadTask();
  }

  function handleBack() {
    router.push(`/h/${propertyId}/operations/maintenance`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--paper)" }}>
        <div style={S.muted}>Loading task...</div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--paper)" }}>
        <div className="text-center">
          <p className="mb-4" style={{ color: "var(--st-bad)", fontSize: "var(--t-md)" }}>{error || "Task not found"}</p>
          <button onClick={handleBack} className="btn-ghost">
            ← Back to Maintenance
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)" }}>
      <OpsTopStrip propertyId={propertyId} activeSuffix="/maintenance" />
      <div className="max-w-4xl mx-auto p-6">
        <button onClick={handleBack} className="btn-ghost mb-4">
          ← Back to Maintenance
        </button>
        <div style={{ ...S.card, padding: 24 }}>
          <TaskDetail
            task={task}
            propertyId={propertyId}
            onComplete={handleComplete}
            standalone={true}
          />
        </div>
      </div>
    </div>
  );
}
