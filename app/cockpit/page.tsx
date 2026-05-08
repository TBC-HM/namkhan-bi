// app/cockpit/page.tsx
// Cockpit — IT Department UI
// Reads everything live from Supabase. No hardcoded data.
// Deps: @supabase/supabase-js (already installed in namkhan-bi)
//
// Required env vars (already exist in your Vercel project):
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY  (read-only client access; server uses service role)
//   SUPABASE_SERVICE_ROLE_KEY      (server-only, for admin ops on cockpit tables)
//
// To deploy:
//   1. Save this file as app/cockpit/page.tsx
//   2. Save the API routes (see end of file for separate route files)
//   3. git add . && git commit -m "feat: cockpit UI" && git push
//   4. Vercel auto-deploys

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import NotificationsBar from "@/components/cockpit/NotificationsBar";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Tab = "chat" | "schedule" | "team" | "logs" | "data" | "knowledge" | "tools" | "activity" | "docs" | "deploys";

type Ticket = {
  id: number;
  created_at: string;
  arm: string;
  intent: string;
  status: string;
  parsed_summary: string | null;
  pr_url: string | null;
  github_issue_url: string | null;
  iterations: number;
};

type AuditLog = {
  id: number;
  created_at: string;
  job: string;
  arms: string[] | null;
  skills: string[] | null;
  status: string;
  trigger: string | null;
  duration_ms: number | null;
  output: string | null;
  cost_usd: number | null;
  pr_url: string | null;
};

type Incident = {
  id: number;
  created_at: string;
  severity: string;
  title: string;
  body: string | null;
  resolved_at: string | null;
};

type KpiSnapshot = {
  id: number;
  taken_at: string;
  metric: string;
  value: number;
  unit: string | null;
  source: string | null;
};

type SchemaTable = {
  schema: string;
  name: string;
  row_count: number;
  size_bytes: number;
  has_rls: boolean;
  is_view: boolean;
};

type Agent = {
  name: string;
  display_name?: string;
  avatar?: string;
  tagline?: string;
  color?: string | null;
  department?: string;
  role: string;
  skills: string[] | { id: number; name: string; description: string }[];
  workers: number;
  state: "idle" | "active" | "attention";
  is_chief?: boolean;
  version?: number;
  prompt_source?: string;
  last_updated?: string | null;
  runs_24h?: number;
  success_rate?: number | null;
  last_run_at?: string | null;
  active_ticket_ids?: number[];
  cost_24h_usd?: string;
};

// Human-friendly titles for the team (org chart + cards).
const AGENT_TITLES: Record<string, string> = {
  it_manager: "Chief · IT Manager",
  lead: "Senior Engineer · decomposes features",
  frontend: "Frontend Engineer · UI specialist",
  backend: "Backend Engineer · schema + API",
  designer: "Designer · brand & design system",
  researcher: "Research Analyst · data + investigation",
  reviewer: "Code Reviewer · risks + must-have tests",
  tester: "QA Lead · test plans",
  documentarian: "Technical Writer · docs + ADRs",
  ops_lead: "Operations Lead · external handoff",
  code_spec_writer: "Spec Writer · GH-issue-ready specs",
  skill_creator: "Skill Architect · designs new tools",
  none: "Generalist · fallback dispatcher",
};
const friendlyTitle = (key: string) => AGENT_TITLES[key] ?? key.replace(/_/g, " ");
const friendlySkill = (key: string) =>
  key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function CockpitPage() {
  const [tab, setTab] = useState<Tab>("chat");
  const [orgOpen, setOrgOpen] = useState(false);
  const [systemHealth, setSystemHealth] = useState<"green" | "yellow" | "red">("green");
  const [counts, setCounts] = useState({ schedule: 0, team: 0, logs: 0, data: 0 });

  // Top-level health probe — refreshed every 30s
  useEffect(() => {
    const probe = async () => {
      const { data } = await supabase
        .from("cockpit_incidents")
        .select("severity")
        .is("resolved_at", null);
      if (!data || data.length === 0) return setSystemHealth("green");
      if (data.some((i) => i.severity === "critical")) return setSystemHealth("red");
      return setSystemHealth("yellow");
    };
    probe();
    const id = setInterval(probe, 30_000);
    return () => clearInterval(id);
  }, []);

  // Tab counts — single batch read on mount
  useEffect(() => {
    (async () => {
      const [logsCount, tablesCount] = await Promise.all([
        supabase.from("cockpit_audit_log").select("id", { count: "exact", head: true }),
        fetch("/api/cockpit/schema/tables").then((r) => r.json()).catch(() => ({ tables: [] })),
      ]);
      setCounts({
        schedule: 0, // populated by schedule tab itself
        team: 0,
        logs: logsCount.count ?? 0,
        data: tablesCount.tables?.length ?? 0,
      });
    })();
  }, []);

  return (
    <div className="cockpit">
      <NotificationsBar />
      <TopBar
        tab={tab}
        setTab={setTab}
        counts={counts}
        systemHealth={systemHealth}
        onOrg={() => setOrgOpen(true)}
      />

      <div className="content">
        {tab === "chat" && <ChatTab />}
        {tab === "knowledge" && <KnowledgeTab />}
        {tab === "tools" && <ToolsTab />}
        {tab === "activity" && <ActivityTab />}
        {tab === "docs" && <DocsTab />}
        {tab === "deploys" && <DeploysTab />}
        {tab === "schedule" && <ScheduleTab onCount={(n) => setCounts((c) => ({ ...c, schedule: n }))} />}
        {tab === "team" && <TeamTab onCount={(n) => setCounts((c) => ({ ...c, team: n }))} />}
        {tab === "logs" && <LogsTab />}
        {tab === "data" && <DataTab />}
      </div>

      {orgOpen && <OrgOverlay onClose={() => setOrgOpen(false)} />}

      <style jsx global>{`
        :root {
          --bg-0: #0a0e1a;
          --bg-1: #131826;
          --bg-2: #1a2030;
          --bg-3: #232b3d;
          --border: #1f2937;
          --border-2: #2a3447;
          --text-0: #f3f4f6;
          --text-1: #cbd5e0;
          --text-2: #8b95a7;
          --text-3: #64748b;
          --green: #22c55e;
          --green-bg: rgba(34, 197, 94, 0.12);
          --yellow: #f59e0b;
          --yellow-bg: rgba(245, 158, 11, 0.12);
          --red: #ef4444;
          --red-bg: rgba(239, 68, 68, 0.12);
          --blue: #60a5fa;
          --blue-bg: rgba(96, 165, 250, 0.12);
          --purple: #a855f7;
          --purple-bg: rgba(168, 85, 247, 0.12);
          --cyan: #22d3ee;
          --cyan-bg: rgba(34, 211, 238, 0.12);
          --pink: #ec4899;
          --pink-bg: rgba(236, 72, 153, 0.12);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
          background: var(--bg-0);
          color: var(--text-0);
          font-size: 13px;
          line-height: 1.4;
        }
        .cockpit {
          height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .content { flex: 1; overflow: hidden; }
        ::-webkit-scrollbar { width: 7px; height: 7px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--border-2); }
      `}</style>
    </div>
  );
}

// ============================================================================
// TOP BAR
// ============================================================================
function TopBar({
  tab,
  setTab,
  counts,
  systemHealth,
  onOrg,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  counts: { schedule: number; team: number; logs: number; data: number };
  systemHealth: "green" | "yellow" | "red";
  onOrg: () => void;
}) {
  const healthColor = { green: "var(--green)", yellow: "var(--yellow)", red: "var(--red)" }[systemHealth];
  const healthLabel = { green: "All operational", yellow: "Attention", red: "Critical" }[systemHealth];

  return (
    <div className="topbar">
      <div className="logo">
        <div className="logo-dot" style={{ background: healthColor, boxShadow: `0 0 8px ${healthColor}` }} />
        Cockpit
      </div>
      <div className="topbar-sub">namkhan-bi</div>

      <div className="tabs">
        <Tab name="💬 Chat" active={tab === "chat"} onClick={() => setTab("chat")} />
        <Tab name="📊 Activity" active={tab === "activity"} onClick={() => setTab("activity")} />
        <Tab name="👥 Team" active={tab === "team"} onClick={() => setTab("team")} count={counts.team} />
        <Tab name="🧠 Knowledge" active={tab === "knowledge"} onClick={() => setTab("knowledge")} />
        <Tab name="📄 Docs" active={tab === "docs"} onClick={() => setTab("docs")} />
        <Tab name="🚀 Deploys" active={tab === "deploys"} onClick={() => setTab("deploys")} />
        <Tab name="📅 Schedule" active={tab === "schedule"} onClick={() => setTab("schedule")} count={counts.schedule} />
        <Tab name="📜 Logs" active={tab === "logs"} onClick={() => setTab("logs")} count={counts.logs} />
        <Tab name="🗄 Data" active={tab === "data"} onClick={() => setTab("data")} count={counts.data} />
        <Tab name="🔗 Tools" active={tab === "tools"} onClick={() => setTab("tools")} />
      </div>

      <div className="topbar-right">
        <a className="org-btn" href="https://vercel.com/pbsbase-2825s-projects/namkhan-bi/deployments" target="_blank" rel="noreferrer" title="Latest preview deploys">🌐 Preview</a>
        <a className="org-btn" href="/" target="_blank" rel="noreferrer" title="Open the live BI app in a new tab">↗ App</a>
        <div className="system-pulse" style={{ background: `${healthColor}20`, borderColor: `${healthColor}50`, color: healthColor }}>
          <div className="pulse-dot" style={{ background: healthColor }} />
          <span>{healthLabel}</span>
        </div>
        <div className="user-avatar">PB</div>
      </div>

      <style jsx>{`
        .topbar {
          height: 48px;
          background: var(--bg-1);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          padding: 0 20px;
          gap: 14px;
          flex-shrink: 0;
        }
        .logo { font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 8px; }
        .logo-dot { width: 8px; height: 8px; border-radius: 50%; }
        .topbar-sub { font-size: 11px; color: var(--text-3); }
        .tabs { display: flex; margin-left: 6px; }
        .topbar-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
        .org-btn {
          background: var(--bg-2);
          border: 1px solid var(--border-2);
          color: var(--text-1);
          border-radius: 6px;
          padding: 6px 11px;
          font-size: 11px;
          cursor: pointer;
        }
        .org-btn:hover { border-color: var(--blue); color: var(--blue); }
        .system-pulse {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 11px;
          border: 1px solid;
          border-radius: 14px;
          font-size: 11px;
        }
        .pulse-dot { width: 6px; height: 6px; border-radius: 50%; animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .user-avatar {
          width: 28px; height: 28px;
          background: var(--bg-2); border: 1px solid var(--border-2);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; color: var(--text-1); font-weight: 600;
        }
      `}</style>
    </div>
  );
}

function Tab({ name, active, onClick, count }: { name: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <div className={`tab ${active ? "active" : ""}`} onClick={onClick}>
      {name}
      {count !== undefined && count > 0 && <span className="tab-count">{count > 999 ? `${Math.floor(count / 1000)}k` : count}</span>}
      <style jsx>{`
        .tab {
          padding: 0 13px; height: 48px;
          display: flex; align-items: center; gap: 6px;
          font-size: 12px; color: var(--text-2);
          cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px;
        }
        .tab.active { color: var(--text-0); border-bottom-color: var(--blue); }
        .tab:hover:not(.active) { color: var(--text-1); }
        .tab-count {
          font-size: 9.5px; background: var(--bg-2);
          padding: 1px 5px; border-radius: 8px; color: var(--text-2);
        }
        .tab.active .tab-count { background: var(--blue-bg); color: var(--blue); }
      `}</style>
    </div>
  );
}

// ============================================================================
// CHAT TAB
// Plain-English status labels per PBS 2026-05-07 — internal state names are jargon.
function statusLabel(s: string): string {
  switch (s) {
    case "new": return "📥 Just received";
    case "triaging": return "👀 Reading";
    case "triaged": return "⏳ Waiting (queued for specialist)";
    case "working": return "🛠️ In process";
    case "in_progress": return "🛠️ In process";
    case "awaits_user": return "🟡 Needs you";
    case "completed": return "✅ Finished";
    case "triage_failed": return "❌ Failed";
    case "blocked": return "🚧 Blocked";
    case "cancelled": return "⊘ Cancelled";
    case "merged": return "✅ Merged";
    default: return s;
  }
}

// ============================================================================
type Filter = "open" | "waiting" | "done" | "failed" | "all";

const FILTER_GROUPS: Record<Filter, string[]> = {
  open: ["new", "triaging", "triaged", "working"],
  waiting: ["awaits_user"],
  done: ["completed"],
  failed: ["triage_failed", "blocked"],
  all: [],
};

// ─── Tiny inline markdown renderer ───────────────────────────────────────
// Covers what agents actually emit: headers, bold, italic, code, lists,
// links, tables, inline code. No new dependency.
function mdToHtml(md: string): string {
  if (!md) return "";
  let s = md;
  // Escape HTML first
  s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Code fences ```lang ... ```
  s = s.replace(/```([a-z]*)\n([\s\S]*?)```/g, (_m, lang, body) => {
    return `<pre class="md-pre" data-lang="${lang || ""}"><code>${body}</code></pre>`;
  });
  // Headers (#, ##, ###)
  s = s.replace(/^### (.+)$/gm, "<h4 class='md-h4'>$1</h4>");
  s = s.replace(/^## (.+)$/gm, "<h3 class='md-h3'>$1</h3>");
  s = s.replace(/^# (.+)$/gm, "<h2 class='md-h2'>$1</h2>");
  // Bold + italic
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = s.replace(/`([^`]+?)`/g, "<code class='md-code'>$1</code>");
  // Links
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<a href='$2' target='_blank' rel='noreferrer' class='md-a'>$1</a>");
  // Tables (simple pipe-tables)
  s = s.replace(/((?:^\|.+\|\n)+)/gm, (block) => {
    const rows = block.trim().split("\n").map((r) => r.trim());
    if (rows.length < 2) return block;
    const isSep = (r: string) => /^\|[\s|:-]+\|$/.test(r);
    const hdr = rows[0];
    const sep = rows[1];
    if (!isSep(sep)) return block;
    const body = rows.slice(2);
    const splitRow = (r: string) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    const th = splitRow(hdr).map((c) => `<th>${c}</th>`).join("");
    const tbody = body.map((r) => `<tr>${splitRow(r).map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
    return `<table class='md-table'><thead><tr>${th}</tr></thead><tbody>${tbody}</tbody></table>`;
  });
  // Lists (- or * at start of line)
  s = s.replace(/(^|\n)((?:[-*] .+\n?)+)/g, (_m, lead, block) => {
    const items = block.trim().split("\n").map((l: string) => l.replace(/^[-*] /, "")).map((l: string) => `<li>${l}</li>`).join("");
    return `${lead}<ul class='md-ul'>${items}</ul>`;
  });
  // Paragraphs (double newlines)
  s = s.replace(/\n\n+/g, "</p><p class='md-p'>");
  s = `<p class='md-p'>${s}</p>`;
  // Single newlines → <br>
  s = s.replace(/(<\/p><p class='md-p'>)|(\n)/g, (m) => (m === "\n" ? "<br/>" : m));
  return s;
}

// Extract all ```json ... ``` blocks from a markdown string.
function extractJsonBlocks(md: string): { jsons: unknown[]; stripped: string } {
  if (!md) return { jsons: [], stripped: md };
  const jsons: unknown[] = [];
  const stripped = md.replace(/```json\n([\s\S]*?)```/gi, (_m, body) => {
    try {
      jsons.push(JSON.parse(body));
    } catch {
      jsons.push({ __unparseable: body });
    }
    return "";
  });
  return { jsons, stripped };
}

// Build a clean human-readable markdown summary from agent JSON output.
// Preference order:
//   1. summary_markdown (agent's own pre-rendered output — Olive v3, Felix v2 etc.)
//   2. Known structured fields (next_action, plan, findings, team_roster_if_relevant, …)
//   3. Recursive walk of nested objects (BRIEFING, table arrays, …) — last resort
//      so older agents (Olive v2 / pre-summary_markdown) still render readably.
function walkObjectAsMarkdown(o: Record<string, unknown>, depth = 0): string {
  // Skip noise keys + already-handled keys
  const SKIP = new Set([
    "mode", "owner", "deps", "estimated_minutes", "needs_human_decision",
    "interpretations_if_ambiguous", "blocking_questions", "next_action",
    "summary", "summary_markdown", "plan", "findings", "team_roster_if_relevant",
    "recommendation", "result_summary", "tasks", "critical_path", "parallel_safe",
    "rollout_plan", "__skill_calls",
  ]);
  const lines: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    if (SKIP.has(k)) continue;
    const heading = depth === 0 ? `### ${k}` : `**${k}**`;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      // Array of objects with consistent shape → markdown table
      const allObjs = v.every((x) => x && typeof x === "object" && !Array.isArray(x));
      if (allObjs && v.length > 1) {
        const cols = Array.from(new Set(v.flatMap((x) => Object.keys(x as object))));
        if (cols.length > 0 && cols.length <= 6) {
          lines.push(heading);
          lines.push("| " + cols.join(" | ") + " |");
          lines.push("| " + cols.map(() => "---").join(" | ") + " |");
          for (const row of v as Array<Record<string, unknown>>) {
            lines.push("| " + cols.map((c) => {
              const cell = row[c];
              if (cell === null || cell === undefined) return "—";
              return typeof cell === "string" ? cell : JSON.stringify(cell);
            }).join(" | ") + " |");
          }
          continue;
        }
      }
      lines.push(heading);
      for (const item of v) {
        if (item && typeof item === "object") {
          lines.push("- " + JSON.stringify(item));
        } else {
          lines.push(`- ${item}`);
        }
      }
    } else if (v && typeof v === "object") {
      lines.push(heading);
      lines.push(walkObjectAsMarkdown(v as Record<string, unknown>, depth + 1));
    } else if (v !== null && v !== undefined && v !== "") {
      lines.push(`**${k}:** ${v}`);
    }
  }
  return lines.join("\n\n");
}

