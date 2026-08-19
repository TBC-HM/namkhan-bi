// app/h/[property_id]/ops/maintenance/page.tsx
// PM module v1 — unified view: asset register, calendar, task completion
// PBS directive 2026-08-06: shared spine (§0), preventive stream only
// Enhanced 2026-08-13: mobile-friendly asset capture with photo nameplate
// Enhanced 2026-08-14: task detail modal with completion flow
// Enhanced 2026-08-XX: SOP render in task modal (pm-v3-slice-2)
"use client";
import { useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type Asset = { id: number; asset_code: string; asset_name: string; category_name: string; location_name: string; status: string; manufacturer: string; model: string; maintenance_count: number; last_maintenance: string; next_maintenance: string };
type PMTask = { instance_id: string; task_id: string; task_code: string; title: string; description: string; scheduled_date: string; status: string; dept_id: number; provider: string; asset_id: number; asset_code: string; asset_name: string; estimated_minutes: number; assigned_to: string; verification_type: string; sop_doc_id: string; actual_minutes: number; completed_at: string; completed_by: string; sop_content?: string; sop_title?: string };
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
  const [sopPanelOpen, setSopPanelOpen] = useState(true);
  
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

  async function loadTaskDetail(instanceId: string) {
    const sb = createClient();
    const { data, error } = await sb
      .from("v_pm_task_detail")
      .select("*")
      .eq("instance_id", instanceId)
      .single();
    
    if (error) {
      console.error("Error loading task detail:", error);
      return null;
    }
    return data as PMTask;
  }

  async function handleTaskClick(task: PMTask) {
    // Set the basic task immediately for fast modal open
    setSelectedTask(task);
    setSopPanelOpen(true);
    
    // Load enriched detail (with SOP content) in background
    const detail = await loadTaskDetail(task.instance_id);
    if (detail) {
      setSelectedTask(detail);
    }
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
      setView("assets");
      await loadData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleCompleteTask() {
    if (!selectedTask || !completionForm.actual_minutes) {
      alert("Please enter actual minutes");
      return;
    }
    setUploading(true);
    try {
      const sb = createClient();
      const { data, error } = await sb.rpc("fn_complete_task", {
        p_instance_id: selectedTask.instance_id,
        p_actual_minutes: completionForm.actual_minutes,
        p_notes: completionForm.notes || null
      });
      if (error) throw error;
      alert("✅ Task completed!");
      setSelectedTask(null);
      setCompletionForm({ actual_minutes: 0, notes: "", photo_urls: [], checklist: {} });
      await loadData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }

  function renderAssets() {
    const sorted = [...assets].sort((a, b) => (b.maintenance_count || 0) - (a.maintenance_count || 0));
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Asset Register ({assets.length})</h2>
        </div>
        <div className="grid gap-4">
          {sorted.map(a => (
            <div key={a.id} className="border rounded-lg p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm bg-gray-200 px-2 py-1 rounded">{a.asset_code}</span>
                    <span className="font-semibold">{a.asset_name}</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {a.category_name} · {a.location_name}
                  </div>
                  {a.manufacturer && <div className="text-xs text-gray-500 mt-1">{a.manufacturer} {a.model}</div>}
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Maintenance count</div>
                  <div className="text-2xl font-bold">{a.maintenance_count || 0}</div>
                </div>
              </div>
              {a.last_maintenance && (
                <div className="mt-2 pt-2 border-t text-xs text-gray-600">
                  Last: {new Date(a.last_maintenance).toLocaleDateString()}
                  {a.next_maintenance && ` · Next: ${new Date(a.next_maintenance).toLocaleDateString()}`}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderCalendar() {
    const filtered = pmTasks.filter(t => {
      if (filterProvider !== "all" && t.provider !== filterProvider) return false;
      return true;
    });

    const upcoming = filtered.filter(t => !t.completed_at);
    const completed = filtered.filter(t => t.completed_at);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setFilterProvider("all")} className={`px-3 py-1 rounded-lg text-sm ${filterProvider==="all"?"bg-blue-600 text-white":"bg-gray-200"}`}>All</button>
          <button onClick={() => setFilterProvider("internal")} className={`px-3 py-1 rounded-lg text-sm ${filterProvider==="internal"?"bg-blue-600 text-white":"bg-gray-200"}`}>Internal</button>
          <button onClick={() => setFilterProvider("external")} className={`px-3 py-1 rounded-lg text-sm ${filterProvider==="external"?"bg-blue-600 text-white":"bg-gray-200"}`}>External</button>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">Upcoming ({upcoming.length})</h3>
          <div className="grid gap-3">
            {upcoming.map(t => (
              <div key={t.instance_id} onClick={() => handleTaskClick(t)} className="border rounded-lg p-4 hover:bg-blue-50 cursor-pointer">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-semibold">{t.title}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {t.asset_code && <span className="font-mono text-xs bg-gray-200 px-1 rounded mr-2">{t.asset_code}</span>}
                      {t.asset_name && <span className="text-xs">{t.asset_name}</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(t.scheduled_date).toLocaleDateString()} · {t.estimated_minutes}min · {t.provider}
                    </div>
                  </div>
                  <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">{t.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">Completed ({completed.length})</h3>
          <div className="grid gap-3">
            {completed.map(t => (
              <div key={t.instance_id} onClick={() => handleTaskClick(t)} className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer opacity-75">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-semibold">{t.title}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {t.asset_code && <span className="font-mono text-xs bg-gray-200 px-1 rounded mr-2">{t.asset_code}</span>}
                      {t.asset_name && <span className="text-xs">{t.asset_name}</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(t.scheduled_date).toLocaleDateString()} · {t.estimated_minutes}min · {t.provider}
                    </div>
                  </div>
                  <span className="px-2 py-1 text-xs rounded bg-green-600 text-white">✓ Done</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderCapture() {
    return (
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-4 md:p-6">
        <h2 className="text-2xl font-semibold mb-6">📷 Capture New Asset</h2>
        
        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">1. Photo Nameplate (Optional)</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              {!capturedImage && !cameraActive && (
                <div className="space-y-3">
                  <button onClick={startCamera} className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                    📸 Open Camera
                  </button>
                  <div className="text-sm text-gray-500">or</div>
                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="w-full md:w-auto px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium">
                    📁 Upload Photo
                  </button>
                </div>
              )}
              {cameraActive && (
                <div>
                  <video ref={videoRef} className="w-full rounded-lg mb-3" autoPlay playsInline />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex gap-2 justify-center">
                    <button onClick={capturePhoto} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Capture</button>
                    <button onClick={stopCamera} className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">Cancel</button>
                  </div>
                </div>
              )}
              {capturedImage && (
                <div>
                  <img src={capturedImage} className="max-w-full h-auto rounded-lg mb-3 mx-auto" style={{maxHeight:"400px"}} />
                  <button onClick={() => setCapturedImage("")} className="px-4 py-2 bg-gray-500 text-white rounded-lg">Clear</button>
                </div>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Asset Code *</label>
              <input value={captureForm.code} onChange={e => setCaptureForm({...captureForm, code: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. GEN-001" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Asset Name *</label>
              <input value={captureForm.name} onChange={e => setCaptureForm({...captureForm, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Backup Generator" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select value={captureForm.category} onChange={e => setCaptureForm({...captureForm, category: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg">
                {categories.map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <select value={captureForm.location} onChange={e => setCaptureForm({...captureForm, location: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Select location</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Manufacturer</label>
              <input value={captureForm.manufacturer} onChange={e => setCaptureForm({...captureForm, manufacturer: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Cummins" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Model</label>
              <input value={captureForm.model} onChange={e => setCaptureForm({...captureForm, model: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. C45D6" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Serial Number</label>
              <input value={captureForm.serial} onChange={e => setCaptureForm({...captureForm, serial: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="Optional" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea value={captureForm.notes} onChange={e => setCaptureForm({...captureForm, notes: e.target.value})} className="w-full px-3 py-2 border rounded-lg" rows={3} placeholder="Installation date, warranty, special considerations..."></textarea>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setView("assets")} className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium">Cancel</button>
          <button onClick={handleCapture} disabled={uploading} className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:bg-gray-400">
            {uploading ? "Saving..." : "💾 Save Asset"}
          </button>
        </div>
      </div>
    );
  }

  function renderTaskDetail() {
    if (!selectedTask) return null;
    const isCompleted = !!selectedTask.completed_at;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedTask(null)}>
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="p-6 border-b">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-2xl font-bold">{selectedTask.title}</h2>
              <button onClick={() => setSelectedTask(null)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
            </div>
            <div className="text-sm text-gray-600">
              {selectedTask.asset_code && <span className="font-mono bg-gray-200 px-2 py-1 rounded mr-2">{selectedTask.asset_code}</span>}
              {selectedTask.asset_name}
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div><span className="font-semibold">Scheduled:</span> {new Date(selectedTask.scheduled_date).toLocaleDateString()}</div>
              <div><span className="font-semibold">Estimated:</span> {selectedTask.estimated_minutes} minutes</div>
              <div><span className="font-semibold">Provider:</span> {selectedTask.provider}</div>
              <div><span className="font-semibold">Verification:</span> {selectedTask.verification_type || "None"}</div>
            </div>

            {selectedTask.description && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="font-semibold mb-2">Description</div>
                <div className="text-sm text-gray-700">{selectedTask.description}</div>
              </div>
            )}

            {/* SOP Panel */}
            {(selectedTask.sop_content || selectedTask.sop_doc_id) && (
              <div className="border rounded-lg overflow-hidden">
                <button 
                  onClick={() => setSopPanelOpen(!sopPanelOpen)} 
                  className="w-full px-4 py-3 bg-blue-50 hover:bg-blue-100 flex justify-between items-center text-left font-semibold"
                >
                  <span>📋 Procedure (SOP)</span>
                  <span className="text-xl">{sopPanelOpen ? "−" : "+"}</span>
                </button>
                {sopPanelOpen && (
                  <div className="p-4 bg-white">
                    {selectedTask.sop_content ? (
                      <pre className="text-sm whitespace-pre-wrap font-sans text-gray-800 leading-relaxed">
                        {selectedTask.sop_content}
                      </pre>
                    ) : (
                      <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded">
                        ⚠️ SOP linked but body not loaded yet
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {isCompleted ? (
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
                  <span className="text-xl">✓</span> Completed
                </div>
                <div className="text-sm space-y-1">
                  <div><span className="font-semibold">Completed:</span> {new Date(selectedTask.completed_at).toLocaleString()}</div>
                  <div><span className="font-semibold">Actual time:</span> {selectedTask.actual_minutes} minutes</div>
                </div>
              </div>
            ) : (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Complete Task</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Actual Minutes *</label>
                    <input 
                      type="number" 
                      value={completionForm.actual_minutes || ""} 
                      onChange={e => setCompletionForm({...completionForm, actual_minutes: Number(e.target.value)})} 
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder={`Est. ${selectedTask.estimated_minutes} min`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Notes</label>
                    <textarea 
                      value={completionForm.notes} 
                      onChange={e => setCompletionForm({...completionForm, notes: e.target.value})} 
                      className="w-full px-3 py-2 border rounded-lg" 
                      rows={3}
                      placeholder="Any observations, issues, or follow-up needed..."
                    />
                  </div>

                  <button 
                    onClick={handleCompleteTask} 
                    disabled={uploading || !completionForm.actual_minutes}
                    className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:bg-gray-400"
                  >
                    {uploading ? "Saving..." : "✓ Mark Complete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-600">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold">🔧 Maintenance</h1>
          <div className="flex gap-2">
            <button onClick={() => setView("calendar")} className={`px-4 py-2 rounded-lg font-medium ${view==="calendar"?"bg-blue-600 text-white":"bg-white border"}`}>Calendar</button>
            <button onClick={() => setView("assets")} className={`px-4 py-2 rounded-lg font-medium ${view==="assets"?"bg-blue-600 text-white":"bg-white border"}`}>Assets</button>
            <button onClick={() => setView("capture")} className={`px-4 py-2 rounded-lg font-medium ${view==="capture"?"bg-green-600 text-white":"bg-white border"}`}>+ Capture</button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          {view === "calendar" && renderCalendar()}
          {view === "assets" && renderAssets()}
          {view === "capture" && renderCapture()}
        </div>
      </div>

      {selectedTask && renderTaskDetail()}
    </div>
  );
}
