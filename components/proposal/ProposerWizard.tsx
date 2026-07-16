'use client';
// components/proposal/ProposerWizard.tsx
//
// DEPRECATED 2026-07-16 (unify pass, item 3). The composer no longer gates on
// wizard completion — the same fields (dates/pax/rooms/rate plan) now live at
// the top of the unified ComposerEditor's left pane. This file is kept only
// because other routes may still transitively import it, and removing it in
// the same push would burn a full deploy cycle to catch stragglers. Do NOT
// route to it. Do NOT extend it. Delete after 2026-07-30 if grep is clean.
//
// 4-step entry wizard that gates the composer. On commit it writes the
// proposal snapshot cols + wizard_completed_at, then router.refresh().
//
// Design: paper white, hairlines, ink, brand green CTA, red validation.
// System font stack, no legacy fonts. No dependency on legacy design system.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const PAPER = '#FFFFFF';
const HAIR = '#E6DFCC';
const INK = '#1B1B1B';
const INK_MUTE = '#6B6459';
const GREEN = '#084838';
const GREEN_HOVER = '#0a5a46';
const RED = '#B04A2F';
const FONT = '-apple-system, "SF Pro Text", Helvetica, Arial, sans-serif';

interface Props {
  proposalId: string;
  propertyId: number;
  initialDateIn?: string | null;
  initialDateOut?: string | null;
  initialAdults?: number | null;
  initialChildren?: number | null;
  initialRooms?: number | null;
}

