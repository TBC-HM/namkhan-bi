// app/cockpit/users/page.tsx
// Owner-only admin page (middleware enforces — non-owners get 404).
// Lists workspace_users, inline checkbox toggles, add/deactivate/reactivate.
"use client";

import { useEffect, useState, useCallback } from "react";

type Row = {
  email: string;
  display_name: string | null;
  access_revenue: boolean;
  access_sales: boolean;
  access_marketing: boolean;
  access_operations: boolean;
  access_finance: boolean;
  is_owner: boolean;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
  notes: string | null;
};

const DEPTS = [
  { key: "access_revenue", label: "Rev" },
  { key: "access_sales", label: "Sales" },
  { key: "access_marketing", label: "Mkt" },
  { key: "access_operations", label: "Ops" },
  { key: "access_finance", label: "Fin" },
] as const;

export default function WorkspaceUsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/cockpit/users");
    if (!res.ok) {
      setError("failed to load (status " + res.status + ")");
      setLoading(false);
      return;
    }
    const json = await res.json();
    setRows(json.rows ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function patch(email: string, patch: Partial<Row>) {
    const res = await fetch("/api/cockpit/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", email, ...patch }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(`Update failed: ${j.error ?? res.statusText}`);
      return;
    }
    await load();
  }

  async function toggleActive(row: Row) {
    const res = await fetch("/api/cockpit/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: row.active ? "deactivate" : "reactivate", email: row.email }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(`Toggle failed: ${j.error ?? res.statusText}`);
      return;
    }
    await load();
  }

  return (
    <div style={{ padding: "32px 48px", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{
        fontSize: 11, letterSpacing: "0.15em", color: "var(--brass, #c4a36a)",
        textTransform: "uppercase", marginBottom: 4,
      }}>Cockpit · Owner Admin</div>
      <h1 style={{
        fontFamily: "Fraunces, Georgia, serif", fontStyle: "italic", fontSize: 32,
        margin: "0 0 8px",
      }}>Workspace Users</h1>
      <p style={{ color: "var(--text-2, #888)", maxWidth: "60ch", margin: "0 0 24px" }}>
        Email + 5 dept access flags. Hard delete forbidden — use Active toggle.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            background: "var(--brass, #c4a36a)", color: "#000", border: "none",
            padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: "pointer",
          }}
        >+ Add user</button>
        <button
          onClick={load}
          style={{
            background: "var(--bg-2, #222)", color: "var(--text-1, #ccc)",
            border: "1px solid var(--border-2, #333)", padding: "8px 14px",
            borderRadius: 6, fontSize: 12, cursor: "pointer",
          }}
        >Reload</button>
      </div>

      {error && <div style={{ padding: 12, background: "rgba(179,38,30,0.15)", borderRadius: 6, marginBottom: 12 }}>{error}</div>}
      {loading ? <div>Loading…</div> : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-1, #333)" }}>
              <th style={th}>Email</th>
              <th style={th}>Name</th>
              {DEPTS.map((d) => <th key={d.key} style={thCenter}>{d.label}</th>)}
              <th style={thCenter}>Owner</th>
              <th style={thCenter}>Active</th>
              <th style={th}>Last login</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.email} style={{ borderBottom: "1px solid var(--border-2, #2a2a2a)", opacity: r.active ? 1 : 0.5 }}>
                <td style={td}>{r.email}</td>
                <td style={td}>{r.display_name ?? r.email.split("@")[0]}</td>
                {DEPTS.map((d) => (
                  <td key={d.key} style={tdCenter}>
                    <input
                      type="checkbox"
                      checked={r[d.key as keyof Row] as boolean}
                      onChange={(e) => patch(r.email, { [d.key]: e.target.checked } as Partial<Row>)}
                      disabled={r.is_owner}
                      title={r.is_owner ? "Owner has all access regardless" : ""}
                    />
                  </td>
                ))}
                <td style={tdCenter}>
                  <input
                    type="checkbox"
                    checked={r.is_owner}
                    onChange={(e) => patch(r.email, { is_owner: e.target.checked })}
                  />
                </td>
                <td style={tdCenter}>
                  <button
                    onClick={() => toggleActive(r)}
                    style={{
                      background: r.active ? "var(--good, #2a7d2e)" : "var(--text-3, #555)",
                      color: "#fff", border: "none", padding: "3px 10px",
                      borderRadius: 4, fontSize: 11, cursor: "pointer",
                    }}
                  >{r.active ? "Active" : "Off"}</button>
                </td>
                <td style={td}>{r.last_login_at ? r.last_login_at.slice(0, 10) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onCreated={load} />}
    </div>
  );
}

function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [flags, setFlags] = useState({
    access_revenue: false, access_sales: false, access_marketing: false,
    access_operations: false, access_finance: false, is_owner: false,
  });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/cockpit/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        email,
        display_name: displayName || null,
        ...flags,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(`Create failed: ${j.error ?? res.statusText}`);
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <form onSubmit={submit} style={{
        background: "var(--bg-1, #1a1a1a)", padding: 24, borderRadius: 10, width: 420,
        border: "1px solid var(--border, #333)",
      }}>
        <h2 style={{ margin: "0 0 16px", fontFamily: "Fraunces, Georgia, serif", fontStyle: "italic" }}>Add user</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input required type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          <input placeholder="Display name (optional)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />
          {DEPTS.map((d) => (
            <label key={d.key} style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={flags[d.key as keyof typeof flags] as boolean}
                onChange={(e) => setFlags({ ...flags, [d.key]: e.target.checked })}
              />
              {d.label} access
            </label>
          ))}
          <label style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <input
              type="checkbox"
              checked={flags.is_owner}
              onChange={(e) => setFlags({ ...flags, is_owner: e.target.checked })}
            />
            Owner (sees everything)
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={btnSecondary}>Cancel</button>
          <button type="submit" disabled={saving || !email} style={btnPrimary}>
            {saving ? "Saving…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 11, letterSpacing: "0.1em", color: "var(--brass, #c4a36a)", textTransform: "uppercase" };
const thCenter: React.CSSProperties = { ...th, textAlign: "center" };
const td: React.CSSProperties = { padding: "8px 10px" };
const tdCenter: React.CSSProperties = { ...td, textAlign: "center" };
const inputStyle: React.CSSProperties = { padding: "8px 10px", borderRadius: 6, background: "var(--bg-2, #222)", color: "var(--text-0, #f0f0f0)", border: "1px solid var(--border-2, #333)", fontSize: 13 };
const btnPrimary: React.CSSProperties = { background: "var(--brass, #c4a36a)", color: "#000", border: "none", padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { background: "var(--bg-2, #222)", color: "var(--text-1, #ccc)", border: "1px solid var(--border-2, #333)", padding: "8px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer" };
