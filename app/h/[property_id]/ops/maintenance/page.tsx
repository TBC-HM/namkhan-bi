// app/h/[property_id]/ops/maintenance/page.tsx
// PM module v1 — unified view: asset register, calendar, task completion
// PBS directive 2026-08-06: shared spine (§0), preventive stream only
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
      loadData();
      setView("assets");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleCompleteTask() {
    if (!selectedTask || !completionForm.actual_minutes) {
      alert("Actual minutes is required");
      return;
    }
    setUploading(true);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const verification_data = {
        photos: completionForm.photo_urls,
        checklist: completionForm.checklist,
        type: selectedTask.verification_type
      };

      const { data, error } = await sb.rpc("fn_complete_task_instance", {
        p_instance_id: selectedTask.instance_id,
        p_completed_by: user.id,
        p_actual_minutes: completionForm.actual_minutes,
        p_notes: completionForm.notes || null,
        p_verification_data: verification_data
      });
      
      if (error) throw error;
      alert(`✅ Task "${selectedTask.title}" completed!`);
      setSelectedTask(null);
      setCompletionForm({ actual_minutes: 0, notes: "", photo_urls: [], checklist: {} });
      loadData();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  const filtered = pmTasks.filter(t => {
    if (filterProvider !== "all" && t.provider !== filterProvider) return false;
    if (filterDept !== "all" && String(t.dept_id) !== filterDept) return false;
    return true;
  });

  const overdue = filtered.filter(t => t.status === "scheduled" && new Date(t.scheduled_date) < new Date() && !t.completed_at);
  const upcoming = filtered.filter(t => (t.status === "scheduled" && new Date(t.scheduled_date) >= new Date()) || t.status === "completed");

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold">🔧 Preventive Maintenance</h1>
            <p className="text-gray-600 mt-1">Namkhan property · {pmTasks.length} tasks scheduled</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setView("calendar")} className={`px-4 py-2 rounded-lg font-medium ${view==="calendar"?"bg-blue-600 text-white":"bg-white text-gray-700 border"}`}>
              📅 Calendar
            </button>
            <button onClick={() => setView("assets")} className={`px-4 py-2 rounded-lg font-medium ${view==="assets"?"bg-blue-600 text-white":"bg-white text-gray-700 border"}`}>
              📦 Assets ({assets.length})
            </button>
            <button onClick={() => setView("capture")} className={`px-4 py-2 rounded-lg font-medium ${view==="capture"?"bg-blue-600 text-white":"bg-white text-gray-700 border"}`}>
              📷 Capture
            </button>
          </div>
        </div>

        {view === "assets" && renderAssets()}
        {view === "calendar" && renderCalendar()}
        {view === "capture" && renderCapture()}
        {selectedTask && renderTaskDetail()}
      </div>
    </div>
  );

  function renderAssets() {
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="text-left p-3 font-semibold">Code</th>
              <th className="text-left p-3 font-semibold">Asset Name</th>
              <th className="text-left p-3 font-semibold">Category</th>
              <th className="text-left p-3 font-semibold">Location</th>
              <th className="text-left p-3 font-semibold">Manufacturer</th>
              <th className="text-left p-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {assets.map(a => (
              <tr key={a.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-mono text-sm font-semibold">{a.asset_code}</td>
                <td className="p-3">{a.asset_name}</td>
                <td className="p-3 text-sm text-gray-600">{a.category_name}</td>
                <td className="p-3 text-sm text-gray-600">{a.location_name}</td>
                <td className="p-3 text-sm text-gray-600">{a.manufacturer} {a.model}</td>
                <td className="p-3"><span className={`px-2 py-1 text-xs rounded ${a.status==="active"?"bg-green-100 text-green-800":"bg-gray-100"}`}>{a.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderCalendar() {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <select value={filterProvider} onChange={e => setFilterProvider(e.target.value as any)} className="px-3 py-2 border rounded-lg">
              <option value="all">All providers</option>
              <option value="internal">Internal only</option>
              <option value="external">External only</option>
            </select>
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="px-3 py-2 border rounded-lg">
              <option value="all">All departments</option>
            </select>
          </div>
        </div>

        {overdue.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-lg font-semibold text-red-700 mb-3">⚠️ Overdue ({overdue.length})</h3>
            <div className="space-y-2">
              {overdue.map(t => (
                <div key={t.instance_id} onClick={() => setSelectedTask(t)} className="border-l-4 border-red-500 bg-red-50 p-3 rounded cursor-pointer hover:bg-red-100">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-semibold">{t.title}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {t.asset_code && <span className="font-mono text-xs bg-gray-200 px-1 rounded mr-2">{t.asset_code}</span>}
                        {t.asset_name && <span className="text-xs">{t.asset_name}</span>}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Due: {new Date(t.scheduled_date).toLocaleDateString()} · {t.estimated_minutes}min · {t.provider}
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-red-600 text-white text-xs rounded font-semibold">OVERDUE</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold mb-3">Upcoming & Completed ({upcoming.length})</h3>
          <div className="space-y-2">
            {upcoming.map(t => (
              <div key={t.instance_id} onClick={() => setSelectedTask(t)} className="border-l-4 border-blue-500 bg-blue-50 p-3 rounded cursor-pointer hover:bg-blue-100">
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
                  <span className={`px-2 py-1 text-xs rounded ${t.completed_at?"bg-green-600 text-white":"bg-blue-100 text-blue-800"}`}>
                    {t.completed_at ? "✓ Done" : t.status}
                  </span>
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
            <textarea value={captureForm.notes} onChange={e => setCaptureForm({...captureForm, notes: e.target.value})} className="w-full px-3 py-2 border rounded-lg" rows={3} placeholder="Additional details..." />
          </div>
        </div>

        <button onClick={handleCapture} disabled={uploading} className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:bg-gray-400">
          {uploading ? "Creating..." : "✓ Create Asset"}
        </button>
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

                  {selectedTask.verification_type === "checklist" && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="font-semibold mb-2">Checklist</div>
                      <div className="text-sm text-gray-600">Checklist items would be dynamically loaded from SOP here.</div>
                    </div>
                  )}

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
}
