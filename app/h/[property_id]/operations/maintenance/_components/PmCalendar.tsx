// app/h/[property_id]/operations/maintenance/_components/PmCalendar.tsx
// PM v3 slice 6 (A4, A6): design-system conformance
//   - MonthCalendar atom bound to v_cal_maintenance (9-col universal feed)
//   - Overdue + Upcoming sections with ListContainer primitive
//   - Status semantics via --status-* tokens

"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ListContainer, MonthCalendar, type CalendarDay } from "@/app/(cockpit)/_design";
import type { ListContainerColumn } from "@/app/(cockpit)/_design/types";
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
  completed_by: string;
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
  onTaskClick,
}: PmCalendarProps) {
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [loadingCal, setLoadingCal] = useState(true);

  useEffect(() => {
    loadCalendarFeed();
  }, [propertyId]);

  async function loadCalendarFeed() {
    const sb = createClient();
    const today = new Date();
    const endDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const res = await sb
      .from("v_cal_maintenance")
      .select("*")
      .eq("property_id", propertyId)
      .gte("day_date", today.toISOString().split("T")[0])
      .lte("day_date", endDate.toISOString().split("T")[0])
      .order("day_date", { ascending: true });

    if (res.data && res.data.length > 0) {
      const days: CalendarDay[] = res.data.map((row: any) => ({
        date: row.day_date,
        label: row.label || "",
        tone: mapColorKeyToTone(row.color_key),
        tooltip: row.tooltip_json ? JSON.stringify(row.tooltip_json) : row.label || "",
      }));
      setCalendarDays(days);
    } else {
      // Fill with empty 30-day grid if no data
      const empty: CalendarDay[] = [];
      for (let i = 0; i < 30; i++) {
        const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
        empty.push({ date: d.toISOString().split("T")[0] });
      }
      setCalendarDays(empty);
    }
    setLoadingCal(false);
  }

  function mapColorKeyToTone(ck: string | null): "green" | "amber" | "red" | "brass" | "ink" {
    if (!ck) return "ink";
    if (ck.includes("green") || ck.includes("good")) return "green";
    if (ck.includes("amber") || ck.includes("warn")) return "amber";
    if (ck.includes("red") || ck.includes("bad")) return "red";
    if (ck.includes("brass")) return "brass";
    return "ink";
  }

  const filtered = tasks.filter((t) => {
    if (filterProvider !== "all" && t.provider !== filterProvider) return false;
    if (filterDept !== "all" && String(t.dept_id) !== filterDept) return false;
    return true;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = filtered.filter(
    (t) =>
      t.status !== "completed" &&
      new Date(t.scheduled_date + "T00:00:00Z") < today
  );
  const upcoming = filtered.filter(
    (t) =>
      t.status !== "completed" &&
      new Date(t.scheduled_date + "T00:00:00Z") >= today
  );

  const renderTaskRow = (task: PMTask) => {
    const pill = S.statusPillClass(task.status, task.scheduled_date);
    const isOverdue = pill.includes("pill-expired");
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ ...S.sectionTitle, fontSize: "var(--t-lg)", marginBottom: 4 }}>
            {task.title}
          </div>
          <div style={{ ...S.label, fontSize: "var(--t-sm)" }}>
            {task.task_code} – {task.asset_code} {task.asset_name}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className={pill}>{isOverdue ? "overdue" : task.status}</span>
          <span className="status-pill pill-info">{task.provider}</span>
          <span style={{ ...S.num, fontSize: "var(--t-sm)", color: "var(--ink-soft)" }}>
            {task.scheduled_date}
          </span>
        </div>
      </div>
    );
  };

  const drawerColumns: ListContainerColumn<PMTask>[] = [
    { key: "task_code", label: "Code", width: 100 },
    { key: "title", label: "Task", width: 240 },
    { key: "asset_code", label: "Asset", width: 100 },
    { key: "scheduled_date", label: "Scheduled", width: 120, align: "center" },
    { key: "provider", label: "Provider", width: 100 },
    {
      key: "status",
      label: "Status",
      width: 100,
      align: "center",
      render: (t) => <span className={S.statusPillClass(t.status, t.scheduled_date)}>{t.status}</span>,
    },
  ];

  if (loading || loadingCal) {
    return (
      <div className="text-center py-8" style={S.muted}>
        Loading calendar...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Month calendar bound to v_cal_maintenance */}
      <div style={S.card}>
        <h3 style={{ ...S.sectionTitle, marginBottom: 12 }}>30-Day View</h3>
        <MonthCalendar days={calendarDays} variant="events" />
      </div>

      {/* Overdue section */}
      {overdue.length > 0 && (
        <ListContainer
          title="Overdue Tasks"
          subtitle={`${overdue.length} task${overdue.length === 1 ? "" : "s"} past scheduled date`}
          data={overdue}
          preview={5}
          renderRow={renderTaskRow}
          rowKey={(t) => t.instance_id}
          drawerColumns={drawerColumns}
          onRowClick={onTaskClick}
          status="red"
        />
      )}

      {/* Upcoming section */}
      {upcoming.length > 0 && (
        <ListContainer
          title="Upcoming Tasks"
          subtitle={`${upcoming.length} scheduled task${upcoming.length === 1 ? "" : "s"}`}
          data={upcoming}
          preview={10}
          renderRow={renderTaskRow}
          rowKey={(t) => t.instance_id}
          drawerColumns={drawerColumns}
          onRowClick={onTaskClick}
        />
      )}

      {overdue.length === 0 && upcoming.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: 32 }}>
          <div style={S.muted}>No tasks found matching filters</div>
        </div>
      )}
    </div>
  );
}
