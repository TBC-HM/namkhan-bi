// app/h/[property_id]/operations/maintenance/tasks/[instance_id]/page.tsx
// PM v3 slice 5 — task detail deep-link route
"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import TaskDetail from "../../_components/TaskDetail";

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
    router.push(`/h/${propertyId}/ops/maintenance`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading task...</div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">❌ {error || "Task not found"}</p>
          <button onClick={handleBack} className="text-blue-600 hover:text-blue-800">
            ← Back to Maintenance
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <button onClick={handleBack} className="mb-4 text-blue-600 hover:text-blue-800 flex items-center gap-2">
          ← Back to Maintenance
        </button>
        <TaskDetail 
          task={task} 
          propertyId={propertyId} 
          onComplete={handleComplete}
          standalone={true}
        />
      </div>
    </div>
  );
}
