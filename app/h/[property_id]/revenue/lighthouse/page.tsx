// app/h/[property_id]/revenue/lighthouse/page.tsx
import { redirect } from 'next/navigation';
export default function LighthouseRoot({ params }: { params: { property_id: string } }) {
  redirect(`/h/${params.property_id}/revenue/lighthouse/overview`);
}
