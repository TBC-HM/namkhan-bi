// app/marketing/channels/page.tsx
// PBS 2026-07-21 · Channels top tab retired. Socials + Digital are now top-strip
// peers; visitors of the legacy /marketing/channels URL land on Socials.
import { redirect } from 'next/navigation';
export default function ChannelsRedirect() { redirect('/marketing/social'); }
