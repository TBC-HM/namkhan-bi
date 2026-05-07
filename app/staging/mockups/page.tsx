// app/staging/mockups/page.tsx
// Mockup gallery — all design files PBS uploaded to ~/Downloads, mounted under
// /_engine_prototypes/ and /_dept_mockups/. PBS reviews each, picks finalists,
// Cowork wires the chosen ones to real Supabase views.
//
// Author: PBS via Claude (Cowork) · 2026-05-07.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REVENUE_ENGINE = [
  { slug: "rm_morning",        label: "Morning",          file: "/_engine_prototypes/rm_morning.html",        note: "uploaded 2026-05-07 (latest)" },
  { slug: "rm_entry_v2",       label: "Entry v2",         file: "/_engine_prototypes/rm_entry_v2.html",       note: "live at /revenue/engine?view=entry" },
  { slug: "rm_entry",          label: "Entry v1",         file: "/_engine_prototypes/rm_entry.html",          note: "earlier draft" },
  { slug: "rm_workspace_v3",   label: "Workspace v3",     file: "/_engine_prototypes/rm_workspace_v3.html",   note: "live at /revenue/engine?view=workspace" },
  { slug: "rm_workspace_v3_1", label: "Workspace v3.1",   file: "/_engine_prototypes/rm_workspace_v3_1.html", note: "iteration" },
  { slug: "rm_workspace",      label: "Workspace v1",     file: "/_engine_prototypes/rm_workspace.html",      note: "earliest" },
  { slug: "rm_report",         label: "Report",           file: "/_engine_prototypes/rm_report.html",         note: "live at /revenue/engine?view=report" },
  { slug: "rm_dashboard",      label: "Dashboard",        file: "/_engine_prototypes/rm_dashboard.html",      note: "live at /revenue/engine?view=dashboard" },
  { slug: "rm_team_design_v2", label: "Team v2",          file: "/_engine_prototypes/rm_team_design_v2.html", note: "team layout" },
  { slug: "rm_team_design",    label: "Team v1",          file: "/_engine_prototypes/rm_team_design.html",    note: "earlier" },
];

const REVENUE_REDESIGN = [
  { slug: "v1", label: "Revenue redesign v1", file: "/_dept_mockups/namkhan_revenue_redesign.html" },
  { slug: "v2", label: "Revenue redesign v2", file: "/_dept_mockups/namkhan_revenue_redesign_1.html" },
  { slug: "v3", label: "Revenue redesign v3", file: "/_dept_mockups/namkhan_revenue_redesign_2.html" },
  { slug: "v4", label: "Revenue redesign v4", file: "/_dept_mockups/namkhan_revenue_redesign_3.html" },
  { slug: "v5", label: "Revenue redesign v5", file: "/_dept_mockups/namkhan_revenue_redesign_4.html" },
  { slug: "v6", label: "Revenue redesign v6", file: "/_dept_mockups/namkhan_revenue_redesign_5.html" },
  { slug: "v7", label: "Revenue redesign v7", file: "/_dept_mockups/namkhan_revenue_redesign_6.html" },
  { slug: "v8", label: "Revenue redesign v8", file: "/_dept_mockups/namkhan_revenue_redesign_7.html" },
  { slug: "v9", label: "Revenue redesign v9", file: "/_dept_mockups/namkhan_revenue_redesign_8.html" },
];

const COCKPIT = [
  { slug: "v1", label: "Cockpit v1",       file: "/_dept_mockups/cockpit-mockup.html" },
  { slug: "v2", label: "Cockpit v2",       file: "/_dept_mockups/cockpit-mockup-v2.html" },
  { slug: "v3", label: "Cockpit v3",       file: "/_dept_mockups/cockpit-mockup-v3.html" },
  { slug: "v4", label: "Cockpit v4",       file: "/_dept_mockups/cockpit-mockup-v4.html" },
  { slug: "v5", label: "Cockpit v5 (latest)", file: "/_dept_mockups/cockpit-mockup-v5.html" },
];

const COMPSET = [
  { slug: "v2", label: "Compset v2", file: "/_dept_mockups/compset_page_mockup_v2.html" },
  { slug: "v3", label: "Compset v3", file: "/_dept_mockups/compset_page_mockup_v3.html" },
];

