'use client';

// app/finance/hr/schedule/SchedulePlannerView.tsx
// PBS 2026-07-25 · ADR-149 · v2: dept view + dept bulk assign + dept filter
// Namkhan manual engine; Donna = Factorial read-only.

import { useState, useEffect, useCallback, useTransition } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShiftTemplate { id: string; code: string; name: string; start_time: string; end_time: string; break_min: number; dept_id: string | null; }
interface StaffRow { user_id: string; ext_id: string; full_name: string; position_title: string; dept_id: string | null; dept_name: string | null; dept_code: string | null; property_id: number; }
interface ShiftCell { shift_id: string; user_id: string; shift_date: string; template_code: string | null; template_name: string | null; status: string; is_published: boolean; notes: string | null; edit_reason: string | null; }
interface DeptCoverage { dept_id: string; dept_name: string; dept_code: string; shift_date: string; shifts_scheduled: number; shifts_published: number; on_leave: number; total_staff: number; }
interface CellEdit { user_id: string; shift_date: string; existing: ShiftCell | null; }

// ── Colors ────────────────────────────────────────────────────────────────────

function shiftColor(code: string | null, status: string): { bg: string; text: string } {
  if (!code || status === 'gap')  return { bg: '#FFF8E1', text: '#F57F17' };
  if (status === 'cancelled')     return { bg: '#F5F5F5', text: '#9E9E9E' };
  const c = code.toUpperCase();
  if (c.startsWith('S1') || c.startsWith('S2')) return { bg: '#E8F5E9', text: '#2E7D32' };
  if (c.startsWith('S3') || c.startsWith('S4')) return { bg: '#E3F2FD', text: '#1565C0' };
  if (c.startsWith('S5') || c.startsWith('S6')) return { bg: '#FFF3E0', text: '#E65100' };
  if (c.toLowerCase().includes('night') || c.startsWith('S9')) return { bg: '#EDE7F6', text: '#4527A0' };
  if (c.toLowerCase().includes('split')) return { bg: '#E0F2F1', text: '#00695C' };
  return { bg: '#F3E5F5', text: '#6A1B9A' };
}

function coverageColor(scheduled: number, total: number): { bg: string; text: string; bar: string } {
  if (total === 0) return { bg: '#F5F5F5', text: '#9E9E9E', bar: '#E0E0E0' };
  const pct = scheduled / total;
  if (pct >= 0.9) return { bg: '#E8F5E9', text: '#2E7D32', bar: '#2E7D32' };
  if (pct >= 0.6) return { bg: '#FFF3E0', text: '#E65100', bar: '#F57F17' };
  return { bg: '#FFEBEE', text: '#D32F2F', bar: '#D32F2F' };
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function toISODate(d: Date): string { return d.toISOString().slice(0, 10); }
function shortDay(iso: string): string { return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }); }
function isWeekend(iso: string): boolean { const dow = new Date(iso + 'T00:00:00').getDay(); return dow === 0 || dow === 6; }

// ── Cell editor ───────────────────────────────────────────────────────────────

