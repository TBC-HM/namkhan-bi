// components/engine/DeptCockpit.tsx
// Per-dept cockpit shell — same dark engine style, scoped to the dept's HoD,
// workers, dashboard, and chat. Used by /sales, /revenue, /marketing, /operations,
// /guest, /finance to give each its own "team" + "dashboard" experience.
//
// Author: PBS via Claude (Cowork) · 2026-05-07.

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co"),
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "build-placeholder-anon")
);

type Agent = {
  role: string;
  display_name: string | null;
  avatar: string | null;
  tagline: string | null;
  color: string | null;
};

type Ticket = {
  id: number;
  status: string;
  parsed_summary: string | null;
  arm: string | null;
  intent: string | null;
  updated_at: string;
};

export type DeptCockpitProps = {
  dept_label: string;          // "Sales"
  dept_slug: string;           // "sales"
  hod_role: string;            // "sales_hod"
  worker_roles: string[];      // ['inquiry_triager', 'b2b_account_manager', ...]
  dashboard_href: string;      // "/sales/dashboard"
  description: string;         // 1-line mission
};

export default function DeptCockpit(props: DeptCockpitProps) {
  // PBS 2026-05-09 (repair list): dashboard tab/link hidden everywhere —
  // "the dashboard in the menu in sales we don't need". Page still
  // reachable via direct URL (e.g. /sales/dashboard) for any external link.
  const [tab, setTab] = useState<"team" | "chat" | "tickets">("team");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const interestedRoles = [props.hod_role, ...props.worker_roles];
    supabase
      .from("cockpit_agent_identity")
      .select("role,display_name,avatar,tagline,color")
      .in("role", interestedRoles)
      .then(({ data }) => setAgents(data ?? []));
  }, [props.hod_role, props.worker_roles]);

  useEffect(() => {
    const tick = () => {
      supabase
        .from("cockpit_tickets")
        .select("id,status,parsed_summary,arm,intent,updated_at")
        .eq("arm", props.dept_slug === "sales" ? "sales" : props.dept_slug === "revenue" ? "revenue" : props.dept_slug === "operations" ? "ops" : props.dept_slug)
        .order("updated_at", { ascending: false })
        .limit(20)
        .then(({ data }) => setTickets((data as Ticket[]) ?? []));
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [props.dept_slug]);

  const send = async () => {
    if (!chatInput.trim() || sending) return;
    setSending(true);
    try {
      await fetch("/api/cockpit/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `[${props.dept_slug}] ${chatInput}` }),
      });
      setChatInput("");
    } finally {
      setSending(false);
    }
  };

  const hod = agents.find((a) => a.role === props.hod_role);
  const workers = agents.filter((a) => a.role !== props.hod_role);

  return (
    <div style={S.body}>
      <div style={S.topbar}>
        <div style={S.logo}>
          <div style={S.logoMark}>N</div>
          <span>The Namkhan · <b>{props.dept_label}</b></span>
        </div>
        <div style={S.topbarRight}>
          <a href="/cockpit" style={S.topBtn}>cockpit</a>
        </div>
      </div>

      <div style={S.snap}>
        <div style={S.snapHeadline}>
          <em>{props.dept_label}</em> · {hod?.display_name ?? "—"}
        </div>
        <div style={S.snapMeta}>{props.description}</div>
      </div>

      <div style={S.tabs}>
        {(["team", "chat", "tickets"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
                  style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }}>
            {t}
          </button>
        ))}
      </div>

      {tab === "team" && (
        <div style={S.section}>
          <div style={S.panelLabel}>{props.dept_label} team · cockpit_agent_identity</div>
          {hod && (
            <div style={{ ...S.agentCard, borderLeft: `3px solid ${hod.color ?? "#c79a6b"}` }}>
              <div style={S.agentRow}>
                <div style={{ ...S.agentAvatar, background: hod.color ?? "#c79a6b" }}>{hod.avatar ?? "👤"}</div>
                <div>
                  <div style={S.chiefBadge}>HEAD OF {props.dept_label.toUpperCase()}</div>
                  <div style={S.agentName}>{hod.display_name}</div>
                  <div style={S.agentTagline}>{hod.tagline}</div>
                </div>
              </div>
            </div>
          )}
          <div style={S.workerGrid}>
            {workers.map((w) => (
              <div key={w.role} style={{ ...S.agentCard, borderTop: `2px solid ${w.color ?? "#3d3d45"}` }}>
                <div style={S.agentRow}>
                  <div style={{ ...S.agentAvatar, background: w.color ?? "#15151a" }}>{w.avatar ?? "🤖"}</div>
                  <div>
                    <div style={S.agentName}>{w.display_name}</div>
                    <div style={S.agentTagline}>{w.tagline}</div>
                    <div style={S.agentRole}>{w.role}</div>
                  </div>
                </div>
              </div>
            ))}
            {workers.length === 0 && <div style={S.empty}>— no workers yet for {props.dept_label} —</div>}
          </div>
        </div>
      )}

      {tab === "chat" && (
        <div style={S.section}>
          <div style={S.panelLabel}>Chat with {hod?.display_name ?? props.dept_label}</div>
          <div style={S.chatBox}>
            <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)}
              placeholder={`Ask ${hod?.display_name ?? props.dept_label} something...`}
              style={S.chatInput} />
            <button onClick={send} disabled={sending || !chatInput.trim()} style={S.sendBtn}>
              {sending ? "Sending..." : "Send →"}
            </button>
          </div>
          <div style={{ ...S.empty, marginTop: 12, fontSize: 11 }}>
            Each message creates a ticket in cockpit_tickets and routes through Captain Kit. Reply lands in /cockpit chat.
          </div>
        </div>
      )}

      {tab === "tickets" && (
        <div style={S.section}>
          <div style={S.panelLabel}>{props.dept_label} tickets · last 20</div>
          {tickets.length === 0 ? (
            <div style={S.empty}>— no tickets yet for arm={props.dept_slug} —</div>
          ) : (
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>#</th><th style={S.th}>Status</th><th style={S.th}>Intent</th>
                <th style={S.th}>Summary</th><th style={S.th}>Updated</th>
              </tr></thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} style={S.tr}>
                    <td style={S.td}>#{t.id}</td>
                    <td style={S.td}>{t.status}</td>
                    <td style={S.td}>{t.intent}</td>
                    <td style={{ ...S.td, color: "#a1a1aa" }}>{(t.parsed_summary ?? "").split("\n")[0].slice(0, 60)}</td>
                    <td style={S.td}>{new Date(t.updated_at).toISOString().slice(0, 16).replace("T", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div style={S.footer}>
        Engine cockpit · <b>{props.dept_label}</b> · scoped to {props.hod_role} + {props.worker_roles.length} workers · all data from Supabase, no mocks
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  body: { background: "#0a0a0b", color: "#ededf0", minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif", fontSize: 14 },
  topbar: { height: 56, padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { fontWeight: 500, fontSize: 14, display: "flex", alignItems: "center", gap: 10, color: "#a1a1aa" },
  logoMark: { width: 22, height: 22, borderRadius: 6, background: "linear-gradient(135deg, #c79a6b, #b88556)", color: "#1a1a1a", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" },
  topbarRight: { display: "flex", alignItems: "center", gap: 8 },
  topBtn: { padding: "8px 14px", borderRadius: 8, color: "#a1a1aa", fontSize: 13, textDecoration: "none", border: "1px solid #25252d" },
  snap: { padding: "26px 28px 18px", borderBottom: "1px solid #1a1a20" },
  snapHeadline: { fontFamily: "'Cooper', Georgia, serif", fontSize: 28, lineHeight: 1.25, fontWeight: 400 },
  snapMeta: { marginTop: 8, fontSize: 11, color: "#6b6b75", fontFamily: "ui-monospace, monospace" },
  tabs: { display: "flex", gap: 4, padding: "12px 28px", borderBottom: "1px solid #1a1a20" },
  tab: { background: "transparent", border: "1px solid #25252d", color: "#a1a1aa", padding: "6px 14px", borderRadius: 6, cursor: "pointer", textTransform: "capitalize", fontSize: 12 },
  tabActive: { color: "#0a0a0b", background: "#c79a6b", borderColor: "#c79a6b" },
  section: { padding: "20px 28px" },
  panelLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b6b75", fontWeight: 600, marginBottom: 14 },
  agentCard: { background: "#15151a", padding: 14, borderRadius: 8, marginBottom: 10 },
  agentRow: { display: "flex", gap: 12, alignItems: "flex-start" },
  agentAvatar: { width: 40, height: 40, borderRadius: 8, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" },
  chiefBadge: { fontSize: 10, color: "#c79a6b", letterSpacing: "0.1em", textTransform: "uppercase" },
  agentName: { fontFamily: "'Cooper', Georgia, serif", fontSize: 18, marginTop: 2 },
  agentTagline: { fontSize: 12, color: "#a1a1aa", marginTop: 2 },
  agentRole: { fontSize: 10, color: "#3d3d45", fontFamily: "ui-monospace, monospace", marginTop: 4 },
  workerGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10, marginTop: 12 },
  empty: { color: "#6b6b75", fontSize: 12, padding: 12, fontFamily: "ui-monospace, monospace" },
  chatBox: { display: "flex", gap: 8, alignItems: "flex-end" },
  chatInput: { flex: 1, minHeight: 80, padding: 12, background: "#0f0f11", border: "1px solid #25252d", borderRadius: 8, color: "#ededf0", fontSize: 13, fontFamily: "inherit", resize: "vertical" },
  sendBtn: { padding: "10px 18px", background: "#c79a6b", color: "#0a0a0b", border: 0, borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "8px 10px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b6b75", borderBottom: "1px solid #25252d" },
  tr: { borderBottom: "1px solid #1a1a20" },
  td: { padding: "8px 10px" },
  footer: { padding: "20px 28px", color: "#6b6b75", fontSize: 11, fontFamily: "ui-monospace, monospace", borderTop: "1px solid #1a1a20", marginTop: 20 },
};