interface RatePlan {
  rate_plan_id: string;
  rate_plan_name: string;
  room_type_id: string;
  room_type_name: string;
  avg_rate_per_night_usd: number;
  total_usd: number;
  total_lak: number;
  nights: number;
  rooms_available_min: number;
  child_policy: string | null;
  cancellation_policy: string | null;
  board: string | null;
}

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export default function ProposerWizard({
  proposalId,
  propertyId: _propertyId,
  initialDateIn,
  initialDateOut,
  initialAdults,
  initialChildren,
  initialRooms,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [dateIn, setDateIn] = useState<string>(initialDateIn || todayPlus(30));
  const [dateOut, setDateOut] = useState<string>(initialDateOut || todayPlus(33));
  const [adults, setAdults] = useState<number>(initialAdults ?? 2);
  const [children, setChildrenN] = useState<number>(initialChildren ?? 0);
  const [rooms, setRooms] = useState<number>(initialRooms ?? 1);
  const [plans, setPlans] = useState<RatePlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  // Validation
  const today = todayPlus(0);
  const dateInPast = dateIn < today;
  const dateOutInvalid = !(dateOut > dateIn);
  const step1Valid = !!dateIn && !!dateOut && !dateInPast && !dateOutInvalid;
  const step2Valid = adults >= 1 && adults <= 24 && children >= 0 && children <= 12;
  const step3Valid = rooms >= 1 && rooms <= 24;

  // Query plans when entering step 4
  useEffect(() => {
    if (step !== 4) return;
    let cancelled = false;
    setLoadingPlans(true);
    setQueryError(null);
    fetch(`/api/sales/proposals/${proposalId}/wizard`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        step: 'query',
        date_in: dateIn,
        date_out: dateOut,
        adults,
        children,
        rooms,
      }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text();
          throw new Error(`Query failed (${r.status}): ${text.slice(0, 200)}`);
        }
        return r.json();
      })
      .then((j) => {
        if (cancelled) return;
        setPlans(Array.isArray(j.plans) ? j.plans : []);
      })
      .catch((e) => {
        if (cancelled) return;
        setQueryError(String(e?.message || e));
      })
      .finally(() => {
        if (!cancelled) setLoadingPlans(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, proposalId, dateIn, dateOut, adults, children, rooms]);

  // Group plans by room_type
  const groups = useMemo(() => {
    const byRoom = new Map<string, { room_type_id: string; room_type_name: string; plans: RatePlan[] }>();
    for (const p of plans) {
      const key = p.room_type_id;
      if (!byRoom.has(key)) {
        byRoom.set(key, {
          room_type_id: p.room_type_id,
          room_type_name: p.room_type_name || 'Room',
          plans: [],
        });
      }
      byRoom.get(key)!.plans.push(p);
    }
    for (const g of byRoom.values()) {
      g.plans.sort((a, b) => a.avg_rate_per_night_usd - b.avg_rate_per_night_usd);
    }
    return Array.from(byRoom.values());
  }, [plans]);

  async function commit() {
    if (!selectedPlanId || !selectedRoomTypeId) return;
    setCommitting(true);
    setCommitError(null);
    try {
      const r = await fetch(`/api/sales/proposals/${proposalId}/wizard`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          step: 'commit',
          date_in: dateIn,
          date_out: dateOut,
          adults,
          children,
          rooms,
          selected_rate_plan_id: selectedPlanId,
          selected_room_type_id: selectedRoomTypeId,
        }),
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`Commit failed (${r.status}): ${text.slice(0, 200)}`);
      }
      // Reload the composer — wizard_completed_at is now set, so edit page renders blocks
      router.refresh();
    } catch (e) {
      setCommitError(String((e as Error)?.message || e));
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: PAPER,
        zIndex: 40,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: '48px 24px',
        fontFamily: FONT,
        color: INK,
      }}
    >
      <div style={{ width: '100%', maxWidth: 720 }}>
        <ProgressDots step={step} />
        <div
          style={{
            marginTop: 24,
            background: PAPER,
            border: `1px solid ${HAIR}`,
            borderRadius: 4,
            padding: 32,
          }}
        >
          {step === 1 && (
            <StepDates
              dateIn={dateIn}
              dateOut={dateOut}
              setDateIn={setDateIn}
              setDateOut={setDateOut}
              dateInPast={dateInPast}
              dateOutInvalid={dateOutInvalid}
            />
          )}
          {step === 2 && (
            <StepPax
              adults={adults}
              childrenCount={children}
              setAdults={setAdults}
              setChildren={setChildrenN}
            />
          )}
          {step === 3 && <StepRooms rooms={rooms} setRooms={setRooms} />}
          {step === 4 && (
            <StepPlans
              loading={loadingPlans}
              error={queryError}
              groups={groups}
              selectedPlanId={selectedPlanId}
              setSelected={(planId, roomTypeId) => {
                setSelectedPlanId(planId);
                setSelectedRoomTypeId(roomTypeId);
              }}
              expandedGroups={expandedGroups}
              toggleGroup={(k) => setExpandedGroups((s) => ({ ...s, [k]: !s[k] }))}
              summary={{ dateIn, dateOut, adults, children, rooms }}
            />
          )}

          {commitError && (
            <div style={{ marginTop: 16, color: RED, fontSize: 13 }}>{commitError}</div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
            <button
              type="button"
              onClick={() => setStep((s) => (Math.max(1, s - 1) as 1 | 2 | 3 | 4))}
              disabled={step === 1}
              style={{
                background: 'transparent',
                border: 'none',
                color: step === 1 ? '#B8B0A0' : INK_MUTE,
                fontFamily: FONT,
                fontSize: 14,
                cursor: step === 1 ? 'not-allowed' : 'pointer',
                padding: '10px 0',
              }}
            >
              ← Back
            </button>

            {step < 4 && (
              <button
                type="button"
                onClick={() => setStep((s) => (Math.min(4, s + 1) as 1 | 2 | 3 | 4))}
                disabled={
                  (step === 1 && !step1Valid) ||
                  (step === 2 && !step2Valid) ||
                  (step === 3 && !step3Valid)
                }
                style={{
                  background:
                    (step === 1 && !step1Valid) ||
                    (step === 2 && !step2Valid) ||
                    (step === 3 && !step3Valid)
                      ? '#B8B0A0'
                      : GREEN,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 3,
                  padding: '10px 20px',
                  fontFamily: FONT,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor:
                    (step === 1 && !step1Valid) ||
                    (step === 2 && !step2Valid) ||
                    (step === 3 && !step3Valid)
                      ? 'not-allowed'
                      : 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (
                    !((step === 1 && !step1Valid) ||
                      (step === 2 && !step2Valid) ||
                      (step === 3 && !step3Valid))
                  ) {
                    (e.currentTarget as HTMLButtonElement).style.background = GREEN_HOVER;
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    (step === 1 && !step1Valid) ||
                    (step === 2 && !step2Valid) ||
                    (step === 3 && !step3Valid)
                      ? '#B8B0A0'
                      : GREEN;
                }}
              >
                Next →
              </button>
            )}

            {step === 4 && (
              <button
                type="button"
                onClick={commit}
                disabled={!selectedPlanId || committing}
                style={{
                  background: !selectedPlanId || committing ? '#B8B0A0' : GREEN,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 3,
                  padding: '10px 24px',
                  fontFamily: FONT,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: !selectedPlanId || committing ? 'not-allowed' : 'pointer',
                }}
              >
                {committing ? 'Saving…' : 'Continue'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressDots({ step }: { step: 1 | 2 | 3 | 4 }) {
  const labels = ['Dates', 'Guests', 'Rooms', 'Rate plan'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {labels.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3 | 4;
        const active = n === step;
        const done = n < step;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 600,
                background: active || done ? GREEN : PAPER,
                color: active || done ? '#fff' : INK_MUTE,
                border: `1px solid ${active || done ? GREEN : HAIR}`,
              }}
            >
              {done ? '✓' : n}
            </span>
            <span
              style={{
                fontSize: 12,
                color: active ? INK : INK_MUTE,
                fontWeight: active ? 600 : 400,
              }}
            >
              {label}
            </span>
            {i < labels.length - 1 && (
              <span style={{ width: 24, height: 1, background: HAIR, marginLeft: 4 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: INK_MUTE, marginBottom: 6, letterSpacing: 0.2 }}>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        padding: '10px 12px',
        border: `1px solid ${HAIR}`,
        borderRadius: 3,
        fontFamily: FONT,
        fontSize: 14,
        color: INK,
        background: PAPER,
        boxSizing: 'border-box',
        ...(props.style || {}),
      }}
    />
  );
}

function StepDates({
  dateIn,
  dateOut,
  setDateIn,
  setDateOut,
  dateInPast,
  dateOutInvalid,
}: {
  dateIn: string;
  dateOut: string;
  setDateIn: (v: string) => void;
  setDateOut: (v: string) => void;
  dateInPast: boolean;
  dateOutInvalid: boolean;
}) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px' }}>When is the stay?</h2>
      <p style={{ fontSize: 13, color: INK_MUTE, margin: '0 0 24px' }}>
        Pick check-in and check-out dates.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <Label>Check-in</Label>
          <Input type="date" value={dateIn} onChange={(e) => setDateIn(e.target.value)} min={todayPlus(0)} />
          {dateInPast && (
            <div style={{ marginTop: 6, color: RED, fontSize: 12 }}>Check-in cannot be in the past.</div>
          )}
        </div>
        <div>
          <Label>Check-out</Label>
          <Input type="date" value={dateOut} onChange={(e) => setDateOut(e.target.value)} min={dateIn || todayPlus(1)} />
          {dateOutInvalid && !dateInPast && (
            <div style={{ marginTop: 6, color: RED, fontSize: 12 }}>Check-out must be after check-in.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepPax({
  adults,
  childrenCount,
  setAdults,
  setChildren,
}: {
  adults: number;
  // 2026-07-16 lint: renamed from `children` to satisfy react/no-children-prop
  // (component prop `children` collides with JSX children semantics).
  childrenCount: number;
  setAdults: (v: number) => void;
  setChildren: (v: number) => void;
}) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px' }}>How many guests?</h2>
      <p style={{ fontSize: 13, color: INK_MUTE, margin: '0 0 24px' }}>
        Adults and children in the party.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <Label>Adults</Label>
          <Input
            type="number"
            min={1}
            max={24}
            value={adults}
            onChange={(e) => setAdults(Math.max(1, Math.min(24, parseInt(e.target.value || '1', 10))))}
          />
        </div>
        <div>
          <Label>Children</Label>
          <Input
            type="number"
            min={0}
            max={12}
            value={childrenCount}
            onChange={(e) => setChildren(Math.max(0, Math.min(12, parseInt(e.target.value || '0', 10))))}
          />
        </div>
      </div>
    </div>
  );
}

function StepRooms({ rooms, setRooms }: { rooms: number; setRooms: (v: number) => void }) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px' }}>How many rooms?</h2>
      <p style={{ fontSize: 13, color: INK_MUTE, margin: '0 0 24px' }}>
        Enter the room count you want to price.
      </p>
      <div style={{ maxWidth: 220 }}>
        <Label>Rooms</Label>
        <Input
          type="number"
          min={1}
          max={24}
          value={rooms}
          onChange={(e) => setRooms(Math.max(1, Math.min(24, parseInt(e.target.value || '1', 10))))}
        />
      </div>
    </div>
  );
}

function StepPlans({
  loading,
  error,
  groups,
  selectedPlanId,
  setSelected,
  expandedGroups,
  toggleGroup,
  summary,
}: {
  loading: boolean;
  error: string | null;
  groups: { room_type_id: string; room_type_name: string; plans: RatePlan[] }[];
  selectedPlanId: string | null;
  setSelected: (planId: string, roomTypeId: string) => void;
  expandedGroups: Record<string, boolean>;
  toggleGroup: (k: string) => void;
  summary: { dateIn: string; dateOut: string; adults: number; children: number; rooms: number };
}) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px' }}>Choose a rate plan</h2>
      <p style={{ fontSize: 13, color: INK_MUTE, margin: '0 0 20px' }}>
        {summary.dateIn} → {summary.dateOut} · {summary.adults} adult{summary.adults === 1 ? '' : 's'}
        {summary.children > 0 ? ` · ${summary.children} child${summary.children === 1 ? '' : 'ren'}` : ''} ·{' '}
        {summary.rooms} room{summary.rooms === 1 ? '' : 's'}
      </p>

      {loading && (
        <div style={{ padding: '32px 0', textAlign: 'center', color: INK_MUTE, fontSize: 13 }}>
          Checking availability…
        </div>
      )}
      {error && !loading && (
        <div
          style={{
            padding: 16,
            background: '#FBEEE7',
            border: `1px solid ${RED}`,
            borderRadius: 3,
            color: RED,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
      {!loading && !error && groups.length === 0 && (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            border: `1px dashed ${HAIR}`,
            borderRadius: 3,
            color: INK_MUTE,
            fontSize: 13,
          }}
        >
          No rate plans available for these dates. Try adjusting dates or party size.
        </div>
      )}

      {!loading && !error && groups.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {groups.map((g) => {
            const expanded = expandedGroups[g.room_type_id];
            const shown = expanded ? g.plans : g.plans.slice(0, 3);
            const hidden = g.plans.length - shown.length;
            return (
              <div key={g.room_type_id}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: INK,
                    marginBottom: 8,
                    paddingBottom: 6,
                    borderBottom: `1px solid ${HAIR}`,
                  }}
                >
                  {g.room_type_name}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {shown.map((p) => {
                    const selected = selectedPlanId === p.rate_plan_id;
                    const lowInventory = p.rooms_available_min <= 2;
                    return (
                      <label
                        key={p.rate_plan_id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          padding: 14,
                          border: `1px solid ${selected ? GREEN : HAIR}`,
                          borderRadius: 3,
                          background: selected ? '#F4F9F7' : PAPER,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="radio"
                          name="rate_plan"
                          checked={selected}
                          onChange={() => setSelected(p.rate_plan_id, p.room_type_id)}
                          style={{ marginTop: 2, accentColor: GREEN }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ fontSize: 14, fontWeight: 500, color: INK }}>
                              {p.rate_plan_name}
                              {p.board && (
                                <span style={{ marginLeft: 8, fontSize: 11, color: INK_MUTE }}>· {p.board}</span>
                              )}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: INK, whiteSpace: 'nowrap' }}>
                              {fmtUsd(p.total_usd)}
                            </div>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 12,
                              marginTop: 4,
                              fontSize: 12,
                              color: INK_MUTE,
                            }}
                          >
                            <div>
                              {fmtUsd(p.avg_rate_per_night_usd)}/night · {p.nights} night{p.nights === 1 ? '' : 's'}
                            </div>
                            <div
                              style={{
                                color: lowInventory ? RED : INK_MUTE,
                                fontWeight: lowInventory ? 600 : 400,
                              }}
                            >
                              {p.rooms_available_min} room{p.rooms_available_min === 1 ? '' : 's'} available
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {g.plans.length > 3 && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(g.room_type_id)}
                    style={{
                      marginTop: 8,
                      background: 'transparent',
                      border: 'none',
                      color: GREEN,
                      fontFamily: FONT,
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {expanded ? 'Show fewer' : `Show all ${g.plans.length} plans`}
                    {!expanded && hidden > 0 && ` (+${hidden})`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
