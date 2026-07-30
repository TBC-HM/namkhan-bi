// lib/specs/agentContext.ts
// Shared §9 agent-context block injected into every build brief produced by
// the Spec Builder (form path) AND the MD-upload intake path (md-intake-v1).
// Single source — SpecBuilderClient imports this; do not fork the text.

export const AGENT_CONTEXT = `
## §9 Agent context (auto-injected v2 · 2026-07-25 — do not edit)

### Design system (v14 — tokens win)
- Read \`documentation.documents\` where \`doc_type='design_system'\` (v14+) before touching any UI. Live gallery: /holding/it/cockpit/design
- Primitives: \`@/app/(cockpit)/_design\` → \`DashboardPage\`, \`Container\`, \`KpiTile\`, \`MetricRow\`, \`ListContainer\`, \`SplitContainer\`
- TOKENS ONLY: var(--paper) for surfaces, var(--ink), var(--hairline), var(--primary). Hex literals live ONLY in globals.css (memory 217). Never var(--paper-warm)/var(--paper-deep) on cells (resolves dark on Namkhan).
- Tab strip: thin sans-serif, active = primary underline. NO custom tab components. No new component in _design without a contract entry.

### Architecture
- Read \`documentation.documents\` where \`doc_type='architecture'\` for full system map
- Read \`documentation.documents\` where \`doc_type='claude_md'\` for operating rules (§0.65 push guard!)
- Read \`documentation.documents\` where \`doc_type='data_model'\` for schema reference

### Properties + URL law (importance-10)
- Namkhan: property_id=260955 · USD · TZ Asia/Vientiane. Donna: property_id=1000001 · EUR · TZ Europe/Madrid.
- Holding surfaces live under /holding/* (synthetic, NO property_id).
- EVERY url/link property-scoped: /h/[property_id]/<dept>/<sub> or /holding/*. Unprefixed links on multi-property surfaces are violations.

### Goal traceability (ADR-165)
- Every brief carries goal_id → governance.goals (read public.v_goals). Orphan briefs get rejected at intake.

### Deploy rules (ADR-166/167 — the ONLY sanctioned path)
- Push via \`SELECT public.fn_gh_push_file('TBC-HM','namkhan-bi','main', path, content, message)\`. NEVER vercel CLI, NEVER raw gh api PUT.
- HOT shared files (governance.push_hot_files: groups.ts, globals.css, hod_subpages_catalog.ts, nav-subgroups.ts): first re-fetch from main, then \`SELECT public.fn_gh_declare_read(path)\`, then push within 10 min (CAS enforced — stale base = 409).
- Verify pushes via public.v_push_ledger / public.v_commit_mirror (NOT v_current_prod — dead).

### Schema access rules
- PostgREST exposes ONLY public schema. Non-public schemas: use \`getSupabaseAdmin()\` or SECURITY DEFINER RPC bridges (public.v_* / public.fn_*).
- New tables need GRANT to service_role or they 500 silently.
- \`sb.schema('non_public').update()\` silently no-ops — use RPC for writes.

### Quality bar + verify loop
- Acceptance criteria (§6) must be ITEMIZED and individually testable — the standing verifier runs them one by one against the live deploy before status can reach shipped.
- tsc --noEmit must pass. No any[] in new code without explicit justification.
- Test on both Namkhan + Donna routes if multi-property.
`.trim();
