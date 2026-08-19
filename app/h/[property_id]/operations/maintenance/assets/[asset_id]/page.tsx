// app/h/[property_id]/operations/maintenance/assets/[asset_id]/page.tsx
// PM v3 slice 5 — asset detail deep-link route
"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Asset = { 
  id: number; 
  asset_code: string; 
  asset_name: string; 
  category_name: string; 
  location_name: string; 
  status: string; 
  manufacturer: string; 
  model: string; 
  maintenance_count: number; 
  last_maintenance: string; 
  next_maintenance: string;
  serial_number: string;
  purchase_date: string;
  warranty_expiry: string;
  notes: string;
};

type PMTask = { 
  instance_id: string; 
  task_code: string; 
  title: string; 
  scheduled_date: string; 
  status: string; 
  provider: string; 
  estimated_minutes: number; 
};

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = Number(params?.property_id);
  const assetId = Number(params?.asset_id);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [tasks, setTasks] = useState<PMTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    loadAsset();
  }, [assetId, propertyId]);

  async function loadAsset() {
    try {
      const sb = createClient();
      
      // Load asset details
      const { data: assetData, error: assetError } = await sb
        .from("v_asset_register")
        .select("*")
        .eq("property_id", propertyId)
        .eq("id", assetId)
        .single();
      
      if (assetError) throw assetError;
      if (!assetData) throw new Error("Asset not found");
      
      setAsset(assetData as Asset);

      // Load related PM tasks
      const { data: tasksData } = await sb
        .from("v_pm_calendar")
        .select("instance_id, task_code, title, scheduled_date, status, provider, estimated_minutes")
        .eq("property_id", propertyId)
        .eq("asset_id", assetId)
        .order("scheduled_date", { ascending: false })
        .limit(20);
      
      if (tasksData) setTasks(tasksData as PMTask[]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    router.push(`/h/${propertyId}/operations/maintenance`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading asset...</div>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">❌ {error || "Asset not found"}</p>
          <button onClick={handleBack} className="text-blue-600 hover:text-blue-800">
            ← Back to Maintenance
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        <button onClick={handleBack} className="mb-4 text-blue-600 hover:text-blue-800 flex items-center gap-2">
          ← Back to Maintenance
        </button>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{asset.asset_name}</h1>
              <p className="text-gray-600 text-lg mt-1">{asset.asset_code}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              asset.status === "active" ? "bg-green-100 text-green-800" :
              asset.status === "maintenance" ? "bg-yellow-100 text-yellow-800" :
              "bg-gray-100 text-gray-800"
            }`}>
              {asset.status}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="space-y-3">
              <div>
                <span className="text-gray-600 text-sm">Category</span>
                <p className="font-medium text-gray-900">{asset.category_name}</p>
              </div>
              <div>
                <span className="text-gray-600 text-sm">Location</span>
                <p className="font-medium text-gray-900">{asset.location_name}</p>
              </div>
              <div>
                <span className="text-gray-600 text-sm">Manufacturer</span>
                <p className="font-medium text-gray-900">{asset.manufacturer || "—"}</p>
              </div>
              <div>
                <span className="text-gray-600 text-sm">Model</span>
                <p className="font-medium text-gray-900">{asset.model || "—"}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-gray-600 text-sm">Serial Number</span>
                <p className="font-medium text-gray-900">{asset.serial_number || "—"}</p>
              </div>
              <div>
                <span className="text-gray-600 text-sm">Total Maintenance Tasks</span>
                <p className="font-medium text-gray-900">{asset.maintenance_count}</p>
              </div>
              <div>
                <span className="text-gray-600 text-sm">Last Maintenance</span>
                <p className="font-medium text-gray-900">{asset.last_maintenance || "—"}</p>
              </div>
              <div>
                <span className="text-gray-600 text-sm">Next Maintenance</span>
                <p className="font-medium text-gray-900">{asset.next_maintenance || "—"}</p>
              </div>
            </div>
          </div>

          {asset.notes && (
            <div className="mt-6 p-4 bg-gray-50 rounded border border-gray-200">
              <span className="text-gray-600 text-sm font-medium">Notes:</span>
              <p className="mt-2 text-gray-900">{asset.notes}</p>
            </div>
          )}
        </div>

        {/* Related PM Tasks */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Maintenance History</h2>
          
          {tasks.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No maintenance tasks found for this asset</p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <Link
                  key={task.instance_id}
                  href={`/h/${propertyId}/operations/maintenance/tasks/${task.instance_id}`}
                  className="block p-4 border border-gray-200 rounded hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">{task.title}</h3>
                      <p className="text-sm text-gray-600">{task.task_code}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      task.status === "completed" ? "bg-green-100 text-green-800" :
                      task.status === "scheduled" ? "bg-yellow-100 text-yellow-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {task.status}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-4 text-sm text-gray-600">
                    <span>📅 {task.scheduled_date}</span>
                    <span>⏱️ {task.estimated_minutes} min</span>
                    <span>🔧 {task.provider}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