function agentJsonToMarkdown(j: unknown): string {
  if (!j || typeof j !== "object") return "";
  const o = j as Record<string, unknown>;
  // 1. Agent-supplied pre-rendered markdown wins
  if (typeof o.summary_markdown === "string" && o.summary_markdown.trim().length > 0) {
    return o.summary_markdown.trim();
  }
  // 2. Known structured fields
  const lines: string[] = [];
  if (typeof o.next_action === "string") lines.push(`**Next:** ${o.next_action}`);
  if (typeof o.summary === "string") lines.push(o.summary);
  if (Array.isArray(o.plan) && o.plan.length > 0) {
    lines.push("**Plan**");
    o.plan.forEach((p) => lines.push(`- ${typeof p === "string" ? p : JSON.stringify(p)}`));
  }
  if (Array.isArray(o.tasks) && o.tasks.length > 0) {
    lines.push("**Tasks**");
    lines.push("| # | Owner | Title | Est. min |");
    lines.push("|---|---|---|---|");
    (o.tasks as Array<Record<string, unknown>>).forEach((t, i) =>
      lines.push(`| ${t.order ?? i + 1} | ${t.owner ?? "—"} | ${t.title ?? "—"} | ${t.estimated_minutes ?? "—"} |`)
    );
  }
  if (Array.isArray(o.findings) && o.findings.length > 0) {
    lines.push("**Findings**");
    o.findings.forEach((f) => lines.push(`- ${typeof f === "string" ? f : JSON.stringify(f)}`));
  }
  if (Array.isArray(o.team_roster_if_relevant) && o.team_roster_if_relevant.length > 0) {
    lines.push("**Team**");
    lines.push("| Role | Name | Tagline |");
    lines.push("|---|---|---|");
    (o.team_roster_if_relevant as Array<Record<string, unknown>>).forEach((m) =>
      lines.push(`| ${m.role ?? "—"} | ${m.display_name ?? "—"} | ${m.tagline ?? "—"} |`)
    );
  }
  if (Array.isArray(o.blocking_questions) && o.blocking_questions.length > 0) {
    lines.push("**Questions**");
    o.blocking_questions.forEach((q) => lines.push(`- ${typeof q === "string" ? q : JSON.stringify(q)}`));
  }
  if (typeof o.recommendation === "string") lines.push(`**Recommendation:** ${o.recommendation}`);
  if (typeof o.result_summary === "string") lines.push(o.result_summary);
  if (typeof o.rollout_plan === "string") lines.push(`**Rollout:** ${o.rollout_plan}`);
  // 3. If nothing structured matched, walk the rest of the object (handles legacy
  // BRIEFING-style payloads from Olive v2 ticket #25 etc.)
  if (lines.length === 0) {
    const walked = walkObjectAsMarkdown(o, 0);
    if (walked.trim().length > 0) return walked;
  } else {
    // Append any unhandled keys at the bottom (don't repeat known ones)
    const walked = walkObjectAsMarkdown(o, 0);
    if (walked.trim().length > 0) lines.push(walked);
  }
  return lines.join("\n\n");
}

type Attachment = { name: string; path: string; public_url: string | null; size: number; mime: string; ext: string };