const OTHER = [
  { slug: "dashboard_v2",  label: "Namkhan Dashboard v2",   file: "/_dept_mockups/namkhan-dashboard-v2.html" },
  { slug: "pbs_central",   label: "PBS Central",            file: "/_dept_mockups/pbs_central_mockup.html" },
];

const REAL_PAGES = [
  { slug: "rev",      label: "Revenue dashboard",     route: "/revenue/dashboard",     desc: "Live Supabase data, no mocks" },
  { slug: "sales",    label: "Sales dashboard",       route: "/sales/dashboard",       desc: "DMC contracts + channel + arrivals" },
  { slug: "mkt",      label: "Marketing dashboard",   route: "/marketing/dashboard",   desc: "Channel mix + ranking + parity" },
  { slug: "ops",      label: "Operations dashboard",  route: "/operations/dashboard",  desc: "Arrivals + staff + F&B" },
  { slug: "guest",    label: "Guest dashboard",       route: "/guest/dashboard",       desc: "TODO — repeat guests + journey" },
  { slug: "fin",      label: "Finance dashboard",     route: "/finance/dashboard",     desc: "TODO — USALI P&L + FX" },
];

function Section({ title, items, isMockup = true }: { title: string; items: Array<{ slug: string; label: string; file?: string; route?: string; desc?: string; note?: string }>; isMockup?: boolean }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: "#c79a6b", marginBottom: 12, fontWeight: 600 }}>{title}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {items.map((it) => {
          const href = isMockup ? it.file! : it.route!;
          return (
            <a key={it.slug} href={href} target="_blank" rel="noreferrer"
               style={{ display: "block", padding: 14, background: "#15151a", border: "1px solid #25252d", borderRadius: 8, textDecoration: "none", color: "#ededf0" }}>
              <div style={{ fontFamily: "'Cooper', Georgia, serif", fontSize: 18, marginBottom: 4 }}>{it.label}</div>
              <div style={{ fontSize: 11, color: "#6b6b75", fontFamily: "ui-monospace, monospace" }}>{it.note ?? it.desc ?? href}</div>
              <div style={{ fontSize: 10, color: "#3d3d45", fontFamily: "ui-monospace, monospace", marginTop: 6 }}>{href}</div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <div style={{ background: "#0a0a0b", color: "#ededf0", minHeight: "100vh", padding: "32px 28px", fontFamily: "-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "#c79a6b" }}>Staging · Mockup gallery</div>
        <h1 style={{ fontFamily: "'Cooper', Georgia, serif", fontSize: 40, fontWeight: 400, marginTop: 4 }}>
          All <em style={{ color: "#c79a6b" }}>30+</em> mockups + 6 real dashboards
        </h1>
        <div style={{ fontSize: 12, color: "#6b6b75", maxWidth: 720, marginTop: 8, lineHeight: 1.5 }}>
          Pick which mockup style each dept should adopt. Click a card to open. Real-data pages are at the bottom — wired to live Supabase views, zero mocks.
        </div>
      </div>

      <Section title="Real dashboards (live Supabase data)" items={REAL_PAGES} isMockup={false} />
      <Section title="Revenue Engine — entry / workspace / report / dashboard / morning" items={REVENUE_ENGINE} />
      <Section title="Revenue redesign sketches" items={REVENUE_REDESIGN} />
      <Section title="Cockpit mockups" items={COCKPIT} />
      <Section title="Compset mockups" items={COMPSET} />
      <Section title="Other / cross-cutting" items={OTHER} />

      <div style={{ marginTop: 40, padding: 16, background: "#15151a", border: "1px solid #25252d", borderRadius: 8, fontSize: 12, color: "#a1a1aa" }}>
        <b style={{ color: "#c79a6b" }}>How to use this page:</b><br />
        1. Click each mockup, decide which one represents the final look for its dept.<br />
        2. Reply in cockpit chat naming the chosen file (e.g. <code style={{ color: "#5cf2a4" }}>rm_morning.html</code>) and which dept it belongs to.<br />
        3. Cowork wires the chosen design into a real <code>/revenue/dashboard</code> / <code>/sales/dashboard</code> etc., pulling live data only.<br />
      </div>
    </div>
  );
}
