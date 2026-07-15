// components/settings/panels/TeamPanel.tsx
// PBS 2026-07-15 (item 4): Team panel is now a READ-ONLY mirror of HR.
// Source of truth: public.v_team_directory (bridge over v_staff_register_extended
// + hr.employees). No salary — HR-only field. No writes from this panel.
//
// Header action: "+ Add member" → deep-links to the HR create-flow at
//   /finance/hr?add=1                            (Namkhan)
//   /h/{propertyId}/finance/hr?add=1             (Donna / any other property)
// Per row: "Edit in HR →" link that lands on the HR page filtered to that staff.

import Link from 'next/link';
import { PanelHeader, EmptyState } from './_shared';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

type TeamMember = {
  staff_id: string;
  emp_id: string | null;
  full_name: string | null;
  dept_code: string | null;
  dept_name: string | null;
  position_title: string | null;
  notes: string | null;
  skills: string[] | null;
  phone: string | null;
  email: string | null;
  primary_language: string | null;
  english_proficiency: string | null;
  hire_date?: string | null;
  tenure_years?: number | null;
  employment_type?: string | null;
};

function hrBasePath(propertyId: number): string {
  return propertyId === NAMKHAN_PROPERTY_ID ? '/finance/hr' : `/h/${propertyId}/finance/hr`;
}

