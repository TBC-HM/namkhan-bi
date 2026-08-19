// app/h/[property_id]/operations/maintenance/_components/TaskDetail.tsx
// Extracted from ops/maintenance/page.tsx for slice 5 deep-link routes
// PM v3 slice 3 — completion form branches on verification_type:
//   checklist    → checkboxes parsed from SOP markdown "- [ ]" lines (all required)
//   photo        → camera/file upload to 'maintenance-evidence' bucket (≥1 required)
//   measurement / data → 3 generic numeric readings
//   none / NULL  → actual_minutes + notes (previous behaviour)
// Also fixes completion RPC: fn_complete_pm_task did not exist in the DB;
// canonical bridge is public.fn_complete_task_instance (verified via pg_proc).
"use client";
import { useState, useEffect } from "react";
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

type PhotoItem = { path: string; previewUrl: string };

function parseChecklistItems(md: string | null): string[] {
  if (!md) return [];
  const items: string[] = [];
  for (const line of md.split("\n")) {
    const m = line.match(/^\s*[-*]\s+\[\s?\]\s+(.+)$/);
    if (m) items.push(m[1].trim());
  }
  return items;
}

export default function TaskDetail({ task, propertyId, onComplete, onClose, standalone = false }: TaskDetailProps) {
  const [completionForm, setCompletionForm] = useState({
    actual_minutes: 0,
    notes: "",
    checklist: {} as Record<string, boolean>,
    measurements: { r1: "", r2: "", r3: "" }
  });
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sopContent, setSopContent] = useState<string | null>(null);
  const [sopLoading, setSopLoading] = useState(false);

  const vtype = (task.verification_type || "none").toLowerCase();
  const isChecklist = vtype === "checklist";
  const isPhoto = vtype === "photo";
  const isMeasurement = vtype === "measurement" || vtype === "data";

  const checklistItems = isChecklist ? parseChecklistItems(sopContent) : [];
  const allChecked = checklistItems.length > 0 && checklistItems.every(i => completionForm.checklist[i]);

  useEffect(() => {
    if (!isChecklist || task.status === "completed") return;
    let cancelled = false;
    (async () => {
      setSopLoading(true);
      try {
        const sb = createClient();
        const { data } = await sb
          .from("v_pm_task_detail")
          .select("sop_content")
          .eq("property_id", propertyId)
          .eq("instance_id", task.instance_id)
          .maybeSingle();
        if (!cancelled) setSopContent(data?.sop_content ?? null);
      } catch {
        if (!cancelled) setSopContent(null);
      } finally {
        if (!cancelled) setSopLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [task.instance_id, propertyId, isChecklist, task.status]);

  async function handlePhotoFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const sb = createClient();
      const uploaded: PhotoItem[] = [];
      const now = new Date();
      const ts = now.toISOString().replace(/[-:T]/g, "").slice(0, 15).replace(".", "_");
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${propertyId}/${task.instance_id}/${ts}_${photos.length + i + 1}.${ext}`;
        const { error } = await sb.storage.from("maintenance-evidence").upload(path, file, { upsert: false });
        if (error) throw error;
        uploaded.push({ path, previewUrl: URL.createObjectURL(file) });
      }
      setPhotos(prev => [...prev, ...uploaded]);
    } catch (e: any) {
      alert("❌ Photo upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  }

  function verificationBlocked(): string | null {
    if (isChecklist) {
      if (sopLoading) return "Loading SOP checklist…";
      if (checklistItems.length === 0) return null; // no parseable items → don't block completion
      if (!allChecked) return "Complete all checklist items before submitting";
    }
    if (isPhoto && photos.length === 0) return "At least 1 photo is required before submitting";
    if (isMeasurement) {
      const { r1, r2, r3 } = completionForm.measurements;
      if (r1 === "" && r2 === "" && r3 === "") return "Enter at least one reading before submitting";
    }
    return null;
  }

  async function handleComplete() {
    if (!completionForm.actual_minutes || completionForm.actual_minutes <= 0) {
      alert("Please enter actual duration (minutes)");
      return;
    }
    const blocked = verificationBlocked();
    if (blocked) { alert(blocked); return; }
    setSubmitting(true);
    try {
      const sb = createClient();
      const { data: userData } = await sb.auth.getUser();

      const verification_data: Record<string, any> = {};
      if (isChecklist && checklistItems.length > 0) {
        verification_data.checklist = checklistItems.map(item => ({ item, checked: !!completionForm.checklist[item] }));
      }
      if (isPhoto && photos.length > 0) {
        verification_data.photo_urls = photos.map(p => p.path);
      }
      let notes = completionForm.notes || "";
      if (isMeasurement) {
        const m = {
          r1: completionForm.measurements.r1 === "" ? null : Number(completionForm.measurements.r1),
          r2: completionForm.measurements.r2 === "" ? null : Number(completionForm.measurements.r2),
          r3: completionForm.measurements.r3 === "" ? null : Number(completionForm.measurements.r3)
        };
        verification_data.measurements = m;
        notes = (notes ? notes + "\n" : "") + "Readings: " + JSON.stringify(m);
      }

      const { data, error } = await sb.rpc("fn_complete_task_instance", {
        p_instance_id: task.instance_id,
        p_completed_by: userData?.user?.id ?? null,
        p_actual_minutes: completionForm.actual_minutes,
        p_notes: notes || null,
        p_verification_data: Object.keys(verification_data).length > 0 ? verification_data : null
      });
      if (error) throw error;
      if (data === false) throw new Error("Task not in a completable state (already done or cancelled)");
      alert("✅ Task completed!");
      if (onComplete) onComplete();
      if (onClose) onClose();
    } catch (e: any) {
      alert("❌ " + e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const containerClass = standalone
    ? "min-h-screen bg-gray-50 p-6"
    : "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4";

  const blockedReason = verificationBlocked();

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
          <div className="flex gap-2 flex-wrap">
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">{task.task_code}</span>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              task.status === "completed" ? "bg-green-100 text-green-800" :
              task.status === "scheduled" ? "bg-yellow-100 text-yellow-800" :
              "bg-gray-100 text-gray-800"
            }`}>{task.status}</span>
            <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">{task.provider}</span>
            {task.verification_type && (
              <span className="inline-block px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                {isPhoto ? "📷 photo" : isChecklist ? "☑ checklist" : isMeasurement ? "📏 readings" : task.verification_type}
              </span>
            )}
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

              {isChecklist && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Verification Checklist *</label>
                  {sopLoading ? (
                    <p className="text-sm text-gray-500">Loading SOP checklist…</p>
                  ) : checklistItems.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No checklist items found in the linked SOP — complete with duration and notes.</p>
                  ) : (
                    <div className="space-y-2 border border-gray-200 rounded p-3 bg-gray-50">
                      {checklistItems.map(item => (
                        <label key={item} className="flex items-start gap-2 text-sm text-gray-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!completionForm.checklist[item]}
                            onChange={e => setCompletionForm({
                              ...completionForm,
                              checklist: { ...completionForm.checklist, [item]: e.target.checked }
                            })}
                            className="mt-0.5"
                          />
                          <span>{item}</span>
                        </label>
                      ))}
                      <p className="text-xs text-gray-500 pt-1">
                        {checklistItems.filter(i => completionForm.checklist[i]).length}/{checklistItems.length} checked
                      </p>
                    </div>
                  )}
                </div>
              )}

              {isPhoto && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Photo Evidence * (min. 1)</label>
                  <div className="flex gap-2">
                    <label className="flex-1 text-center px-3 py-2 border border-gray-300 rounded cursor-pointer bg-gray-50 hover:bg-gray-100 text-sm">
                      📷 Take Photo
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => { handlePhotoFiles(e.target.files); e.target.value = ""; }} />
                    </label>
                    <label className="flex-1 text-center px-3 py-2 border border-gray-300 rounded cursor-pointer bg-gray-50 hover:bg-gray-100 text-sm">
                      🖼 Upload
                      <input type="file" accept="image/*" multiple className="hidden"
                        onChange={e => { handlePhotoFiles(e.target.files); e.target.value = ""; }} />
                    </label>
                  </div>
                  {uploading && <p className="text-sm text-gray-500 mt-2">Uploading…</p>}
                  {photos.length > 0 && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {photos.map(p => (
                        <div key={p.path} className="relative">
                          <img src={p.previewUrl} alt="evidence" className="w-20 h-20 object-cover rounded border border-gray-300" />
                          <button
                            onClick={() => setPhotos(photos.filter(x => x.path !== p.path))}
                            className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 text-xs leading-5"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isMeasurement && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Readings *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["r1", "r2", "r3"] as const).map((k, idx) => (
                      <div key={k}>
                        <label className="block text-xs text-gray-600 mb-1">Reading {idx + 1}</label>
                        <input
                          type="number"
                          step="any"
                          value={completionForm.measurements[k]}
                          onChange={e => setCompletionForm({
                            ...completionForm,
                            measurements: { ...completionForm.measurements, [k]: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                disabled={submitting || uploading || !completionForm.actual_minutes || !!blockedReason}
                className="w-full bg-green-600 text-white py-3 rounded font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {submitting ? "Saving..." : blockedReason ? blockedReason : "✓ Complete Task"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
