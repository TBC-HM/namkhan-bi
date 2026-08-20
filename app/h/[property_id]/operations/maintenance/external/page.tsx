// app/h/[property_id]/operations/maintenance/external/page.tsx
// PM v3 slice 5 — external contractor view
// PM v3 slice 6 — design-system conformance: token colors only, global
// .status-pill / .btn-primary / .btn-ghost classes, paper-white cards with
// hairline borders, no emoji, no Tailwind color classes.
"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import * as S from "../_components/pmStyles";

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
  completed_by: string;
  provider_note: string;
};

export default function ExternalContractorPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = Number(params?.property_id);
  const [tasks, setTasks] = useState<PMTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"scheduled"|"completed">("scheduled");

  useEffect(() => {
    loadTasks();
  }, [propertyId]);

  async function loadTasks() {
    try {
      const sb = createClient();
      const { data, error } = await sb
        .from("v_pm_calendar")
        .select("*")
        .eq("property_id", propertyId)
        .eq("provider", "external")
        .order("scheduled_date", { ascending: false })
        .limit(100);

      if (error) throw error;
      if (data) setTasks(data as PMTask[]);
    } catch (e: any) {
      console.error("Failed to load external tasks:", e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    router.push(`/h/${propertyId}/operations/maintenance`);
  }

  const scheduledTasks = tasks.filter(t => t.status === "scheduled");
  const completedTasks = tasks.filter(t => t.status === "completed");
  const displayTasks = view === "scheduled" ? scheduledTasks : completedTasks;

  // Extract unique provider notes for contact info
  const providerNotes = Array.from(new Set(tasks.map(t => t.provider_note).filter(Boolean)));

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)" }}>
      <div className="max-w-6xl mx-auto p-6">
        <button onClick={handleBack} className="btn-ghost mb-4">
          ← Back to Maintenance
        </button>

        <div className="mb-6" style={{ ...S.card, padding: 24 }}>
          <h1 style={{ ...S.sectionTitle, fontSize: "var(--t-2xl)", marginBottom: 4 }}>External Contractor View</h1>
          <p style={S.muted}>Tasks assigned to external maintenance providers</p>
        </div>

        {/* Contact Info Section */}
        {providerNotes.length > 0 && (
          <div className="mb-6" style={S.inset}>
            <h2 style={{ ...S.sectionTitle, fontSize: "var(--t-lg)", marginBottom: 8 }}>Provider Contact Information</h2>
            <div className="space-y-1">
              {providerNotes.map((note, idx) => (
                <p key={idx} style={{ fontSize: "var(--t-md)", color: "var(--ink-soft)", margin: 0 }}>{note}</p>
              ))}
            </div>
          </div>
        )}

        {/* View Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setView("scheduled")}
            className={view === "scheduled" ? "btn-primary" : "btn-ghost"}
          >
            Scheduled ({scheduledTasks.length})
          </button>
          <button
            onClick={() => setView("completed")}
            className={view === "completed" ? "btn-primary" : "btn-ghost"}
          >
            Completed ({completedTasks.length})
          </button>
        </div>

        {/* Tasks List */}
        {loading ? (
          <div className="text-center py-12" style={S.muted}>Loading external tasks...</div>
        ) : displayTasks.length === 0 ? (
          <div className="text-center" style={{ ...S.card, padding: 32, color: "var(--ink-mute)" }}>
            No {view} external tasks found
          </div>
        ) : (
          <div className="space-y-4">
            {displayTasks.map((task) => (
              <div key={task.instance_id} style={{ ...S.card, padding: 20 }}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 style={{ ...S.sectionTitle, fontSize: "var(--t-xl)" }}>{task.title}</h3>
                    <p style={S.muted}>{task.task_code} – {task.asset_code} {task.asset_name}</p>
                  </div>
                  <span className={S.statusPillClass(task.status, task.scheduled_date)}>
                    {task.status}
                  </span>
                </div>

                {task.description && (
                  <p className="mb-3" style={{ color: "var(--ink-soft)", fontSize: "var(--t-md)" }}>{task.description}</p>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3" style={{ fontSize: "var(--t-md)" }}>
                  <div>
                    <span style={S.label}>Scheduled:</span>
                    <p style={{ ...S.value, ...S.num }}>{task.scheduled_date}</p>
                  </div>
                  <div>
                    <span style={S.label}>Duration:</span>
                    <p style={{ ...S.value, ...S.num }}>{task.estimated_minutes} min</p>
                  </div>
                  <div>
                    <span style={S.label}>Assigned:</span>
                    <p style={S.value}>{task.assigned_to || "Unassigned"}</p>
                  </div>
                  {task.status === "completed" && task.completed_at && (
                    <div>
                      <span style={S.label}>Completed:</span>
                      <p style={{ ...S.value, ...S.num }}>{task.completed_at}</p>
                    </div>
                  )}
                </div>

                {task.provider_note && (
                  <div className="mt-3" style={S.inset}>
                    <span style={{ ...S.label, fontWeight: 500 }}>Contact:</span>
                    <p style={{ fontSize: "var(--t-md)", color: "var(--ink)", margin: 0 }}>{task.provider_note}</p>
                  </div>
                )}

                <div className="mt-4">
                  <Link
                    href={`/h/${propertyId}/operations/maintenance/tasks/${task.instance_id}`}
                    style={{ color: "var(--moss)", fontWeight: 500, fontSize: "var(--t-md)" }}
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
