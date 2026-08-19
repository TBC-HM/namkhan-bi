// app/h/[property_id]/operations/maintenance/page.tsx
// PM module v2 — canonical route (was Donna stub, now the real page)
// Directive 2026-08-21: /operations/maintenance is canonical; /ops/maintenance redirects here
// Enhanced 2026-08-13: mobile-friendly asset capture with photo nameplate
// Enhanced 2026-08-14: task detail modal with completion flow
"use client";
import { useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type Asset = { id: number; asset_code: string; asset_name: string; category_name: string; location_name: string; status: string; manufacturer: string; model: string; maintenance_count: number; last_maintenance: string; next_maintenance: string };
type PMTask = { instance_id: string; task_id: string; task_code: string; title: string; description: string; scheduled_date: string; status: string; dept_id: number; provider: string; asset_id: number; asset_code: string; asset_name: string; estimated_minutes: number; assigned_to: string; verification_type: string; sop_doc_id: string; actual_minutes: number; completed_at: string; completed_by: string };
type Category = { id: number; category_name: string; category_code: string };
type Location = { id: number; location_name: string; location_type: string };

export default function MaintenancePage() {
  const params = useParams();
  const propertyId = Number(params?.property_id);
  const [view, setView] = useState<"calendar"|"assets"|"capture">("calendar");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pmTasks, setPmTasks] = useState<PMTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [captureForm, setCaptureForm] = useState({ code: "", name: "", category: 16, location: "", manufacturer: "", model: "", serial: "", notes: "", photoUrl: "" });
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [uploading, setUploading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [filterProvider, setFilterProvider] = useState<"all"|"internal"|"external">("all");
  const [filterDept, setFilterDept] = useState<"all"|string>("all");
  const [selectedTask, setSelectedTask] = useState<PMTask|null>(null);
  const [completionForm, setCompletionForm] = useState({ actual_minutes: 0, notes: "", photo_urls: [] as string[], checklist: {} as Record<string,boolean> });
  
  useEffect(() => {
    loadData();
  }, [propertyId]);

  async function loadData() {
    const sb = createClient();
    const [assetRes, catRes, locRes, pmRes] = await Promise.all([
      sb.from("v_asset_register").select("*").eq("property_id", propertyId),
      sb.from("v_asset_categories").select("id,category_name,category_code"),
      sb.from("v_asset_locations").select("id,location_name,location_type").eq("property_id", propertyId),
      sb.from("v_pm_calendar").select("*").eq("property_id", propertyId).gte("scheduled_date", new Date(Date.now() - 30*24*60*60*1000).toISOString().split("T")[0]).order("scheduled_date", {ascending:true}).limit(200)
    ]);
    if (assetRes.data) setAssets(assetRes.data as Asset[]);
    if (catRes.data) setCategories(catRes.data as Category[]);
    if (locRes.data) setLocations(locRes.data as Location[]);
    if (pmRes.data) setPmTasks(pmRes.data as PMTask[]);
    setLoading(false);
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      alert("Camera access denied or unavailable. Use file upload instead.");
    }
  }

  function stopCamera() {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(dataUrl);
    stopCamera();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCapturedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleCapture() {
    if (!captureForm.code || !captureForm.name) {
      alert("Asset code and name are required");
      return;
    }
    setUploading(true);
    try {
      const sb = createClient();
      const { data, error } = await sb.rpc("fn_create_fixed_asset", {
        p_property_id: propertyId,
        p_asset_code: captureForm.code,
        p_asset_name: captureForm.name,
        p_category_id: captureForm.category,
        p_location_id: captureForm.location ? Number(captureForm.location) : null,
        p_manufacturer: captureForm.manufacturer || null,
        p_model: captureForm.model || null,
        p_serial_number: captureForm.serial || null,
        p_notes: captureForm.notes || null
      });
      if (error) throw error;
      alert(`✅ Asset ${captureForm.code} created!`);
      setCaptureForm({ code: "", name: "", category: 16, location: "", manufacturer: "", model: "", serial: "", notes: "", photoUrl: "" });
      setCapturedImage("");
      await loadData();
      setView("assets");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleTaskComplete() {
    if (!selectedTask) return;
    const sb = createClient();
    const { error } = await sb.rpc("fn_complete_pm_task", {
      p_instance_id: selectedTask.instance_id,
      p_actual_minutes: completionForm.actual_minutes || null,
      p_notes: completionForm.notes || null
    });
    if (error) {
      alert(`Error: ${error.message}`);
      return;
    }
    alert("✅ Task completed!");
    setSelectedTask(null);
    setCompletionForm({ actual_minutes: 0, notes: "", photo_urls: [], checklist: {} });
    await loadData();
  }

  const filteredTasks = pmTasks.filter(t => {
    if (filterProvider === "internal" && t.provider !== "internal") return false;
    if (filterProvider === "external" && t.provider !== "external") return false;
    if (filterDept !== "all" && String(t.dept_id) !== filterDept) return false;
    return true;
  });

  const upcomingTasks = filteredTasks.filter(t => t.status === "scheduled" && new Date(t.scheduled_date) >= new Date());
  const overdueTasks = filteredTasks.filter(t => t.status === "scheduled" && new Date(t.scheduled_date) < new Date());
  const completedTasks = filteredTasks.filter(t => t.status === "completed");

  if (loading) {
    return (
      <div style={{ padding: 40, fontFamily: "var(--font-display)", fontSize: 15, color: "var(--fg-muted)" }}>
        Loading maintenance data…
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 40px", fontFamily: "var(--font-display)", fontSize: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>Maintenance</h1>
        <div style={{ flex: 1 }} />
        <button onClick={() => setView("calendar")} style={{ padding: "8px 16px", background: view === "calendar" ? "var(--brand)" : "transparent", color: view === "calendar" ? "white" : "var(--fg)", border: "1px solid var(--divider)", borderRadius: 6, cursor: "pointer" }}>Calendar</button>
        <button onClick={() => setView("assets")} style={{ padding: "8px 16px", background: view === "assets" ? "var(--brand)" : "transparent", color: view === "assets" ? "white" : "var(--fg)", border: "1px solid var(--divider)", borderRadius: 6, cursor: "pointer" }}>Assets</button>
        <button onClick={() => setView("capture")} style={{ padding: "8px 16px", background: view === "capture" ? "var(--brand)" : "transparent", color: view === "capture" ? "white" : "var(--fg)", border: "1px solid var(--divider)", borderRadius: 6, cursor: "pointer" }}>+ Capture</button>
      </div>

      {view === "calendar" && (
        <div>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <select value={filterProvider} onChange={e => setFilterProvider(e.target.value as any)} style={{ padding: "6px 12px", border: "1px solid var(--divider)", borderRadius: 6, background: "var(--bg)", color: "var(--fg)" }}>
              <option value="all">All providers</option>
              <option value="internal">Internal only</option>
              <option value="external">External only</option>
            </select>
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ padding: "6px 12px", border: "1px solid var(--divider)", borderRadius: 6, background: "var(--bg)", color: "var(--fg)" }}>
              <option value="all">All departments</option>
              <option value="4">Operations</option>
              <option value="6">Engineering</option>
            </select>
          </div>

          {overdueTasks.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--st-bad)", marginBottom: 12 }}>Overdue ({overdueTasks.length})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {overdueTasks.map(t => (
                  <div key={t.instance_id} onClick={() => setSelectedTask(t)} style={{ padding: 12, border: "1px solid var(--st-bad)", borderRadius: 8, cursor: "pointer", background: "var(--bg)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <strong>{t.task_code}</strong>
                      <span style={{ fontSize: 12, color: "var(--st-bad)" }}>{t.scheduled_date}</span>
                    </div>
                    <div style={{ color: "var(--fg-muted)", fontSize: 13 }}>{t.title}</div>
                    <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>{t.asset_code} · {t.asset_name} · {t.provider}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Upcoming ({upcomingTasks.length})</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {upcomingTasks.slice(0, 20).map(t => (
                <div key={t.instance_id} onClick={() => setSelectedTask(t)} style={{ padding: 12, border: "1px solid var(--divider)", borderRadius: 8, cursor: "pointer", background: "var(--bg)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <strong>{t.task_code}</strong>
                    <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>{t.scheduled_date}</span>
                  </div>
                  <div style={{ color: "var(--fg-muted)", fontSize: 13 }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>{t.asset_code} · {t.asset_name} · {t.provider}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Recently completed ({completedTasks.length})</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {completedTasks.slice(0, 10).map(t => (
                <div key={t.instance_id} style={{ padding: 12, border: "1px solid var(--divider)", borderRadius: 8, background: "var(--bg)", opacity: 0.7 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <strong>{t.task_code}</strong>
                    <span style={{ fontSize: 12, color: "var(--st-good)" }}>✓ {t.completed_at?.split("T")[0]}</span>
                  </div>
                  <div style={{ color: "var(--fg-muted)", fontSize: 13 }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>{t.asset_code} · {t.completed_by}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === "assets" && (
        <div>
          <div style={{ marginBottom: 16, color: "var(--fg-muted)" }}>
            {assets.length} assets registered · showing maintenance schedule
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
            {assets.map(a => (
              <div key={a.id} style={{ padding: 12, border: "1px solid var(--divider)", borderRadius: 8, background: "var(--bg)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <strong>{a.asset_code}</strong>
                  <span style={{ fontSize: 11, padding: "2px 6px", background: a.status === "operational" ? "var(--st-good)" : "var(--st-bad)", color: "white", borderRadius: 4 }}>{a.status}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--fg-muted)", marginBottom: 4 }}>{a.asset_name}</div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>{a.category_name} · {a.location_name}</div>
                {a.manufacturer && <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 4 }}>{a.manufacturer} {a.model}</div>}
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--divider)", fontSize: 11 }}>
                  <div>Maintenance count: {a.maintenance_count || 0}</div>
                  {a.last_maintenance && <div style={{ color: "var(--fg-muted)" }}>Last: {a.last_maintenance}</div>}
                  {a.next_maintenance && <div style={{ color: "var(--brass)" }}>Next: {a.next_maintenance}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "capture" && (
        <div style={{ maxWidth: 600 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Quick Asset Capture</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Asset Code *</label>
              <input type="text" value={captureForm.code} onChange={e => setCaptureForm({...captureForm, code: e.target.value})} style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--divider)", borderRadius: 6, background: "var(--bg)", color: "var(--fg)" }} />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Asset Name *</label>
              <input type="text" value={captureForm.name} onChange={e => setCaptureForm({...captureForm, name: e.target.value})} style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--divider)", borderRadius: 6, background: "var(--bg)", color: "var(--fg)" }} />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Category</label>
              <select value={captureForm.category} onChange={e => setCaptureForm({...captureForm, category: Number(e.target.value)})} style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--divider)", borderRadius: 6, background: "var(--bg)", color: "var(--fg)" }}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Location</label>
              <select value={captureForm.location} onChange={e => setCaptureForm({...captureForm, location: e.target.value})} style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--divider)", borderRadius: 6, background: "var(--bg)", color: "var(--fg)" }}>
                <option value="">Select location</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Manufacturer</label>
              <input type="text" value={captureForm.manufacturer} onChange={e => setCaptureForm({...captureForm, manufacturer: e.target.value})} style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--divider)", borderRadius: 6, background: "var(--bg)", color: "var(--fg)" }} />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Model</label>
              <input type="text" value={captureForm.model} onChange={e => setCaptureForm({...captureForm, model: e.target.value})} style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--divider)", borderRadius: 6, background: "var(--bg)", color: "var(--fg)" }} />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Serial Number</label>
              <input type="text" value={captureForm.serial} onChange={e => setCaptureForm({...captureForm, serial: e.target.value})} style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--divider)", borderRadius: 6, background: "var(--bg)", color: "var(--fg)" }} />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Notes</label>
              <textarea value={captureForm.notes} onChange={e => setCaptureForm({...captureForm, notes: e.target.value})} rows={3} style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--divider)", borderRadius: 6, background: "var(--bg)", color: "var(--fg)", fontFamily: "inherit" }} />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 500 }}>Nameplate Photo (optional)</label>
              {!capturedImage && !cameraActive && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={startCamera} style={{ padding: "8px 16px", background: "var(--brand)", color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}>📷 Use Camera</button>
                  <button onClick={() => fileInputRef.current?.click()} style={{ padding: "8px 16px", background: "var(--bg)", color: "var(--fg)", border: "1px solid var(--divider)", borderRadius: 6, cursor: "pointer" }}>📁 Upload File</button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} style={{ display: "none" }} />
                </div>
              )}
              {cameraActive && (
                <div>
                  <video ref={videoRef} style={{ width: "100%", maxWidth: 400, border: "1px solid var(--divider)", borderRadius: 8, marginBottom: 8 }} />
                  <canvas ref={canvasRef} style={{ display: "none" }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={capturePhoto} style={{ padding: "8px 16px", background: "var(--brand)", color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}>Capture</button>
                    <button onClick={stopCamera} style={{ padding: "8px 16px", background: "var(--bg)", color: "var(--fg)", border: "1px solid var(--divider)", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              )}
              {capturedImage && (
                <div>
                  <img src={capturedImage} alt="Captured" style={{ width: "100%", maxWidth: 400, border: "1px solid var(--divider)", borderRadius: 8, marginBottom: 8 }} />
                  <button onClick={() => setCapturedImage("")} style={{ padding: "6px 12px", background: "var(--bg)", color: "var(--fg)", border: "1px solid var(--divider)", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Remove</button>
                </div>
              )}
            </div>

            <button onClick={handleCapture} disabled={uploading} style={{ padding: "12px 24px", background: uploading ? "var(--fg-muted)" : "var(--brand)", color: "white", border: "none", borderRadius: 6, cursor: uploading ? "not-allowed" : "pointer", fontWeight: 600, marginTop: 8 }}>
              {uploading ? "Creating…" : "Create Asset"}
            </button>
          </div>
        </div>
      )}

      {selectedTask && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setSelectedTask(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg)", padding: 24, borderRadius: 12, maxWidth: 600, width: "90%", maxHeight: "80vh", overflow: "auto" }}>
            <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>{selectedTask.task_code}</h3>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 15, marginBottom: 8 }}>{selectedTask.title}</div>
              <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>{selectedTask.description}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16, fontSize: 13 }}>
              <div><strong>Asset:</strong> {selectedTask.asset_code}</div>
              <div><strong>Scheduled:</strong> {selectedTask.scheduled_date}</div>
              <div><strong>Provider:</strong> {selectedTask.provider}</div>
              <div><strong>Est. time:</strong> {selectedTask.estimated_minutes} min</div>
            </div>
            {selectedTask.status === "scheduled" && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--divider)" }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Complete Task</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 12 }}>Actual minutes</label>
                    <input type="number" value={completionForm.actual_minutes} onChange={e => setCompletionForm({...completionForm, actual_minutes: Number(e.target.value)})} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--divider)", borderRadius: 6, background: "var(--bg)", color: "var(--fg)" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 12 }}>Notes</label>
                    <textarea value={completionForm.notes} onChange={e => setCompletionForm({...completionForm, notes: e.target.value})} rows={3} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--divider)", borderRadius: 6, background: "var(--bg)", color: "var(--fg)", fontFamily: "inherit" }} />
                  </div>
                  <button onClick={handleTaskComplete} style={{ padding: "10px 20px", background: "var(--st-good)", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Mark Complete</button>
                </div>
              </div>
            )}
            <button onClick={() => setSelectedTask(null)} style={{ marginTop: 16, padding: "8px 16px", background: "var(--bg)", color: "var(--fg)", border: "1px solid var(--divider)", borderRadius: 6, cursor: "pointer", width: "100%" }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
