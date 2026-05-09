// app/cockpit/notify/page.tsx
// PBS notification feed — one screen, auto-refresh every 30s.
// Shows everything that shipped, every PR auto-merge, every deploy ready.
// PBS keeps this tab open. He clicks links. He doesn't review PRs.
//
// 2026-05-07 — PBS directive: "give me a link when a frontend deployment
// is done and the rest needs to run in the background."

import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Notification = {
  id: number;
  created_at: string;
  kind: string;
  title: string;
  url: string | null;
  ticket_id: number | null;
  pr_number: number | null;
  branch: string | null;
  seen_at: string | null;
};

const KIND_ICON: Record<string, string> = {
  pr_opened: "📝",
  pr_merged: "✅",
  deploy_ready: "🚀",
  deploy_failed: "🔥",
};

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function NotifyPage() {
  const supabase = createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co"),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key")
  );
  const { data, error } = await supabase
    .from("v_pbs_notifications_feed")
    .select("*")
    .limit(50);

  const rows = (data ?? []) as Notification[];
  const unseen = rows.filter(r => !r.seen_at).length;

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "24px 20px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Auto-refresh every 30s */}
      <meta httpEquiv="refresh" content="30" />

      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
          What just shipped
        </h1>
        <div style={{ fontSize: 13, color: "#666" }}>
          {unseen > 0 ? <strong style={{ color: "#084838" }}>{unseen} new</strong> : "all caught up"}
          {" · auto-refresh 30s"}
        </div>
      </header>

      {error ? (
        <div style={{ padding: 16, border: "1px solid #f0c0c0", background: "#fff5f5", borderRadius: 8 }}>
          Error loading feed: {error.message}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 24, color: "#888", textAlign: "center" }}>
          Nothing shipped yet. The agents are working — check back in a minute.
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {rows.map(n => (
            <li
              key={n.id}
              style={{
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
                padding: "14px 16px",
                borderBottom: "1px solid #eee",
                background: n.seen_at ? "transparent" : "#f6fbf7",
              }}
            >
              <div style={{ fontSize: 22, lineHeight: 1, paddingTop: 2 }}>
                {KIND_ICON[n.kind] ?? "•"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>
                  {n.url ? (
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#084838", textDecoration: "none" }}
                    >
                      {n.title}
                    </a>
                  ) : (
                    n.title
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#888" }}>
                  {relTime(n.created_at)}
                  {n.pr_number && (
                    <>
                      {" · "}
                      <a
                        href={`https://github.com/TBC-HM/namkhan-bi/pull/${n.pr_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#888" }}
                      >
                        PR #{n.pr_number}
                      </a>
                    </>
                  )}
                  {n.branch && (
                    <>
                      {" · "}
                      <code style={{ fontSize: 11, color: "#666" }}>{n.branch}</code>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <footer style={{ marginTop: 32, fontSize: 12, color: "#aaa", textAlign: "center" }}>
        Page auto-refreshes every 30 seconds. Click a row to open the live URL or PR.
      </footer>
    </main>
  );
}
