// Status dot color resolution.

import type { StatusTone } from '../types';

export function statusColor(tone?: StatusTone): string {
  switch (tone) {
    case 'green': return 'var(--status-green, #2E7D32)';
    case 'amber': return 'var(--status-amber, #B8A878)';
    case 'red':   return 'var(--status-red, #B8542A)';
    case 'grey':  return 'var(--status-grey, #8A8A8A)';
    default:      return 'transparent';
  }
}
