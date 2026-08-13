// app/h/[property_id]/ops/maintenance/page.tsx
// PM module v1 — unified view: asset register, calendar, task completion
// PBS directive 2026-08-06: shared spine (§0), preventive stream only
// Enhanced 2026-08-13: mobile-friendly asset capture with photo nameplate
"use client";
import { useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type Asset = { id: number; asset_code: string; asset_name: string; category_name: string; location_name: string; status: string; manufacturer: string; model: string; maintenance_count: number; last_maintenance: string; next_maintenance: string };
type PMTask = { instance_id: string; task_code: string; title: string; scheduled_date: string; status: string; dept_id: number; provider: string; asset_code: string; asset_name: string; estimated_minutes: number; assigned_to: string };
type Category = { id: number; category_name: string; category_code: string };
type Location = { id: number; location_name: string; location_type: string };

export default function MaintenancePage() {
  const params = useParams();
  const propertyId = Number(params?.property_id);
  const [view, setView] = useState<"calendar"|"assets"|"capture">("assets");
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
  
  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [assetRes, catRes, locRes, pmRes] = await Promise.all([
        sb.from("v_asset_register").select("*").eq("property_id", propertyId),
        sb.from("v_asset_categories").select("id,category_name,category_code"),
        sb.from("v_asset_locations").select("id,location_name,location_type").eq("property_id", propertyId),
        sb.from("v_pm_calendar").select("*").eq("property_id", propertyId).gte("scheduled_date", new Date().toISOString().split("T")[0]).order("scheduled_date", {ascending:true}).limit(100)
      ]);
      if (assetRes.data) setAssets(assetRes.data as Asset[]);
      if (catRes.data) setCategories(catRes.data as Category[]);
      if (locRes.data) setLocations(locRes.data as Location[]);
      if (pmRes.data) setPmTasks(pmRes.data as PMTask[]);
      setLoading(false);
    }
    if (propertyId) load();
  }, [propertyId]);

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
    // Simple OCR hint: in production, call an edge function with Vision API here
    // For now, user manually fills fields from the captured photo
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
    if (!captureForm.code || !captureForm.name) return alert("Asset code and name are required");
    const sb = createClient();
    setUploading(true);
    try {
      const { data, error } = await sb.rpc("fn_create_fixed_asset", {
        p_property_id: propertyId,
        p_asset_code: captureForm.code.trim().toUpperCase(),
        p_asset_name: captureForm.name.trim(),
        p_category_id: Number(captureForm.category),
        p_manufacturer: captureForm.manufacturer.trim() || null,
        p_model: captureForm.model.trim() || null,
        p_serial_number: captureForm.serial.trim() || null,
        p_location_id: captureForm.location ? Number(captureForm.location) : null,
        p_notes: captureForm.notes.trim() || null
      });
      if (error) throw error;
      alert(`✅ Asset ${captureForm.code} created with ID ${data}`);
      setCaptureForm({ code: "", name: "", category: 16, location: "", manufacturer: "", model: "", serial: "", notes: "", photoUrl: "" });
      setCapturedImage("");
      setView("assets");
      const res = await sb.from("v_asset_register").select("*").eq("property_id", propertyId);
      if (res.data) setAssets(res.data as Asset[]);
    } catch (err: any) {
      alert("Error creating asset: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  function renderAssetRegister() {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Fixed Assets ({assets.length})</h2>
          <button onClick={() => setView("capture")} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
            <span className="text-xl">📷</span> Add Asset
          </button>
        </div>
        {assets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">No assets registered yet.</p>
            <p className="text-sm">Start by capturing your first asset with photo documentation.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="p-2 text-left font-semibold">Code</th>
                  <th className="p-2 text-left font-semibold">Name</th>
                  <th className="p-2 text-left font-semibold">Category</th>
                  <th className="p-2 text-left font-semibold">Location</th>
                  <th className="p-2 text-left font-semibold">Manufacturer</th>
                  <th className="p-2 text-left font-semibold">Model</th>
                  <th className="p-2 text-left font-semibold">Status</th>
                  <th className="p-2 text-left font-semibold">Maintenance</th>
                </tr>
              </thead>
              <tbody>
                {assets.map(a => (
                  <tr key={a.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-mono text-xs font-semibold text-blue-700">{a.asset_code}</td>
                    <td className="p-2 font-medium">{a.asset_name}</td>
                    <td className="p-2 text-xs text-gray-600">{a.category_name}</td>
                    <td className="p-2 text-xs text-gray-600">{a.location_name || "—"}</td>
                    <td className="p-2 text-xs">{a.manufacturer || "—"}</td>
                    <td className="p-2 text-xs">{a.model || "—"}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${a.status==="active"?"bg-green-100 text-green-800":"bg-gray-100 text-gray-800"}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="p-2 text-xs">
                      {a.maintenance_count > 0 ? (
                        <div>
                          <div className="text-gray-600">{a.maintenance_count} records</div>
                          <div className="text-xs text-gray-400">Last: {a.last_maintenance ? new Date(a.last_maintenance).toLocaleDateString() : "—"}</div>
                          {a.next_maintenance && <div className="text-xs text-blue-600">Next: {new Date(a.next_maintenance).toLocaleDateString()}</div>}
                        </div>
                      ) : (
                        <span className="text-gray-400">No history</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  function renderPMCalendar() {
    const filtered = pmTasks.filter(t => {
      if (filterProvider !== "all" && t.provider !== filterProvider) return false;
      if (filterDept !== "all" && String(t.dept_id) !== filterDept) return false;
      return true;
    });
    const overdue = filtered.filter(t => t.status !== "completed" && new Date(t.scheduled_date) < new Date());
    const upcoming = filtered.filter(t => t.status !== "completed" && new Date(t.scheduled_date) >= new Date());

    return (
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h2 className="text-xl font-semibold">Preventive Maintenance Calendar</h2>
          <div className="flex flex-wrap gap-2">
            <select value={filterProvider} onChange={e => setFilterProvider(e.target.value as any)} className="px-3 py-1 border rounded text-sm">
              <option value="all">All providers</option>
              <option value="internal">Internal only</option>
              <option value="external">External only</option>
            </select>
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="px-3 py-1 border rounded text-sm">
              <option value="all">All departments</option>
              <option value="6">Engineering</option>
              <option value="4">Housekeeping</option>
              <option value="2">F&B</option>
            </select>
          </div>
        </div>

        {pmTasks.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">No PM tasks scheduled yet.</p>
            <p className="text-sm">Task instances are generated by fn_generate_task_instances (hr_scheduling module).</p>
          </div>
        ) : (
          <>
            {overdue.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-red-700 mb-3">⚠️ Overdue ({overdue.length})</h3>
                <div className="space-y-2">
                  {overdue.map(t => (
                    <div key={t.instance_id} className="border-l-4 border-red-500 bg-red-50 p-3 rounded">
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

            <div>
              <h3 className="text-lg font-semibold mb-3">Upcoming ({upcoming.length})</h3>
              <div className="space-y-2">
                {upcoming.map(t => (
                  <div key={t.instance_id} className="border-l-4 border-blue-500 bg-blue-50 p-3 rounded">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-semibold">{t.title}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {t.asset_code && <span className="font-mono text-xs bg-gray-200 px-1 rounded mr-2">{t.asset_code}</span>}
                          {t.asset_name && <span className="text-xs">{t.asset_name}</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Scheduled: {new Date(t.scheduled_date).toLocaleDateString()} · {t.estimated_minutes}min · {t.provider}
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded font-medium ${t.status==="scheduled"?"bg-green-100 text-green-800":"bg-gray-100 text-gray-800"}`}>
                        {t.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  function renderCapture() {
    return (
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-4 md:p-6">
        <h2 className="text-2xl font-semibold mb-6">📷 Capture New Asset</h2>
        
        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">1. Photo Nameplate</label>
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
                    <button onClick={capturePhoto} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                      Capture
                    </button>
                    <button onClick={stopCamera} className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {capturedImage && (
                <div>
                  <img src={capturedImage} className="max-w-full h-auto rounded-lg mb-3 mx-auto" style={{maxHeight:"400px"}} />
                  <button onClick={() => setCapturedImage("")} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm">
                    ↻ Retake
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Asset Code *</label>
              <input value={captureForm.code} onChange={e => setCaptureForm({...captureForm, code: e.target.value})} placeholder="GEN-001" className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Asset Name *</label>
              <input value={captureForm.name} onChange={e => setCaptureForm({...captureForm, name: e.target.value})} placeholder="Backup Generator 45kVA" className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category *</label>
              <select value={captureForm.category} onChange={e => setCaptureForm({...captureForm, category: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg">
                {categories.map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <select value={captureForm.location} onChange={e => setCaptureForm({...captureForm, location: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                <option value="">— None —</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Manufacturer</label>
              <input value={captureForm.manufacturer} onChange={e => setCaptureForm({...captureForm, manufacturer: e.target.value})} placeholder="Cummins" className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Model</label>
              <input value={captureForm.model} onChange={e => setCaptureForm({...captureForm, model: e.target.value})} placeholder="C45D6" className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Serial Number</label>
              <input value={captureForm.serial} onChange={e => setCaptureForm({...captureForm, serial: e.target.value})} placeholder="CUM2024-45-8821" className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea value={captureForm.notes} onChange={e => setCaptureForm({...captureForm, notes: e.target.value})} rows={3} placeholder="Installation notes, special requirements..." className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={() => setView("assets")} className="px-6 py-2 border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleCapture} disabled={uploading || !captureForm.code || !captureForm.name} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium">
            {uploading ? "Saving..." : "✅ Create Asset"}
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-lg text-gray-600">Loading maintenance module...</div></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-3 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Preventive Maintenance</h1>
            <p className="text-sm text-gray-600 mt-1">Property {propertyId} · Ops Module</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setView("assets")} className={`px-4 py-2 rounded-lg font-medium ${view==="assets"?"bg-blue-600 text-white":"bg-white border hover:bg-gray-50"}`}>
              📦 Assets ({assets.length})
            </button>
            <button onClick={() => setView("calendar")} className={`px-4 py-2 rounded-lg font-medium ${view==="calendar"?"bg-blue-600 text-white":"bg-white border hover:bg-gray-50"}`}>
              📅 Calendar
            </button>
          </div>
        </div>

        {view === "assets" && renderAssetRegister()}
        {view === "calendar" && renderPMCalendar()}
        {view === "capture" && renderCapture()}
      </div>
    </div>
  );
}
