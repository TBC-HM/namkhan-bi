// app/h/[property_id]/operations/maintenance/_components/PmCalendar.tsx
// Extracted from ops/maintenance/page.tsx for slice 5 deep-link routes
"use client";
import Link from "next/link";

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
    return <div className="text-center py-8 text-gray-500">Loading tasks...</div>;
  }

  if (filtered.length === 0) {
    return <div className="text-center py-8 text-gray-500">No tasks found</div>;
  }

  return (
    <div className="space-y-3">
      {filtered.map((task) => (
        <div 
          key={task.instance_id} 
          className="border border-gray-300 rounded-lg p-4 hover:shadow-md transition-shadow bg-white cursor-pointer"
          onClick={() => onTaskClick && onTaskClick(task)}
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <h3 className="font-bold text-lg text-gray-900">{task.title}</h3>
              <p className="text-sm text-gray-600">{task.task_code} – {task.asset_code} {task.asset_name}</p>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                task.status === "completed" ? "bg-green-100 text-green-800" :
                task.status === "scheduled" ? "bg-yellow-100 text-yellow-800" :
                "bg-gray-100 text-gray-800"
              }`}>
                {task.status}
              </span>
              <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                {task.provider}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-3">
            <div>
              <span className="text-gray-600">Scheduled:</span>
              <p className="font-medium">{task.scheduled_date}</p>
            </div>
            <div>
              <span className="text-gray-600">Duration:</span>
              <p className="font-medium">{task.estimated_minutes} min</p>
            </div>
            <div>
              <span className="text-gray-600">Assigned:</span>
              <p className="font-medium">{task.assigned_to || "Unassigned"}</p>
            </div>
            <div>
              <span className="text-gray-600">Details:</span>
              <Link 
                href={`/h/${propertyId}/operations/maintenance/tasks/${task.instance_id}`}
                className="text-blue-600 hover:text-blue-800 font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                View →
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