function ChatTab() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<Filter>("open");
  const [search, setSearch] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listEnd = useRef<HTMLDivElement>(null);

  const [threadStart, setThreadStart] = useState<string>(() => {
    if (typeof window === "undefined") return new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    return localStorage.getItem("kit_cockpit_thread_start") ?? new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  });
  // Resizable left ticket panel — PBS wants to drag the divider.
  const [listWidth, setListWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 280;
    const saved = parseInt(localStorage.getItem("kit_cockpit_list_width") ?? "280", 10);
    return Number.isFinite(saved) && saved >= 200 && saved <= 700 ? saved : 280;
  });
  const draggingRef = useRef(false);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const w = Math.max(200, Math.min(700, e.clientX));
      setListWidth(w);
    };
    const onUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false;
        document.body.style.cursor = "";
        localStorage.setItem("kit_cockpit_list_width", String(listWidth));
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [listWidth]);
  const startNewChat = () => {
    const now = new Date().toISOString();
    localStorage.setItem("kit_cockpit_thread_start", now);
    setThreadStart(now);
    setActiveTicket(null);
    setInput("");
  };
  const loadTickets = useCallback(async () => {
    const { data } = await supabase
      .from("cockpit_tickets")
      .select("*")
      // Hide cron/scheduled tickets — they live in the Schedule tab now (PBS 2026-05-07)
      .not("source", "ilike", "cron_%")
      .gte("created_at", threadStart)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setTickets(data);
  }, [threadStart]);

  useEffect(() => {
    loadTickets();
    const channel = supabase
      .channel("cockpit_tickets_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "cockpit_tickets" }, () => loadTickets())
      .subscribe();
    // Belt-and-braces poll every 15s in case realtime drops (Bug 3 — DB and UI got out of sync)
    const poll = setInterval(loadTickets, 15_000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, [loadTickets]);

  // Keep activeTicket in sync with the latest list (status updates from agents arrive after selection)
  useEffect(() => {
    if (!activeTicket) return;
    const fresh = tickets.find((t) => t.id === activeTicket.id);
    if (fresh && (fresh.status !== activeTicket.status || fresh.parsed_summary !== activeTicket.parsed_summary)) {
      setActiveTicket(fresh);
    }
  }, [tickets, activeTicket]);

  useEffect(() => { listEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [tickets]);

  const send = async (override?: string) => {
    const msg = (override ?? input).trim();
    if ((!msg && attachments.length === 0) || sending) return;
    setSending(true);
    try {
      // If attachments exist, append references to the message body
      let body = msg;
      if (attachments.length > 0) {
        const lines = attachments.map(
          (a) => `📎 ${a.name} (${(a.size / 1024).toFixed(1)} KB) → ${a.public_url ?? a.path}`
        );
        body = msg ? `${msg}\n\n**Attached files:**\n${lines.join("\n")}` : `**Attached files:**\n${lines.join("\n")}`;
      }
      const res = await fetch("/api/cockpit/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: body, attachments }),
      });
      if (!res.ok) throw new Error("Send failed");
      if (!override) setInput("");
      setAttachments([]);
      await loadTickets();
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setSending(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newAttachments: Attachment[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/cockpit/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(`Upload failed for ${file.name}: ${err.error ?? res.statusText}`);
          continue;
        }
        const json = await res.json();
        newAttachments.push({
          name: json.name,
          path: json.path,
          public_url: json.public_url,
          size: json.size,
          mime: json.mime,
          ext: json.ext,
        });
      }
      setAttachments((prev) => [...prev, ...newAttachments]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (path: string) => {
    setAttachments((prev) => prev.filter((a) => a.path !== path));
  };

  const requestMagicLink = async () => {
    try {
      const res = await fetch("/api/cockpit/auth/magic-link");
      if (!res.ok) throw new Error("magic link failed");
      const json = await res.json();
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(json.url)}`;
      const w = window.open("", "_blank", "width=400,height=500");
      if (w) {
        w.document.write(`<html><body style='font-family:system-ui;text-align:center;padding:20px'><h3>Scan with phone</h3><img src='${qrUrl}' /><p style='font-size:11px;word-break:break-all'>${json.url}</p><p style='color:#888;font-size:11px'>Expires in 10 min · single use · sets 30-day cookie</p></body></html>`);
      } else {
        alert(`Magic link (10 min):\n${json.url}`);
      }
    } catch (e) {
      alert(`Magic link error: ${e instanceof Error ? e.message : "unknown"}`);
    }
  };

  return (
    <div className="chat-tab" style={{ gridTemplateColumns: `${listWidth}px 6px 1fr` }}>
      <div className="chat-list">
        <div className="chat-list-header">
          <span>Conversation</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={startNewChat} className="chat-magic-btn" title="Start a new conversation — hides previous tickets">＋ New</button>
            <button onClick={loadTickets} className="chat-magic-btn" title="Refresh ticket list">🔄</button>
            <button onClick={requestMagicLink} className="chat-magic-btn" title="Get a 10-min QR code to log in on phone">📱</button>
          </div>
        </div>
        <div className="chat-filters">
          {(["open", "waiting", "done", "failed", "all"] as Filter[]).map((f) => {
            const count =
              f === "all"
                ? tickets.length
                : tickets.filter((t) => FILTER_GROUPS[f].includes(t.status)).length;
            const label = f === "waiting" ? "needs you" : f;
            const tooltip = f === "waiting"
              ? "Awaiting your input. After the autonomous-repair mandate (KB #271) this should only show when an agent genuinely needs PBS — personal credential, real outbound message, or owner-only action. Anything else is a stale ticket Cowork should close."
              : f === "open" ? "In flight — triaging, triaged, working, in_progress."
              : f === "done" ? "Completed."
              : f === "failed" ? "Triage failed or blocked."
              : "Every ticket regardless of status.";
            return (
              <button
                key={f}
                className={`chat-filter-pill ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}
                title={tooltip}
              >
                {label} {count > 0 && <span className="cf-count">{count}</span>}
              </button>
            );
          })}
        </div>
        <input
          className="chat-search"
          placeholder="Search summary…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {(() => {
          const filtered = tickets.filter((t) => {
            const passFilter = filter === "all" || FILTER_GROUPS[filter].includes(t.status);
            const passSearch =
              !search.trim() ||
              (t.parsed_summary ?? "").toLowerCase().includes(search.toLowerCase()) ||
              t.arm?.toLowerCase().includes(search.toLowerCase()) ||
              t.intent?.toLowerCase().includes(search.toLowerCase());
            return passFilter && passSearch;
          });
          if (filtered.length === 0) {
            return <div className="chat-empty">No tickets match · {filter} {search ? `· "${search}"` : ""}</div>;
          }
          return filtered.map((t) => (
            <div
              key={t.id}
              className={`chat-list-item ${activeTicket?.id === t.id ? "active" : ""}`}
              onClick={() => setActiveTicket(t)}
            >
              <div className="cli-top">
                <span className={`cli-arm cli-arm-${t.arm}`}>{t.arm}</span>
                <span className="cli-status" data-status={t.status}>{statusLabel(t.status)}</span>
                <span className="cli-time">{relTime(t.created_at)}</span>
              </div>
              <div className="cli-summary">{t.parsed_summary || `#${t.id} · ${t.intent}`}</div>
            </div>
          ));
        })()}
      </div>

      <div
        className="chat-resizer"
        onMouseDown={() => { draggingRef.current = true; document.body.style.cursor = "col-resize"; }}
        title="Drag to resize ticket list"
      />

      <div className="chat-main">
        <div className="chat-thread">
          {!activeTicket && tickets.length > 0 && (
            <div className="chat-empty">Select a ticket on the left to view details, or type below to start a new conversation.</div>
          )}
          {!activeTicket && tickets.length === 0 && (
            <div className="chat-empty">No conversations yet. Type below to dispatch your first ticket to the IT Manager.</div>
          )}
          {activeTicket && (
            <div className="chat-ticket-detail">
              <div className="ctd-header">
                <h2>#{activeTicket.id} · {activeTicket.intent}</h2>
                <div className="ctd-meta">
                  <span className={`cli-arm cli-arm-${activeTicket.arm}`}>{activeTicket.arm}</span>
                  <span className="cli-status" data-status={activeTicket.status}>{statusLabel(activeTicket.status)}</span>
                  <span className="cli-time">{absTime(activeTicket.created_at)}</span>
                  {activeTicket.iterations > 0 && <span className="cli-time">{activeTicket.iterations} iterations</span>}
                </div>
              </div>
              <div className="ctd-body">
                {(() => {
                  const raw = activeTicket.parsed_summary;
                  if (!raw) return <i>No summary parsed yet.</i>;
                  const { jsons, stripped } = extractJsonBlocks(raw);
                  const agentSummaries = jsons.map(agentJsonToMarkdown).filter((s) => s.trim().length > 0);
                  const human = [stripped.trim(), ...agentSummaries].filter(Boolean).join("\n\n---\n\n");
                  return (
                    <>
                      <div className="md-render" dangerouslySetInnerHTML={{ __html: mdToHtml(human) }} />
                      {jsons.length > 0 && (
                        <details className="ctd-raw">
                          <summary>Show raw agent JSON ({jsons.length})</summary>
                          {jsons.map((j, i) => (
                            <pre key={i} className="ctd-raw-pre">{JSON.stringify(j, null, 2)}</pre>
                          ))}
                        </details>
                      )}
                    </>
                  );
                })()}
              </div>
              {activeTicket.status === "awaits_user" && (
                <div className="ctd-approve">
                  <button
                    onClick={() => send("approve")}
                    disabled={sending}
                    className="ctd-approve-btn ctd-approve-yes"
                  >
                    {sending ? "Applying…" : "✅ Approve"}
                  </button>
                  <button
                    onClick={() => send("reject")}
                    disabled={sending}
                    className="ctd-approve-btn ctd-approve-no"
                  >
                    Reject
                  </button>
                  <span className="ctd-approve-hint">Or type your own follow-up below.</span>
                </div>
              )}
              {activeTicket.pr_url && (
                <a className="ctd-link" href={activeTicket.pr_url} target="_blank" rel="noreferrer">
                  View PR ↗
                </a>
              )}
              {activeTicket.github_issue_url && (
                <a className="ctd-link" href={activeTicket.github_issue_url} target="_blank" rel="noreferrer">
                  View GitHub Issue ↗
                </a>
              )}
            </div>
          )}
          <div ref={listEnd} />
        </div>

        <div className="chat-input-wrap">
          {attachments.length > 0 && (
            <div className="chat-attachments">
              {attachments.map((a) => (
                <span key={a.path} className="chat-attachment-chip" title={a.path}>
                  📎 {a.name} <small>({(a.size / 1024).toFixed(0)} KB)</small>
                  <button
                    className="chat-attachment-remove"
                    onClick={() => removeAttachment(a.path)}
                    title="Remove"
                  >×</button>
                </span>
              ))}
            </div>
          )}
          <textarea
            className="chat-input"
            value={input}
            placeholder="Ask the IT Manager: build, fix, investigate, decide..."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
            }}
            disabled={sending}
            rows={3}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            accept=".md,.txt,.csv,.tsv,.json,.yaml,.yml,.pdf,.doc,.docx,.rtf,.odt,.xls,.xlsx,.ods,.ppt,.pptx,.odp,.png,.jpg,.jpeg,.gif,.webp,.avif,.svg,.heic,.heif,.zip,.tar,.gz,.tgz,.mp4,.mov,.webm,.m4a,.mp3,.wav"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            className="chat-attach"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || uploading}
            title="Attach files (md, zip, csv, xlsx, docs, images, ...)"
          >
            {uploading ? "↑ Uploading…" : "📎 Attach"}
          </button>
          <button
            className="chat-send"
            onClick={() => send()}
            disabled={sending || (!input.trim() && attachments.length === 0)}
          >
            {sending ? "Sending..." : "Send · ⌘↵"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .chat-tab { height: 100%; display: grid; grid-template-columns: 280px 6px 1fr; }
        .chat-list { background: var(--bg-1); border-right: 1px solid var(--border); overflow-y: auto; }
        .chat-resizer {
          background: var(--brass);
          opacity: 0.25;
          cursor: col-resize;
          transition: opacity 0.12s;
          position: relative;
        }
        .chat-resizer:hover { opacity: 0.85; }
        .chat-resizer::after {
          content: "⋮"; position: absolute; top: 50%; left: 50%;
          transform: translate(-50%,-50%); color: #0a0a0b; font-size: 14px;
          font-weight: 700; line-height: 1;
        }
        .chat-list-header {
          padding: 14px 16px 8px;
          font-size: 10px; color: var(--text-3);
          text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600;
          display: flex; align-items: center; justify-content: space-between;
        }
        .chat-filters {
          display: flex; flex-wrap: wrap; gap: 4px; padding: 4px 12px 8px;
          border-bottom: 1px solid var(--border);
        }
        .chat-filter-pill {
          padding: 3px 9px; border-radius: 99px; cursor: pointer;
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px;
          font-weight: 600; background: transparent; color: var(--text-3);
          border: 1px solid var(--border);
        }
        .chat-filter-pill.active {
          background: var(--text-1); color: var(--bg-0);
          border-color: var(--text-1);
        }
        .cf-count { font-weight: 400; opacity: 0.7; margin-left: 3px; }
        .chat-search {
          width: calc(100% - 24px); margin: 8px 12px;
          padding: 6px 8px; border-radius: 4px;
          border: 1px solid var(--border); background: var(--bg-2);
          color: var(--text-1); font-size: 11px;
        }
        .chat-search:focus { outline: 1px solid var(--cyan); }
        .chat-magic-btn {
          background: none; border: none; cursor: pointer; padding: 0 4px;
          font-size: 14px; line-height: 1;
        }
        .chat-magic-btn:hover { opacity: 0.7; }
        .ctd-approve {
          margin-top: 16px; padding: 14px; border-radius: 8px;
          background: var(--yellow-bg); border: 1px solid var(--yellow);
          display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
        }
        .ctd-approve-btn {
          padding: 8px 16px; border-radius: 6px; cursor: pointer;
          font-size: 13px; font-weight: 600; border: 1px solid transparent;
        }
        .ctd-approve-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ctd-approve-yes {
          background: var(--green); color: white; border-color: var(--green);
        }
        .ctd-approve-no {
          background: transparent; color: var(--text-1); border-color: var(--border);
        }
        .ctd-approve-hint { font-size: 11px; color: var(--text-3); }
        .chat-empty {
          padding: 30px 20px; text-align: center;
          color: var(--text-3); font-size: 12px;
        }
        .chat-list-item {
          padding: 10px 16px; border-bottom: 1px solid var(--border);
          cursor: pointer;
        }
        .chat-list-item:hover { background: var(--bg-2); }
        .chat-list-item.active { background: var(--bg-2); border-left: 2px solid var(--blue); padding-left: 14px; }
        .cli-top { display: flex; gap: 6px; align-items: center; margin-bottom: 4px; }
        .cli-arm {
          font-size: 9.5px; padding: 1px 6px; border-radius: 3px;
          text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600;
          background: var(--bg-3); color: var(--text-2);
        }
        .cli-arm-health { background: var(--green-bg); color: var(--green); }
        .cli-arm-dev { background: var(--cyan-bg); color: var(--cyan); }
        .cli-arm-research { background: var(--purple-bg); color: var(--purple); }
        .cli-arm-control { background: var(--yellow-bg); color: var(--yellow); }
        .cli-arm-design { background: var(--pink-bg); color: var(--pink); }
        .cli-status {
          font-size: 9.5px; padding: 1px 6px; border-radius: 3px;
          text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600;
        }
        .cli-status[data-status="merged"], .cli-status[data-status="closed"] { background: var(--green-bg); color: var(--green); }
        .cli-status[data-status="in_progress"] { background: var(--cyan-bg); color: var(--cyan); }
        .cli-status[data-status="awaits_user"] { background: var(--yellow-bg); color: var(--yellow); }
        .cli-status[data-status="failed"], .cli-status[data-status="cancelled"] { background: var(--red-bg); color: var(--red); }
        .cli-time { margin-left: auto; font-size: 10px; color: var(--text-3); font-family: ui-monospace, monospace; }
        .cli-summary { font-size: 12px; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .chat-main { display: flex; flex-direction: column; overflow: hidden; }
        .chat-thread { flex: 1; overflow-y: auto; padding: 24px; }
        .chat-ticket-detail h2 { font-size: 16px; margin-bottom: 8px; }
        .ctd-meta { display: flex; gap: 8px; margin-bottom: 14px; }
        .ctd-body {
          background: var(--bg-1); border: 1px solid var(--border);
          border-radius: 8px; padding: 14px 16px;
          font-size: 13px; color: var(--text-1); line-height: 1.6;
          white-space: pre-wrap;
        }
        .ctd-link {
          display: inline-block; margin-top: 12px;
          padding: 6px 12px; background: var(--bg-2); border: 1px solid var(--border-2);
          border-radius: 5px; color: var(--blue); text-decoration: none; font-size: 12px;
        }
        .ctd-link:hover { border-color: var(--blue); }
        .chat-input-wrap {
          padding: 14px 24px; border-top: 1px solid var(--border);
          display: flex; gap: 10px; background: var(--bg-1); flex-wrap: wrap;
        }
        .chat-attachments {
          flex-basis: 100%;
          display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 4px;
        }
        .chat-attachment-chip {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--bg-2); border: 1px solid var(--border-2);
          border-radius: 6px; padding: 4px 8px; font-size: 11px;
          color: var(--text-1);
        }
        .chat-attachment-chip small { color: var(--text-3); font-size: 10px; }
        .chat-attachment-remove {
          background: transparent; border: none; color: var(--text-3);
          cursor: pointer; font-size: 14px; padding: 0 2px; line-height: 1;
        }
        .chat-attachment-remove:hover { color: var(--bad, #b3261e); }
        .chat-input {
          flex: 1; resize: none; min-width: 200px;
          background: var(--bg-2); border: 1px solid var(--border-2); color: var(--text-0);
          border-radius: 7px; padding: 10px 14px; font-size: 13px;
          font-family: inherit; outline: none;
        }
        .chat-input:focus { border-color: var(--blue); }
        .chat-input:disabled { opacity: 0.5; }
        .chat-attach {
          background: var(--bg-2); border: 1px solid var(--border-2); color: var(--text-1);
          border-radius: 7px; padding: 0 12px; font-size: 12px;
          cursor: pointer; align-self: flex-end; height: 38px;
        }
        .chat-attach:hover:not(:disabled) { border-color: var(--brass); color: var(--brass); }
        .chat-attach:disabled { opacity: 0.4; cursor: not-allowed; }
        .chat-send {
          background: var(--blue); border: none; color: white;
          border-radius: 7px; padding: 0 16px; font-size: 12px; font-weight: 600;
          cursor: pointer; align-self: flex-end; height: 38px;
        }
        .chat-send:disabled { opacity: 0.4; cursor: not-allowed; }
        .md-render { font-size: 13px; line-height: 1.55; color: var(--text-0); }
        .md-render .md-h2 { font-size: 16px; margin: 12px 0 6px; color: var(--text-0); }
        .md-render .md-h3 { font-size: 14px; margin: 10px 0 4px; color: var(--text-1); }
        .md-render .md-h4 { font-size: 13px; margin: 8px 0 4px; color: var(--text-1); }
        .md-render .md-p { margin: 6px 0; }
        .md-render .md-ul { margin: 6px 0; padding-left: 22px; }
        .md-render .md-ul li { margin: 2px 0; }
        .md-render .md-pre { background: var(--bg-2); padding: 10px 12px; border-radius: 6px; overflow-x: auto; font-size: 11px; }
        .md-render .md-code { background: var(--bg-2); padding: 1px 5px; border-radius: 3px; font-size: 11px; }
        .md-render .md-a { color: var(--blue); text-decoration: underline; }
        .md-render .md-table { border-collapse: collapse; margin: 8px 0; font-size: 12px; }
        .md-render .md-table th, .md-render .md-table td { border: 1px solid var(--border-2); padding: 5px 8px; text-align: left; }
        .md-render .md-table th { background: var(--bg-2); font-weight: 600; }
        .ctd-raw { margin-top: 12px; }
        .ctd-raw summary { cursor: pointer; color: var(--text-3); font-size: 11px; }
        .ctd-raw-pre {
          margin-top: 6px; background: var(--bg-2); padding: 10px 12px; border-radius: 6px;
          overflow-x: auto; font-size: 10px; color: var(--text-2); white-space: pre-wrap;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// SCHEDULE TAB — reads from /api/cockpit/schedule which lists GitHub Actions + Make.com scenarios
// ============================================================================
type Mismatch = {
  id: number; detected_at: string; source: string; agent_or_target: string | null;
  ticket_id: number | null; category: string; what_machine_said: string;
  what_reality_is: string; fix_applied: string | null; fixed_at: string | null; active: boolean;
};

function MismatchPanel() {
  const [items, setItems] = useState<Mismatch[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  useEffect(() => {
    const tick = async () => {
      const q = supabase.from("cockpit_mismatches").select("*").order("id", { ascending: false }).limit(50);
      const { data } = showResolved ? await q : await q.eq("active", true);
      setItems((data as Mismatch[]) ?? []);
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [showResolved]);
  const resolve = async (id: number) => {
    await supabase.from("cockpit_mismatches").update({ active: false, fixed_at: new Date().toISOString() }).eq("id", id);
    const t = await supabase.from("cockpit_mismatches").select("*").order("id", { ascending: false }).limit(50);
    setItems((t.data as Mismatch[]) ?? []);
  };
  return (
    <div style={{ background: "var(--bg-2)", border: "1px solid var(--border-1)", borderRadius: 8, padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "var(--bad, #b3261e)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
          🚨 Where the machine did not work · {items.filter((i) => i.active).length} active
        </div>
        <label style={{ fontSize: 11, color: "var(--text-3)", cursor: "pointer" }}>
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} style={{ marginRight: 4 }} />
          show resolved
        </label>
      </div>
      {items.length === 0 ? (
        <div style={{ color: "var(--text-3)", fontSize: 12, padding: 8 }}>— no mismatches recorded —</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((m) => (
            <div key={m.id} style={{ background: "var(--bg-1)", border: `1px solid ${m.active ? "var(--bad, #b3261e)" : "var(--border-2)"}`, borderRadius: 6, padding: 10, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div>
                  <span style={{ background: "var(--bad, #b3261e)", color: "#fff", padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>{m.category}</span>
                  <span style={{ marginLeft: 8, color: "var(--text-3)", fontSize: 11 }}>{m.agent_or_target ?? "—"} · {new Date(m.detected_at).toISOString().slice(0, 16).replace("T", " ")}</span>
                </div>
                {m.active && (
                  <button onClick={() => resolve(m.id)} style={{ background: "transparent", color: "var(--good, #2a7d2e)", border: "1px solid var(--good, #2a7d2e)", borderRadius: 4, padding: "2px 8px", fontSize: 10, cursor: "pointer" }}>mark resolved</button>
                )}
              </div>
              <div style={{ marginBottom: 4 }}><span style={{ color: "var(--text-3)" }}>Machine said:</span> {m.what_machine_said}</div>
              <div style={{ marginBottom: 4 }}><span style={{ color: "var(--good, #2a7d2e)" }}>Reality:</span> {m.what_reality_is}</div>
              {m.fix_applied && <div style={{ color: "var(--brass)", fontSize: 11 }}>Fix: {m.fix_applied}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type CronJob = { jobid: number; jobname: string; schedule: string; command: string; active: boolean; username: string };
type CronRun = { runid: number; jobid: number; jobname: string; status: string; return_message: string | null; start_time: string; end_time: string | null; duration_sec: number | null };

function ScheduleTab({ onCount }: { onCount: (n: number) => void }) {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [j, r] = await Promise.all([
      supabase.from("v_cockpit_cron_jobs").select("*"),
      supabase.from("v_cockpit_cron_recent").select("*").limit(80),
    ]);
    setJobs((j.data as CronJob[]) ?? []);
    setRuns((r.data as CronRun[]) ?? []);
    onCount(j.data?.length ?? 0);
    setLoading(false);
  }, [onCount]);

  useEffect(() => {
    load();
    const id = setInterval(load, 12_000);
    return () => clearInterval(id);
  }, [load]);

  const saveEdit = async (jobid: number) => {
    if (!editVal.trim()) { setEditing(null); return; }
    await supabase.rpc("cockpit_cron_update", { p_jobid: jobid, p_schedule: editVal.trim(), p_active: null });
    setEditing(null); setEditVal("");
    load();
  };
  const toggleActive = async (jobid: number, current: boolean) => {
    await supabase.rpc("cockpit_cron_update", { p_jobid: jobid, p_schedule: null, p_active: !current });
    load();
  };

  const lastRunByJob: Record<number, CronRun | undefined> = {};
  for (const r of runs) if (!lastRunByJob[r.jobid]) lastRunByJob[r.jobid] = r;

  // Owner inference
  function ownerOf(j: CronJob): string {
    if (j.jobname.startsWith("agent-")) return "Kit (agent runner)";
    if (j.jobname.startsWith("cockpit-")) return "Cowork";
    if (j.jobname.startsWith("compset")) return "Vector";
    if (j.jobname.startsWith("kb-") || j.jobname.includes("embed")) return "Cowork";
    if (j.jobname.startsWith("it_window")) return "Sentinel";
    if (j.jobname.includes("self_heal")) return "Cowork (self-heal)";
    return "system";
  }

  return (
    <div className="schedule-tab">
      <div className="page-header">
        <h1>Schedule</h1>
        <span className="page-sub">
          Every cron job in Supabase. Edit the schedule inline (5-field cron expression). Toggle active.
          Owner shows who runs each. {jobs.length} jobs, {runs.length} runs in last 7d.
        </span>
      </div>
      {loading && <div className="empty">Loading…</div>}
      {!loading && jobs.length === 0 && <div className="empty">No cron jobs yet.</div>}
      {!loading && jobs.length > 0 && (
        <table className="sched-table">
          <thead>
            <tr>
              <th>Job</th><th>Schedule</th><th>Owner</th><th>Active</th>
              <th>Last run</th><th>Last status</th><th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => {
              const last = lastRunByJob[j.jobid];
              return (
                <tr key={j.jobid}>
                  <td><div style={{ fontWeight: 600 }}>{j.jobname}</div>
                    <div style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "ui-monospace, monospace", marginTop: 2 }}>{j.command.replace(/\s+/g, " ").slice(0, 80)}…</div>
                  </td>
                  <td>
                    {editing === j.jobid ? (
                      <input value={editVal} onChange={(e) => setEditVal(e.target.value)}
                        onBlur={() => saveEdit(j.jobid)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(j.jobid); if (e.key === "Escape") setEditing(null); }}
                        autoFocus
                        style={{ background: "var(--bg-2)", color: "var(--text-1)", border: "1px solid var(--brass)", borderRadius: 4, padding: "4px 8px", fontFamily: "ui-monospace, monospace", fontSize: 12, width: 140 }}
                      />
                    ) : <code>{j.schedule}</code>}
                  </td>
                  <td><span style={{ fontSize: 11, color: "var(--brass)" }}>{ownerOf(j)}</span></td>
                  <td>
                    <button onClick={() => toggleActive(j.jobid, j.active)}
                      style={{ background: j.active ? "var(--good, #2a7d2e)" : "var(--text-3)", color: "#0a0a0b", border: 0, borderRadius: 4, padding: "3px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                      {j.active ? "ON" : "OFF"}
                    </button>
                  </td>
                  <td>{last ? new Date(last.start_time).toISOString().slice(0, 16).replace("T", " ") : "—"}</td>
                  <td>{last ? <span className="src-pill" data-src={last.status}>{last.status}</span> : "—"}</td>
                  <td>
                    {editing === j.jobid ? null : (
                      <button onClick={() => { setEditing(j.jobid); setEditVal(j.schedule); }}
                        style={{ background: "transparent", color: "var(--brass)", border: "1px solid var(--brass)", borderRadius: 4, padding: "3px 10px", fontSize: 10, cursor: "pointer" }}>
                        edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <style jsx>{`
        .schedule-tab { padding: 24px; height: 100%; overflow-y: auto; }
        .page-header { margin-bottom: 16px; }
        .page-header h1 { font-size: 18px; font-weight: 600; }
        .page-sub { font-size: 12px; color: var(--text-3); }
        .empty { padding: 40px; text-align: center; color: var(--text-3); }
        .sched-table { width: 100%; border-collapse: collapse; background: var(--bg-1); border-radius: 8px; overflow: hidden; }
        th { background: var(--bg-2); padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-3); }
        td { padding: 10px 14px; border-top: 1px solid var(--border); font-size: 12px; vertical-align: top; }
        code { font-family: ui-monospace, monospace; font-size: 11.5px; color: var(--cyan); }
        .src-pill { font-size: 10px; padding: 2px 7px; border-radius: 3px; text-transform: uppercase; }
        .src-pill[data-src="succeeded"] { background: var(--green-bg); color: var(--good, #2a7d2e); }
        .src-pill[data-src="failed"] { background: var(--red-bg); color: var(--bad, #b3261e); }
      `}</style>
    </div>
  );
}

// ============================================================================
// TEAM TAB — reads agent definitions from /api/cockpit/team
// ============================================================================
type AgentStat = { agent: string; runs_24h: number; cost_milli_24h: number; success_pct: number; last_action_at: string | null };

const kpiBox: React.CSSProperties = { background: "var(--bg-2)", border: "1px solid var(--border-1)", padding: 14, borderRadius: 8 };
const kpiLabel: React.CSSProperties = { fontSize: 10, color: "var(--brass)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 };
const kpiVal: React.CSSProperties = { fontFamily: "'Cooper', Georgia, serif", fontSize: 24, color: "var(--text-1)", marginTop: 4 };

function TeamTab({ onCount }: { onCount: (n: number) => void }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<Record<string, AgentStat>>({});
  const [kpi, setKpi] = useState({ total_runs: 0, total_cost_usd: 0, active_agents: 0, top_agent: "—" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const team = fetch("/api/cockpit/team").then((r) => r.json()).catch(() => ({ agents: [] }));
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const audit = supabase.from("cockpit_audit_log")
        .select("agent,success,cost_usd_milli,created_at")
        .gte("created_at", since)
        .limit(2000);
      const [t, a] = await Promise.all([team, audit]);
      if (!alive) return;
      const itOnly = (t.agents ?? []).filter((x: Agent) => (x.department ?? "it") === "it");
      setAgents(itOnly);
      onCount(itOnly.length);
      // Aggregate audit by agent.
      const m: Record<string, { runs: number; cost: number; ok: number; last: string | null }> = {};
      for (const r of (a.data ?? []) as Array<{ agent: string; success: boolean | null; cost_usd_milli: number | null; created_at: string }>) {
        const key = r.agent ?? "?";
        if (!m[key]) m[key] = { runs: 0, cost: 0, ok: 0, last: null };
        m[key].runs += 1;
        m[key].cost += r.cost_usd_milli ?? 0;
        if (r.success) m[key].ok += 1;
        if (!m[key].last || r.created_at > m[key].last) m[key].last = r.created_at;
      }
      const built: Record<string, AgentStat> = {};
      for (const k of Object.keys(m)) {
        built[k] = {
          agent: k, runs_24h: m[k].runs, cost_milli_24h: m[k].cost,
          success_pct: m[k].runs > 0 ? Math.round((m[k].ok / m[k].runs) * 100) : 0,
          last_action_at: m[k].last,
        };
      }
      setStats(built);
      const totalRuns = Object.values(built).reduce((s, x) => s + x.runs_24h, 0);
      const totalCost = Object.values(built).reduce((s, x) => s + x.cost_milli_24h, 0) / 1000;
      const activeAgents = Object.values(built).filter((x) => x.runs_24h > 0).length;
      const top = Object.values(built).sort((a, b) => b.runs_24h - a.runs_24h)[0];
      setKpi({ total_runs: totalRuns, total_cost_usd: totalCost, active_agents: activeAgents, top_agent: top?.agent ?? "—" });
      setLoading(false);
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => { alive = false; clearInterval(id); };
  }, [onCount]);

  function statFor(role: string): AgentStat | undefined {
    return stats[role];
  }

  const chief = agents.find((a) => a.is_chief);
  const workers = agents.filter((a) => !a.is_chief);

  const skillName = (s: Agent["skills"][number]): string =>
    typeof s === "string" ? s : s.name;
  const skillDesc = (s: Agent["skills"][number]): string =>
    typeof s === "string" ? "" : s.description;

  return (
    <div className="team-tab">
      <div className="page-header">
        <h1>Team</h1>
        <span className="page-sub">
          Source of truth: <code>cockpit_agent_prompts</code> + <code>cockpit_agent_skills</code>. Activity from <code>cockpit_audit_log</code> (last 24h).
        </span>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, margin: "0 0 18px 0" }}>
        <div style={kpiBox}><div style={kpiLabel}>Runs · 24h</div><div style={kpiVal}>{kpi.total_runs}</div></div>
        <div style={kpiBox}><div style={kpiLabel}>Cost · 24h</div><div style={kpiVal}>${kpi.total_cost_usd.toFixed(2)}</div></div>
        <div style={kpiBox}><div style={kpiLabel}>Active agents</div><div style={kpiVal}>{kpi.active_agents}</div></div>
        <div style={kpiBox}><div style={kpiLabel}>Top by runs</div><div style={{ ...kpiVal, fontSize: 16 }}>{kpi.top_agent}</div></div>
      </div>

      {loading && <div className="empty">Loading team...</div>}
      {!loading && agents.length === 0 && <div className="empty">No agents found. Run the cockpit_agent_prompts migration.</div>}
      {!loading && chief && (
        <div className="chief-card" style={{ borderLeftColor: chief.color ?? "var(--cyan)" }}>
          <div className="chief-row">
            <div className="chief-avatar" style={{ background: chief.color ?? "var(--cyan)" }}>{chief.avatar ?? "🧭"}</div>
            <div className="chief-text">
              <div className="chief-badge">CHIEF · {(chief.department ?? "it").toUpperCase()}</div>
              <div className="chief-name">{chief.display_name ?? friendlyTitle(chief.name)}</div>
              <div className="chief-role">{chief.tagline ?? chief.role}</div>
            </div>
          </div>
          <div className="chief-stats">
            <span>v{chief.version}</span>
            <span>·</span>
            <span>{chief.skills.length} skills</span>
            <span>·</span>
            <span>{chief.runs_24h ?? 0} runs / 24h</span>
            {chief.success_rate !== null && chief.success_rate !== undefined && (
              <>
                <span>·</span>
                <span>{chief.success_rate}% ok</span>
              </>
            )}
            {chief.cost_24h_usd && Number(chief.cost_24h_usd) > 0 && (
              <>
                <span>·</span>
                <span>${chief.cost_24h_usd}</span>
              </>
            )}
            <span>·</span>
            <span className={`agent-state agent-state-${chief.state}`}>
              {chief.active_ticket_ids && chief.active_ticket_ids.length > 0 ? `working · #${chief.active_ticket_ids[0]}` : chief.state}
            </span>
          </div>
          <div className="agent-skills">
            {chief.skills.map((s) => (
              <span key={skillName(s)} className="skill-pill" title={skillDesc(s)}>{friendlySkill(skillName(s))}</span>
            ))}
          </div>
        </div>
      )}
      {!loading && workers.length > 0 && (() => {
        // Group by department.
        const byDept: Record<string, Agent[]> = {};
        for (const w of workers) {
          const d = w.department ?? "it";
          if (!byDept[d]) byDept[d] = [];
          byDept[d].push(w);
        }
        const deptOrder = ["it", ...Object.keys(byDept).filter((d) => d !== "it").sort()];
        return deptOrder.filter((d) => byDept[d]).map((dept) => (
          <div key={dept} className="dept-group">
            <h2 className="dept-heading">{dept === "it" ? "IT Department · Workers" : dept.toUpperCase() + " Department"}</h2>
            <div className="agents-grid">
              {byDept[dept].map((a) => (
                <div key={a.name} className="agent-card" style={{ borderTopColor: a.color ?? "var(--text-2)" }}>
                  <div className="agent-card-top">
                    <div className="agent-avatar-row">
                      <div className="agent-avatar" style={{ background: a.color ?? "var(--bg-2)" }}>{a.avatar ?? "🤖"}</div>
                      <div>
                        <div className="agent-name">{a.display_name ?? friendlyTitle(a.name)}</div>
                        <div className="agent-handle">{a.name}</div>
                      </div>
                    </div>
                    <span className={`agent-state agent-state-${a.state}`}>
                      {a.active_ticket_ids && a.active_ticket_ids.length > 0 ? `▶ #${a.active_ticket_ids[0]}` : a.state}
                    </span>
                  </div>
                  <div className="agent-role">{a.tagline ?? a.role}</div>
                  <div className="agent-stats">
                    <div><strong>v{a.version ?? 1}</strong></div>
                    <div><strong>{a.skills.length}</strong> skills</div>
                    {(() => {
                      const s = statFor(a.name);
                      return (
                        <>
                          <div><strong>{s?.runs_24h ?? 0}</strong> runs/24h</div>
                          {s && s.success_pct > 0 && <div><strong>{s.success_pct}%</strong> ok</div>}
                          {s && s.cost_milli_24h > 0 && <div><strong>${(s.cost_milli_24h / 1000).toFixed(3)}</strong></div>}
                          {s && s.last_action_at && <div style={{ fontSize: 10, color: "var(--text-3)" }}>last: {new Date(s.last_action_at).toISOString().slice(11, 16)}</div>}
                        </>
                      );
                    })()}
                  </div>
                  <div className="agent-skills">
                    {a.skills.length === 0 && <i className="agent-no-skills">no skills assigned</i>}
                    {a.skills.map((s) => (
                      <span key={skillName(s)} className="skill-pill" title={skillDesc(s)}>{friendlySkill(skillName(s))}</span>
                    ))}
                  </div>
                  {a.prompt_source && a.prompt_source !== "seed" && (
                    <div className="agent-source">prompt updated via <strong>{a.prompt_source}</strong></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ));
      })()}
      <style jsx>{`
        .team-tab { padding: 24px; height: 100%; overflow-y: auto; }
        .page-header { margin-bottom: 16px; }
        .page-header h1 { font-size: 18px; font-weight: 600; }
        .page-sub { font-size: 12px; color: var(--text-3); }
        .page-sub code { background: var(--bg-3); padding: 1px 6px; border-radius: 4px; font-size: 11px; }
        .empty { padding: 40px; text-align: center; color: var(--text-3); }
        .chief-card {
          margin-bottom: 24px;
          padding: 18px 22px;
          background: linear-gradient(135deg, var(--bg-1) 0%, var(--cyan-bg) 100%);
          border: 1px solid var(--cyan); border-radius: 12px;
          border-left: 6px solid var(--cyan);
        }
        .chief-row { display: flex; gap: 14px; align-items: center; margin-bottom: 8px; }
        .chief-avatar { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
        .chief-text { flex: 1; min-width: 0; }
        .agent-avatar-row { display: flex; gap: 10px; align-items: center; flex: 1; min-width: 0; }
        .agent-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
        .agent-handle { font-size: 10px; color: var(--text-3); font-family: ui-monospace, Menlo, monospace; margin-top: 1px; }
        .dept-group { margin-bottom: 28px; }
        .dept-heading { font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-3); font-weight: 600; margin: 18px 0 10px 0; }
        .chief-badge {
          display: inline-block; font-size: 9.5px; letter-spacing: 0.6px;
          color: var(--cyan); text-transform: uppercase; font-weight: 700;
          margin-bottom: 6px;
        }
        .chief-name { font-size: 16px; font-weight: 600; margin-bottom: 2px; }
        .chief-role { font-size: 12px; color: var(--text-2); margin-bottom: 10px; }
        .chief-stats {
          display: flex; gap: 6px; flex-wrap: wrap; align-items: center;
          font-size: 11px; color: var(--text-2); margin-bottom: 12px;
        }
        .agent-card-top { display: flex; justify-content: space-between; align-items: center; }
        .agent-source { margin-top: 8px; font-size: 10px; color: var(--text-3); font-style: italic; }
        .agent-source strong { color: var(--text-1); }
        .agents-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 14px;
        }
        .agent-card {
          background: var(--bg-1); border: 1px solid var(--border-2);
          border-radius: 10px; padding: 14px 16px;
          border-top: 3px solid var(--text-2);
        }
        .agent-card.agent-health { border-top-color: var(--green); }
        .agent-card.agent-dev, .agent-card.agent-development { border-top-color: var(--cyan); }
        .agent-card.agent-research, .agent-card.agent-researcher { border-top-color: var(--purple); }
        .agent-card.agent-control, .agent-card.agent-tester { border-top-color: var(--yellow); }
        .agent-card.agent-design, .agent-card.agent-designer { border-top-color: var(--pink); }
        .agent-name { font-size: 13px; font-weight: 600; }
        .agent-role { font-size: 10px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 10px; }
        .agent-stats { display: flex; gap: 14px; font-size: 11px; color: var(--text-2); margin-bottom: 10px; }
        .agent-stats strong { color: var(--text-0); }
        .agent-state { padding: 1px 7px; border-radius: 3px; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; }
        .agent-state-idle { background: var(--bg-3); color: var(--text-3); }
        .agent-state-active { background: var(--cyan-bg); color: var(--cyan); }
        .agent-state-attention { background: var(--yellow-bg); color: var(--yellow); }
        .agent-skills { display: flex; flex-wrap: wrap; gap: 4px; }
        .agent-no-skills { font-size: 11px; color: var(--text-3); }
        .skill-pill {
          background: var(--bg-2); border: 1px solid var(--border);
          font-size: 10.5px; padding: 2px 7px; border-radius: 3px; color: var(--text-1);
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// LOGS TAB — cockpit_audit_log with filters
// ============================================================================
type AuditRow = {
  id: number; created_at: string;
  agent: string | null; action: string | null; target: string | null;
  ticket_id: number | null; success: boolean | null;
  reasoning: string | null;
  input_tokens: number | null; output_tokens: number | null;
  cost_usd_milli: number | null; duration_ms: number | null;
};

function LogsTab() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [filter, setFilter] = useState<"all" | "success" | "failed" | "today">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("cockpit_audit_log")
      .select("id,created_at,agent,action,target,ticket_id,success,reasoning,input_tokens,output_tokens,cost_usd_milli,duration_ms")
      .order("id", { ascending: false }).limit(300);
    if (filter === "success") q = q.eq("success", true);
    if (filter === "failed") q = q.eq("success", false);
    if (filter === "today") {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      q = q.gte("created_at", today.toISOString());
    }
    const { data } = await q;
    setLogs((data as AuditRow[]) ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
    const ch = supabase.channel("audit_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cockpit_audit_log" }, () => load())
      .subscribe();
    const id = setInterval(load, 10_000);
    return () => { supabase.removeChannel(ch); clearInterval(id); };
  }, [load]);

  const filtered = search
    ? logs.filter((l) =>
        (l.agent ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (l.action ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (l.target ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (l.reasoning ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <div className="logs-tab">
      <div className="logs-toolbar">
        <input
          className="logs-search"
          placeholder="Search logs by job, arm, output..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="logs-filter">
          {(["all", "success", "failed", "today"] as const).map((f) => (
            <span key={f} className={`filter-pill ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f}
            </span>
          ))}
        </div>
      </div>

      <div className="logs-list">
        {loading && <div className="empty">Loading logs...</div>}
        {!loading && filtered.length === 0 && <div className="empty">No log rows match.</div>}
        {filtered.map((log) => {
          const sev = log.success === true ? "success" : log.success === false ? "failed" : "partial";
          return (
            <div key={log.id} className={`log-row log-${sev}`}>
              <div className="log-row-header">
                <div className="log-time">{absTime(log.created_at)}</div>
                <div className="log-job">{log.agent ?? "—"} · {log.action ?? "—"}</div>
                <div className={`log-status log-${sev}`}>{sev}</div>
                {log.ticket_id && <div className="log-trigger">#{log.ticket_id}</div>}
                {log.duration_ms != null && <div className="log-duration">{formatDuration(log.duration_ms)}</div>}
              </div>
              <div className="log-meta">
                {log.target && <div><span className="meta-label">target:</span> {log.target}</div>}
                {log.cost_usd_milli != null && log.cost_usd_milli > 0 && <div><span className="meta-label">cost:</span> ${(log.cost_usd_milli / 1000).toFixed(3)}</div>}
                {log.input_tokens != null && log.input_tokens > 0 && <div><span className="meta-label">tokens:</span> {log.input_tokens}+{log.output_tokens ?? 0}</div>}
              </div>
              {log.reasoning && <div className="log-output">{log.reasoning}</div>}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .logs-tab { height: 100%; display: flex; flex-direction: column; }
        .logs-toolbar {
          background: var(--bg-1); border-bottom: 1px solid var(--border);
          padding: 14px 24px; display: flex; align-items: center; gap: 12px;
        }
        .logs-search {
          flex: 1; background: var(--bg-2); border: 1px solid var(--border-2);
          color: var(--text-0); border-radius: 6px; padding: 7px 12px;
          font-size: 12px; outline: none; font-family: inherit;
        }
        .logs-search:focus { border-color: var(--blue); }
        .logs-filter { display: flex; gap: 4px; }
        .filter-pill {
          font-size: 11px; padding: 6px 11px;
          background: var(--bg-2); border: 1px solid var(--border-2);
          border-radius: 5px; color: var(--text-2); cursor: pointer;
          text-transform: capitalize;
        }
        .filter-pill:hover { color: var(--text-0); }
        .filter-pill.active { background: var(--blue-bg); border-color: var(--blue); color: var(--blue); }
        .logs-list { flex: 1; overflow-y: auto; padding: 0 24px 24px; }
        .empty { padding: 40px; text-align: center; color: var(--text-3); }
        .log-row {
          background: var(--bg-1); border: 1px solid var(--border);
          border-radius: 7px; padding: 12px 14px; margin-top: 8px;
          border-left: 3px solid var(--text-3);
        }
        .log-row.log-success { border-left-color: var(--green); }
        .log-row.log-partial { border-left-color: var(--yellow); }
        .log-row.log-failed, .log-row.log-skipped { border-left-color: var(--red); }
        .log-row-header { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; flex-wrap: wrap; }
        .log-time { font-family: ui-monospace, monospace; font-size: 11px; color: var(--text-3); }
        .log-job { font-size: 12.5px; font-weight: 600; }
        .log-status {
          font-size: 9.5px; padding: 1px 7px; border-radius: 3px;
          text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600;
        }
        .log-status.log-success { background: var(--green-bg); color: var(--green); }
        .log-status.log-partial { background: var(--yellow-bg); color: var(--yellow); }
        .log-status.log-failed, .log-status.log-skipped { background: var(--red-bg); color: var(--red); }
        .log-trigger { font-size: 10px; color: var(--text-3); background: var(--bg-2); padding: 1px 7px; border-radius: 3px; text-transform: uppercase; }
        .log-duration { margin-left: auto; font-size: 11px; color: var(--text-3); font-family: ui-monospace, monospace; }
        .log-meta { display: flex; gap: 14px; font-size: 11px; color: var(--text-2); margin-top: 5px; flex-wrap: wrap; }
        .meta-label { color: var(--text-3); font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
        .log-output {
          margin-top: 8px; padding: 8px 11px; background: var(--bg-2); border-radius: 5px;
          font-size: 11.5px; color: var(--text-1); line-height: 1.5;
        }
        .log-action {
          display: inline-block; margin-top: 8px; font-size: 10.5px;
          padding: 4px 9px; background: var(--bg-2); border: 1px solid var(--border-2);
          border-radius: 4px; color: var(--blue); text-decoration: none;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// DATA TAB — Supabase schema browser
// ============================================================================
function DataTab() {
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [columns, setColumns] = useState<Array<{ name: string; type: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/cockpit/schema/tables")
      .then((r) => r.json())
      .then((d) => {
        setTables(d.tables ?? []);
        if (d.tables?.[0]) setActiveTable(`${d.tables[0].schema}.${d.tables[0].name}`);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeTable) return;
    fetch(`/api/cockpit/schema/rows?table=${encodeURIComponent(activeTable)}&limit=50`)
      .then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setColumns(d.columns ?? []); });
  }, [activeTable]);

  const grouped: Record<string, SchemaTable[]> = {};
  for (const t of tables) {
    const visible = !search || t.name.toLowerCase().includes(search.toLowerCase());
    if (!visible) continue;
    const key = t.name.startsWith("cockpit_") ? "Cockpit" : t.schema === "auth" ? "Auth" : t.schema === "storage" ? "Storage" : "Hotel BI";
    grouped[key] = grouped[key] || [];
    grouped[key].push(t);
  }

  const activeMeta = tables.find((t) => `${t.schema}.${t.name}` === activeTable);

  return (
    <div className="data-tab">
      <div className="tables-sidebar">
        <input
          className="tables-search"
          placeholder="Search tables..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {loading && <div className="empty">Loading schema...</div>}
        {!loading && Object.keys(grouped).length === 0 && <div className="empty">No tables found.</div>}
        {Object.entries(grouped).map(([section, tabs]) => (
          <div key={section} className="tables-section">
            <div className="tables-section-label">{section} · {tabs.length}</div>
            {tabs.map((t) => (
              <div
                key={`${t.schema}.${t.name}`}
                className={`table-item ${activeTable === `${t.schema}.${t.name}` ? "active" : ""} ${t.is_view ? "view" : ""}`}
                onClick={() => setActiveTable(`${t.schema}.${t.name}`)}
              >
                <span className="table-item-icon">{t.is_view ? "▶" : "⊞"}</span>
                <span className="table-item-name">{t.name}</span>
                <span className="table-item-rows">{formatRowCount(t.row_count)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="table-main">
        {!activeTable && <div className="empty">Select a table.</div>}
        {activeTable && activeMeta && (
          <>
            <div className="table-header">
              <div className="table-name">{activeMeta.schema}.{activeMeta.name}</div>
              <div className="table-meta">
                <span><strong>{activeMeta.row_count}</strong> rows</span>
                <span><strong>{columns.length}</strong> columns</span>
                <span>{formatBytes(activeMeta.size_bytes)}</span>
                {activeMeta.has_rls && <span className="rls-pill">RLS</span>}
                {activeMeta.is_view && <span className="view-pill">VIEW</span>}
              </div>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th key={c.name}>{c.name} <span className="col-type">{c.type}</span></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan={columns.length} className="empty-row">No rows</td></tr>}
                  {rows.map((r, i) => (
                    <tr key={i}>
                      {columns.map((c) => (
                        <td key={c.name}>{formatCell(r[c.name])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              Showing {rows.length} of {activeMeta.row_count} · read-only
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .data-tab { height: 100%; display: grid; grid-template-columns: 280px 1fr; }
        .tables-sidebar { background: var(--bg-1); border-right: 1px solid var(--border); overflow-y: auto; padding: 14px 0; }
        .tables-search {
          margin: 0 12px 14px; width: calc(100% - 24px);
          background: var(--bg-2); border: 1px solid var(--border-2); color: var(--text-0);
          border-radius: 6px; padding: 7px 11px; font-size: 12px; outline: none; font-family: inherit;
        }
        .tables-section { margin-bottom: 16px; }
        .tables-section-label {
          font-size: 10px; color: var(--text-3); text-transform: uppercase;
          letter-spacing: 0.6px; padding: 0 16px 6px; font-weight: 600;
        }
        .table-item {
          padding: 7px 16px; font-size: 12px; color: var(--text-1);
          cursor: pointer; display: flex; align-items: center; gap: 7px;
          border-left: 2px solid transparent;
        }
        .table-item:hover { background: var(--bg-2); }
        .table-item.active { background: var(--bg-2); border-left-color: var(--blue); color: var(--text-0); }
        .table-item-icon { color: var(--text-3); font-size: 12px; }
        .table-item.view .table-item-icon { color: var(--purple); }
        .table-item-name { flex: 1; font-family: ui-monospace, monospace; font-size: 11.5px; }
        .table-item-rows { font-size: 10px; color: var(--text-3); }
        .table-main { display: flex; flex-direction: column; overflow: hidden; }
        .empty { padding: 40px; text-align: center; color: var(--text-3); }
        .table-header { background: var(--bg-1); border-bottom: 1px solid var(--border); padding: 14px 20px; }
        .table-name { font-size: 14px; font-weight: 600; font-family: ui-monospace, monospace; margin-bottom: 6px; }
        .table-meta { display: flex; gap: 12px; font-size: 11px; color: var(--text-3); }
        .table-meta strong { color: var(--text-1); }
        .rls-pill, .view-pill { padding: 1px 6px; border-radius: 3px; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; }
        .rls-pill { background: var(--green-bg); color: var(--green); }
        .view-pill { background: var(--purple-bg); color: var(--purple); }
        .table-scroll { flex: 1; overflow: auto; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 12px; font-family: ui-monospace, monospace; }
        .data-table thead th {
          background: var(--bg-1); color: var(--text-3); font-size: 10.5px;
          text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600;
          text-align: left; padding: 8px 14px;
          border-bottom: 1px solid var(--border); border-right: 1px solid var(--border);
          position: sticky; top: 0; white-space: nowrap;
        }
        .col-type { color: var(--text-3); font-size: 9.5px; margin-left: 4px; text-transform: lowercase; font-weight: 400; }
        .data-table tbody td {
          padding: 8px 14px; border-bottom: 1px solid var(--border); border-right: 1px solid var(--border);
          color: var(--text-1); white-space: nowrap; max-width: 250px; overflow: hidden; text-overflow: ellipsis;
        }
        .data-table tbody tr:hover td { background: var(--bg-2); }
        .empty-row { text-align: center; color: var(--text-3); padding: 30px !important; }
        .table-footer {
          background: var(--bg-1); border-top: 1px solid var(--border);
          padding: 9px 20px; font-size: 11px; color: var(--text-3);
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// ORG CHART OVERLAY — reads from /api/cockpit/team
// ============================================================================
function OrgOverlay({ onClose }: { onClose: () => void }) {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    fetch("/api/cockpit/team").then((r) => r.json()).then((d) => setAgents(d.agents ?? []));
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div className="overlay">
      <div className="overlay-header">
        <div>
          <div className="overlay-title">IT Department · Org Chart</div>
          <div className="overlay-sub">All arms with their skills · click ESC to close</div>
        </div>
        <button className="overlay-close" onClick={onClose}>×</button>
      </div>
      <div className="org-chart">
        <div className="org-level">
          {(() => {
            const chiefNode = agents.find((a) => a.is_chief);
            const totalSkills = agents.reduce((s, a) => s + a.skills.length, 0);
            return (
              <div className="org-node manager">
                <div className="org-node-title">{chiefNode ? friendlyTitle(chiefNode.name) : "Chief · IT Manager"}</div>
                <div className="org-node-role">{chiefNode?.role ?? "routes everything"}</div>
                <div className="org-node-stats">
                  <div><strong>{agents.length - (chiefNode ? 1 : 0)}</strong> reports</div>
                  <div><strong>{totalSkills}</strong> total skills</div>
                </div>
                {chiefNode && chiefNode.active_ticket_ids && chiefNode.active_ticket_ids.length > 0 && (
                  <div className="org-node-state state-active">▶ working · #{chiefNode.active_ticket_ids[0]}</div>
                )}
              </div>
            );
          })()}
        </div>
        <div className="org-arrows"><div className="org-arrow-trunk" /></div>
        <div className="org-level">
          {agents.filter((a) => !a.is_chief).map((a) => (
            <div key={a.name} className={`org-node org-${a.name.toLowerCase()}`}>
              <div className="org-node-title">{friendlyTitle(a.name)}</div>
              <div className="org-node-role">{a.role}</div>
              <div className="org-node-stats">
                <div><strong>{a.skills.length}</strong> skills</div>
                <div><strong>{a.runs_24h ?? 0}</strong> runs/24h</div>
              </div>
              <div className={`org-node-state state-${a.state}`}>
                {a.active_ticket_ids && a.active_ticket_ids.length > 0 ? `▶ #${a.active_ticket_ids[0]}` : a.state}
              </div>
            </div>
          ))}
        </div>

        <div className="skills-grid-all">
          {agents.map((a) => {
            const skillItems = a.skills as ({ id: number; name: string; description: string }[] | string[]);
            return (
              <div key={a.name} className={`arm-skills-panel arm-${a.name.toLowerCase()}`}>
                <div className="arm-panel-header">
                  <span className="arm-name">{friendlyTitle(a.name)}</span>
                  <span className="arm-count">{a.skills.length} skills</span>
                </div>
                <div className="arm-skills">
                  {a.skills.length === 0 && <i className="no-skills">no skills assigned</i>}
                  {skillItems.map((s) => {
                    const sname = typeof s === "string" ? s : s.name;
                    const sdesc = typeof s === "string" ? "" : s.description;
                    return <span key={sname} className="skill-pill" title={sdesc}>{friendlySkill(sname)}</span>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .overlay {
          position: fixed; inset: 0;
          background: rgba(10, 14, 26, 0.92); backdrop-filter: blur(6px);
          z-index: 100; padding: 26px; overflow: auto;
        }
        .overlay-header { display: flex; align-items: center; margin-bottom: 20px; max-width: 1200px; margin-left: auto; margin-right: auto; }
        .overlay-title { font-size: 16px; font-weight: 600; }
        .overlay-sub { font-size: 12px; color: var(--text-3); margin-top: 2px; }
        .overlay-close {
          margin-left: auto; background: var(--bg-2); border: 1px solid var(--border-2);
          color: var(--text-1); width: 32px; height: 32px; border-radius: 6px;
          font-size: 14px; cursor: pointer;
        }
        .org-chart { max-width: 1200px; margin: 0 auto; }
        .org-level { display: flex; justify-content: center; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
        .org-arrows { height: 22px; margin-bottom: 6px; position: relative; }
        .org-arrow-trunk { position: absolute; top: 0; left: 50%; width: 1px; height: 100%; background: var(--border-2); }
        .org-node {
          background: var(--bg-1); border: 1px solid var(--border-2);
          border-radius: 10px; padding: 12px 14px; min-width: 158px;
          text-align: center; border-top: 3px solid var(--text-2);
        }
        .org-node.manager { border-top-color: var(--blue); min-width: 220px; }
        .org-node.org-health { border-top-color: var(--green); }
        .org-node.org-dev, .org-node.org-development { border-top-color: var(--cyan); }
        .org-node.org-research, .org-node.org-researcher { border-top-color: var(--purple); }
        .org-node.org-control, .org-node.org-tester { border-top-color: var(--yellow); }
        .org-node.org-design, .org-node.org-designer { border-top-color: var(--pink); }
        .org-node-title { font-size: 13px; font-weight: 600; }
        .org-node-role { font-size: 10px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 8px; }
        .org-node-stats { display: flex; gap: 10px; justify-content: center; font-size: 10.5px; color: var(--text-2); }
        .org-node-stats strong { color: var(--text-0); font-size: 13px; display: block; }
        .org-node-state { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.3px; margin-top: 7px; color: var(--text-3); }
        .org-node-state.state-active { color: var(--cyan); }
        .org-node-state.state-attention { color: var(--yellow); }
        .skills-grid-all {
          max-width: 1200px; margin: 24px auto 0;
          display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;
        }
        .arm-skills-panel {
          background: var(--bg-1); border: 1px solid var(--border);
          border-radius: 10px; padding: 14px 16px; border-left: 3px solid;
        }
        .arm-skills-panel.arm-health { border-left-color: var(--green); }
        .arm-skills-panel.arm-dev, .arm-skills-panel.arm-development { border-left-color: var(--cyan); }
        .arm-skills-panel.arm-research, .arm-skills-panel.arm-researcher { border-left-color: var(--purple); }
        .arm-skills-panel.arm-control, .arm-skills-panel.arm-tester { border-left-color: var(--yellow); }
        .arm-skills-panel.arm-design, .arm-skills-panel.arm-designer { border-left-color: var(--pink); }
        .arm-panel-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .arm-name { font-size: 13px; font-weight: 600; }
        .arm-count { margin-left: auto; font-size: 10.5px; color: var(--text-3); }
        .arm-skills { display: flex; flex-wrap: wrap; gap: 4px; }
        .no-skills { font-size: 11px; color: var(--text-3); }
        .skill-pill {
          background: var(--bg-2); border: 1px solid var(--border);
          font-size: 10.5px; padding: 2px 7px; border-radius: 3px; color: var(--text-1);
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================
function relTime(iso: string): string {
  const d = new Date(iso); const now = new Date(); const ms = now.getTime() - d.getTime();
  const m = Math.floor(ms / 60000); const h = Math.floor(m / 60); const days = Math.floor(h / 24);
  if (days > 0) return `${days}d ago`; if (h > 0) return `${h}h ago`; if (m > 0) return `${m}m ago`; return "now";
}
function absTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
}
function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000); if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60); return `${h}h ${m % 60}m`;
}
function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`; if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
function formatRowCount(n: number): string {
  if (n < 1000) return `${n}`; if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// ============================================================================
// KNOWLEDGE TAB — browse + add team learnings
// ============================================================================
type KbEntry = {
  id: number; topic: string; key_fact: string; scope: string;
  source: string; source_ticket_id: number | null; confidence: string;
  active: boolean; created_at: string; updated_at: string;
};

function KnowledgeTab() {
  const [entries, setEntries] = useState<KbEntry[]>([]);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("");
  const [adding, setAdding] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [newFact, setNewFact] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (scope) params.set("scope", scope);
    const r = await fetch(`/api/cockpit/knowledge?${params}`);
    const d = await r.json();
    setEntries(d.entries ?? []);
    setLoading(false);
  }, [search, scope]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("kb_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "cockpit_knowledge_base" }, () => load())
      .subscribe();
    const id = setInterval(load, 15_000); // belt + braces
    return () => { supabase.removeChannel(ch); clearInterval(id); };
  }, [load]);

  const addEntry = async () => {
    if (!newTopic.trim() || !newFact.trim()) return;
    await fetch("/api/cockpit/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: newTopic.trim(), key_fact: newFact.trim(), scope: scope || "global" }),
    });
    setNewTopic(""); setNewFact(""); setAdding(false);
    load();
  };

  const scopes = Array.from(new Set(entries.map((e) => e.scope))).sort();

  return (
    <div className="kb-tab">
      <div className="page-header">
        <h1>Team Knowledge Base</h1>
        <span className="page-sub">
          Persistent facts the team carries between tickets. Stored in <code>cockpit_knowledge_base</code>.
          Agents read this via the <code>read_knowledge_base</code> skill.
        </span>
      </div>
      <div className="kb-toolbar">
        <input placeholder="Search topic or fact…" value={search} onChange={(e) => setSearch(e.target.value)} className="kb-search" />
        <select value={scope} onChange={(e) => setScope(e.target.value)} className="kb-scope">
          <option value="">all scopes</option>
          {scopes.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => setAdding(!adding)} className="kb-add-btn">{adding ? "✕ Cancel" : "+ Add fact"}</button>
      </div>
      {adding && (
        <div className="kb-add-form">
          <input placeholder="Topic (kebab-case)" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} className="kb-input" />
          <textarea placeholder="The fact — 1-3 sentences. Include why it matters." value={newFact} onChange={(e) => setNewFact(e.target.value)} className="kb-textarea" rows={3} />
          <button onClick={addEntry} className="kb-save-btn">Save</button>
        </div>
      )}
      {loading && <div className="empty">Loading knowledge base...</div>}
      {!loading && entries.length === 0 && <div className="empty">No entries match.</div>}
      {!loading && entries.length > 0 && (
        <div className="kb-grid">
          {entries.map((e) => (
            <div key={e.id} className={`kb-card kb-conf-${e.confidence}`}>
              <div className="kb-card-top">
                <span className="kb-topic">{e.topic}</span>
                <span className={`kb-scope-pill kb-scope-${e.scope}`}>{e.scope}</span>
              </div>
              <div className="kb-fact">{e.key_fact}</div>
              <div className="kb-meta">
                <span>{e.source}</span>
                <span>·</span>
                <span>{e.confidence} confidence</span>
                <span>·</span>
                <span>{absTime(e.updated_at)}</span>
                {e.source_ticket_id && <><span>·</span><span>from ticket #{e.source_ticket_id}</span></>}
              </div>
            </div>
          ))}
        </div>
      )}
      <style jsx>{`
        .kb-tab { padding: 24px; height: 100%; overflow-y: auto; }
        .page-header { margin-bottom: 16px; }
        .page-header h1 { font-size: 18px; font-weight: 600; }
        .page-sub { font-size: 12px; color: var(--text-3); }
        .page-sub code { background: var(--bg-3); padding: 1px 6px; border-radius: 4px; font-size: 11px; }
        .empty { padding: 40px; text-align: center; color: var(--text-3); }
        .kb-toolbar { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
        .kb-search, .kb-scope, .kb-input { padding: 6px 10px; border: 1px solid var(--border); background: var(--bg-2); color: var(--text-1); border-radius: 4px; font-size: 12px; }
        .kb-search { flex: 1; min-width: 200px; }
        .kb-scope { min-width: 130px; }
        .kb-add-btn, .kb-save-btn { padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; background: var(--cyan); color: var(--bg-0); border: none; }
        .kb-save-btn { background: var(--green); }
        .kb-add-form { display: flex; flex-direction: column; gap: 8px; padding: 12px; background: var(--bg-1); border: 1px solid var(--cyan); border-radius: 6px; margin-bottom: 16px; }
        .kb-textarea { padding: 8px 10px; border: 1px solid var(--border); background: var(--bg-2); color: var(--text-1); border-radius: 4px; font-family: inherit; font-size: 12px; resize: vertical; }
        .kb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; }
        .kb-card { background: var(--bg-1); border: 1px solid var(--border); border-radius: 8px; padding: 14px; border-left: 3px solid var(--text-3); }
        .kb-card.kb-conf-high { border-left-color: var(--green); }
        .kb-card.kb-conf-medium { border-left-color: var(--yellow); }
        .kb-card.kb-conf-low { border-left-color: var(--red); }
        .kb-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 8px; }
        .kb-topic { font-size: 12px; font-weight: 600; color: var(--text-0); }
        .kb-scope-pill { font-size: 9px; padding: 2px 7px; border-radius: 99px; background: var(--bg-3); color: var(--text-2); text-transform: uppercase; letter-spacing: 0.4px; }
        .kb-fact { font-size: 12.5px; line-height: 1.45; color: var(--text-1); margin-bottom: 8px; }
        .kb-meta { display: flex; gap: 5px; flex-wrap: wrap; font-size: 10px; color: var(--text-3); }
      `}</style>
    </div>
  );
}

// ============================================================================
// ACTIVITY TAB — live boxes, pipeline funnel, 7-day chart, recent timeline
// ============================================================================
type ActivityData = {
  funnel: Record<string, number>;
  live_working: Array<{ ticket_id: number; status: string; agent_role: string; display_name: string; avatar: string; color: string | null; summary: string; elapsed_ms: number }>;
  timeline: Array<{ id: number; ticket_id: number | null; agent: string; display_name: string; avatar: string; color: string | null; action: string; success: boolean; created_at: string; cost_usd: string | null; duration_ms: number | null; reasoning: string }>;
  days_buckets: { tickets_by_day: { day: string; count: number }[]; cost_by_day: { day: string; cost_usd: number }[] };
  summary: { tickets_7d: number; events_1h: number; working_now: number };
};

function ActivityTab() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const tick = () => {
      fetch("/api/cockpit/activity").then((r) => r.json()).then((d) => alive && setData(d)).finally(() => alive && setLoading(false));
    };
    tick();
    const id = setInterval(tick, 8000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  if (loading) return <div className="act-tab"><div className="empty">Loading activity…</div></div>;
  if (!data) return <div className="act-tab"><div className="empty">No data.</div></div>;

  const funnelOrder: Array<{ key: string; label: string; color: string }> = [
    { key: "new", label: "Just received", color: "var(--text-3)" },
    { key: "triaging", label: "Reading it", color: "var(--cyan)" },
    { key: "triaged", label: "Queued for specialist", color: "var(--cyan)" },
    { key: "working", label: "Working on it", color: "var(--purple)" },
    { key: "awaits_user", label: "Needs you", color: "var(--yellow)" },
    { key: "completed", label: "Done", color: "var(--green)" },
    { key: "failed", label: "Failed", color: "var(--red)" },
  ];
  const maxCost = Math.max(0.0001, ...data.days_buckets.cost_by_day.map((d) => d.cost_usd));
  const maxTickets = Math.max(1, ...data.days_buckets.tickets_by_day.map((d) => d.count));

  return (
    <div className="act-tab">
      <div className="page-header">
        <h1>Live Activity</h1>
        <span className="page-sub">Pipeline funnel · who&apos;s working right now · 7-day cost · recent timeline. Auto-refreshes every 8s.</span>
      </div>

      <MismatchPanel />

      {/* Live working boxes */}
      <div className="act-section">
        <h3>Working right now ({data.live_working.length})</h3>
        {data.live_working.length === 0 ? (
          <div className="act-empty">No agent is currently working. Send a chat message to dispatch one.</div>
        ) : (
          <div className="act-live-grid">
            {data.live_working.map((w) => (
              <div key={w.ticket_id} className="act-live-box" style={{ borderLeftColor: w.color ?? "var(--cyan)" }}>
                <div className="act-live-top">
                  <div className="act-avatar" style={{ background: w.color ?? "var(--cyan)" }}>{w.avatar}</div>
                  <div className="act-live-meta">
                    <div className="act-live-name">{w.display_name}</div>
                    <div className="act-live-handle">working on #{w.ticket_id} · {Math.round(w.elapsed_ms / 1000)}s elapsed</div>
                  </div>
                  <div className="act-pulse">●</div>
                </div>
                <div className="act-live-summary">{w.summary || "(no summary)"}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pipeline funnel */}
      <div className="act-section">
        <h3>Pipeline · last 7 days ({data.summary.tickets_7d} tickets)</h3>
        <div className="act-funnel">
          {funnelOrder.map((f) => (
            <div key={f.key} className="act-funnel-cell" style={{ borderTopColor: f.color }}>
              <div className="act-funnel-count">{data.funnel[f.key] ?? 0}</div>
              <div className="act-funnel-label">{f.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 7-day cost + ticket charts */}
      <div className="act-charts">
        <div className="act-chart-card">
          <h3>Cost · last 7 days</h3>
          <div className="act-bars">
            {data.days_buckets.cost_by_day.map((d) => (
              <div key={d.day} className="act-bar-col" title={`${d.day}: $${d.cost_usd.toFixed(4)}`}>
                <div className="act-bar" style={{ height: `${(d.cost_usd / maxCost) * 100}%`, background: "var(--cyan)" }} />
                <div className="act-bar-label">{d.day.slice(5)}</div>
                <div className="act-bar-value">${d.cost_usd.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="act-chart-card">
          <h3>Tickets · last 7 days</h3>
          <div className="act-bars">
            {data.days_buckets.tickets_by_day.map((d) => (
              <div key={d.day} className="act-bar-col" title={`${d.day}: ${d.count} tickets`}>
                <div className="act-bar" style={{ height: `${(d.count / maxTickets) * 100}%`, background: "var(--purple)" }} />
                <div className="act-bar-label">{d.day.slice(5)}</div>
                <div className="act-bar-value">{d.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent timeline */}
      <div className="act-section">
        <h3>Recent · last hour ({data.timeline.length} events)</h3>
        {data.timeline.length === 0 ? (
          <div className="act-empty">No agent activity in the last hour.</div>
        ) : (
          <div className="act-timeline">
            {data.timeline.map((e) => (
              <div key={e.id} className={`act-event ${e.success ? "" : "act-event-fail"}`}>
                <div className="act-avatar small" style={{ background: e.color ?? "var(--bg-3)" }}>{e.avatar}</div>
                <div className="act-event-body">
                  <div className="act-event-top">
                    <span className="act-event-name">{e.display_name}</span>
                    <span className="act-event-action">{e.action}</span>
                    {e.ticket_id && <span className="act-event-ticket">#{e.ticket_id}</span>}
                    {e.cost_usd && <span className="act-event-cost">${e.cost_usd}</span>}
                    {e.duration_ms && <span className="act-event-dur">{(e.duration_ms / 1000).toFixed(1)}s</span>}
                    <span className="act-event-time">{new Date(e.created_at).toLocaleTimeString()}</span>
                  </div>
                  {e.reasoning && <div className="act-event-reason">{e.reasoning}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .act-tab { padding: 24px; height: 100%; overflow-y: auto; }
        .page-header { margin-bottom: 16px; }
        .page-header h1 { font-size: 18px; font-weight: 600; }
        .page-sub { font-size: 12px; color: var(--text-3); }
        .empty, .act-empty { padding: 30px; text-align: center; color: var(--text-3); font-size: 12px; }
        .act-empty { padding: 14px; background: var(--bg-1); border: 1px dashed var(--border); border-radius: 6px; }
        .act-section { margin-bottom: 24px; }
        .act-section h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-3); font-weight: 600; margin-bottom: 8px; }
        .act-live-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 10px; }
        .act-live-box { background: var(--bg-1); border: 1px solid var(--border); border-left: 4px solid; border-radius: 8px; padding: 12px 14px; }
        .act-live-top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .act-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
        .act-avatar.small { width: 24px; height: 24px; font-size: 12px; }
        .act-live-meta { flex: 1; min-width: 0; }
        .act-live-name { font-size: 12.5px; font-weight: 600; }
        .act-live-handle { font-size: 10.5px; color: var(--text-3); }
        .act-pulse { color: var(--green); animation: pulse 1.4s ease-in-out infinite; font-size: 14px; }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        .act-live-summary { font-size: 12px; color: var(--text-1); line-height: 1.4; }
        .act-funnel { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
        .act-funnel-cell { background: var(--bg-1); border: 1px solid var(--border); border-top: 3px solid; border-radius: 6px; padding: 10px 8px; text-align: center; }
        .act-funnel-count { font-family: Fraunces, Georgia, serif; font-style: italic; font-size: 22px; line-height: 1; }
        .act-funnel-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--text-3); margin-top: 4px; font-weight: 600; }
        .act-charts { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px; }
        .act-chart-card { background: var(--bg-1); border: 1px solid var(--border); border-radius: 8px; padding: 14px; }
        .act-chart-card h3 { margin-bottom: 12px; }
        .act-bars { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; height: 130px; align-items: end; }
        .act-bar-col { display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: end; }
        .act-bar { width: 100%; min-height: 2px; border-radius: 4px 4px 0 0; }
        .act-bar-label { font-size: 9.5px; color: var(--text-3); margin-top: 4px; }
        .act-bar-value { font-size: 10px; font-weight: 600; color: var(--text-1); }
        .act-timeline { display: flex; flex-direction: column; gap: 4px; }
        .act-event { display: flex; gap: 10px; padding: 8px 12px; background: var(--bg-1); border-radius: 6px; border-left: 2px solid var(--border); }
        .act-event-fail { border-left-color: var(--red); }
        .act-event-body { flex: 1; min-width: 0; }
        .act-event-top { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; font-size: 11px; }
        .act-event-name { font-weight: 600; color: var(--text-0); }
        .act-event-action { background: var(--bg-3); padding: 1px 7px; border-radius: 99px; font-size: 9.5px; text-transform: uppercase; color: var(--text-2); letter-spacing: 0.3px; }
        .act-event-ticket { font-family: ui-monospace, Menlo, monospace; font-size: 10px; color: var(--text-3); }
        .act-event-cost, .act-event-dur { font-size: 10px; color: var(--text-2); }
        .act-event-time { font-size: 10px; color: var(--text-3); margin-left: auto; }
        .act-event-reason { font-size: 11.5px; color: var(--text-2); margin-top: 3px; line-height: 1.4; }
      `}</style>
    </div>
  );
}

// ============================================================================
// DOCS TAB — 7-doc governance: Live, Staging, Activity, Backup
// ============================================================================
type DocSummary = {
  doc_type: string; title: string; requires_approval: boolean;
  staging: { version: number; status: string; last_updated_at: string; last_updated_by: string | null; locked_by: string | null; locked_at: string | null } | null;
  production: { version: number; status: string; last_updated_at: string; last_updated_by: string | null; auto_promoted: boolean; auto_promoted_at: string | null; recently_auto_promoted: boolean } | null;
  pending_approval: boolean;
};
type DocDetail = {
  doc_type: string;
  staging: { id: string; doc_type: string; title: string; content_md: string; version: number; status: string; locked_by: string | null; requires_approval: boolean } | null;
  production: { id: string; doc_type: string; title: string; content_md: string; version: number; status: string; auto_promoted: boolean; auto_promoted_at: string | null } | null;
  staging_versions: Array<{ version: number; change_summary: string | null; created_by: string; created_at: string }>;
  production_versions: Array<{ version: number; change_summary: string | null; created_by: string; created_at: string; content_md: string }>;
};

const DOC_LABELS: Record<string, string> = {
  vision_roadmap: "Vision & Roadmap",
  prd: "PRD",
  architecture: "Architecture",
  data_model: "Data Model",
  api: "API",
  security: "Security & Multi-tenancy",
  integration: "Integration & Deployment",
};

type DeployRow = { uid: string; state: string; created_at: string; sha: string; ref: string; message: string; url: string | null };

function DeploysTab() {
  const [data, setData] = useState<{ "namkhan-bi"?: { deploys?: DeployRow[]; error?: string }; "namkhan-bi-staging"?: { deploys?: DeployRow[]; error?: string }; fetched_at?: string } | null>(null);
  const [routeChecks, setRouteChecks] = useState<Array<{ url: string; status: number | null }>>([]);

  const checkRoutes = async () => {
    const routes = [
      "/cockpit","/chat","/staging/mockups",
      "/sales/dashboard","/revenue/dashboard","/marketing/dashboard","/operations/dashboard","/guest/dashboard","/finance/dashboard",
      "/sales/cockpit","/revenue/cockpit","/marketing/cockpit","/operations/cockpit","/guest/cockpit","/finance/cockpit",
      "/revenue/engine?view=entry","/revenue/engine?view=workspace","/revenue/engine?view=report","/revenue/engine?view=dashboard","/revenue/engine?view=morning",
    ];
    const results = await Promise.all(routes.map(async (r) => {
      try {
        const res = await fetch(r, { method: "HEAD", cache: "no-store" });
        return { url: r, status: res.status };
      } catch {
        return { url: r, status: null };
      }
    }));
    setRouteChecks(results);
  };

  useEffect(() => {
    fetch("/api/cockpit/deployments", { cache: "no-store" }).then((r) => r.json()).then(setData).catch(() => setData({}));
    checkRoutes();
    const id = setInterval(() => {
      fetch("/api/cockpit/deployments", { cache: "no-store" }).then((r) => r.json()).then(setData).catch(() => null);
      checkRoutes();
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ padding: 24, height: "100%", overflowY: "auto" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>🚀 Deploys & live routes</h1>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>
          Ground truth: every prod deploy on Vercel + live HTTP check on every documented route. Refreshes every 30s.
        </span>
      </div>

      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border-1)", borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "var(--brass)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 600 }}>
          Route health · {routeChecks.filter(r => r.status === 200).length}/{routeChecks.length} green
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 6 }}>
          {routeChecks.map((r) => (
            <div key={r.url} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "var(--bg-1)", border: "1px solid var(--border-2)", borderRadius: 4, fontSize: 11, fontFamily: "ui-monospace, monospace" }}>
              <a href={r.url} target="_blank" rel="noreferrer" style={{ color: "var(--text-1)", textDecoration: "none" }}>{r.url}</a>
              <span style={{ color: r.status === 200 ? "var(--good, #2a7d2e)" : r.status === null ? "var(--text-3)" : "var(--bad, #b3261e)", fontWeight: 600 }}>
                {r.status ?? "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {(["namkhan-bi", "namkhan-bi-staging"] as const).map((proj) => {
        const block = data?.[proj];
        return (
          <div key={proj} style={{ background: "var(--bg-2)", border: "1px solid var(--border-1)", borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "var(--brass)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 600 }}>
              📦 {proj} · last 20 prod deploys
            </div>
            {block?.error && <div style={{ color: "var(--bad, #b3261e)", fontSize: 12 }}>error: {block.error}</div>}
            {!block?.deploys && !block?.error && <div style={{ color: "var(--text-3)" }}>loading…</div>}
            {block?.deploys && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, color: "var(--text-3)", textTransform: "uppercase" }}>When</th>
                    <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, color: "var(--text-3)", textTransform: "uppercase" }}>SHA</th>
                    <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, color: "var(--text-3)", textTransform: "uppercase" }}>Branch</th>
                    <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, color: "var(--text-3)", textTransform: "uppercase" }}>Message</th>
                    <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, color: "var(--text-3)", textTransform: "uppercase" }}>URL</th>
                  </tr>
                </thead>
                <tbody>
                  {block.deploys.map((d) => (
                    <tr key={d.uid} style={{ borderBottom: "1px solid var(--border-2)" }}>
                      <td style={{ padding: "6px 10px", fontFamily: "ui-monospace, monospace", color: "var(--text-3)" }}>{d.created_at.replace("T", " ").slice(0, 16)}</td>
                      <td style={{ padding: "6px 10px", fontFamily: "ui-monospace, monospace", color: "var(--brass)" }}>{d.sha}</td>
                      <td style={{ padding: "6px 10px", fontFamily: "ui-monospace, monospace" }}>{d.ref}</td>
                      <td style={{ padding: "6px 10px" }}>{d.message}</td>
                      <td style={{ padding: "6px 10px" }}>{d.url ? <a href={d.url} target="_blank" rel="noreferrer" style={{ color: "var(--brass)" }}>↗</a> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {data?.fetched_at && <div style={{ fontSize: 10, color: "var(--text-3)", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>fetched {data.fetched_at.slice(11, 19)} UTC</div>}
    </div>
  );
}

function DocsTab() {
  type SubView = "pulse" | "live" | "staging" | "activity" | "backup";
  const [view, setView] = useState<SubView>("pulse");
  // Live pulse — last changes flowing through Supabase
  const [pulse, setPulse] = useState<{
    audit: Array<{ id: number; agent: string; action: string; target: string | null; success: boolean; created_at: string; cost_usd_milli: number | null }>;
    kb: Array<{ id: number; topic: string; scope: string; created_at: string; updated_at: string }>;
    prompts: Array<{ id: number; role: string; version: number; source: string | null; updated_at: string }>;
    migrations: Array<{ version: string; name: string }>;
    tickets: Array<{ id: number; status: string; arm: string | null; intent: string | null; updated_at: string }>;
  } | null>(null);
  useEffect(() => {
    const tick = async () => {
      const [au, kb, pr, mg, tk] = await Promise.all([
        supabase.from("cockpit_audit_log").select("id,agent,action,target,success,created_at,cost_usd_milli").order("id", { ascending: false }).limit(15),
        supabase.from("cockpit_knowledge_base").select("id,topic,scope,created_at,updated_at").order("updated_at", { ascending: false }).limit(8),
        supabase.from("cockpit_agent_prompts").select("id,role,version,source,updated_at").eq("active", true).order("updated_at", { ascending: false }).limit(8),
        supabase.schema("supabase_migrations" as never).from("schema_migrations" as never).select("version,name").order("version", { ascending: false }).limit(5).then((r) => r.error ? { data: [] as Array<{ version: string; name: string }> } : r),
        supabase.from("cockpit_tickets").select("id,status,arm,intent,updated_at").order("updated_at", { ascending: false }).limit(10),
      ]);
      setPulse({
        audit: (au.data ?? []) as never,
        kb: (kb.data ?? []) as never,
        prompts: (pr.data ?? []) as never,
        migrations: ((mg as { data?: unknown }).data ?? []) as never,
        tickets: (tk.data ?? []) as never,
      });
    };
    tick();
    const id = setInterval(tick, 8000);
    return () => clearInterval(id);
  }, []);
  const [list, setList] = useState<DocSummary[]>([]);
  const [pending, setPending] = useState(0);
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocDetail | null>(null);
  const [activity, setActivity] = useState<{ recent_promotions: Array<{ document_id: string; staging_version: number; production_version: number; promoted_by: string; promoted_at: string; promotion_type: string }>; recent_rollbacks: Array<{ rolled_back_from_version: number; rolled_back_to_version: number; rolled_back_by: string; reason: string; rolled_back_at: string }>; recent_approvals: Array<{ staging_version: number; status: string; approver: string | null; approved_at: string | null; created_at: string }> } | null>(null);
  const [backup, setBackup] = useState<{ last_success: { backup_type: string; status: string; completed_at: string | null; size_bytes: number | null } | null; last_failure: { backup_type: string; error_message: string | null; completed_at: string | null } | null; recent: Array<{ id: string; backup_type: string; status: string; started_at: string; completed_at: string | null; size_bytes: number | null }> } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    const r = await fetch("/api/cockpit/docs");
    const d = await r.json();
    setList(d.docs ?? []);
    setPending(d.pending_approvals_count ?? 0);
    setActivity({
      recent_promotions: d.recent_promotions ?? [],
      recent_rollbacks: d.recent_rollbacks ?? [],
      recent_approvals: d.recent_approvals ?? [],
    });
  }, []);
  const loadDetail = useCallback(async (docType: string) => {
    const r = await fetch(`/api/cockpit/docs/detail?doc_type=${docType}`);
    setDetail(await r.json());
  }, []);
  const loadBackup = useCallback(async () => {
    const r = await fetch("/api/cockpit/docs/backup");
    setBackup(await r.json());
  }, []);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { if (activeDoc) loadDetail(activeDoc); }, [activeDoc, loadDetail]);
  useEffect(() => { if (view === "backup") loadBackup(); }, [view, loadBackup]);

  const decide = async (action: "approve" | "reject" | "request_changes") => {
    if (!detail || !detail.staging) return;
    const notes = action === "approve" ? "approved via cockpit" : window.prompt("Notes?") ?? "";
    setBusy(true);
    try {
      await fetch("/api/cockpit/docs/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_type: detail.doc_type, action, notes, staging_version: detail.staging.version }),
      });
      await loadList();
      if (activeDoc) await loadDetail(activeDoc);
    } finally { setBusy(false); }
  };

  const rollback = async (toVersion: number) => {
    if (!detail) return;
    const reason = window.prompt(`Rollback ${DOC_LABELS[detail.doc_type] ?? detail.doc_type} to v${toVersion}. Reason (min 5 chars)?`);
    if (!reason || reason.trim().length < 5) return;
    setBusy(true);
    try {
      await fetch("/api/cockpit/docs/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_type: detail.doc_type, to_version: toVersion, reason }),
      });
      await loadList();
      if (activeDoc) await loadDetail(activeDoc);
    } finally { setBusy(false); }
  };

  const triggerBackup = async () => {
    setBusy(true);
    try {
      await fetch("/api/cockpit/docs/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      await loadBackup();
    } finally { setBusy(false); }
  };

  return (
    <div className="docs-tab">
      <div className="page-header">
        <h1>Documentation</h1>
        <span className="page-sub">
          7-doc governance · staging → owner approval / auto-promote → production · ADR 0003
          {pending > 0 && <span className="docs-pending"> · {pending} pending approval{pending > 1 ? "s" : ""}</span>}
        </span>
      </div>
      <div className="docs-subnav">
        {(["pulse", "live", "staging", "activity", "backup"] as SubView[]).map((v) => (
          <button key={v} className={`docs-pill ${view === v ? "active" : ""}`} onClick={() => setView(v)}>
            {v === "pulse" && "🫀 Pulse"}
            {v === "live" && "📜 Live"}
            {v === "staging" && `📝 Staging${pending > 0 ? ` (${pending})` : ""}`}
            {v === "activity" && "📊 Activity"}
            {v === "backup" && "💾 Backup"}
          </button>
        ))}
      </div>

      {view === "pulse" && pulse && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div style={{ background: "var(--bg-2)", border: "1px solid var(--border-1)", borderRadius: 8, padding: 12, gridColumn: "span 2" }}>
            <div style={{ fontSize: 10, color: "var(--brass)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
              🫀 Live Supabase activity · refreshes every 8s · everything that's happening on the database, audited
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
              Every change made by an agent or cron lands in <code>cockpit_audit_log</code>. This panel = live tail of that log.
            </div>
          </div>

          <div style={{ background: "var(--bg-2)", border: "1px solid var(--border-1)", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 10, color: "var(--brass)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Audit log · last 15</div>
            {pulse.audit.length === 0 ? <div style={{ color: "var(--text-3)" }}>—</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontFamily: "ui-monospace, monospace" }}>
                {pulse.audit.map(a => (
                  <div key={a.id} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "3px 0", borderBottom: "1px dashed var(--border-2)" }}>
                    <span style={{ color: a.success ? "var(--good, #2a7d2e)" : "var(--bad, #b3261e)", width: 14 }}>{a.success ? "✓" : "✗"}</span>
                    <span style={{ color: "var(--text-3)", width: 70 }}>{new Date(a.created_at).toISOString().slice(11, 16)}</span>
                    <span style={{ color: "var(--brass)", width: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.agent}</span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.action}</span>
                    {a.cost_usd_milli !== null && a.cost_usd_milli > 0 && <span style={{ color: "var(--text-3)" }}>${(a.cost_usd_milli / 1000).toFixed(3)}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: "var(--bg-2)", border: "1px solid var(--border-1)", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 10, color: "var(--brass)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>KB updates · last 8</div>
            {pulse.kb.map(k => (
              <div key={k.id} style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", padding: "3px 0", borderBottom: "1px dashed var(--border-2)", display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.topic}</span>
                <span style={{ color: "var(--text-3)" }}>{new Date(k.updated_at).toISOString().slice(0, 10)}</span>
              </div>
            ))}
          </div>

          <div style={{ background: "var(--bg-2)", border: "1px solid var(--border-1)", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 10, color: "var(--brass)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Active agent prompts · versions</div>
            {pulse.prompts.map(p => (
              <div key={p.id} style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", padding: "3px 0", borderBottom: "1px dashed var(--border-2)", display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ color: "var(--text-1)", width: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.role}</span>
                <span style={{ color: "var(--brass)" }}>v{p.version}</span>
                <span style={{ color: "var(--text-3)", flex: 1, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.source ?? "—"}</span>
              </div>
            ))}
          </div>

          <div style={{ background: "var(--bg-2)", border: "1px solid var(--border-1)", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 10, color: "var(--brass)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Schema migrations · last 5</div>
            {pulse.migrations.length === 0 ? <div style={{ color: "var(--text-3)", fontSize: 11 }}>(schema not exposed via PostgREST — read locally)</div> :
              pulse.migrations.map((m, i) => (
                <div key={i} style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", padding: "3px 0", borderBottom: "1px dashed var(--border-2)" }}>
                  <span style={{ color: "var(--brass)", width: 130, display: "inline-block" }}>{m.version}</span>
                  <span style={{ color: "var(--text-1)" }}>{m.name}</span>
                </div>
              ))}
          </div>

          <div style={{ background: "var(--bg-2)", border: "1px solid var(--border-1)", borderRadius: 8, padding: 12, gridColumn: "span 2" }}>
            <div style={{ fontSize: 10, color: "var(--brass)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Recent ticket activity · last 10</div>
            {pulse.tickets.map(t => (
              <div key={t.id} style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", padding: "3px 0", borderBottom: "1px dashed var(--border-2)", display: "flex", gap: 12 }}>
                <span style={{ color: "var(--brass)", width: 50 }}>#{t.id}</span>
                <span style={{ width: 90, color: t.status === "completed" ? "var(--good, #2a7d2e)" : t.status === "triage_failed" ? "var(--bad, #b3261e)" : "var(--text-2)" }}>{t.status}</span>
                <span style={{ width: 80, color: "var(--text-3)" }}>{t.arm ?? "—"}</span>
                <span style={{ width: 80, color: "var(--text-3)" }}>{t.intent ?? "—"}</span>
                <span style={{ flex: 1, color: "var(--text-3)", textAlign: "right" }}>{new Date(t.updated_at).toISOString().slice(0, 16).replace("T", " ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(view === "live" || view === "staging") && (
        <div className="docs-grid">
          <div className="docs-list">
            {list.map((d) => {
              const v = view === "live" ? d.production : d.staging;
              return (
                <div key={d.doc_type} className={`docs-row ${activeDoc === d.doc_type ? "active" : ""}`} onClick={() => setActiveDoc(d.doc_type)}>
                  <div className="docs-row-top">
                    <span className="docs-title">{DOC_LABELS[d.doc_type]}</span>
                    {d.requires_approval ? <span className="docs-pill-tag manual">manual</span> : <span className="docs-pill-tag auto">auto</span>}
                  </div>
                  <div className="docs-row-meta">
                    v{v?.version ?? "—"} · {v?.status ?? "—"}
                    {view === "live" && d.production?.recently_auto_promoted && <span className="docs-banner">⚡ auto-promoted (48h)</span>}
                    {view === "staging" && d.pending_approval && <span className="docs-banner pending">⏳ pending approval</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="docs-detail">
            {!activeDoc && <div className="docs-empty">Pick a doc on the left.</div>}
            {activeDoc && detail && (
              <div>
                <div className="docs-detail-head">
                  <h2>{DOC_LABELS[detail.doc_type]}</h2>
                  <div className="docs-detail-meta">
                    {view === "live" && detail.production && (
                      <>
                        <span>v{detail.production.version}</span>
                        <span>·</span>
                        <span>{detail.production.status}</span>
                        {detail.production.auto_promoted && <><span>·</span><span>auto-promoted</span></>}
                      </>
                    )}
                    {view === "staging" && detail.staging && (
                      <>
                        <span>staging v{detail.staging.version}</span>
                        <span>·</span>
                        <span>prod v{detail.production?.version ?? 0}</span>
                        <span>·</span>
                        <span>{detail.staging.status}</span>
                      </>
                    )}
                  </div>
                </div>

                {view === "staging" && detail.staging?.status === "pending_approval" && (
                  <div className="docs-approve-row">
                    <button disabled={busy} onClick={() => decide("approve")} className="docs-btn ok">✅ Approve & promote</button>
                    <button disabled={busy} onClick={() => decide("request_changes")} className="docs-btn warn">↺ Request changes</button>
                    <button disabled={busy} onClick={() => decide("reject")} className="docs-btn danger">✕ Reject</button>
                  </div>
                )}

                {view === "staging" && (
                  <div className="docs-diff">
                    <div className="docs-diff-col">
                      <div className="docs-diff-head">PRODUCTION (v{detail.production?.version ?? 0})</div>
                      <pre className="docs-content">{detail.production?.content_md ?? "(empty)"}</pre>
                    </div>
                    <div className="docs-diff-col">
                      <div className="docs-diff-head">STAGING (v{detail.staging?.version ?? 0})</div>
                      <pre className="docs-content">{detail.staging?.content_md ?? "(empty)"}</pre>
                    </div>
                  </div>
                )}

                {view === "live" && (
                  <>
                    <pre className="docs-content single">{detail.production?.content_md ?? "(no content yet — agent must write to staging then promote)"}</pre>
                    <h3>Version history</h3>
                    <table className="docs-table">
                      <thead><tr><th>v</th><th>Change</th><th>By</th><th>When</th><th></th></tr></thead>
                      <tbody>
                        {detail.production_versions.map((v) => (
                          <tr key={v.version}>
                            <td>v{v.version}</td>
                            <td>{v.change_summary ?? "—"}</td>
                            <td>{v.created_by}</td>
                            <td>{absTime(v.created_at)}</td>
                            <td><button disabled={busy} className="docs-btn small" onClick={() => rollback(v.version)}>Rollback</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {view === "activity" && activity && (
        <div className="docs-activity">
          <h3>Recent promotions</h3>
          {activity.recent_promotions.length === 0 ? <div className="docs-empty">No promotions yet.</div> : (
            <table className="docs-table">
              <thead><tr><th>Doc</th><th>Staging→Prod</th><th>Type</th><th>By</th><th>When</th></tr></thead>
              <tbody>{activity.recent_promotions.map((p, i) => (<tr key={i}><td>—</td><td>v{p.staging_version} → v{p.production_version}</td><td>{p.promotion_type}</td><td>{p.promoted_by}</td><td>{absTime(p.promoted_at)}</td></tr>))}</tbody>
            </table>
          )}
          <h3>Recent rollbacks</h3>
          {activity.recent_rollbacks.length === 0 ? <div className="docs-empty">None.</div> : (
            <table className="docs-table">
              <thead><tr><th>Doc</th><th>Versions</th><th>By</th><th>Reason</th><th>When</th></tr></thead>
              <tbody>{activity.recent_rollbacks.map((r, i) => (<tr key={i}><td>—</td><td>v{r.rolled_back_from_version} → v{r.rolled_back_to_version}</td><td>{r.rolled_back_by}</td><td>{r.reason}</td><td>{absTime(r.rolled_back_at)}</td></tr>))}</tbody>
            </table>
          )}
          <h3>Recent approvals</h3>
          {activity.recent_approvals.length === 0 ? <div className="docs-empty">None.</div> : (
            <table className="docs-table">
              <thead><tr><th>Doc</th><th>Staging v</th><th>Status</th><th>Approver</th><th>When</th></tr></thead>
              <tbody>{activity.recent_approvals.map((a, i) => (<tr key={i}><td>—</td><td>v{a.staging_version}</td><td>{a.status}</td><td>{a.approver ?? "—"}</td><td>{absTime(a.approved_at ?? a.created_at)}</td></tr>))}</tbody>
            </table>
          )}
        </div>
      )}

      {view === "backup" && (
        <div className="docs-backup">
          <div className="docs-backup-grid">
            <div className="docs-backup-card">
              <div className="docs-backup-label">Last successful backup</div>
              <div className="docs-backup-value">
                {backup?.last_success ? <>{backup.last_success.backup_type} · {(backup.last_success.size_bytes ?? 0) > 0 ? `${((backup.last_success.size_bytes ?? 0) / 1024).toFixed(1)}KB` : "—"} · {absTime(backup.last_success.completed_at ?? "")}</> : "—"}
              </div>
            </div>
            <div className="docs-backup-card">
              <div className="docs-backup-label">Last failed backup</div>
              <div className="docs-backup-value">{backup?.last_failure ? backup.last_failure.error_message ?? "(no error msg)" : "none ✓"}</div>
            </div>
            <div className="docs-backup-card">
              <div className="docs-backup-label">Manual</div>
              <button disabled={busy} className="docs-btn ok" onClick={triggerBackup}>{busy ? "Backing up…" : "💾 Backup Now"}</button>
            </div>
          </div>
          <h3>Recent backups</h3>
          {(!backup?.recent || backup.recent.length === 0) ? <div className="docs-empty">No backups yet. Daily cron runs at 03:00 UTC.</div> : (
            <table className="docs-table">
              <thead><tr><th>Type</th><th>Status</th><th>Started</th><th>Completed</th><th>Size</th></tr></thead>
              <tbody>{backup.recent.map((b) => (<tr key={b.id}><td>{b.backup_type}</td><td>{b.status}</td><td>{absTime(b.started_at)}</td><td>{b.completed_at ? absTime(b.completed_at) : "—"}</td><td>{b.size_bytes ? `${(b.size_bytes / 1024).toFixed(1)}KB` : "—"}</td></tr>))}</tbody>
            </table>
          )}
        </div>
      )}

      <style jsx>{`
        .docs-tab { padding: 24px; height: 100%; overflow-y: auto; }
        .page-header { margin-bottom: 16px; }
        .page-header h1 { font-size: 18px; font-weight: 600; }
        .page-sub { font-size: 12px; color: var(--text-3); }
        .docs-pending { color: var(--yellow); font-weight: 600; }
        .docs-subnav { display: flex; gap: 4px; margin-bottom: 14px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
        .docs-pill { background: transparent; border: 1px solid var(--border); color: var(--text-2); padding: 4px 10px; border-radius: 99px; font-size: 11px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600; }
        .docs-pill.active { background: var(--text-1); color: var(--bg-0); border-color: var(--text-1); }
        .docs-grid { display: grid; grid-template-columns: 280px 1fr; gap: 14px; }
        .docs-list { display: flex; flex-direction: column; gap: 4px; }
        .docs-row { padding: 10px 12px; background: var(--bg-1); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; }
        .docs-row.active { border-color: var(--cyan); }
        .docs-row-top { display: flex; justify-content: space-between; gap: 8px; }
        .docs-title { font-size: 12px; font-weight: 600; }
        .docs-pill-tag { font-size: 9px; padding: 1px 6px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.3px; }
        .docs-pill-tag.manual { background: var(--yellow-bg); color: var(--yellow); }
        .docs-pill-tag.auto { background: var(--green-bg); color: var(--green); }
        .docs-row-meta { font-size: 10.5px; color: var(--text-3); margin-top: 4px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
        .docs-banner { background: var(--yellow-bg); color: var(--yellow); padding: 1px 7px; border-radius: 99px; font-size: 9.5px; }
        .docs-banner.pending { background: var(--cyan-bg); color: var(--cyan); }
        .docs-detail { background: var(--bg-1); border: 1px solid var(--border); border-radius: 8px; padding: 16px; min-height: 400px; }
        .docs-detail-head { margin-bottom: 12px; }
        .docs-detail-head h2 { font-size: 16px; font-weight: 600; }
        .docs-detail-meta { font-size: 11px; color: var(--text-3); display: flex; gap: 6px; margin-top: 4px; }
        .docs-empty { padding: 30px; text-align: center; color: var(--text-3); font-size: 12px; }
        .docs-approve-row { display: flex; gap: 8px; padding: 12px; background: var(--yellow-bg); border-radius: 6px; margin-bottom: 12px; }
        .docs-btn { padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; border: 1px solid transparent; }
        .docs-btn.small { padding: 3px 8px; font-size: 10.5px; }
        .docs-btn.ok { background: var(--green); color: white; }
        .docs-btn.warn { background: var(--yellow); color: var(--bg-0); }
        .docs-btn.danger { background: var(--red); color: white; }
        .docs-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .docs-diff { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .docs-diff-col { background: var(--bg-2); border-radius: 4px; }
        .docs-diff-head { padding: 6px 10px; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-3); border-bottom: 1px solid var(--border); }
        .docs-content { padding: 12px; font-size: 11.5px; font-family: ui-monospace, Menlo, monospace; white-space: pre-wrap; word-break: break-word; max-height: 500px; overflow-y: auto; }
        .docs-content.single { background: var(--bg-2); border-radius: 4px; }
        .docs-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 18px; }
        .docs-table th { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border); color: var(--text-3); font-weight: 500; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
        .docs-table td { padding: 7px 8px; border-bottom: 1px solid var(--border); color: var(--text-1); }
        .docs-activity h3, .docs-backup h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-3); margin-top: 14px; margin-bottom: 8px; }
        .docs-backup-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }
        .docs-backup-card { background: var(--bg-1); border: 1px solid var(--border); border-radius: 8px; padding: 14px; }
        .docs-backup-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-3); margin-bottom: 6px; }
        .docs-backup-value { font-size: 12px; color: var(--text-1); }
      `}</style>
    </div>
  );
}

// ============================================================================
// COST TAB — agent spend across windows
// ============================================================================
type CostBucket = { cost_usd: string; runs: number; tokens_in: number; tokens_out: number };
type TopTicket = { ticket_id: number; cost_usd: string; runs: number; agents: string[] };
type TopAgent = { agent: string; cost_usd: string; runs: number; avg_cost_usd: string; avg_duration_ms: number; tokens_in: number; tokens_out: number };

function CostTab() {
  const [data, setData] = useState<{ totals: Record<"24h" | "7d" | "30d", CostBucket>; top_tickets_24h: TopTicket[]; top_agents_7d: TopAgent[] } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/cockpit/cost").then((r) => r.json()).then((d) => setData(d)).finally(() => setLoading(false));
  }, []);
  if (loading) return <div className="cost-tab"><div className="empty">Loading cost…</div></div>;
  if (!data) return <div className="cost-tab"><div className="empty">No cost data.</div></div>;
  return (
    <div className="cost-tab">
      <div className="page-header">
        <h1>Cost Tracker</h1>
        <span className="page-sub">
          Anthropic spend per window. Pricing: <code>$3/Mtok input, $15/Mtok output</code> (Sonnet-4-6).
          Captured per agent run in <code>cockpit_audit_log.cost_usd_milli</code>.
        </span>
      </div>
      <div className="cost-grid-3">
        {(["24h", "7d", "30d"] as const).map((w) => {
          const b = data.totals[w];
          return (
            <div key={w} className="cost-card">
              <div className="cost-window">{w}</div>
              <div className="cost-amount">${b.cost_usd}</div>
              <div className="cost-meta">
                {b.runs} runs · {(b.tokens_in / 1000).toFixed(1)}k in · {(b.tokens_out / 1000).toFixed(1)}k out
              </div>
            </div>
          );
        })}
      </div>
      <div className="cost-section">
        <h3>Top tickets · last 24h</h3>
        {data.top_tickets_24h.length === 0 ? (
          <div className="empty-small">No ticket spend in the last 24h.</div>
        ) : (
          <table className="cost-table">
            <thead><tr><th>Ticket</th><th>Cost</th><th>Runs</th><th>Agents involved</th></tr></thead>
            <tbody>{data.top_tickets_24h.map((t) => (
              <tr key={t.ticket_id}>
                <td>#{t.ticket_id}</td>
                <td>${t.cost_usd}</td>
                <td>{t.runs}</td>
                <td>{t.agents.join(", ")}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      <div className="cost-section">
        <h3>Top agents · last 7 days</h3>
        {data.top_agents_7d.length === 0 ? (
          <div className="empty-small">No agent spend in the last 7d.</div>
        ) : (
          <table className="cost-table">
            <thead><tr><th>Agent</th><th>Total</th><th>Runs</th><th>Avg cost</th><th>Avg ms</th><th>Tok in/out</th></tr></thead>
            <tbody>{data.top_agents_7d.map((a) => (
              <tr key={a.agent}>
                <td>{a.agent}</td>
                <td>${a.cost_usd}</td>
                <td>{a.runs}</td>
                <td>${a.avg_cost_usd}</td>
                <td>{a.avg_duration_ms}</td>
                <td>{(a.tokens_in / 1000).toFixed(1)}k / {(a.tokens_out / 1000).toFixed(1)}k</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      <style jsx>{`
        .cost-tab { padding: 24px; height: 100%; overflow-y: auto; }
        .page-header { margin-bottom: 16px; }
        .page-header h1 { font-size: 18px; font-weight: 600; }
        .page-sub { font-size: 12px; color: var(--text-3); }
        .page-sub code { background: var(--bg-3); padding: 1px 6px; border-radius: 4px; font-size: 11px; }
        .empty, .empty-small { padding: 30px; text-align: center; color: var(--text-3); }
        .empty-small { padding: 14px; font-size: 12px; }
        .cost-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        .cost-card { background: var(--bg-1); border: 1px solid var(--border); border-radius: 10px; padding: 16px 18px; }
        .cost-window { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-3); font-weight: 600; }
        .cost-amount { font-family: Fraunces, Georgia, serif; font-style: italic; font-size: 28px; line-height: 1.1; margin: 4px 0; }
        .cost-meta { font-size: 11px; color: var(--text-3); }
        .cost-section { margin-bottom: 24px; }
        .cost-section h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-3); font-weight: 600; margin-bottom: 8px; }
        .cost-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .cost-table th { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border); color: var(--text-3); font-weight: 500; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
        .cost-table td { padding: 7px 8px; border-bottom: 1px solid var(--border); color: var(--text-1); }
      `}</style>
    </div>
  );
}

// ============================================================================
// TOOLS TAB — quick links to external tools
// ============================================================================
function ToolsTab() {
  const links = [
    { group: "App", items: [
      { name: "Production app", url: "https://namkhan-bi.vercel.app", note: "namkhan-bi.vercel.app" },
      { name: "Overview / Pulse", url: "https://namkhan-bi.vercel.app/overview", note: "live KPIs" },
      { name: "Sales · Inquiries", url: "https://namkhan-bi.vercel.app/sales/inquiries", note: "reference design page" },
      { name: "Revenue · Compset", url: "https://namkhan-bi.vercel.app/revenue/compset", note: "OTA rate intelligence" },
      { name: "Revenue · Parity", url: "https://namkhan-bi.vercel.app/revenue/parity", note: "rate-parity watchdog" },
      { name: "Settings · Cockpit (status page)", url: "https://namkhan-bi.vercel.app/settings/cockpit", note: "site-design status view" },
    ]},
    { group: "Infra", items: [
      { name: "Vercel project", url: "https://vercel.com/pbsbase-2825s-projects/namkhan-bi", note: "deploys, env, firewall" },
      { name: "Vercel deploys", url: "https://vercel.com/pbsbase-2825s-projects/namkhan-bi/deployments", note: "history + rollback" },
      { name: "Vercel speed insights", url: "https://vercel.com/pbsbase-2825s-projects/namkhan-bi/speed-insights", note: "CWV" },
      { name: "Vercel firewall", url: "https://vercel.com/pbsbase-2825s-projects/namkhan-bi/firewall", note: "rate limits + blocks" },
      { name: "Vercel billing", url: "https://vercel.com/teams/pbsbase-2825s-projects/settings/billing", note: "spending cap" },
      { name: "Supabase project", url: "https://supabase.com/dashboard/project/kpenyneooigsyuuomgct", note: "namkhan-pms" },
      { name: "Supabase SQL editor", url: "https://supabase.com/dashboard/project/kpenyneooigsyuuomgct/sql/new", note: "ad-hoc queries" },
      { name: "Supabase logs", url: "https://supabase.com/dashboard/project/kpenyneooigsyuuomgct/logs/explorer", note: "all DB activity" },
      { name: "Supabase advisor", url: "https://supabase.com/dashboard/project/kpenyneooigsyuuomgct/advisors/security", note: "security + perf" },
      { name: "Supabase webhooks", url: "https://supabase.com/dashboard/project/kpenyneooigsyuuomgct/integrations/database-webhooks", note: "outbound" },
    ]},
    { group: "Code", items: [
      { name: "GitHub repo", url: "https://github.com/TBC-HM/namkhan-bi", note: "TBC-HM/namkhan-bi" },
      { name: "Open issues", url: "https://github.com/TBC-HM/namkhan-bi/issues?q=is%3Aopen", note: "auto-spec + incidents land here" },
      { name: "PRs", url: "https://github.com/TBC-HM/namkhan-bi/pulls", note: "review queue" },
      { name: "Actions runs", url: "https://github.com/TBC-HM/namkhan-bi/actions", note: "weekly audit + lighthouse" },
    ]},
    { group: "Automation", items: [
      { name: "Make.com scenarios", url: "https://eu2.make.com/scenarios", note: "if you import the blueprints" },
      { name: "Anthropic Console", url: "https://console.anthropic.com/settings/billing", note: "track spend" },
      { name: "Claude Docs (tool use)", url: "https://docs.claude.com/en/docs/agents-and-tools/tool-use/overview", note: "agent capabilities" },
    ]},
    { group: "Hospitality", items: [
      { name: "Cloudbeds login", url: "https://hotels.cloudbeds.com/", note: "PMS — sole revenue source" },
      { name: "SLH portal", url: "https://www.slh.com/", note: "Small Luxury Hotels" },
    ]},
  ];

  return (
    <div className="tools-tab">
      <div className="page-header">
        <h1>Quick Tools</h1>
        <span className="page-sub">External dashboards + the cockpit&apos;s upstream services. All open in a new tab.</span>
      </div>
      {links.map((g) => (
        <div key={g.group} className="tools-group">
          <h3 className="tools-group-title">{g.group}</h3>
          <div className="tools-grid">
            {g.items.map((it) => (
              <a key={it.url} href={it.url} target="_blank" rel="noreferrer" className="tools-card">
                <div className="tools-name">{it.name} ↗</div>
                <div className="tools-note">{it.note}</div>
              </a>
            ))}
          </div>
        </div>
      ))}
      <style jsx>{`
        .tools-tab { padding: 24px; height: 100%; overflow-y: auto; }
        .page-header { margin-bottom: 24px; }
        .page-header h1 { font-size: 18px; font-weight: 600; }
        .page-sub { font-size: 12px; color: var(--text-3); }
        .tools-group { margin-bottom: 24px; }
        .tools-group-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-3); font-weight: 600; margin-bottom: 8px; }
        .tools-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }
        .tools-card { display: block; padding: 10px 12px; background: var(--bg-1); border: 1px solid var(--border); border-radius: 6px; text-decoration: none; color: inherit; }
        .tools-card:hover { border-color: var(--cyan); }
        .tools-name { font-size: 12.5px; font-weight: 500; color: var(--text-0); margin-bottom: 2px; }
        .tools-note { font-size: 11px; color: var(--text-3); }
      `}</style>
    </div>
  );
}
