// components/cockpit/tabs/SkillsTab.tsx
// Prompt 6 stub — replaced by full Skills tab in Prompt 7 (cockpit-skills-tab).

'use client';

import { useEffect, useState } from 'react';

interface RosterAgent {
  role: string;
  display_name: string | null;
  skill_count?: number | null;
  read_skills?: number | null;
  write_skills?: number | null;
  gated_skills?: number | null;
}

interface SkillRow {
  skill_id: number;
  name: string;
  category: string | null;
  authority_level: string | null;
  cost_class: string | null;
  description: string | null;
  serves_kpis: string[] | null;
}

export default function SkillsTab({ roster }: { roster: RosterAgent[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [skillsByRole, setSkillsByRole] = useState<Record<string, SkillRow[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  async function loadSkills(role: string) {
    if (skillsByRole[role] || loading[role]) return;
    setLoading((m) => ({ ...m, [role]: true }));
    try {
      const res = await fetch('/api/cockpit/skills-for-role', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setSkillsByRole((m) => ({ ...m, [role]: data }));
      }
    } finally {
      setLoading((m) => ({ ...m, [role]: false }));
    }
  }

  useEffect(() => {
    if (expanded) loadSkills(expanded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {roster.map((a) => {
        const isOpen = expanded === a.role;
        const rows = skillsByRole[a.role] ?? [];
        return (
          <div
            key={a.role}
            style={{
              background: 'var(--surf-1, #0f0d0a)',
              border: '1px solid var(--border-1, #1f1c15)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => setExpanded(isOpen ? null : a.role)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: '10px 14px',
                textAlign: 'left',
                color: 'var(--text-0, #e9e1ce)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 14 }}>
                {a.display_name ?? a.role}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-dim, #7d7565)', fontFamily: "'JetBrains Mono', monospace" }}>
                {a.skill_count ?? 0} skills
                {a.read_skills != null && ` · ${a.read_skills} read`}
                {a.write_skills != null && ` · ${a.write_skills} write`}
                {a.gated_skills != null && ` · ${a.gated_skills} gated`}
              </span>
              <span style={{ marginLeft: 'auto', color: 'var(--text-dim, #7d7565)', fontSize: 10 }}>
                {isOpen ? '▼' : '▸'}
              </span>
            </button>
            {isOpen && (
              <div style={{ borderTop: '1px solid var(--border-1, #1f1c15)' }}>
                {loading[a.role] && (
                  <div style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text-mute, #9b907a)' }}>
                    Loading skills…
                  </div>
                )}
                {!loading[a.role] && rows.length === 0 && (
                  <div style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text-dim, #7d7565)' }}>
                    No skills returned (catalog endpoint not yet wired — see Prompt 7).
                  </div>
                )}
                {rows.map((s) => (
                  <div
                    key={s.skill_id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '20px 1fr 80px 90px',
                      gap: 12,
                      padding: '6px 14px',
                      borderTop: '1px solid var(--border-1, #1f1c15)',
                      fontSize: 12,
                      color: 'var(--text-0, #e9e1ce)',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    <span>{s.authority_level === 'write' ? '✏️' : s.authority_level === 'gated' ? '🔒' : '📖'}</span>
                    <span>{s.name}</span>
                    <span style={{ color: 'var(--text-dim, #7d7565)' }}>{s.authority_level ?? '—'}</span>
                    <span style={{ color: 'var(--text-mute, #9b907a)' }}>{s.cost_class ?? '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
