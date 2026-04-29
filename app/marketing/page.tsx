// app/marketing/page.tsx
import { redirect } from 'next/navigation';

export default function MarketingIndex() {
  redirect('/marketing/reviews');
}
