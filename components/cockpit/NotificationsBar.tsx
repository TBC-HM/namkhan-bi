// components/cockpit/NotificationsBar.tsx
// it_only_window_v2 task 4.3 — bell icon + active-tickets strip.
// Silent-by-default per KB #271 — bell only fires on done OR critical/emergency.
// Author: PBS via Claude (Cowork) · 2026-05-07.

"use client";

import { useEffect, useState, useCallback } from "react";

type Notification = {
  id: number;
  ticket_id: number | null;
  agent: string | null;
  kind: "done" | "emergency" | "pbs_required";
  severity: "info" | "warning" | "critical" | "emergency";
  summary: string;
  seen_at: string | null;
  created_at: string;
};

type ActiveTicket = {
  id: number;
  status: string;
  arm: string | null;
  parsed_summary: string | null;
};

const POLL_MS = 20000;

export default function NotificationsBar() {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unseen, setUnseen] = useState(0);
  const [badge, setBadge] = useState<"off" | "green" | "red">("off");
  const [active, setActive] = useState<ActiveTicket[]>([]);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [nRes, aRes] = await Promise.all([
        fetch("/api/cockpit/notifications", { cache: "no-store" }),
        fetch("/api/cockpit/activity?status=in_progress,triaged&limit=10", { cache: "no-store" }).catch(() => null),
      ]);
      if (nRes.ok) {
        const d = await nRes.json();
        setNotifs(d.rows ?? []);
        setUnseen(d.unseen ?? 0);
        setBadge(d.badge ?? "off");
      }
      if (aRes && aRes.ok) {
        const d = await aRes.json();
        setActive((d.tickets ?? []).slice(0, 10));
      }
    } catch {
      /* swallow — bar is best-effort */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const markSeen = async (id: number) => {
    await fetch("/api/cockpit/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    refresh();
  };

  const badgeColor = badge === "red" ? "var(--bad, #b3261e)" : badge === "green" ? "var(--good, #2a7d2e)" : "transparent";

  return (
    <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--bg-1, #faf8f3)", borderBottom: "1px solid var(--border-2, #e8e4dc)" }}>
      {/* Top row: bell + active tickets */}
      <div style={{ display: "flex", alignItems: "center", padding: "8px 16px", gap: 16, minHeight: 36 }}>
        {/* Active tickets strip */}
        <div style={{ flex: 1, display: "flex", gap: 8, overflow: "auto" }}>
          {active.length === 0 ? null : active.map((t) => (
            <a
              key={t.id}
              href={`#ticket-${t.id}`}
              style={{
                fontSize: "var(--t-xs, 11px)",
                padding: "3px 8px",
                background: "var(--surface-1, #f6f3ee)",
                border: "1px solid var(--border-2, #e8e4dc)",
                borderRadius: 4,
                color: "var(--text-2, #444)",
                textDecoration: "none",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {t.status === "in_progress" ? (
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--good, #2a7d2e)", animation: "pulse 1.5s infinite" }} />
              ) : (
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brass, #b07a00)" }} />
              )}
              #{t.id} · {(t.parsed_summary ?? "").split("\n")[0].slice(0, 40)}
            </a>
          ))}
        </div>

        {/* Bell */}
        <button
          onClick={() => setOpen(!open)}
          style={{
            position: "relative",
            background: "transparent",
            border: "1px solid var(--border-2, #e8e4dc)",
            borderRadius: 4,
            padding: "4px 10px",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
          }}
          title={unseen > 0 ? `${unseen} unread` : "no notifications"}
        >
          🔔
          {unseen > 0 && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                minWidth: 16,
                height: 16,
                padding: "0 4px",
                background: badgeColor,
                color: "#fff",
                borderRadius: 8,
                fontSize: 10,
                lineHeight: "16px",
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              {unseen > 99 ? "99+" : unseen}
            </span>
          )}
        </button>
      </div>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 16,
            width: 360,
            maxHeight: 440,
            overflow: "auto",
            background: "var(--bg-1, #faf8f3)",
            border: "1px solid var(--border-2, #e8e4dc)",
            borderRadius: 6,
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            zIndex: 40,
          }}
        >
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-2, #e8e4dc)", fontSize: "var(--t-xs, 11px)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--brass, #b07a00)" }}>
            Notifications · {unseen} unread
          </div>
          {notifs.length === 0 ? (
            <div style={{ padding: 16, color: "var(--text-3, #888)", fontSize: "var(--t-sm, 13px)" }}>
              All quiet. Per KB #271, bell stays silent unless something is done or critical.
            </div>
          ) : (
            notifs.map((n) => {
              const isUnseen = !n.seen_at;
              const dotColor = n.severity === "critical" || n.severity === "emergency" ? "var(--bad, #b3261e)"
                : n.severity === "warning" ? "var(--brass, #b07a00)"
                : "var(--good, #2a7d2e)";
              return (
                <div
                  key={n.id}
                  onClick={() => {
                    if (isUnseen) markSeen(n.id);
                    if (n.ticket_id) {
                      window.location.hash = `#ticket-${n.ticket_id}`;
                      setOpen(false);
                    }
                  }}
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid var(--border-2, #e8e4dc)",
                    cursor: "pointer",
                    background: isUnseen ? "rgba(176,122,0,0.05)" : "transparent",
                    display: "flex",
                    gap: 8,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "var(--t-sm, 13px)", color: "var(--text-1, #222)" }}>{n.summary}</div>
                    <div style={{ fontSize: "var(--t-xs, 11px)", color: "var(--text-3, #888)", marginTop: 2 }}>
                      {n.kind} · {n.severity} · {n.ticket_id ? `#${n.ticket_id} · ` : ""}{new Date(n.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
