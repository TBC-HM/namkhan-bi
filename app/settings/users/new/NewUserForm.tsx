// app/settings/users/new/NewUserForm.tsx
// Client island for the invite form. Submits to /api/settings/users/new.
"use client";

import { useMemo, useState } from "react";

type Property = { property_id: number; code: string; name: string };
type Dept = { dept_id: string; code: string; name: string; property_id: number };
type RoleLevel = "holding" | "property" | "hod";

export default function NewUserForm({
  properties,
  depts,
}: {
  properties: Property[];
  depts: Dept[];
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleLevel, setRoleLevel] = useState<RoleLevel>("property");
  const [propertyIds, setPropertyIds] = useState<number[]>([]);
  const [deptIds, setDeptIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const visibleDepts = useMemo(() => {
    // Dept list filters down to the picked properties (or shows all when no
    // property picked yet).
    if (propertyIds.length === 0) return depts;
    return depts.filter((d) => propertyIds.includes(d.property_id));
  }, [depts, propertyIds]);

  function togglePropertyId(id: number) {
    setPropertyIds((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      // Drop dept selections whose property is no longer selected
      setDeptIds((d) => d.filter((did) => {
        const dept = depts.find((x) => x.dept_id === did);
        return dept ? next.includes(dept.property_id) : false;
      }));
      return next;
    });
  }

  function toggleDeptId(id: string) {
    setDeptIds((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (roleLevel === "property" && propertyIds.length === 0) {
      setMessage({ kind: "err", text: "Property-level access requires at least one hotel." });
      return;
    }
    if (roleLevel === "hod" && (propertyIds.length !== 1 || deptIds.length === 0)) {
      setMessage({ kind: "err", text: "HOD access requires exactly one hotel and at least one department." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings/users/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: phone || null,
          role_level: roleLevel,
          property_ids: propertyIds,
          dept_ids: deptIds,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ kind: "err", text: `Invite failed: ${json.error ?? res.statusText}` });
      } else {
        setMessage({ kind: "ok", text: `Invitation sent to ${email}.` });
        setName("");
        setEmail("");
        setPhone("");
        setPropertyIds([]);
        setDeptIds([]);
      }
    } catch (err) {
      setMessage({ kind: "err", text: String(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Field label="Full name">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Lars Donaldsen"
          style={inputStyle}
        />
      </Field>

      <Field label="Email">
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@hotel.com"
          style={inputStyle}
        />
      </Field>

      <Field label="Phone (optional)">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+856 ..."
          style={inputStyle}
        />
      </Field>

      <Field label="Access tier">
        <div style={{ display: "flex", gap: 8 }}>
          {(["holding", "property", "hod"] as RoleLevel[]).map((rl) => (
            <button
              key={rl}
              type="button"
              onClick={() => setRoleLevel(rl)}
              style={{
                ...pillStyle,
                background: roleLevel === rl ? "var(--brass, #c4a36a)" : "var(--bg-2, #1a1a1a)",
                color: roleLevel === rl ? "#000" : "var(--text-1, #ccc)",
                borderColor: roleLevel === rl ? "var(--brass, #c4a36a)" : "var(--border-2, #2a2a2a)",
              }}
            >
              {rl === "holding" ? "Holding" : rl === "property" ? "Property" : "HOD"}
            </button>
          ))}
        </div>
        <small style={{ color: "var(--text-2, #888)", marginTop: 6, display: "block" }}>
          {roleLevel === "holding" && "Cross-property access. Hotel and dept lists are ignored."}
          {roleLevel === "property" && "Pick one or more hotels. Leaving depts empty = all departments."}
          {roleLevel === "hod" && "Pick exactly one hotel and at least one department."}
        </small>
      </Field>

      <Field label={`Hotels (${propertyIds.length} selected)`}>
        <div style={checklistStyle}>
          {properties.length === 0 && <em style={{ color: "var(--text-2, #888)" }}>No properties loaded</em>}
          {properties.map((p) => (
            <label key={p.property_id} style={checkRowStyle}>
              <input
                type="checkbox"
                checked={propertyIds.includes(p.property_id)}
                onChange={() => togglePropertyId(p.property_id)}
                disabled={roleLevel === "holding"}
              />
              <span style={{ fontFamily: "monospace", color: "var(--text-2, #888)", minWidth: 80 }}>
                {p.property_id}
              </span>
              <span>{p.name}</span>
            </label>
          ))}
        </div>
      </Field>

      <Field label={`Departments (${deptIds.length} selected, optional)`}>
        <div style={checklistStyle}>
          {visibleDepts.length === 0 && (
            <em style={{ color: "var(--text-2, #888)" }}>
              {propertyIds.length === 0 ? "Pick a hotel above to see its departments." : "No active departments."}
            </em>
          )}
          {visibleDepts.map((d) => (
            <label key={d.dept_id} style={checkRowStyle}>
              <input
                type="checkbox"
                checked={deptIds.includes(d.dept_id)}
                onChange={() => toggleDeptId(d.dept_id)}
                disabled={roleLevel === "holding"}
              />
              <span style={{ fontFamily: "monospace", color: "var(--text-2, #888)", minWidth: 90 }}>
                {d.code}
              </span>
              <span>{d.name}</span>
              <span style={{ marginLeft: "auto", fontSize: "var(--t-eyebrow, 11px)", color: "var(--text-3, #555)" }}>
                {d.property_id}
              </span>
            </label>
          ))}
        </div>
      </Field>

      {message && (
        <div style={{
          padding: 10,
          borderRadius: 6,
          background: message.kind === "ok" ? "rgba(42,125,46,0.18)" : "rgba(179,38,30,0.18)",
          color: message.kind === "ok" ? "var(--good, #6ee07b)" : "var(--bad, #ff8a82)",
          fontSize: "var(--t-sm, 12px)",
        }}>{message.text}</div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="submit" disabled={saving} style={btnPrimary}>
          {saving ? "Sending..." : "Send invitation"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{
        fontSize: "var(--t-eyebrow, 11px)",
        letterSpacing: "0.1em",
        color: "var(--brass, #c4a36a)",
        textTransform: "uppercase",
      }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 6,
  background: "var(--bg-2, #1a1a1a)",
  color: "var(--text-0, #f0f0f0)",
  border: "1px solid var(--border-2, #2a2a2a)",
  fontSize: "var(--t-body, 14px)",
};

const pillStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid var(--border-2, #2a2a2a)",
  fontSize: "var(--t-sm, 12px)",
  cursor: "pointer",
  fontWeight: 600,
};

const checklistStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  maxHeight: 220,
  overflowY: "auto",
  padding: 8,
  background: "var(--bg-2, #1a1a1a)",
  border: "1px solid var(--border-2, #2a2a2a)",
  borderRadius: 6,
};

const checkRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "4px 6px",
  fontSize: "var(--t-sm, 12px)",
};

const btnPrimary: React.CSSProperties = {
  background: "var(--brass, #c4a36a)",
  color: "#000",
  border: "none",
  padding: "10px 18px",
  borderRadius: 6,
  fontSize: "var(--t-sm, 12px)",
  fontWeight: 600,
  cursor: "pointer",
};
