'use client';

// app/finance/hr/schedule/SchedulePlannerView.tsx
// HR Schedule Planner — 30-day grid, per-department, cell editor with reason tracking.
// PBS 2026-07-25 · ADR-149 · Namkhan manual engine; Donna = Factorial read-only.

import { useState, useEffect, useCallback, useTransition } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShiftTemplate {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  break_min: number;
  dept_id: string | null;
}

interface StaffRow {
  user_id: string;
  full_name: string;
  position_title: string;
  dept_id: string | null;
  dept_name: string | null;
  dept_code: string | null;
  property_id: number;
}

interface ShiftCell {
  shift_id: string;
  user_id: string;
  shift_date: string;
  template_code: string | null;
  template_name: string | null;
  status: string;
  is_published: boolean;
  notes: string | null;
  edit_reason: string | null;
}

interface CellEdit {
  user_id: string;
  shift_date: string;
  existing: ShiftCell | null;
}

// ── Color map for shift templates ─────────────────────────────────────────────

function shiftColor(code: string | null, status: string): { bg: string; text: string } {
  if (!code || status === 'gap')  return { bg: '#FFF8E1', text: '#F57F17' };   // gap = leave
  if (status === 'cancelled')     return { bg: '#F5F5F5', text: '#9E9E9E' };
  const c = code.toUpperCase();
  if (c.startsWith('S1') || c.startsWith('S2')) return { bg: '#E8F5E9', text: '#2E7D32' };
  if (c.startsWith('S3') || c.startsWith('S4')) return { bg: '#E3F2FD', text: '#1565C0' };
  if (c.startsWith('S5') || c.startsWith('S6')) return { bg: '#FFF3E0', text: '#E65100' };
  if (c.toLowerCase().includes('night') || c.startsWith('S9')) return { bg: '#EDE7F6', text: '#4527A0' };
  if (c.toLowerCase().includes('split')) return { bg: '#E0F2F1', text: '#00695C' };
  return { bg: '#F3E5F5', text: '#6A1B9A' };
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shortDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
}

function isWeekend(iso: string): boolean {
  const dow = new Date(iso + 'T00:00:00').getDay();
  return dow === 0 || dow === 6;
}

// ── Cell editor popover ───────────────────────────────────────────────────────

interface PopoverProps {
  cell: CellEdit;
  templates: ShiftTemplate[];
  propertyId: number;
  onSave: (data: {
    user_id: string; shift_date: string; action: string;
    template_id?: string; status?: string; notes?: string; edit_reason?: string;
  }) => Promise<void>;
  onClose: () => void;
}

