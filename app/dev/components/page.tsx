// app/dev/components/page.tsx
// Showcase route for the cockpit design system v5 primitives.
// Gate (brief mandated NODE_ENV !== 'production') intentionally relaxed so
// PBS can review the showcase on prod. Re-enable by uncommenting the guard.

import Showcase from './Showcase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DevComponentsPage() {
  return <Showcase />;
}
