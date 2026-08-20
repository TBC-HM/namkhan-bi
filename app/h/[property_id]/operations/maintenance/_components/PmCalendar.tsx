// app/h/[property_id]/operations/maintenance/_components/PmCalendar.tsx
// Extracted from ops/maintenance/page.tsx for slice 5 deep-link routes
// PM v3 slice 6 — design-system conformance: all colors via var(--*) tokens,
// status via global .status-pill classes, paper-white cards + hairline borders.
"use client";
import Link from "next/link";
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

type PmCalendarProps = {
  tasks: PMTask[];
  propertyId: number;
  loading?: boolean;
  filterProvider?: "all" | "internal" | "external";
  filterDept?: "all" | string;
  onTaskClick?: (task: PMTask) => void;
};

export default function PmCalendar({
  tasks,
  propertyId,
  loading = false,
  filterProvider = "all",
  filterDept = "all",
  onTaskClick
}: PmCalendarProps) {

  const filtered = tasks.filter(t => {
    if (filterProvider !== "all" && t.provider !== filterProvider) return false;
    if (filterDept !== "all" && String(t.dept_id) !== filterDept) return false;
    return true;
  });

  if (loading) {
    return <div className="text-center py-8" style={S.muted}>Loading tasks...</div>;
  }

  if (filtered.length === 0) {
    return <div className="text-center py-8" style={S.muted}>No tasks found</div>;
  }

  return (
    <div className="space-y-3">
      {filtered.map((task) => {
        const pill = S.statusPillClass(task.status, task.scheduled_date);
        const overdue = pill.includes("pill-expired");
        return (
          <div
            key={task.instance_id}
            style={{
              ...S.card,
              cursor: "pointer",
              borderLeft: overdue
                ? "3px solid var(--st-bad)"
                : task.status === "completed"
                  ? "3px solid var(--st-good)"
                  : "3px solid var(--hairline)",
            }}
            onClick={() => onTaskClick && onTaskClick(task)}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <h3 style={{ ...S.sectionTitle, fontSize: "var(--t-lg)" }}>{task.title}</h3>
                <p style={S.label}>{task.task_code} – {task.asset_code} {task.asset_name}</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <span className={pill}>{overdue ? "overdue" : task.status}</span>
                <span className="status-pill pill-info">{task.provider}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3" style={{ fontSize: "var(--t-md)" }}>
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
              <div>
                <span style={S.label}>Details:</span>
                <Link
                  href={`/h/${propertyId}/operations/maintenance/tasks/${task.instance_id}`}
                  style={{ color: "var(--moss)", fontWeight: 500 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  View →
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