function CellPopover({ cell, templates, propertyId, onSave, onClose }: PopoverProps) {
  const isEdit = !!cell.existing;
  const [templateId, setTemplateId] = useState(cell.existing?.shift_id ? '' : '');
  const [status, setStatus] = useState<string>(cell.existing?.status ?? 'planned');
  const [notes, setNotes] = useState(cell.existing?.notes ?? '');
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function handleSave() {
    if (isEdit && !reason.trim()) { setErr('Reason required when editing an existing shift.'); return; }
    startTransition(async () => {
      await onSave({
        user_id: cell.user_id,
        shift_date: cell.shift_date,
        action: 'upsert',
        template_id: templateId || undefined,
        status,
        notes: notes || undefined,
        edit_reason: reason || undefined,
      });
      onClose();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await onSave({ user_id: cell.user_id, shift_date: cell.shift_date, action: 'delete' });
      onClose();
    });
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.25)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#FFFFFF', borderRadius: 8, border: '1px solid #E6DFCC',
        padding: '20px 22px', width: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1B1B1B', marginBottom: 4 }}>
          {isEdit ? 'Edit shift' : 'Assign shift'}
        </div>
        <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 16 }}>
          {shortDay(cell.shift_date)}
          {cell.existing && (
            <span style={{ marginLeft: 8, color: cell.existing.is_published ? '#2E7D32' : '#F57F17',
              fontWeight: 600 }}>
              {cell.existing.is_published ? '● published' : '○ draft'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Shift template</label>
            <select value={templateId} onChange={e => setTemplateId(e.target.value)} style={inputStyle}>
              <option value="">— Day off / clear —</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.code} · {t.name} ({t.start_time.slice(0, 5)}–{t.end_time.slice(0, 5)})
                </option>
              ))}
              <option value="__leave__">LEAVE</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>
              <option value="scheduled">Scheduled (draft)</option>
              <option value="confirmed">Confirmed</option>
              <option value="gap">Leave / absence</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="e.g. Cover for Somsak" />
          </div>

          {isEdit && (
            <div>
              <label style={{ ...labelStyle, color: '#B8542A' }}>Reason for change *</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)}
                rows={2} style={{ ...inputStyle, borderColor: reason ? '#E6DFCC' : '#B8542A', resize: 'vertical' }}
                placeholder="e.g. Staff requested swap, medical appointment..." />
            </div>
          )}

          {err && <div style={{ fontSize: 11, color: '#B8542A' }}>{err}</div>}

          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button onClick={handleSave} disabled={isPending} style={{
              flex: 1, fontSize: 12, fontWeight: 700, padding: '8px 0', borderRadius: 4,
              background: '#1F3A2E', color: '#FFFFFF', border: 'none', cursor: 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}>
              {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Assign'}
            </button>
            {isEdit && (
              <button onClick={handleDelete} disabled={isPending} style={{
                fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 4,
                background: '#FFEBEE', color: '#D32F2F', border: '1px solid #D32F2F', cursor: 'pointer',
              }}>
                Remove
              </button>
            )}
            <button onClick={onClose} style={{
              fontSize: 12, padding: '8px 14px', borderRadius: 4,
              background: '#F5F5F5', color: '#5A5A5A', border: '1px solid #E6DFCC', cursor: 'pointer',
            }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: '#5A5A5A', display: 'block', marginBottom: 4,
};
const inputStyle: React.CSSProperties = {
  fontSize: 12, padding: '6px 8px', border: '1px solid #E6DFCC', borderRadius: 4,
  background: '#FFFFFF', color: '#1B1B1B', width: '100%', boxSizing: 'border-box',
};

// ── Main Planner ──────────────────────────────────────────────────────────────

interface Props {
  propertyId: number;
  isReadOnly?: boolean;
}

export default function SchedulePlannerView({ propertyId, isReadOnly = false }: Props) {
  const today = new Date();
  const [startDate, setStartDate] = useState(toISODate(today));
  const [days, setDays] = useState(30);

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [shifts, setShifts] = useState<ShiftCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [activeCell, setActiveCell] = useState<CellEdit | null>(null);

  // Build date range
  const startD = new Date(startDate + 'T00:00:00');
  const dateRange: string[] = Array.from({ length: days }, (_, i) => toISODate(addDays(startD, i)));
  const endDate = dateRange[dateRange.length - 1];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, tmplRes, shiftRes] = await Promise.all([
        fetch('/api/planner/staff?property_id=' + propertyId, { cache: 'no-store' }),
        fetch('/api/planner/templates?property_id=' + propertyId, { cache: 'no-store' }),
        fetch('/api/planner/shifts?property_id=' + propertyId + '&start=' + startDate + '&end=' + endDate, { cache: 'no-store' }),
      ]);
      if (staffRes.ok) setStaff(await staffRes.json());
      if (tmplRes.ok) setTemplates(await tmplRes.json());
      if (shiftRes.ok) setShifts(await shiftRes.json());
    } finally { setLoading(false); }
  }, [propertyId, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  // Build shift lookup: user_id + date → shift
  const shiftMap = new Map<string, ShiftCell>();
  for (const s of shifts) {
    shiftMap.set(s.user_id + '|' + s.shift_date, s);
  }

  // Group staff by dept
  const depts = new Map<string, { name: string; code: string; staff: StaffRow[] }>();
  for (const s of staff) {
    const key = s.dept_id ?? '__none__';
    if (!depts.has(key)) depts.set(key, { name: s.dept_name ?? 'Other', code: s.dept_code ?? '', staff: [] });
    depts.get(key)!.staff.push(s);
  }

  // Stats
  const totalShifts = shifts.length;
  const published = shifts.filter(s => s.is_published).length;
  const draft = totalShifts - published;
  const gaps = dateRange.filter(d => {
    const count = shifts.filter(s => s.shift_date === d && s.status !== 'gap' && s.status !== 'cancelled').length;
    return count < 3; // less than 3 staff working any day = coverage gap
  }).length;

  async function generate() {
    setGenerating(true); setMsg(null);
    const res = await fetch('/api/schedule/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: propertyId, start_date: startDate, end_date: endDate }),
    });
    const j = await res.json();
    setGenerating(false);
    if (res.ok) { setMsg(j.shifts_seeded + ' shifts generated'); load(); }
    else setMsg('Error: ' + j.error);
  }

  async function publish() {
    setPublishing(true); setMsg(null);
    const res = await fetch('/api/schedule/publish', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: propertyId, start_date: startDate, end_date: endDate }),
    });
    const j = await res.json();
    setPublishing(false);
    if (res.ok) { setMsg(j.shifts_published + ' shifts published'); load(); }
    else setMsg('Error: ' + j.error);
  }

  async function saveCell(data: {
    user_id: string; shift_date: string; action: string;
    template_id?: string; status?: string; notes?: string; edit_reason?: string;
  }) {
    const effectiveTemplateId = data.template_id === '__leave__' ? undefined : data.template_id;
    const effectiveStatus = data.template_id === '__leave__' ? 'gap' : (data.status ?? 'scheduled');
    await fetch('/api/schedule/shift', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, template_id: effectiveTemplateId, status: effectiveStatus, property_id: propertyId }),
    });
    load();
  }

  const CELL_W = 76;
  const NAME_W = 160;

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100%' }}>
      {/* Header bar */}
      <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1B1B1B' }}>
            {isReadOnly ? 'Donna · Factorial Schedule (read-only)' : 'Namkhan · Schedule Planner'}
          </div>
          <div style={{ fontSize: 11, color: '#5A5A5A' }}>
            {staff.length} staff · {dateRange.length} days · draft then publish
          </div>
        </div>

        {/* KPI tiles */}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {[
            { label: 'Total shifts', value: totalShifts, color: '#5A5A5A' },
            { label: 'Published', value: published, color: '#2E7D32' },
            { label: 'Draft', value: draft, color: '#F57F17' },
            { label: 'Gap days', value: gaps, color: gaps > 0 ? '#D32F2F' : '#2E7D32' },
          ].map(k => (
            <div key={k.label} style={{
              background: '#FAFAF7', border: '1px solid #E6DFCC', borderRadius: 6,
              padding: '8px 14px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 9, color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: '12px 20px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        borderBottom: '1px solid #E6DFCC' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: '#5A5A5A', fontWeight: 600 }}>From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            style={{ fontSize: 11, padding: '5px 8px', border: '1px solid #E6DFCC',
              borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: '#5A5A5A', fontWeight: 600 }}>Days</label>
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            style={{ fontSize: 11, padding: '5px 8px', border: '1px solid #E6DFCC',
              borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B' }}>
            {[7, 14, 30, 60].map(d => <option key={d} value={d}>{d} days</option>)}
          </select>
        </div>

        {!isReadOnly && (
          <>
            <button onClick={generate} disabled={generating || loading} style={{
              fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 4,
              background: '#1F3A2E', color: '#FFFFFF', border: 'none', cursor: 'pointer',
              opacity: generating ? 0.6 : 1,
            }}>
              {generating ? 'Generating…' : '✨ Generate ' + days + ' days'}
            </button>
            <button onClick={publish} disabled={publishing || draft === 0} style={{
              fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 4,
              background: draft > 0 ? '#2E7D32' : '#C8C0B0', color: '#FFFFFF',
              border: 'none', cursor: draft > 0 ? 'pointer' : 'not-allowed',
              opacity: publishing ? 0.6 : 1,
            }}>
              {publishing ? 'Publishing…' : '▶ Publish ' + draft + ' draft shifts'}
            </button>
          </>
        )}

        {msg && <span style={{ fontSize: 11, color: msg.startsWith('Error') ? '#D32F2F' : '#2E7D32',
          fontWeight: 600 }}>{msg}</span>}
        {loading && <span style={{ fontSize: 11, color: '#8A8A8A' }}>Loading…</span>}
      </div>

      {/* Grid */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11, tableLayout: 'fixed',
          width: NAME_W + CELL_W * dateRange.length }}>
          {/* Header row — sticky top */}
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#FAFAF7' }}>
            <tr>
              <th style={{
                width: NAME_W, minWidth: NAME_W, padding: '6px 10px',
                textAlign: 'left', fontWeight: 700, color: '#5A5A5A',
                fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
                borderBottom: '1px solid #E6DFCC', borderRight: '1px solid #E6DFCC',
                position: 'sticky', left: 0, background: '#FAFAF7', zIndex: 11,
              }}>
                Staff
              </th>
              {dateRange.map(d => (
                <th key={d} style={{
                  width: CELL_W, minWidth: CELL_W, padding: '5px 2px',
                  textAlign: 'center', fontWeight: isWeekend(d) ? 700 : 400,
                  color: isWeekend(d) ? '#D32F2F' : '#5A5A5A',
                  fontSize: 10, borderBottom: '1px solid #E6DFCC',
                  background: isWeekend(d) ? '#FFF5F5' : '#FAFAF7',
                  borderLeft: '1px solid #F0EBE0',
                }}>
                  {shortDay(d)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {Array.from(depts.entries()).map(([deptKey, dept]) => (
              <>
                {/* Department header row */}
                <tr key={'dept-' + deptKey}>
                  <td colSpan={dateRange.length + 1} style={{
                    padding: '5px 10px', background: '#F4EFE2',
                    fontSize: 10, fontWeight: 700, color: '#1F3A2E',
                    letterSpacing: '0.07em', textTransform: 'uppercase',
                    borderTop: '2px solid #E6DFCC',
                  }}>
                    {dept.name} · {dept.staff.length} staff
                  </td>
                </tr>

                {/* Staff rows */}
                {dept.staff.map((s, si) => (
                  <tr key={s.user_id} style={{ background: si % 2 === 0 ? '#FFFFFF' : '#FDFCFA' }}>
                    {/* Sticky name cell */}
                    <td style={{
                      width: NAME_W, minWidth: NAME_W, padding: '4px 10px',
                      position: 'sticky', left: 0,
                      background: si % 2 === 0 ? '#FFFFFF' : '#FDFCFA',
                      borderRight: '1px solid #E6DFCC', zIndex: 2,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#1B1B1B',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.full_name}
                      </div>
                      <div style={{ fontSize: 9, color: '#8A8A8A', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.position_title}
                      </div>
                    </td>

                    {/* Day cells */}
                    {dateRange.map(d => {
                      const shift = shiftMap.get(s.user_id + '|' + d);
                      const col = shift ? shiftColor(shift.template_code, shift.status) : null;
                      return (
                        <td key={d} style={{
                          width: CELL_W, height: 34, padding: '2px 3px',
                          borderLeft: '1px solid #F0EBE0',
                          background: isWeekend(d) ? (si % 2 === 0 ? '#FFF8F8' : '#FFF5F5') : 'inherit',
                          cursor: isReadOnly ? 'default' : 'pointer',
                          verticalAlign: 'middle',
                        }}
                          onClick={() => !isReadOnly && setActiveCell({
                            user_id: s.user_id,
                            shift_date: d,
                            existing: shift ?? null,
                          })}
                        >
                          {shift && col ? (
                            <div style={{
                              background: col.bg, color: col.text,
                              borderRadius: 3, padding: '2px 4px',
                              fontSize: 10, fontWeight: 700, textAlign: 'center',
                              border: shift.is_published ? 'none' : '1px dashed ' + col.text,
                              opacity: shift.status === 'off' ? 0.5 : 1,
                            }}>
                              {shift.status === 'gap' ? 'LEAVE'
                                : shift.status === 'cancelled' ? 'OFF'
                                : (shift.template_code ?? shift.status.toUpperCase().slice(0,3))}
                              {shift.edit_reason && (
                                <span style={{ fontSize: 8, marginLeft: 2 }} title={shift.edit_reason}>✎</span>
                              )}
                            </div>
                          ) : (
                            !isReadOnly && (
                              <div style={{ textAlign: 'center', color: '#D8D0C4', fontSize: 14 }}>+</div>
                            )
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ padding: '10px 20px', borderTop: '1px solid #E6DFCC', display: 'flex',
        gap: 12, flexWrap: 'wrap', fontSize: 10, color: '#8A8A8A' }}>
        {[
          { bg: '#E8F5E9', text: '#2E7D32', label: 'Morning (S1–S2)' },
          { bg: '#E3F2FD', text: '#1565C0', label: 'Midday (S3–S4)' },
          { bg: '#FFF3E0', text: '#E65100', label: 'Afternoon (S5–S6)' },
          { bg: '#EDE7F6', text: '#4527A0', label: 'Night' },
          { bg: '#FFF8E1', text: '#F57F17', label: 'Leave' },
          { bg: '#F5F5F5', text: '#9E9E9E', label: 'Off' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 28, height: 14, borderRadius: 2, background: l.bg,
              color: l.text, fontSize: 8, fontWeight: 700, display: 'flex',
              alignItems: 'center', justifyContent: 'center' }}>S</div>
            <span>{l.label}</span>
          </div>
        ))}
        <span style={{ marginLeft: 'auto' }}>
          Dashed border = draft · Solid = published · ✎ = manually edited (with reason)
        </span>
      </div>

      {/* Cell editor modal */}
      {activeCell && (
        <CellPopover
          cell={activeCell}
          templates={templates}
          propertyId={propertyId}
          onSave={saveCell}
          onClose={() => setActiveCell(null)}
        />
      )}
    </div>
  );
}