function initials(name: string | null | undefined, fallback: string): string {
  const source = name && name.trim().length > 0 ? name : fallback;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

function fmtLanguages(m: TeamMember): string | null {
  const parts: string[] = [];
  if (m.primary_language) parts.push(m.primary_language);
  if (m.english_proficiency) parts.push(`EN·${m.english_proficiency}`);
  return parts.length ? parts.join(' · ') : null;
}

function fmtContact(m: TeamMember): React.ReactNode {
  const bits: React.ReactNode[] = [];
  if (m.email) {
    bits.push(
      <a key="e" href={`mailto:${m.email}`} style={{ color: '#1B1B1B', textDecoration: 'none' }}>
        {m.email}
      </a>
    );
  }
  if (m.phone) {
    bits.push(
      <a key="p" href={`tel:${m.phone}`} style={{ color: '#5A5A5A', textDecoration: 'none' }}>
        {m.phone}
      </a>
    );
  }
  if (bits.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
      {bits}
    </div>
  );
}

function chip(text: string, key: string | number): React.ReactNode {
  return (
    <span
      key={key}
      style={{
        display: 'inline-block',
        padding: '1px 8px',
        borderRadius: 99,
        border: '1px solid #E6DFCC',
        background: '#F5F0E1',
        color: '#3A3A3A',
        fontSize: 11,
        marginRight: 4,
        marginBottom: 4,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  );
}

export default function TeamPanel({
  data,
  propertyId,
}: {
  data: TeamMember[];
  propertyId: number;
}) {
  const members = data ?? [];
  const hrBase = hrBasePath(propertyId);
  // PBS 2026-07-16: land directly on Onboarding where the new-hire flow lives,
  // instead of the HR overview (which doesn't handle ?add=1). Same query still
  // sent — Onboarding page can auto-open the create form if it wants to.
  const addHref = `${hrBase}/onboarding?add=1`;

  const addButton = (
    <Link
      href={addHref}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        borderRadius: 4,
        background: '#1F3A2E',
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 600,
        textDecoration: 'none',
        border: '1px solid #1F3A2E',
      }}
    >
      <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>+</span>
      Add member
    </Link>
  );

  const subtitle =
    members.length === 0
      ? 'Read-only mirror of HR · use "+ Add member" to create in HR'
      : `${members.length} active member${members.length === 1 ? '' : 's'} · read-only mirror of HR`;

  if (members.length === 0) {
    return (
      <div style={{ padding: 0 }}>
        <PanelHeader title="Team" subtitle={subtitle} action={addButton} />
        <div style={{ padding: '20px' }}>
          <EmptyState message="No active team members yet. Click ‘+ Add member’ to create the first one in HR." />
        </div>
      </div>
    );
  }

  // Group by dept for a scannable read
  const byDept = new Map<string, TeamMember[]>();
  for (const m of members) {
    const key = m.dept_name ?? m.dept_code ?? 'Unassigned';
    const arr = byDept.get(key) ?? [];
    arr.push(m);
    byDept.set(key, arr);
  }
  const deptOrder = [...byDept.keys()].sort((a, b) => a.localeCompare(b));

  return (
    <div style={{ padding: 0 }}>
      <PanelHeader title="Team" subtitle={subtitle} action={addButton} />

      <div style={{ padding: '12px 20px 4px', display: 'flex', justifyContent: 'flex-end' }}>
        <Link
          href={hrBase}
          style={{ fontSize: 12, color: '#5A5A5A', textDecoration: 'underline' }}
        >
          Open full HR page →
        </Link>
      </div>

      {deptOrder.map((deptName) => {
        const rows = byDept.get(deptName)!;
        return (
          <section key={deptName} style={{ padding: '8px 20px 16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid #E6DFCC',
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--serif, ui-serif, Georgia, serif)',
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#1B1B1B',
                  margin: 0,
                }}
              >
                {deptName}
              </h3>
              <span style={{ fontSize: 11, color: '#8A8A8A' }}>{rows.length}</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 13,
                  color: '#1B1B1B',
                }}
              >
                <thead>
                  <tr style={{ textAlign: 'left', color: '#5A5A5A', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid #E6DFCC', fontWeight: 600 }}>Name</th>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid #E6DFCC', fontWeight: 600 }}>Position</th>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid #E6DFCC', fontWeight: 600 }}>Languages</th>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid #E6DFCC', fontWeight: 600 }}>Skills</th>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid #E6DFCC', fontWeight: 600 }}>Contact</th>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid #E6DFCC', fontWeight: 600 }}>Notes</th>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid #E6DFCC', fontWeight: 600, textAlign: 'right' }}>HR</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => {
                    const langs = fmtLanguages(m);
                    const contact = fmtContact(m);
                    const empId = m.emp_id ?? m.staff_id;
                    const editHref = `${hrBase}/${encodeURIComponent(m.staff_id)}`;
                    return (
                      <tr key={m.staff_id} style={{ verticalAlign: 'top' }}>
                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #F0EADB' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                background: '#F5F0E1',
                                color: '#1F3A2E',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 11,
                                fontWeight: 600,
                                flexShrink: 0,
                              }}
                              aria-hidden
                            >
                              {initials(m.full_name, empId)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, color: '#1B1B1B' }}>
                                {m.full_name ?? empId}
                              </div>
                              {m.emp_id && (
                                <div style={{ fontSize: 11, color: '#8A8A8A' }}>{m.emp_id}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #F0EADB', color: '#3A3A3A' }}>
                          {m.position_title ?? <span style={{ color: '#8A8A8A', fontStyle: 'italic' }}>—</span>}
                          {m.employment_type && (
                            <div style={{ fontSize: 11, color: '#8A8A8A', marginTop: 2 }}>{m.employment_type}</div>
                          )}
                        </td>
                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #F0EADB', color: '#3A3A3A', whiteSpace: 'nowrap' }}>
                          {langs ?? <span style={{ color: '#8A8A8A', fontStyle: 'italic' }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #F0EADB' }}>
                          {m.skills && m.skills.length > 0 ? (
                            <div>{m.skills.map((s, i) => chip(s, i))}</div>
                          ) : (
                            <span style={{ color: '#8A8A8A', fontStyle: 'italic' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #F0EADB' }}>
                          {contact ?? <span style={{ color: '#8A8A8A', fontStyle: 'italic' }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #F0EADB', color: '#5A5A5A', maxWidth: 240 }}>
                          {m.notes ? (
                            <span title={m.notes}>
                              {m.notes.length > 80 ? `${m.notes.slice(0, 80)}…` : m.notes}
                            </span>
                          ) : (
                            <span style={{ color: '#8A8A8A', fontStyle: 'italic' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #F0EADB', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <Link
                            href={editHref}
                            style={{
                              fontSize: 12,
                              color: '#1F3A2E',
                              textDecoration: 'none',
                              fontWeight: 600,
                            }}
                          >
                            Edit in HR →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
