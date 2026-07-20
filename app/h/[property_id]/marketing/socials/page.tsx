// app/h/[property_id]/marketing/socials/page.tsx
// Universal tenant URL shape (§7). Namkhan → legacy unprefixed Socials page.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function Page({ params }: { params: { property_id: string } }) {
  if (String(params.property_id) === '260955') redirect('/marketing/socials');
  redirect('/h/' + params.property_id + '/marketing');
}
