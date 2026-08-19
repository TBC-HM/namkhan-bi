// PBS 2026-08-19: brain access is via the floating panel only (FloatingHOSPanel).
// This dedicated /holding/chat page was retired — use the floating widget.
import { notFound } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function Page() { notFound(); }
