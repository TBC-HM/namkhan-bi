// LEGACY SURFACE RETIRED — one-channel command law (PBS 2026-07-30) +
// central-chat-v1 verifier V6: the persona-tab direct-specialist chat is
// retired. Specialist agents receive work from the queue via Felix; direct
// owner-chat with specialists is a violation. Redirects to the ONE chat.
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function LegacyRedirect() { redirect('/holding/it2/fleet/chat'); }
