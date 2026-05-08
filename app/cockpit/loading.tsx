/**
 * app/cockpit/loading.tsx
 * Next.js 14 App Router streaming skeleton — covers ALL /cockpit/* slow tabs.
 * This file is auto-shown by React Suspense while any async server component
 * inside /cockpit/** is still fetching. No client JS required; pure CSS animation.
 *
 * Ticket #231 — Perf marathon child: Add loading.tsx for /cockpit/* slow tabs
 */

export default function CockpitLoading() {
  return (
    <div style={styles.root}>
      {/* ── Top bar skeleton ── */}
      <div style={styles.topBar}>
        <div style={{ ...styles.shimmer, width: 160, height: 22, borderRadius: 4 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {[120, 90, 110, 100].map((w, i) => (
            <div key={i} style={{ ...styles.shimmer, width: w, height: 32, borderRadius: 6 }} />
          ))}
        </div>
      </div>

      {/* ── KPI row skeleton (4 cards) ── */}
      <div style={styles.kpiRow}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={styles.kpiCard}>
            <div style={{ ...styles.shimmer, width: '60%', height: 14, borderRadius: 3, marginBottom: 10 }} />
            <div style={{ ...styles.shimmer, width: '80%', height: 28, borderRadius: 4, marginBottom: 6 }} />
            <div style={{ ...styles.shimmer, width: '40%', height: 12, borderRadius: 3 }} />
          </div>
        ))}
      </div>

      {/* ── Secondary KPI row (3 cards) ── */}
      <div style={{ ...styles.kpiRow, gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={styles.kpiCard}>
            <div style={{ ...styles.shimmer, width: '55%', height: 14, borderRadius: 3, marginBottom: 10 }} />
            <div style={{ ...styles.shimmer, width: '70%', height: 28, borderRadius: 4 }} />
          </div>
        ))}
      </div>

      {/* ── Main table skeleton ── */}
      <div style={styles.tableCard}>
        {/* table header */}
        <div style={styles.tableHeaderRow}>
          {[180, 100, 100, 120, 120, 90].map((w, i) => (
            <div key={i} style={{ ...styles.shimmer, width: w, height: 14, borderRadius: 3 }} />
          ))}
        </div>
        {/* table rows */}
        {Array.from({ length: 8 }).map((_, row) => (
          <div key={row} style={styles.tableRow}>
            {[180, 100, 100, 120, 120, 90].map((w, col) => (
              <div
                key={col}
                style={{
                  ...styles.shimmer,
                  width: w,
                  height: 14,
                  borderRadius: 3,
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* ── Keyframe injection ── */}
      <style>{`
        @keyframes _nk_shimmer {
          0%   { background-position: -600px 0; }
          100% { background-position:  600px 0; }
        }
      `}</style>
    </div>
  );
}

/* ── Inline styles (no Tailwind dependency, zero-flash) ── */
const shimmerBase: React.CSSProperties = {
  background: 'linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%)',
  backgroundSize: '1200px 100%',
  animation: '_nk_shimmer 1.4s ease-in-out infinite',
};

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    backgroundColor: '#0a0a0a',
    padding: '24px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
  },
  kpiCard: {
    backgroundColor: '#111',
    border: '1px solid #222',
    borderRadius: 10,
    padding: '18px 20px',
  },
  tableCard: {
    backgroundColor: '#111',
    border: '1px solid #222',
    borderRadius: 10,
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    flex: 1,
  },
  tableHeaderRow: {
    display: 'flex',
    gap: 24,
    alignItems: 'center',
    paddingBottom: 14,
    borderBottom: '1px solid #1e1e1e',
    marginBottom: 4,
  },
  tableRow: {
    display: 'flex',
    gap: 24,
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid #161616',
  },
  shimmer: shimmerBase,
};
