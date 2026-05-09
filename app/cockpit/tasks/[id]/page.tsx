// app/cockpit/tasks/[id]/page.tsx
// Ticket detail — readable view of one ticket. Click target from ND, /cockpit/tasks list, etc.

import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_COLOR: Record<string, string> = {
  new: "#888", triaging: "#888", triaged: "#2c6cf6", working: "#e8a13a",
  awaits_user: "#a04ad0", completed: "#1c5b22",
  triage_failed: "#d04444", blocked: "#d04444", archived: "#999",
};

function rel(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

export default async function TicketPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return <main style={{ padding: 24, color: "white" }}>Invalid ticket id</main>;

  const supabase = createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co"),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key")
  );

  const { data: t, error } = await supabase
    .from("cockpit_tickets")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !t) {
    return (
      <main style={{ background: "#0a0a0b", color: "white", minHeight: "100vh", padding: 32, fontFamily: "system-ui" }}>
        <Link href="/cockpit/tasks" style={{ color: "#5fa" }}>← All tasks</Link>
        <h1 style={{ marginTop: 16 }}>Ticket #{id}</h1>
        <div style={{ marginTop: 16, color: "#888" }}>Not found.</div>
      </main>
    );
  }

  const { data: audit } = await supabase
    .from("cockpit_audit_log")
    .select("created_at, agent, action, success, reasoning, metadata")
    .eq("ticket_id", id)
    .order("created_at", { ascending: false })
    .limit(40);

  const meta = (t.metadata ?? {}) as Record<string, unknown>;
  const evidence = meta.evidence as Record<string, unknown> | undefined;
  const prUrl = (evidence?.pr_url as string) || (meta.pr_url as string) || null;
  const parentTicket = meta.parent_ticket as number | undefined;
  const children = (meta.sliced_into_children_v2 ?? meta.sliced_into_children) as number[] | undefined;

  return (
    <main style={{ background: "#0a0a0b", color: "white", minHeight: "100vh", padding: "24px 32px", fontFamily: "system-ui, -apple-system, sans-serif", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 16, display: "flex", gap: 16, alignItems: "center" }}>
        <Link href="/cockpit/tasks" style={{ color: "#5fa", fontSize: 13, textDecoration: "none" }}>← All tasks</Link>
        {parentTicket && (
          <Link href={`/cockpit/tasks/${parentTicket}`} style={{ color: "#5fa", fontSize: 13, textDecoration: "none" }}>
            ↑ Parent #{parentTicket}
          </Link>
        )}
      </div>

      <header style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #222" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span style={{
            padding: "4px 12px", borderRadius: 4,
            background: STATUS_COLOR[t.status] ?? "#444", color: "white",
            fontSize: 12, fontWeight: 700, letterSpacing: "0.05em",
          }}>{t.status.toUpperCase()}</span>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Ticket #{t.id}</h1>
        </div>
        <div style={{ fontSize: 12, color: "#888" }}>
          <code>{t.source ?? "?"}</code>
          {" · "}arm <b>{t.arm ?? "—"}</b>
          {" · "}intent <b>{t.intent ?? "—"}</b>
          {" · created "}{rel(t.created_at)}
          {" · updated "}{rel(t.updated_at)}
          {t.iterations !== null && (<>{" · "}{t.iterations} iter</>)}
        </div>
      </header>

      {/* Action shortcuts */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {prUrl && (
          <a href={prUrl} target="_blank" rel="noopener noreferrer" style={{ padding: "8px 14px", background: "#5fa", color: "#0a0a0b", borderRadius: 6, fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
            🔗 Open PR
          </a>
        )}
        <a href={`https://github.com/TBC-HM/namkhan-bi/issues?q=is%3Apr+${t.id}`} target="_blank" rel="noopener noreferrer" style={{ padding: "8px 14px", background: "#222", color: "white", borderRadius: 6, fontSize: 13, textDecoration: "none" }}>
          🔍 Search GitHub
        </a>
      </div>

      {/* Children list */}
      {Array.isArray(children) && children.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, color: "#888", fontWeight: 600, marginBottom: 8 }}>Children ({children.length})</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {children.map(c => (
              <Link key={c} href={`/cockpit/tasks/${c}`} style={{ padding: "4px 10px", background: "#222", color: "#5fa", borderRadius: 4, fontSize: 12, textDecoration: "none" }}>
                #{c}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Parsed summary */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, color: "#888", fontWeight: 600, marginBottom: 8 }}>Summary</h2>
        <pre style={{
          background: "#111", padding: 16, borderRadius: 6,
          fontSize: 13, lineHeight: 1.5, color: "#ddd",
          whiteSpace: "pre-wrap", overflow: "auto", maxHeight: 500,
          fontFamily: "system-ui",
        }}>{t.parsed_summary ?? "(empty)"}</pre>
      </section>

      {/* Metadata */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, color: "#888", fontWeight: 600, marginBottom: 8 }}>Metadata</h2>
        <pre style={{ background: "#111", padding: 16, borderRadius: 6, fontSize: 11, color: "#aaa", overflow: "auto", maxHeight: 300 }}>{JSON.stringify(meta, null, 2)}</pre>
      </section>

      {/* Audit log */}
      <section>
        <h2 style={{ fontSize: 14, color: "#888", fontWeight: 600, marginBottom: 8 }}>Audit log ({audit?.length ?? 0})</h2>
        {!audit || audit.length === 0 ? (
          <div style={{ color: "#666", fontSize: 12 }}>No audit entries yet.</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {audit.map((a, i) => {
              const am = (a.metadata ?? {}) as Record<string, unknown>;
              const url = (am.html_url as string) ?? (am.pr_url as string) ?? null;
              return (
                <li key={i} style={{ padding: "10px 12px", borderBottom: "1px solid #1f1f1f", display: "flex", gap: 12 }}>
                  <div style={{ width: 70, fontSize: 11, color: "#666" }}>{rel(a.created_at)}</div>
                  <div style={{ width: 100, fontSize: 12, color: a.success ? "#5fa" : "#d04444", fontWeight: 600 }}>{a.agent}</div>
                  <div style={{ width: 130, fontSize: 12, color: "#aaa" }}>{a.action}</div>
                  <div style={{ flex: 1, fontSize: 12, color: "white" }}>
                    {(a.reasoning ?? "").slice(0, 200)}
                    {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6, color: "#5fa" }}>→</a>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
