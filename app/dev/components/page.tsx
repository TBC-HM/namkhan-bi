// app/dev/components/page.tsx
// Showcase route for the cockpit design system v5 primitives.
// Gated per brief: NODE_ENV !== 'production' OR explicit override via
// NEXT_PUBLIC_DEV_COMPONENTS=1 (lets PBS view it on prod when needed).

import { notFound } from 'next/navigation';
import Showcase from './Showcase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DevComponentsPage() {
  const enabled =
    process.env.NODE_ENV !== 'production'
    || process.env.NEXT_PUBLIC_DEV_COMPONENTS === '1';
  if (!enabled) notFound();
  return <Showcase />;
}
