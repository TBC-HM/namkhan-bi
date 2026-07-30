// LEGACY SURFACE RETIRED — one-channel command law (PBS 2026-07-30) +
// central-chat-v1 verifier V6/V8: per-role direct-specialist chat
// (AgentChatShell → /api/cockpit/chat-v2) is retired. Specialists receive
// work from the queue via Felix and answer through proposals + the Decision
// Inbox — never direct owner chat. Redirects to the ONE chat.
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function LegacyRedirect() { redirect('/holding/it2/fleet/chat'); }
