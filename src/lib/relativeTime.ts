/**
 * getRelativeTime — lightweight relative-time formatter.
 * Returns strings like '3 min ago', '2h ago', '4d ago'.
 * No external dep; works with any ISO timestamp string or Date.
 */
export function getRelativeTime(timestamp: string | Date): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  if (isNaN(diffMs)) return '';

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}
