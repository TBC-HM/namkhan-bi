// app/marketing/prospects/sequences/page.tsx
// PBS 2026-07-21: page moved under Guest · Newsletters as a sub-tab.
// This old URL now redirects so every bookmark / external link still resolves.
// Body lives at ./_components/SequencesBody.tsx (also imported by the new home).
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Page() {
  redirect('/guest/newsletters/sequences');
}
