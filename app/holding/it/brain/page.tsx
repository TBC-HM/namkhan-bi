// app/holding/it/brain/page.tsx
// BRAIN v1 · Company Second Brain console — owner surface under Holding · IT.
// Pipeline tiles + human review queue + "Ask the company brain" window.
// Server component fetches nothing; the client component polls
// /api/brain/review (service-role reads happen server-side in that route).

import BrainClient from './BrainClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function BrainPage() {
  return <BrainClient />;
}
