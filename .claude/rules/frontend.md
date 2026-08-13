paths: app/**/*.tsx, components/**

# Frontend rules

Crash class: JSX component inside async RSC
Never define a React component INSIDE an async Server Component and use it as <Component/> — runtime Digest crash, no build error. Either call it as a function {fn({...})} or define it at module scope. Never pass function props server->client.

Imports:
Before import X from 'pkg': verify pkg is in package.json (grep '"pkg"' package.json). @anthropic-ai/sdk is NOT installed — use callAnthropic() from @/lib/youtube/skills-common (text) or raw fetch with getVaultSecret('ANTHROPIC_API_KEY') (vision).

Theme tokens (property-scoped pages):
Under app/h/[property_id]/** use --tbl-bg, --tbl-fg, --tbl-fg-mute, --tbl-border, --tbl-border-strong, --tbl-bg-elev.
NEVER --ink-*, --bd-*, --surf-* there — they fall through to Namkhan globals and render black-on-black on Donna's cream palette.

Canonical configs (import, never inline):
- Settings tabs: lib/property-settings-tabs.ts -> getSettingsTabs() — never define tabs inline.
- Dept nav: lib/nav-subgroups.ts + prefixTabHref() keep sub-tabs on-tenant.
- IT2 pages: a page and its app/holding/it2/_lib/groups.ts entry are ONE change — push nav first, page second (prebuild orphan check fails otherwise).
- app/cockpit, app/cockpit-v2, app/chat are redirect stubs — never add content there (prebuild enforces redirect().

Email footer:
The physical address comes from /h/[pid]/settings/communications (property.communications.footer_address) — never hardcode it.
