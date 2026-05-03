// Brand override layered AFTER the legacy mockup CSS (redesignCss.ts).
// The mockup ships with hardcoded white/grey panels (--bg: #ffffff, --panel: #ffffff,
// --text: #111827, etc). This block re-binds the .bc-redesign scope to the
// Soho-House brand palette so every revenue tab matches the rest of the portal.
//
// User feedback 2026-05-03: "make sure all pages have the same styling system,
// nothing hardcoded." This file is the surgical fix — no edits to the 1500-line
// mockup string needed; .bc-redesign tokens just resolve to brand tokens and
// every legacy rule that says `var(--panel)` etc. cascades through to the
// correct brown/cream surface.

export default `
/* ============================================================
 * 1. RE-BIND ALL .bc-redesign DESIGN TOKENS TO BRAND PALETTE
 * ============================================================ */
.bc-redesign {
  --bg:         var(--paper) !important;
  --panel:      var(--paper-warm) !important;
  --panel-2:    var(--paper-deep) !important;
  --border:     var(--line-soft) !important;
  --text:       var(--ink) !important;
  --text-dim:   var(--ink-soft) !important;
  --text-faint: var(--ink-mute) !important;
  --accent:     var(--brass) !important;
  --green:      var(--moss-glow) !important;
  --amber:      var(--brass) !important;
  --red:        var(--st-bad) !important;
  --blue:       var(--st-info-tx) !important;
  font-family: var(--sans) !important;
}

/* ============================================================
 * 2. FORCE ALL HARDCODED LEGACY HEX TO BRAND TOKENS
 *    The mockup string contains literal #fff / #fafbfc / #f7f8fa / #fdf8f1
 *    backgrounds in places that don't read --panel. Override them.
 * ============================================================ */
.bc-redesign .sidebar,
.bc-redesign .compset-rate-table th,
.bc-redesign .modal-section-title,
.bc-redesign .gr-input,
.bc-redesign .approval-matrix-table th,
.bc-redesign .knowledge-row,
.bc-redesign .source-tabs,
.bc-redesign .modal-actions,
.bc-redesign .audit-row,
.bc-redesign .gr-layer-header,
.bc-redesign .handoff-footer,
.bc-redesign .dim-strip,
.bc-redesign .agent-log,
.bc-redesign .version-row,
.bc-redesign .mode-strip,
.bc-redesign .prompt-context-list,
.bc-redesign .source-tab.active,
.bc-redesign .compset-self,
.bc-redesign .agent-strip,
.bc-redesign .agent-chip,
.bc-redesign .agent-chip:hover,
.bc-redesign .gr-master,
.bc-redesign .specialist-btn:hover,
.bc-redesign .expand-btn:hover,
.bc-redesign .drilldown,
.bc-redesign .design-note,
.bc-redesign .tactical-header,
.bc-redesign .tactical-alert.med .tactical-header,
.bc-redesign .tactical-alert.low .tactical-header,
.bc-redesign .tactic-card,
.bc-redesign .tactic-channel,
.bc-redesign .tactic-card:hover,
.bc-redesign .gr-toggle-slider:before,
.bc-redesign .modal,
.bc-redesign .modal-header,
.bc-redesign .blackout-tag {
  background: var(--paper-warm) !important;
}
.bc-redesign .kpi.data-pending,
.bc-redesign .data-source-line,
.bc-redesign .data-needed { background: var(--paper-deep) !important; }

/* Status-tinted banners — use brand status tokens */
.bc-redesign .gr-sim-banner   { background: var(--st-warn-bg) !important; border-color: var(--st-warn-bd) !important; color: var(--brass) !important; }
.bc-redesign .write-banner    { background: var(--st-warn-bg) !important; border-color: var(--st-warn-bd) !important; color: var(--ink-soft) !important; }
.bc-redesign .write-stamp     { background: var(--st-warn-bg) !important; border-color: var(--st-warn-bd) !important; color: var(--brass) !important; }
.bc-redesign .playground-result { background: var(--st-good-bg) !important; border-left-color: var(--moss-glow) !important; color: var(--ink) !important; }
.bc-redesign .tactic-card.selected { background: var(--st-good-bg) !important; border-color: var(--moss-glow) !important; }

/* ============================================================
 * 3. FONT-FAMILY UNIFICATION — kill SF Mono / Segoe / Apple system
 * ============================================================ */
.bc-redesign,
.bc-redesign body,
.bc-redesign * { font-family: var(--sans); }
.bc-redesign .kpi-value,
.bc-redesign .topbar h2,
.bc-redesign .topbar h2 em,
.bc-redesign .modal-title,
.bc-redesign h1, .bc-redesign h2, .bc-redesign h3 { font-family: var(--serif) !important; }
.bc-redesign .audit-time,
.bc-redesign .version-row .v,
.bc-redesign .num,
.bc-redesign .gr-input,
.bc-redesign .prompt-textarea,
.bc-redesign .prompt-tag,
.bc-redesign .prompt-context-list .ctx-row,
.bc-redesign .agent-log,
.bc-redesign .compset-cell { font-family: var(--mono) !important; }

/* ============================================================
 * 4. KPI TILE — force .kpi-tile aesthetic on legacy .kpi/.kpi-card
 *    Italic serif value (was bold sans 22px), mono uppercase label.
 * ============================================================ */
.bc-redesign .kpi-card,
.bc-redesign .kpi {
  background: var(--paper-warm) !important;
  border: 1px solid var(--paper-deep) !important;
  border-radius: 8px !important;
  padding: 14px 16px !important;
  min-height: 96px !important;
  box-shadow: none !important;
  transition: box-shadow 140ms ease, transform 140ms ease, border-color 140ms ease !important;
}
.bc-redesign .kpi-card:hover,
.bc-redesign .kpi:hover {
  box-shadow: 0 6px 18px -8px rgba(28, 24, 21, 0.18) !important;
  border-color: var(--brass-soft) !important;
  transform: translateY(-1px);
}
.bc-redesign .kpi-value {
  font-family: var(--serif) !important;
  font-style: italic !important;
  font-weight: 500 !important;
  font-size: 22px !important;
  letter-spacing: -0.01em !important;
  color: var(--ink) !important;
  line-height: 1.1 !important;
}
.bc-redesign .kpi-label {
  font-family: var(--mono) !important;
  font-size: 10px !important;
  letter-spacing: 0.18em !important;
  text-transform: uppercase !important;
  color: var(--ink-mute) !important;
  font-weight: 600 !important;
}
.bc-redesign .kpi-sub {
  font-family: var(--sans) !important;
  font-size: 11px !important;
  color: var(--ink-mute) !important;
}
.bc-redesign .kpi.data-pending { border-style: dashed !important; }
.bc-redesign .kpi.data-pending .kpi-value { color: var(--ink-faint) !important; }

/* ============================================================
 * 5. SECTION / PANEL / TABLE / FILTER — match brand surface language
 * ============================================================ */
.bc-redesign .section,
.bc-redesign .filterbar,
.bc-redesign .gr-layer,
.bc-redesign .tactical-alert {
  background: var(--paper-warm) !important;
  border: 1px solid var(--paper-deep) !important;
  border-radius: 8px !important;
  box-shadow: none !important;
}
.bc-redesign th,
.bc-redesign td { border-bottom-color: var(--paper-deep) !important; }
.bc-redesign th { background: var(--paper-warm) !important; color: var(--ink-mute) !important; }
.bc-redesign tr:hover td { background: var(--paper-deep) !important; }
.bc-redesign .filter,
.bc-redesign .btn {
  background: var(--paper-warm) !important;
  border: 1px solid var(--paper-deep) !important;
  color: var(--ink) !important;
  font-family: var(--sans) !important;
}
.bc-redesign .filter.active,
.bc-redesign .btn:hover { border-color: var(--brass) !important; color: var(--brass) !important; }
.bc-redesign .btn-primary,
.bc-redesign .approval-btn,
.bc-redesign .agent-fire-btn,
.bc-redesign .prompt-btn.primary {
  background: var(--moss) !important;
  color: var(--paper-warm) !important;
  border-color: var(--moss) !important;
}
.bc-redesign .btn-primary:hover,
.bc-redesign .approval-btn:hover,
.bc-redesign .agent-fire-btn:hover { background: var(--moss-mid) !important; }

/* Pills */
.bc-redesign .pill { background: var(--paper-deep) !important; border-color: var(--paper-deep) !important; }
.bc-redesign .pill.green  { color: var(--moss) !important; border-color: var(--moss-glow) !important; background: var(--st-good-bg) !important; }
.bc-redesign .pill.red    { color: var(--st-bad) !important; border-color: var(--st-bad) !important; background: var(--st-bad-bg) !important; }
.bc-redesign .pill.amber  { color: var(--brass) !important; border-color: var(--brass) !important; background: var(--st-warn-bg) !important; }
.bc-redesign .rule-status.active { background: var(--st-good-bg) !important; color: var(--moss) !important; }
.bc-redesign .rule-status.warn   { background: var(--st-warn-bg) !important; color: var(--brass) !important; }
.bc-redesign .rule-status.off    { background: var(--paper-deep) !important; color: var(--ink-mute) !important; }

/* ============================================================
 * 6. SUBTABS / NAV — brand accent
 * ============================================================ */
.bc-redesign .subtab.active,
.bc-redesign .nav-item.active {
  border-color: var(--brass) !important;
  color: var(--ink) !important;
}
.bc-redesign .subtab { color: var(--ink-mute) !important; font-family: var(--sans) !important; }
.bc-redesign .subtab .count { background: var(--brass) !important; color: var(--paper-warm) !important; }
.bc-redesign .breadcrumb { color: var(--ink-mute) !important; }
.bc-redesign .topbar h2 { color: var(--ink) !important; }
.bc-redesign .topbar h2 em { color: var(--brass) !important; font-style: italic !important; }

/* ============================================================
 * 7. EMERGENCY LAYOUT (preserved from original override)
 * ============================================================ */
.bc-redesign .agent-dock { display: none !important; }
.panel.bc-redesign { padding: 24px 32px; max-width: none; background: var(--paper) !important; border: 0 !important; }
.bc-redesign .tab-content { width: 100%; }
.bc-redesign .tab-content.active { display: block; }
.bc-redesign .kpi-row .kpi { min-width: 0; }
.bc-redesign .kpi-value { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;
