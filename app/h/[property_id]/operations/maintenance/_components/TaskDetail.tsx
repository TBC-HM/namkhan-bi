// app/h/[property_id]/operations/maintenance/_components/TaskDetail.tsx
// Extracted from ops/maintenance/page.tsx for slice 5 deep-link routes
// PM v3 slice 3 — completion form branches on verification_type:
//   checklist    → checkboxes parsed from SOP markdown "- [ ]" lines (all required)
//   photo        → camera/file upload to 'maintenance-evidence' bucket (≥1 required)
//   measurement / data → 3 generic numeric readings
//   none / NULL  → actual_minutes + notes (previous behaviour)
// Also fixes completion RPC: fn_complete_pm_task did not exist in the DB;
// canonical bridge is public.fn_complete_task_instance (verified via pg_proc).
// PM v3 slice 6 — design-system conformance:
//   - CONTENT-ONLY component now: the center-modal overlay chrome was removed.
//     The hub renders this inside the design-system <Drawer> (right side, §3.4);
//     the /tasks/[instance_id] route renders it inside a paper-white card.
//   - All colors via var(--*) tokens, status via global .status-pill classes,
//     buttons via global .btn-primary, zero Tailwind color classes, no emoji.
"use client";
import { useState, useEffect, type CSSProperties } from "react";
import { createClient } from "@/lib/supabase/client";
import * as S from "./pmStyles";

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
  /** true = full-page route context (renders the title header);
   *  false = drawer context (Drawer supplies title + close). */
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
      alert("Photo upload failed: " + e.message);
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
      alert("Task completed");
      if (onComplete) onComplete();
      if (onClose) onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const blockedReason = verificationBlocked();

  const fieldLabel: CSSProperties = { display: "block", marginBottom: 4, fontWeight: 500, ...S.label };

  return (
    <div>
      {standalone && (
        <div className="flex justify-between items-start mb-4">
          <h2 style={{ ...S.sectionTitle, fontSize: "var(--t-xl)" }}>{task.title}</h2>
        </div>
      )}

      <div className="space-y-3 mb-6">
        <div className="flex gap-2 flex-wrap">
          <span className="status-pill pill-info">{task.task_code}</span>
          <span className={S.statusPillClass(task.status, task.scheduled_date)}>{task.status}</span>
          <span className="status-pill pill-info">{task.provider}</span>
          {task.verification_type && (
            <span className="status-pill pill-pending">
              {isPhoto ? "photo evidence" : isChecklist ? "checklist" : isMeasurement ? "readings" : task.verification_type}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span style={S.label}>Asset:</span>
            <p style={S.value}>{task.asset_code} – {task.asset_name}</p>
          </div>
          <div>
            <span style={S.label}>Scheduled:</span>
            <p style={{ ...S.value, ...S.num }}>{task.scheduled_date}</p>
          </div>
          <div>
            <span style={S.label}>Estimated:</span>
            <p style={{ ...S.value, ...S.num }}>{task.estimated_minutes} min</p>
          </div>
          <div>
            <span style={S.label}>Assigned:</span>
            <p style={S.value}>{task.assigned_to || "Unassigned"}</p>
          </div>
        </div>

        {task.description && (
          <div className="mt-4">
            <span style={S.label}>Description:</span>
            <p className="mt-1" style={{ color: "var(--ink-soft)", fontSize: "var(--t-md)" }}>{task.description}</p>
          </div>
        )}

        {task.sop_doc_id && (
          <div className="mt-4" style={S.inset}>
            <span style={{ fontSize: "var(--t-md)", color: "var(--ink)" }}>SOP: {task.sop_doc_id}</span>
          </div>
        )}
      </div>

      {task.status === "completed" ? (
        <div className="mt-6" style={{ ...S.inset, borderColor: "var(--st-good-bd)", background: "var(--st-good-bg)" }}>
          <p style={{ color: "var(--moss)", fontWeight: 600, fontSize: "var(--t-md)", margin: 0 }}>Completed</p>
          <div className="mt-2" style={{ fontSize: "var(--t-md)", color: "var(--ink-soft)" }}>
            <p style={S.num}>Duration: {task.actual_minutes} min</p>
            <p style={S.num}>Completed: {task.completed_at}</p>
            <p>By: {task.completed_by}</p>
          </div>
        </div>
      ) : (
        <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--hairline)" }}>
          <h3 style={{ ...S.sectionTitle, marginBottom: 16 }}>Complete Task</h3>
          <div className="space-y-4">

            {isChecklist && (
              <div>
                <label style={fieldLabel}>Verification Checklist *</label>
                {sopLoading ? (
                  <p style={S.muted}>Loading SOP checklist…</p>
                ) : checklistItems.length === 0 ? (
                  <p style={{ ...S.muted, fontStyle: "italic" }}>No checklist items found in the linked SOP — complete with duration and notes.</p>
                ) : (
                  <div className="space-y-2" style={S.inset}>
                    {checklistItems.map(item => (
                      <label key={item} className="flex items-start gap-2 cursor-pointer" style={{ fontSize: "var(--t-md)", color: "var(--ink)" }}>
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
                    <p className="pt-1" style={{ ...S.label, ...S.num }}>
                      {checklistItems.filter(i => completionForm.checklist[i]).length}/{checklistItems.length} checked
                    </p>
                  </div>
                )}
              </div>
            )}

            {isPhoto && (
              <div>
                <label style={fieldLabel}>Photo Evidence * (min. 1)</label>
                <div className="flex gap-2">
                  <label className="flex-1 text-center cursor-pointer" style={{ ...S.inset, padding: "8px 12px", fontSize: "var(--t-md)", color: "var(--ink)" }}>
                    Take Photo
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e => { handlePhotoFiles(e.target.files); e.target.value = ""; }} />
                  </label>
                  <label className="flex-1 text-center cursor-pointer" style={{ ...S.inset, padding: "8px 12px", fontSize: "var(--t-md)", color: "var(--ink)" }}>
                    Upload
                    <input type="file" accept="image/*" multiple className="hidden"
                      onChange={e => { handlePhotoFiles(e.target.files); e.target.value = ""; }} />
                  </label>
                </div>
                {uploading && <p className="mt-2" style={S.muted}>Uploading…</p>}
                {photos.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {photos.map(p => (
                      <div key={p.path} className="relative">
                        <img src={p.previewUrl} alt="evidence" className="w-20 h-20 object-cover" style={{ borderRadius: 6, border: "1px solid var(--hairline)" }} />
                        <button
                          onClick={() => setPhotos(photos.filter(x => x.path !== p.path))}
                          className="absolute -top-2 -right-2 rounded-full w-5 h-5 text-xs leading-5"
                          style={{ background: "var(--oxblood)", color: "var(--paper-warm)", border: "none" }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isMeasurement && (
              <div>
                <label style={fieldLabel}>Readings *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["r1", "r2", "r3"] as const).map((k, idx) => (
                    <div key={k}>
                      <label style={{ ...S.label, display: "block", marginBottom: 4, fontSize: "var(--t-xs)" }}>Reading {idx + 1}</label>
                      <input
                        type="number"
                        step="any"
                        value={completionForm.measurements[k]}
                        onChange={e => setCompletionForm({
                          ...completionForm,
                          measurements: { ...completionForm.measurements, [k]: e.target.value }
                        })}
                        style={S.input}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label style={fieldLabel}>Actual Duration (minutes) *</label>
              <input
                type="number"
                value={completionForm.actual_minutes || ""}
                onChange={e => setCompletionForm({...completionForm, actual_minutes: Number(e.target.value)})}
                style={S.input}
                min="1"
                required
              />
            </div>
            <div>
              <label style={fieldLabel}>Notes</label>
              <textarea
                value={completionForm.notes}
                onChange={e => setCompletionForm({...completionForm, notes: e.target.value})}
                style={S.input}
                rows={3}
                placeholder="Any observations or issues..."
              />
            </div>
            <button
              onClick={handleComplete}
              disabled={submitting || uploading || !completionForm.actual_minutes || !!blockedReason}
              className="btn-primary w-full"
              style={{ opacity: (submitting || uploading || !completionForm.actual_minutes || blockedReason) ? 0.5 : 1 }}
            >
              {submitting ? "Saving..." : blockedReason ? blockedReason : "Complete Task"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
