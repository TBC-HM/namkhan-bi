// app/h/[property_id]/operations/maintenance/external/page.tsx
// PM v3 slice 5 — external contractor view
"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

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
  completed_by: string;
  provider_note: string;
};

export default function ExternalContractorPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = Number(params?.property_id);
  const [tasks, setTasks] = useState<PMTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"scheduled"|"completed">("scheduled");

  useEffect(() => {
    loadTasks();
  }, [propertyId]);

  async function loadTasks() {
    try {
      const sb = createClient();
      const { data, error } = await sb
        .from("v_pm_calendar")
        .select("*")
        .eq("property_id", propertyId)
        .eq("provider", "external")
        .order("scheduled_date", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      if (data) setTasks(data as PMTask[]);
    } catch (e: any) {
      console.error("Failed to load external tasks:", e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    router.push(`/h/${propertyId}/ops/maintenance`);
  }

  const scheduledTasks = tasks.filter(t => t.status === "scheduled");
  const completedTasks = tasks.filter(t => t.status === "completed");
  const displayTasks = view === "scheduled" ? scheduledTasks : completedTasks;

  // Extract unique provider notes for contact info
  const providerNotes = Array.from(new Set(tasks.map(t => t.provider_note).filter(Boolean)));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <button onClick={handleBack} className="mb-4 text-blue-600 hover:text-blue-800 flex items-center gap-2">
          ← Back to Maintenance
        </button>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">External Contractor View</h1>
          <p className="text-gray-600">Tasks assigned to external maintenance providers</p>
        </div>

        {/* Contact Info Section */}
        {providerNotes.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h2 className="font-bold text-blue-900 mb-2">📞 Provider Contact Information</h2>
            <div className="space-y-1">
              {providerNotes.map((note, idx) => (
                <p key={idx} className="text-sm text-blue-800">{note}</p>
              ))}
            </div>
          </div>
        )}

        {/* View Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setView("scheduled")}
            className={`px-4 py-2 rounded font-medium ${
              view === "scheduled" 
                ? "bg-yellow-100 text-yellow-800 border-2 border-yellow-500" 
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            📅 Scheduled ({scheduledTasks.length})
          </button>
          <button
            onClick={() => setView("completed")}
            className={`px-4 py-2 rounded font-medium ${
              view === "completed" 
                ? "bg-green-100 text-green-800 border-2 border-green-500" 
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            ✅ Completed ({completedTasks.length})
          </button>
        </div>

        {/* Tasks List */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading external tasks...</div>
        ) : displayTasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            No {view} external tasks found
          </div>
        ) : (
          <div className="space-y-4">
            {displayTasks.map((task) => (
              <div key={task.instance_id} className="bg-white rounded-lg shadow p-5 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900">{task.title}</h3>
                    <p className="text-gray-600">{task.task_code} – {task.asset_code} {task.asset_name}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    task.status === "completed" ? "bg-green-100 text-green-800" :
                    task.status === "scheduled" ? "bg-yellow-100 text-yellow-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    {task.status}
                  </span>
                </div>

                {task.description && (
                  <p className="text-gray-700 mb-3">{task.description}</p>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                  <div>
                    <span className="text-gray-600">Scheduled:</span>
                    <p className="font-medium">{task.scheduled_date}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Duration:</span>
                    <p className="font-medium">{task.estimated_minutes} min</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Assigned:</span>
                    <p className="font-medium">{task.assigned_to || "Unassigned"}</p>
                  </div>
                  {task.status === "completed" && (
                    <div>
                      <span className="text-gray-600">Completed:</span>
                      <p className="font-medium">{task.completed_at}</p>
                    </div>
                  )}
                </div>

                {task.status === "completed" && task.actual_minutes && (
                  <div className="mt-3 p-3 bg-green-50 rounded border border-green-200">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm text-green-900">✅ Completed by {task.completed_by}</span>
                        <p className="text-sm text-green-800 mt-1">Actual duration: {task.actual_minutes} min</p>
                      </div>
                    </div>
                  </div>
                )}

                {task.sop_doc_id && (
                  <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                    <span className="text-sm text-blue-900">📋 SOP: {task.sop_doc_id}</span>
                  </div>
                )}

                <div className="mt-4 flex justify-end">
                  <Link 
                    href={`/h/${propertyId}/operations/maintenance/tasks/${task.instance_id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View Full Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
