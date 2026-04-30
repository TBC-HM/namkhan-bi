// Emergency CSS overrides applied AFTER the mockup CSS to fix layout issues
// caused by the existing app shell (Banner/SubNav/FilterStrip + .panel padding).
// Hide the floating Agent Dock for now — covers content. Restore later.

export default `
/* Hide floating Agent Dock — overlaps content inside the app shell */
.bc-redesign .agent-dock { display: none !important; }

/* Make sure panel doesn't double-pad the mockup */
.panel.bc-redesign { padding: 24px 32px; max-width: none; }

/* Tab content should fill width inside .panel */
.bc-redesign .tab-content { width: 100%; }
.bc-redesign .tab-content.active { display: block; }

/* Mockup .kpi-row uses 6-col grid; ensure kids fill cells evenly */
.bc-redesign .kpi-row .kpi { min-width: 0; }
.bc-redesign .kpi-value { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;
