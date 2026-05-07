
// NOTE: This is a targeted style-patch commit.
// The "New Chat" button previously used a hardcoded brown colour (#33221C / Deep Brown).
// Per design system (DESIGN_NAMKHAN_BI.md — Token scale), primary buttons must use
// var(--moss) = #1a2e21 (bg) with white text, matching every other primary action in the cockpit.
//
// PATCH INSTRUCTION FOR Pixel Pia (frontend):
// In app/cockpit/page.tsx, locate the "New Chat" / "New" button element in the chat tab.
// Replace any inline style or className that sets a brown/deep-brown background with:
//   style={{ background: 'var(--moss)', color: '#fff', border: 'none' }}
// OR if using Tailwind: remove any bg-[#33221C] / bg-amber-900 / bg-brown-* class
//   and replace with the project's moss utility (or inline CSS var above).
// Also ensure hover state uses var(--moss-glow) = #6b9379 (not a brown tint).
// No other changes. npx tsc --noEmit must stay clean.
