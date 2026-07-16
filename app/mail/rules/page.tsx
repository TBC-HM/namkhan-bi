// app/mail/rules/page.tsx
// PBS 2026-07-15 · Item 7 — Settings → Routing rules editor.
import RulesClient from './_client/RulesClient';

export const dynamic = 'force-dynamic';

export default function RulesPage() {
  return <RulesClient />;
}
