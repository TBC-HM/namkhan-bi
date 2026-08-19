// app/h/[property_id]/operations/maintenance/_components/TaskDetail.tsx
// Extracted from ops/maintenance/page.tsx for slice 5 deep-link routes
"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

type TaskDetailProps = {
  task: PMTask;
  propertyId: number;
  onComplete?: () => void;
  onClose?: () => void;
  standalone?: boolean;
};

export default function TaskDetail({ task, propertyId, onComplete, onClose, standalone = false }: TaskDetailProps) {
  const [completionForm, setCompletionForm] = useState({ 
    actual_minutes: 0, 
    notes: "", 
    photo_urls: [] as string[], 
    checklist: {} as Record<string,boolean> 
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleComplete() {
    if (!completionForm.actual_minutes || completionForm.actual_minutes <= 0) {
      alert("Please enter actual duration (minutes)");
      return;
    }
    setSubmitting(true);
    try {
      const sb = createClient();
      const { error } = await sb.rpc("fn_complete_pm_task", {
        p_instance_id: task.instance_id,
        p_property_id: propertyId,
        p_actual_minutes: completionForm.actual_minutes,
        p_completion_notes: completionForm.notes || null,
        p_photo_urls: completionForm.photo_urls.length > 0 ? completionForm.photo_urls : null
      });
      if (error) throw error;
      alert("✅ Task completed!");
      if (onComplete) onComplete();
      if (onClose) onClose();
    } catch (e: any) {
      alert("❌ " + e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const Container = standalone ? "div" : "div";
  const containerClass = standalone 
    ? "min-h-screen bg-gray-50 p-6" 
    : "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4";

  return (
    <div className={containerClass}>
      <div className={standalone ? "max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-6" : "bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"}>
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-gray-900">{task.title}</h2>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
          )}
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex gap-2">
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">{task.task_code}</span>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              task.status === "completed" ? "bg-green-100 text-green-800" :
              task.status === "scheduled" ? "bg-yellow-100 text-yellow-800" :
              "bg-gray-100 text-gray-800"
            }`}>{task.status}</span>
            <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">{task.provider}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Asset:</span>
              <p className="font-medium">{task.asset_code} – {task.asset_name}</p>
            </div>
            <div>
              <span className="text-gray-600">Scheduled:</span>
              <p className="font-medium">{task.scheduled_date}</p>
            </div>
            <div>
              <span className="text-gray-600">Estimated:</span>
              <p className="font-medium">{task.estimated_minutes} min</p>
            </div>
            <div>
              <span className="text-gray-600">Assigned:</span>
              <p className="font-medium">{task.assigned_to || "Unassigned"}</p>
            </div>
          </div>

          {task.description && (
            <div className="mt-4">
              <span className="text-gray-600 text-sm">Description:</span>
              <p className="mt-1 text-gray-800">{task.description}</p>
            </div>
          )}

          {task.sop_doc_id && (
            <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
              <span className="text-sm text-blue-900">📋 SOP: {task.sop_doc_id}</span>
            </div>
          )}
        </div>

        {task.status === "completed" ? (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded">
            <p className="text-green-900 font-medium">✅ Completed</p>
            <div className="mt-2 text-sm text-green-800">
              <p>Duration: {task.actual_minutes} min</p>
              <p>Completed: {task.completed_at}</p>
              <p>By: {task.completed_by}</p>
            </div>
          </div>
        ) : (
          <div className="mt-6 border-t pt-4">
            <h3 className="font-bold text-lg mb-4">Complete Task</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Actual Duration (minutes) *</label>
                <input 
                  type="number" 
                  value={completionForm.actual_minutes || ""} 
                  onChange={e => setCompletionForm({...completionForm, actual_minutes: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  min="1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea 
                  value={completionForm.notes} 
                  onChange={e => setCompletionForm({...completionForm, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  rows={3}
                  placeholder="Any observations or issues..."
                />
              </div>
              <button 
                onClick={handleComplete}
                disabled={submitting || !completionForm.actual_minutes}
                className="w-full bg-green-600 text-white py-3 rounded font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {submitting ? "Saving..." : "✓ Complete Task"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
