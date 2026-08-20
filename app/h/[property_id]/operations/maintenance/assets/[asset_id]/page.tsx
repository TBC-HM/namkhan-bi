// app/h/[property_id]/operations/maintenance/assets/[asset_id]/page.tsx
// PM v3 slice 5 — asset detail deep-link route
// PM v3 slice 6 — design-system conformance: token colors only, global
// .status-pill / .btn-ghost classes, paper-white cards with hairline borders,
// no emoji, no Tailwind color classes, tabular-nums on counts/dates.
"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import * as S from "../../_components/pmStyles";

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--paper)" }}>
        <div style={S.muted}>Loading asset...</div>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--paper)" }}>
        <div className="text-center">
          <p className="mb-4" style={{ color: "var(--st-bad)", fontSize: "var(--t-md)" }}>{error || "Asset not found"}</p>
          <button onClick={handleBack} className="btn-ghost">
            ← Back to Maintenance
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)" }}>
      <div className="max-w-5xl mx-auto p-6">
        <button onClick={handleBack} className="btn-ghost mb-4">
          ← Back to Maintenance
        </button>

        <div className="mb-6" style={{ ...S.card, padding: 24 }}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 style={{ ...S.sectionTitle, fontSize: "var(--t-2xl)" }}>{asset.asset_name}</h1>
              <p className="mt-1" style={{ ...S.muted, fontSize: "var(--t-lg)" }}>{asset.asset_code}</p>
            </div>
            <span className={S.statusPillClass(asset.status)}>
              {asset.status}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="space-y-3">
              <div>
                <span style={S.label}>Category</span>
                <p style={S.value}>{asset.category_name}</p>
              </div>
              <div>
                <span style={S.label}>Location</span>
                <p style={S.value}>{asset.location_name}</p>
              </div>
              <div>
                <span style={S.label}>Manufacturer</span>
                <p style={S.value}>{asset.manufacturer || "—"}</p>
              </div>
              <div>
                <span style={S.label}>Model</span>
                <p style={S.value}>{asset.model || "—"}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <span style={S.label}>Serial Number</span>
                <p style={S.value}>{asset.serial_number || "—"}</p>
              </div>
              <div>
                <span style={S.label}>Total Maintenance Tasks</span>
                <p style={{ ...S.value, ...S.num }}>{asset.maintenance_count}</p>
              </div>
              <div>
                <span style={S.label}>Last Maintenance</span>
                <p style={{ ...S.value, ...S.num }}>{asset.last_maintenance || "—"}</p>
              </div>
              <div>
                <span style={S.label}>Next Maintenance</span>
                <p style={{ ...S.value, ...S.num }}>{asset.next_maintenance || "—"}</p>
              </div>
            </div>
          </div>

          {asset.notes && (
            <div className="mt-6" style={S.inset}>
              <span style={{ ...S.label, fontWeight: 500 }}>Notes:</span>
              <p className="mt-2" style={{ color: "var(--ink)", fontSize: "var(--t-md)" }}>{asset.notes}</p>
            </div>
          )}
        </div>

        {/* Related PM Tasks */}
        <div style={{ ...S.card, padding: 24 }}>
          <h2 style={{ ...S.sectionTitle, fontSize: "var(--t-xl)", marginBottom: 16 }}>Maintenance History</h2>

          {tasks.length === 0 ? (
            <p className="text-center py-8" style={S.muted}>No maintenance tasks found for this asset</p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <Link
                  key={task.instance_id}
                  href={`/h/${propertyId}/operations/maintenance/tasks/${task.instance_id}`}
                  className="block"
                  style={{ ...S.inset, background: "var(--paper-warm)", textDecoration: "none" }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 style={S.value}>{task.title}</h3>
                      <p style={S.label}>{task.task_code}</p>
                    </div>
                    <span className={S.statusPillClass(task.status, task.scheduled_date)}>
                      {task.status}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-4" style={{ ...S.label, ...S.num }}>
                    <span>{task.scheduled_date}</span>
                    <span>{task.estimated_minutes} min</span>
                    <span>{task.provider}</span>
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
