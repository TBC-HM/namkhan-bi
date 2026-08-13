// app/h/[property_id]/ops/maintenance/page.tsx
// PM module v1 — unified view: asset register, calendar, task completion
// PBS directive 2026-08-06: shared spine (§0), preventive stream only
"use client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Asset = { id: number; asset_code: string; asset_name: string; category_name: string; location_name: string; status: string; manufacturer: string; model: string };
type PMTask = { task_id: string; title: string; dept_name: string; duration_minutes: number; recurrence_days: number; required_skills: string[]; verification_type: string; provider: string };
type TaskInstance = { instance_id: string; task_title: string; scheduled_date: string; assigned_to: string; status: string; actual_minutes: number };

export default function MaintenancePage() {
  const params = useParams();
  const propertyId = Number(params?.property_id);
  const [view, setView] = useState<"calendar"|"assets"|"capture">("assets");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tasks, setTasks] = useState<PMTask[]>([]);
  const [instances, setInstances] = useState<TaskInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [captureForm, setCaptureForm] = useState({ code: "", name: "", category: 16, location: "", manufacturer: "", model: "", serial: "", notes: "" });
  const [locations, setLocations] = useState<{id:number;location_name:string}[]>([]);
  const [categories, setCategories] = useState<{id:number;category_name:string}[]>([]);
  
  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [assetRes, catRes, locRes] = await Promise.all([
        sb.from("v_asset_register").select("*").eq("property_id", propertyId),
        sb.from("v_asset_categories").select("id,category_name"),
        sb.from("v_asset_locations").select("id,location_name").eq("property_id", propertyId)
      ]);
      if (assetRes.data) setAssets(assetRes.data as Asset[]);
      if (catRes.data) setCategories(catRes.data);
      if (locRes.data) setLocations(locRes.data);
      setLoading(false);
    }
    if (propertyId) load();
  }, [propertyId]);

  async function handleCapture() {
    if (!captureForm.code || !captureForm.name) return alert("Code and Name required");
    const sb = createClient();
    const { data, error } = await sb.rpc("fn_create_fixed_asset", {
      p_property_id: propertyId,
      p_asset_code: captureForm.code,
      p_asset_name: captureForm.name,
      p_category_id: captureForm.category,
      p_manufacturer: captureForm.manufacturer || null,
      p_model: captureForm.model || null,
      p_serial_number: captureForm.serial || null,
      p_location_id: captureForm.location ? Number(captureForm.location) : null,
      p_notes: captureForm.notes || null
    });
    if (error) return alert("Error: " + error.message);
    alert(`Asset ${captureForm.code} created with ID ${data}`);
    setCaptureForm({ code: "", name: "", category: 16, location: "", manufacturer: "", model: "", serial: "", notes: "" });
    setView("assets");
    const res = await sb.from("v_asset_register").select("*").eq("property_id", propertyId);
    if (res.data) setAssets(res.data as Asset[]);
  }

  if (loading) return <div className="p-8">Loading maintenance module...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Preventive Maintenance · Property {propertyId}</h1>
          <div className="flex gap-2">
            <button onClick={() => setView("assets")} className={`px-4 py-2 rounded ${view==="assets"?"bg-blue-600 text-white":"bg-white border"}`}>Asset Register</button>
            <button onClick={() => setView("calendar")} className={`px-4 py-2 rounded ${view==="calendar"?"bg-blue-600 text-white":"bg-white border"}`}>PM Calendar</button>
            <button onClick={() => setView("capture")} className={`px-4 py-2 rounded ${view==="capture"?"bg-green-600 text-white":"bg-white border"}`}>➕ Capture Asset</button>
          </div>
        </div>

        {view === "assets" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Fixed Assets ({assets.length})</h2>
            {assets.length === 0 ? (
              <p className="text-gray-500">No assets registered yet. Use ➕ Capture Asset to add your first asset.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Code</th>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Category</th>
                    <th className="p-2 text-left">Location</th>
                    <th className="p-2 text-left">Manufacturer</th>
                    <th className="p-2 text-left">Model</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map(a => (
                    <tr key={a.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-mono text-xs">{a.asset_code}</td>
                      <td className="p-2">{a.asset_name}</td>
                      <td className="p-2 text-xs text-gray-600">{a.category_name}</td>
                      <td className="p-2 text-xs text-gray-600">{a.location_name || "—"}</td>
                      <td className="p-2 text-xs">{a.manufacturer || "—"}</td>
                      <td className="p-2 text-xs">{a.model || "—"}</td>
                      <td className="p-2"><span className={`px-2 py-1 rounded text-xs ${a.status==="active"?"bg-green-100 text-green-800":"bg-gray-100"}`}>{a.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {view === "calendar" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">PM Schedule</h2>
            <div className="text-gray-600 p-8 text-center">
              <p className="text-lg mb-2">⚠️ Task instance generation blocked</p>
              <p className="text-sm">Waiting for hr_scheduling to deliver <code className="bg-gray-100 px-2 py-1 rounded">fn_generate_task_instances</code> (blocker #9).</p>
              <p className="text-sm mt-2">Once available, this view will show dated PM tasks for the next 90 days.</p>
            </div>
          </div>
        )}

        {view === "capture" && (
          <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
            <h2 className="text-xl font-semibold mb-4">Capture New Asset</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Asset Code *</label>
                <input type="text" value={captureForm.code} onChange={e=>setCaptureForm({...captureForm,code:e.target.value.toUpperCase()})} className="w-full border rounded px-3 py-2" placeholder="e.g. GEN-002" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Asset Name *</label>
                <input type="text" value={captureForm.name} onChange={e=>setCaptureForm({...captureForm,name:e.target.value})} className="w-full border rounded px-3 py-2" placeholder="e.g. Backup Generator 60kVA" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select value={captureForm.category} onChange={e=>setCaptureForm({...captureForm,category:Number(e.target.value)})} className="w-full border rounded px-3 py-2">
                    {categories.map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Location</label>
                  <select value={captureForm.location} onChange={e=>setCaptureForm({...captureForm,location:e.target.value})} className="w-full border rounded px-3 py-2">
                    <option value="">— Select —</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Manufacturer</label>
                  <input type="text" value={captureForm.manufacturer} onChange={e=>setCaptureForm({...captureForm,manufacturer:e.target.value})} className="w-full border rounded px-3 py-2" placeholder="e.g. Cummins" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Model</label>
                  <input type="text" value={captureForm.model} onChange={e=>setCaptureForm({...captureForm,model:e.target.value})} className="w-full border rounded px-3 py-2" placeholder="e.g. C60D6" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Serial Number</label>
                <input type="text" value={captureForm.serial} onChange={e=>setCaptureForm({...captureForm,serial:e.target.value})} className="w-full border rounded px-3 py-2" placeholder="Serial or nameplate number" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea value={captureForm.notes} onChange={e=>setCaptureForm({...captureForm,notes:e.target.value})} className="w-full border rounded px-3 py-2" rows={3} placeholder="Installation date, warranty info, maintenance notes..." />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCapture} className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">Create Asset</button>
                <button onClick={()=>setView("assets")} className="bg-gray-200 px-6 py-2 rounded hover:bg-gray-300">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
