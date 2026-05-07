/**
 * FinanceAttentionPanel — "What needs your attention" for /finance.
 *
 * Source: public.v_tactical_alerts_top (exists, allowlisted — confirmed 2026-05-08)
 * Filter: domain = 'finance' OR dept = 'finance' — falls back to all alerts if 0 finance rows.
 *
 * NOTE: v_tactical_alerts_top returned permission error in dev check (permission denied for view v_alerts_active).
 * This component gracefully handles the error and renders an em-dash empty state.
 * TODO: confirm view permission grants for service_role on v_tactical_alerts_top.
 */

import { createClient } from "@supabase/supabase-js";
import StatusPill from "@/components/ui/StatusPill";
import { EMPTY } from "@/lib/format";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface Alert {
  id: string | number;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  dept?: string;
  created_at?: string;
  description?: string;
}

async function fetchFinanceAlerts(): Promise<Alert[]> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from("v_tactical_alerts_top")
      .select("*")
      .or("dept.eq.finance,domain.eq.finance")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error || !data || data.length === 0) {
      // Fall back: return top alerts regardless of dept
      const { data: all } = await supabase
        .from("v_tactical_alerts_top")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      return (all ?? []) as Alert[];
    }
    return data as Alert[];
  } catch {
    return [];
  }
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export default async function FinanceAttentionPanel() {
  const alerts = await fetchFinanceAlerts();

  if (alerts.length === 0) {
    return (
      <div className="attention-empty">
        <span className="empty-icon" aria-hidden>✓</span>
        <span className="empty-text">No finance alerts right now — {EMPTY}</span>
      </div>
    );
  }

  const sorted = [...alerts].sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  );

  return (
    <div className="attention-panel">
      {sorted.map((alert, i) => (
        <div key={alert.id ?? i} className="attention-item">
          <div className="attention-left">
            <StatusPill
              status={
                alert.severity === "critical" || alert.severity === "high"
                  ? "danger"
                  : alert.severity === "medium"
                  ? "warn"
                  : "ok"
              }
              label={alert.severity?.toUpperCase() ?? "INFO"}
            />
            <span className="attention-title">
              {alert.title ?? EMPTY}
            </span>
          </div>
          {alert.dept && (
            <span className="attention-dept">{alert.dept}</span>
          )}
        </div>
      ))}

      <style jsx>{`
        .attention-panel {
          background: var(--color-surface-1, #1a1f1e);
          border: 1px solid var(--color-border, #2a2f2e);
          border-radius: 8px;
          overflow: hidden;
        }
        .attention-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--color-border, #2a2f2e);
          gap: 12px;
        }
        .attention-item:last-child {
          border-bottom: none;
        }
        .attention-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
        }
        .attention-title {
          font-size: 0.85rem;
          color: var(--color-text-primary, #f5f2ef);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .attention-dept {
          font-size: 0.72rem;
          color: var(--color-text-muted, #6b7280);
          font-family: var(--font-mono);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          flex-shrink: 0;
        }
        .attention-empty {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 20px 16px;
          background: var(--color-surface-1, #1a1f1e);
          border: 1px solid var(--color-border, #2a2f2e);
          border-radius: 8px;
          color: var(--color-text-muted, #6b7280);
          font-size: 0.85rem;
        }
        .empty-icon {
          color: var(--color-success, #22c55e);
          font-size: 1rem;
        }
      `}</style>
    </div>
  );
}
