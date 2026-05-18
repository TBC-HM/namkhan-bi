// app/revenue/pulse/_components/HighOccCalendar.tsx
// Cloudbeds-style "Upcoming high occupancy" month calendar. Shows the
// month following `anchor` plus the next month. Days with occupancy
// >= threshold are tinted brass; cell value shows the day number.

interface HighDay {
  date: string;
  occupancy_pct: number;
}

export default function HighOccCalendar({
  anchor,
  highDays,
}: {
  anchor: string; // yyyy-mm-dd
  highDays: HighDay[];
}) {
  // Index high days by date for O(1) lookup
  const highByDate = new Map<string, number>();
  for (const d of highDays) highByDate.set(d.date, d.occupancy_pct);

  // Render the current month containing `anchor`.
  const anchorDate = new Date(anchor + 'T00:00:00Z');
  const year = anchorDate.getUTCFullYear();
  const month = anchorDate.getUTCMonth(); // 0-indexed
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const lastOfMonth = new Date(Date.UTC(year, month + 1, 0));
  const startWeekDay = firstOfMonth.getUTCDay(); // 0=Sun
  const daysInMonth = lastOfMonth.getUTCDate();

  // Build a grid: 6 rows × 7 cols. Pre-month cells empty.
  const cells: Array<{ day: number | null; iso: string | null; occ: number | null }> = [];
  for (let i = 0; i < startWeekDay; i++) {
    cells.push({ day: null, iso: null, occ: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, iso, occ: highByDate.get(iso) ?? null });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, iso: null, occ: null });

  const monthLabel = firstOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute, #7d7565)', letterSpacing: '0.12em' }}>
          {monthLabel}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-mute, #7d7565)' }}>
          {highDays.length} day{highDays.length === 1 ? '' : 's'} ≥ 80%
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono)', fontSize: 11 }}>
        <thead>
          <tr>
            {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map((wd) => (
              <th
                key={wd}
                style={{
                  padding: '4px 0',
                  textAlign: 'center',
                  color: 'var(--ink-mute, #7d7565)',
                  fontSize: 'var(--t-xs)',
                  fontWeight: 600,
                  letterSpacing: '0.10em',
                }}
              >
                {wd}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <tr key={`r-${row}`}>
              {cells.slice(row * 7, row * 7 + 7).map((c, col) => {
                const isToday = c.iso === todayIso;
                const occ = c.occ;
                const tint = occ != null
                  ? occ >= 95
                    ? 'rgba(168, 133, 74, 0.65)'  // brass strong
                    : occ >= 85
                      ? 'rgba(168, 133, 74, 0.40)'  // brass mid
                      : 'rgba(168, 133, 74, 0.22)'  // brass light
                  : 'transparent';
                return (
                  <td
                    key={`c-${row}-${col}`}
                    style={{
                      padding: 0,
                      textAlign: 'center',
                      border: '1px solid var(--tbl-border, var(--paper-deep))',
                      height: 36,
                      background: tint,
                      color: c.day == null
                        ? 'var(--ink-faint, #b3a888)'
                        : occ != null
                          ? 'var(--tbl-fg-strong, var(--ink, #1a1a1a))'
                          : 'var(--tbl-fg, var(--ink, #1a1a1a))',
                      fontWeight: occ != null ? 600 : 400,
                      position: 'relative',
                    }}
                    title={
                      c.iso && occ != null
                        ? `${c.iso} · ${occ.toFixed(1)}% occupancy`
                        : c.iso ?? ''
                    }
                  >
                    <div>{c.day ?? ''}</div>
                    {isToday && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 2,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 4,
                          height: 4,
                          borderRadius: '50%',
                          background: 'var(--brass, #a8854a)',
                        }}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