function CellPopover({ cell, templates, onSave, onClose }: {
  cell: CellEdit; templates: ShiftTemplate[];
  onSave: (d: { user_id: string; shift_date: string; action: string; template_id?: string; status?: string; notes?: string; edit_reason?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = !!cell.existing;
  const [templateId, setTemplateId] = useState('');
  const [status, setStatus] = useState(cell.existing?.status ?? 'scheduled');
  const [notes, setNotes] = useState(cell.existing?.notes ?? '');
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function handleSave() {
    if (isEdit && !reason.trim()) { setErr('Reason required when editing an existing shift.'); return; }
    startTransition(async () => {
      await onSave({ user_id: cell.user_id, shift_date: cell.shift_date, action: 'upsert',
        template_id: templateId || undefined, status, notes: notes || undefined, edit_reason: reason || undefined });
      onClose();
    });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #E6DFCC', padding: '20px 22px', width: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1B1B1B', marginBottom: 4 }}>{isEdit ? 'Edit shift' : 'Assign shift'}</div>
        <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 16 }}>{shortDay(cell.shift_date)}{cell.existing && <span style={{ marginLeft: 8, color: cell.existing.is_published ? '#2E7D32' : '#F57F17', fontWeight: 600 }}>{cell.existing.is_published ? '● confirmed' : '○ draft'}</span>}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div><label style={LS}>Shift template</label>
            <select value={templateId} onChange={e => setTemplateId(e.target.value)} style={IS}>
              <option value="">— Day off / clear —</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.code} · {t.name} ({t.start_time.slice(0,5)}–{t.end_time.slice(0,5)})</option>)}
              <option value="__leave__">LEAVE / absence</option>
            </select></div>
          <div><label style={LS}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={IS}>
              <option value="scheduled">Scheduled (draft)</option>
              <option value="confirmed">Confirmed</option>
              <option value="gap">Leave / absence</option>
              <option value="cancelled">Cancelled</option>
            </select></div>
          <div><label style={LS}>Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...IS, resize: 'vertical' as const }} placeholder="e.g. Cover for colleague" /></div>
          {isEdit && <div><label style={{ ...LS, color: '#B8542A' }}>Reason for change *</label><textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} style={{ ...IS, borderColor: reason ? '#E6DFCC' : '#B8542A', resize: 'vertical' as const }} placeholder="e.g. Staff requested swap…" /></div>}
          {err && <div style={{ fontSize: 11, color: '#B8542A' }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={isPending} style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: '8px 0', borderRadius: 4, background: '#1F3A2E', color: '#FFFFFF', border: 'none', cursor: 'pointer', opacity: isPending ? 0.6 : 1 }}>{isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Assign'}</button>
            {isEdit && <button onClick={async () => { await onSave({ user_id: cell.user_id, shift_date: cell.shift_date, action: 'delete' }); onClose(); }} style={{ fontSize: 12, fontWeight: 700, padding: '8px 12px', borderRadius: 4, background: '#FFEBEE', color: '#D32F2F', border: '1px solid #D32F2F', cursor: 'pointer' }}>Remove</button>}
            <button onClick={onClose} style={{ fontSize: 12, padding: '8px 12px', borderRadius: 4, background: '#F5F5F5', color: '#5A5A5A', border: '1px solid #E6DFCC', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const LS: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A', display: 'block', marginBottom: 4 };
const IS: React.CSSProperties = { fontSize: 12, padding: '6px 8px', border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B', width: '100%', boxSizing: 'border-box' as const };

// ── Main Planner ──────────────────────────────────────────────────────────────

export default function SchedulePlannerView({ propertyId, isReadOnly = false }: { propertyId: number; isReadOnly?: boolean }) {
  const today = new Date();
  const [startDate, setStartDate] = useState(toISODate(today));
  const [days, setDays] = useState(30);
  const [viewMode, setViewMode] = useState<'staff' | 'dept'>('dept');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [shifts, setShifts] = useState<ShiftCell[]>([]);
  const [deptCoverage, setDeptCoverage] = useState<DeptCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [activeCell, setActiveCell] = useState<CellEdit | null>(null);

  // Bulk dept assign state
  const [bulkDept, setBulkDept] = useState<string>('');
  const [bulkTemplate, setBulkTemplate] = useState<string>('');
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  const startD = new Date(startDate + 'T00:00:00');
  const dateRange = Array.from({ length: days }, (_, i) => toISODate(addDays(startD, i)));
  const endDate = dateRange[dateRange.length - 1];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const base = `/api/planner/staff?property_id=${propertyId}`;
      const [sRes, tRes, shRes, dcRes] = await Promise.all([
        fetch(base, { cache: 'no-store' }),
        fetch(`/api/planner/templates?property_id=${propertyId}`, { cache: 'no-store' }),
        fetch(`/api/planner/shifts?property_id=${propertyId}&start=${startDate}&end=${endDate}`, { cache: 'no-store' }),
        fetch(`/api/planner/dept-coverage?property_id=${propertyId}&start=${startDate}&end=${endDate}`, { cache: 'no-store' }),
      ]);
      if (sRes.ok)  setStaff(await sRes.json());
      if (tRes.ok)  setTemplates(await tRes.json());
      if (shRes.ok) setShifts(await shRes.json());
      if (dcRes.ok) setDeptCoverage(await dcRes.json());
    } finally { setLoading(false); }
  }, [propertyId, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const shiftMap = new Map<string, ShiftCell>();
  for (const s of shifts) shiftMap.set(s.user_id + '|' + s.shift_date, s);

  const deptCovMap = new Map<string, DeptCoverage>();
  for (const dc of deptCoverage) deptCovMap.set(dc.dept_id + '|' + dc.shift_date, dc);

  // Unique depts for filter dropdown
  const allDepts = Array.from(new Map(staff.map(s => [s.dept_id, { id: s.dept_id, name: s.dept_name ?? 'Other' }])).values())
    .filter(d => d.id)
    .sort((a, b) => a.name.localeCompare(b.name));

  const depts = new Map<string, { id: string | null; name: string; code: string; staff: StaffRow[] }>();
  for (const s of staff) {
    if (deptFilter !== 'all' && s.dept_id !== deptFilter) continue;
    const key = s.dept_id ?? '__none__';
    if (!depts.has(key)) depts.set(key, { id: s.dept_id, name: s.dept_name ?? 'Other', code: s.dept_code ?? '', staff: [] });
    depts.get(key)!.staff.push(s);
  }

  const totalShifts = shifts.length;
  const published = shifts.filter(s => s.is_published).length;
  const draft = totalShifts - published;
  const gaps = dateRange.filter(d => shifts.filter(s => s.shift_date === d && s.status !== 'gap' && s.status !== 'cancelled').length < 3).length;

  async function generate() {
    setGenerating(true); setMsg(null);
    const res = await fetch('/api/schedule/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ property_id: propertyId, start_date: startDate, end_date: endDate }) });
    const j = await res.json();
    setGenerating(false);
    setMsg(res.ok ? j.shifts_seeded + ' shifts generated' : 'Error: ' + j.error);
    if (res.ok) load();
  }

  async function publish() {
    setPublishing(true); setMsg(null);
    const res = await fetch('/api/schedule/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ property_id: propertyId, start_date: startDate, end_date: endDate }) });
    const j = await res.json();
    setPublishing(false);
    setMsg(res.ok ? j.shifts_published + ' shifts confirmed' : 'Error: ' + j.error);
    if (res.ok) load();
  }

  async function bulkAssignDept() {
    if (!bulkDept || !bulkTemplate) { setMsg('Select department and template first'); return; }
    setBulkAssigning(true); setMsg(null);
    const res = await fetch('/api/schedule/dept', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: propertyId, dept_id: bulkDept, start_date: startDate, end_date: endDate, template_id: bulkTemplate, edit_reason: 'Bulk dept assignment' }) });
    const j = await res.json();
    setBulkAssigning(false);
    setMsg(res.ok ? j.shifts_assigned + ' shifts assigned to department' : 'Error: ' + j.error);
    if (res.ok) load();
  }

  async function saveCell(data: { user_id: string; shift_date: string; action: string; template_id?: string; status?: string; notes?: string; edit_reason?: string }) {
    const effectiveTemplateId = data.template_id === '__leave__' ? undefined : data.template_id;
    const effectiveStatus = data.template_id === '__leave__' ? 'gap' : (data.status ?? 'scheduled');
    await fetch('/api/schedule/shift', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, template_id: effectiveTemplateId, status: effectiveStatus, property_id: propertyId }) });
    load();
  }

  const CELL_W = 72;
  const NAME_W = 160;

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1B1B1B' }}>
            {isReadOnly ? 'Donna · Factorial Schedule (read-only)' : 'Namkhan · Schedule Planner'}
          </div>
          <div style={{ fontSize: 11, color: '#5A5A5A' }}>{staff.length} staff · {allDepts.length} departments · {dateRange.length} days</div>
        </div>
        {/* KPI tiles */}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {[
            { label: 'Shifts', value: totalShifts, color: '#5A5A5A' },
            { label: 'Confirmed', value: published, color: '#2E7D32' },
            { label: 'Draft', value: draft, color: '#F57F17' },
            { label: 'Gap days', value: gaps, color: gaps > 0 ? '#D32F2F' : '#2E7D32' },
          ].map(k => (
            <div key={k.label} style={{ background: '#FAFAF7', border: '1px solid #E6DFCC', borderRadius: 6, padding: '6px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 9, color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: '10px 20px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #E6DFCC' }}>
        {/* View toggle */}
        <div style={{ display: 'flex', border: '1px solid #E6DFCC', borderRadius: 4, overflow: 'hidden', marginRight: 4 }}>
          {[{ key: 'dept', label: '🏢 By Dept' }, { key: 'staff', label: '👤 By Staff' }].map(v => (
            <button key={v.key} onClick={() => setViewMode(v.key as 'staff' | 'dept')} style={{
              fontSize: 11, fontWeight: 700, padding: '5px 12px', border: 'none', cursor: 'pointer',
              background: viewMode === v.key ? '#1F3A2E' : '#FFFFFF',
              color: viewMode === v.key ? '#FFFFFF' : '#5A5A5A',
            }}>{v.label}</button>
          ))}
        </div>

        {/* Dept filter for staff view */}
        {viewMode === 'staff' && (
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
            style={{ fontSize: 11, padding: '5px 8px', border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B' }}>
            <option value="all">All departments</option>
            {allDepts.map(d => <option key={d.id} value={d.id ?? ''}>{d.name}</option>)}
          </select>
        )}

        {/* Date range */}
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          style={{ fontSize: 11, padding: '5px 8px', border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B' }} />
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          style={{ fontSize: 11, padding: '5px 8px', border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B' }}>
          {[7, 14, 30, 60].map(d => <option key={d} value={d}>{d} days</option>)}
        </select>

        {!isReadOnly && (
          <>
            <button onClick={generate} disabled={generating || loading} style={{ fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 4, background: '#1F3A2E', color: '#FFFFFF', border: 'none', cursor: 'pointer', opacity: generating ? 0.6 : 1 }}>
              {generating ? 'Generating…' : '✨ Generate'}
            </button>
            <button onClick={publish} disabled={publishing || draft === 0} style={{ fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 4, background: draft > 0 ? '#2E7D32' : '#C8C0B0', color: '#FFFFFF', border: 'none', cursor: draft > 0 ? 'pointer' : 'not-allowed' }}>
              {publishing ? 'Confirming…' : '▶ Confirm ' + draft}
            </button>
            <button onClick={() => setShowBulk(v => !v)} style={{ fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 4, background: showBulk ? '#1565C0' : '#FFFFFF', color: showBulk ? '#FFFFFF' : '#1565C0', border: '1px solid #1565C0', cursor: 'pointer' }}>
              {showBulk ? '▾' : '▸'} Assign dept
            </button>
          </>
        )}

        {msg && <span style={{ fontSize: 11, color: msg.startsWith('Error') ? '#D32F2F' : '#2E7D32', fontWeight: 600 }}>{msg}</span>}
      </div>

      {/* Bulk dept assign panel */}
      {showBulk && !isReadOnly && (
        <div style={{ padding: '10px 20px', background: '#EEF4FF', borderBottom: '1px solid #C5D8F8', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#1565C0' }}>Assign to department:</span>
          <select value={bulkDept} onChange={e => setBulkDept(e.target.value)}
            style={{ fontSize: 11, padding: '5px 8px', border: '1px solid #C5D8F8', borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B', minWidth: 160 }}>
            <option value="">— Select department —</option>
            {allDepts.map(d => <option key={d.id} value={d.id ?? ''}>{d.name}</option>)}
          </select>
          <select value={bulkTemplate} onChange={e => setBulkTemplate(e.target.value)}
            style={{ fontSize: 11, padding: '5px 8px', border: '1px solid #C5D8F8', borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B', minWidth: 160 }}>
            <option value="">— Select shift template —</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.code} · {t.name} ({t.start_time.slice(0,5)}–{t.end_time.slice(0,5)})</option>)}
          </select>
          <span style={{ fontSize: 10, color: '#5A5A5A' }}>for {startDate} → {endDate}</span>
          <button onClick={bulkAssignDept} disabled={bulkAssigning || !bulkDept || !bulkTemplate} style={{ fontSize: 11, fontWeight: 700, padding: '6px 16px', borderRadius: 4, background: '#1565C0', color: '#FFFFFF', border: 'none', cursor: 'pointer', opacity: bulkAssigning ? 0.6 : 1 }}>
            {bulkAssigning ? 'Assigning…' : 'Assign all staff →'}
          </button>
          <span style={{ fontSize: 10, color: '#5A5A5A' }}>Overwrites existing manual shifts for those staff+dates</span>
        </div>
      )}

      {/* Grid */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
        {/* ── DEPARTMENT VIEW ── */}
        {viewMode === 'dept' && (
          <table style={{ borderCollapse: 'collapse', fontSize: 11, tableLayout: 'fixed', width: NAME_W + CELL_W * dateRange.length }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#FAFAF7' }}>
              <tr>
                <th style={{ width: NAME_W, minWidth: NAME_W, padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#5A5A5A', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #E6DFCC', borderRight: '1px solid #E6DFCC', position: 'sticky', left: 0, background: '#FAFAF7', zIndex: 11 }}>
                  Department
                </th>
                {dateRange.map(d => (
                  <th key={d} style={{ width: CELL_W, minWidth: CELL_W, padding: '5px 2px', textAlign: 'center', fontWeight: isWeekend(d) ? 700 : 400, color: isWeekend(d) ? '#D32F2F' : '#5A5A5A', fontSize: 10, borderBottom: '1px solid #E6DFCC', background: isWeekend(d) ? '#FFF5F5' : '#FAFAF7', borderLeft: '1px solid #F0EBE0' }}>
                    {shortDay(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allDepts.map((dept, di) => (
                <tr key={dept.id} style={{ background: di % 2 === 0 ? '#FFFFFF' : '#FDFCFA' }}>
                  <td style={{ width: NAME_W, minWidth: NAME_W, padding: '6px 10px', position: 'sticky', left: 0, background: di % 2 === 0 ? '#FFFFFF' : '#FDFCFA', borderRight: '1px solid #E6DFCC', zIndex: 2 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1B1B1B' }}>{dept.name}</div>
                    <div style={{ fontSize: 9, color: '#8A8A8A' }}>
                      {staff.filter(s => s.dept_id === dept.id).length} staff
                    </div>
                  </td>
                  {dateRange.map(d => {
                    const dc = deptCovMap.get((dept.id ?? '') + '|' + d);
                    const sched = dc?.shifts_scheduled ?? 0;
                    const total = dc?.total_staff ?? staff.filter(s => s.dept_id === dept.id).length;
                    const col = coverageColor(sched, total);
                    return (
                      <td key={d} style={{ width: CELL_W, height: 40, padding: '3px 4px', borderLeft: '1px solid #F0EBE0', background: isWeekend(d) ? (di % 2 === 0 ? '#FFF8F8' : '#FFF5F5') : 'inherit', cursor: !isReadOnly && dept.id ? 'pointer' : 'default', verticalAlign: 'middle' }}
                        onClick={() => !isReadOnly && dept.id && (setViewMode('staff'), setDeptFilter(dept.id ?? 'all'))}
                        title={sched ? sched + ' / ' + total + ' scheduled — click to see staff' : 'No shifts — click to schedule'}
                      >
                        {total > 0 ? (
                          <div style={{ background: col.bg, borderRadius: 4, padding: '2px 0', textAlign: 'center' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: col.text }}>{sched}/{total}</div>
                            <div style={{ height: 3, background: '#E0E0E0', borderRadius: 2, margin: '2px 4px 0', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: total > 0 ? (sched / total * 100) + '%' : '0%', background: col.bar, borderRadius: 2 }} />
                            </div>
                          </div>
                        ) : (
                          <div style={{ color: '#D8D0C4', fontSize: 12, textAlign: 'center' }}>—</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ── STAFF VIEW ── */}
        {viewMode === 'staff' && (
          <table style={{ borderCollapse: 'collapse', fontSize: 11, tableLayout: 'fixed', width: NAME_W + CELL_W * dateRange.length }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#FAFAF7' }}>
              <tr>
                <th style={{ width: NAME_W, minWidth: NAME_W, padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#5A5A5A', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #E6DFCC', borderRight: '1px solid #E6DFCC', position: 'sticky', left: 0, background: '#FAFAF7', zIndex: 11 }}>
                  Staff {deptFilter !== 'all' && '· ' + (allDepts.find(d => d.id === deptFilter)?.name ?? '')}
                </th>
                {dateRange.map(d => (
                  <th key={d} style={{ width: CELL_W, minWidth: CELL_W, padding: '5px 2px', textAlign: 'center', fontWeight: isWeekend(d) ? 700 : 400, color: isWeekend(d) ? '#D32F2F' : '#5A5A5A', fontSize: 10, borderBottom: '1px solid #E6DFCC', background: isWeekend(d) ? '#FFF5F5' : '#FAFAF7', borderLeft: '1px solid #F0EBE0' }}>
                    {shortDay(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(depts.entries()).map(([deptKey, dept]) => (
                <>
                  <tr key={'dept-' + deptKey}>
                    <td colSpan={dateRange.length + 1} style={{ padding: '4px 10px', background: '#F4EFE2', fontSize: 10, fontWeight: 700, color: '#1F3A2E', letterSpacing: '0.07em', textTransform: 'uppercase', borderTop: '2px solid #E6DFCC' }}>
                      {dept.name} · {dept.staff.length} staff
                      {!isReadOnly && dept.id && (
                        <button onClick={() => { setBulkDept(dept.id ?? ''); setShowBulk(true); }} style={{ marginLeft: 10, fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 3, background: '#1565C0', color: '#FFFFFF', border: 'none', cursor: 'pointer' }}>
                          Assign dept →
                        </button>
                      )}
                    </td>
                  </tr>
                  {dept.staff.map((s, si) => (
                    <tr key={s.user_id} style={{ background: si % 2 === 0 ? '#FFFFFF' : '#FDFCFA' }}>
                      <td style={{ width: NAME_W, minWidth: NAME_W, padding: '3px 10px', position: 'sticky', left: 0, background: si % 2 === 0 ? '#FFFFFF' : '#FDFCFA', borderRight: '1px solid #E6DFCC', zIndex: 2 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#1B1B1B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.full_name}</div>
                        <div style={{ fontSize: 9, color: '#8A8A8A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.position_title}</div>
                      </td>
                      {dateRange.map(d => {
                        const shift = shiftMap.get(s.user_id + '|' + d);
                        const col = shift ? shiftColor(shift.template_code, shift.status) : null;
                        return (
                          <td key={d} style={{ width: CELL_W, height: 32, padding: '2px 3px', borderLeft: '1px solid #F0EBE0', background: isWeekend(d) ? (si % 2 === 0 ? '#FFF8F8' : '#FFF5F5') : 'inherit', cursor: isReadOnly ? 'default' : 'pointer', verticalAlign: 'middle' }}
                            onClick={() => !isReadOnly && setActiveCell({ user_id: s.user_id, shift_date: d, existing: shift ?? null })}>
                            {shift && col ? (
                              <div style={{ background: col.bg, color: col.text, borderRadius: 3, padding: '2px 4px', fontSize: 10, fontWeight: 700, textAlign: 'center', border: shift.is_published ? 'none' : '1px dashed ' + col.text }}>
                                {shift.status === 'gap' ? 'LEAVE' : shift.status === 'cancelled' ? 'OFF' : (shift.template_code ?? shift.status.slice(0,3).toUpperCase())}
                                {shift.edit_reason && <span style={{ fontSize: 8, marginLeft: 2 }} title={shift.edit_reason}>✎</span>}
                              </div>
                            ) : (
                              !isReadOnly && <div style={{ textAlign: 'center', color: '#D8D0C4', fontSize: 14 }}>+</div>
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
        )}
      </div>

      {/* Legend */}
      <div style={{ padding: '8px 20px', borderTop: '1px solid #E6DFCC', display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 10, color: '#8A8A8A', alignItems: 'center' }}>
        {viewMode === 'dept' && <span style={{ fontWeight: 600, color: '#1B1B1B' }}>Click any cell → drill into staff view for that dept</span>}
        {viewMode === 'staff' && <>
          {[{ bg: '#E8F5E9', text: '#2E7D32', l: 'Morning' }, { bg: '#E3F2FD', text: '#1565C0', l: 'Midday' }, { bg: '#FFF3E0', text: '#E65100', l: 'Afternoon' }, { bg: '#EDE7F6', text: '#4527A0', l: 'Night' }, { bg: '#FFF8E1', text: '#F57F17', l: 'Leave' }].map(x => (
            <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 22, height: 12, borderRadius: 2, background: x.bg, color: x.text, fontSize: 7, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>S</div>
              <span>{x.l}</span>
            </div>
          ))}
          <span>Dashed = draft · Solid = confirmed · ✎ = edited</span>
        </>}
        {loading && <span style={{ marginLeft: 'auto' }}>Refreshing…</span>}
      </div>

      {activeCell && (
        <CellPopover cell={activeCell} templates={templates} onSave={saveCell} onClose={() => setActiveCell(null)} />
      )}
    </div>
  );
}
