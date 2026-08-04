// app/holding/it2/fleet/tasks/[id]/page.tsx
// KILLED by action-center-inbox-v1 (2026-08-04) — see ../page.tsx. Ticket
// detail is backend-only now; old deep links land on the Action Center.
import { redirect } from 'next/navigation';
export default function TicketKilledRedirect() { redirect('/holding/it2'); }
