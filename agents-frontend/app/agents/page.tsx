// app/agents/page.tsx
import { redirect } from 'next/navigation';

export default function AgentsIndex() {
  redirect('/agents/roster');
}
