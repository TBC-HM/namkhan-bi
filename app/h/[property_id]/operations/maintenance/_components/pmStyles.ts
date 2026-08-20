// app/h/[property_id]/operations/maintenance/_components/pmStyles.ts
// PM v3 slice 6 — shared token-based style constants for the maintenance surface.
// Design contract: documentation.documents doc_type='design_system' (v17).
// Rules honored here:
//   - zero Tailwind color classes, zero hardcoded hex — every color is a var(--*) token
//   - paper-white cards, --hairline borders, tabular-nums for counts (§ HoD parity)
//   - status semantics via the global .status-pill classes (pill-active / pill-pending /
//     pill-expired / pill-inactive / pill-info) defined in styles/globals.css (untouched)

import type { CSSProperties } from "react";

/** Secondary label text (field captions, table meta). */
export const label: CSSProperties = {
  color: "var(--ink-mute)",
  fontSize: "var(--t-sm)",
};

/** Primary value text under a label. */
export const value: CSSProperties = {
  color: "var(--ink)",
  fontWeight: 500,
  fontSize: "var(--t-md)",
};

/** Muted body / empty-state text. */
export const muted: CSSProperties = {
  color: "var(--ink-mute)",
  fontSize: "var(--t-md)",
};

/** Section heading inside a card (replaces text-xl/2xl + font-bold). */
export const sectionTitle: CSSProperties = {
  color: "var(--ink)",
  fontSize: "var(--t-xl)",
  fontWeight: 600,
  margin: 0,
};

/** Paper-white card with hairline border (HoD landing parity). */
export const card: CSSProperties = {
  background: "var(--paper-warm)",
  border: "1px solid var(--hairline)",
  borderRadius: 8,
  padding: 16,
};

/** Soft inset panel inside a card (was bg-gray-50 / bg-blue-50 blocks). */
export const inset: CSSProperties = {
  background: "var(--paper-deep)",
  border: "1px solid var(--hairline)",
  borderRadius: 6,
  padding: 12,
};

/** Form input / select / textarea. */
export const input: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--hairline)",
  borderRadius: 6,
  background: "var(--paper-warm)",
  color: "var(--ink)",
  fontSize: "var(--t-md)",
};

/** Numeric cell — tabular figures (counts, minutes). */
export const num: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
};

/** Map a PM task / asset status to the global status-pill class. */
export function statusPillClass(status: string, scheduledDate?: string): string {
  const s = (status || "").toLowerCase();
  if (s === "completed" || s === "active") return "status-pill pill-active";
  if (s === "scheduled" || s === "maintenance") {
    // Row status semantics: a scheduled task whose date has passed is overdue.
    if (scheduledDate && scheduledDate < new Date().toISOString().slice(0, 10)) {
      return "status-pill pill-expired";
    }
    return "status-pill pill-pending";
  }
  if (s === "overdue") return "status-pill pill-expired";
  return "status-pill pill-inactive";
}
