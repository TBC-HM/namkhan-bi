// app/marketing/prospects/sequences/[funnel_id]/halt/page.tsx
import { renderSequenceActionPage } from '../_shared/action';
export const dynamic = 'force-dynamic';
export default async function P({ params }: { params: { funnel_id: string } }) { return renderSequenceActionPage(params, 'halt'); }
