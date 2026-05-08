'use client';

/**
 * loading.tsx — Next.js 14 App Router streaming boundary.
 * Placed at app/cockpit/loading.tsx — activates for /cockpit and every
 * sub-route (/cockpit/activity, /cockpit/logs, /cockpit/schedule, etc.).
 *
 * Next.js automatically wraps the page in a <Suspense> and shows this
 * component instantly while the server component tree fetches its data.
 * Zero JS added to the initial bundle — this renders before hydration.
 */
export default function CockpitLoading() {
  return (
    <div className="cockpit-loading" aria-busy="true" aria-label="Loading cockpit data…">
      {/* KPI row skeleton — matches the 4-column KpiBox grid used in cockpit */}
      <div className="cockpit-loading__kpi-row">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="cockpit-loading__kpi-card cockpit-loading__shimmer" />
        ))}
      </div>

      {/* Tab bar skeleton */}
      <div className="cockpit-loading__tab-bar">
        {[80, 72, 90, 64, 56, 68].map((w, i) => (
          <div
            key={i}
            className="cockpit-loading__tab cockpit-loading__shimmer"
            style={{ width: w }}
          />
        ))}
      </div>

      {/* Table skeleton — header + 8 rows */}
      <div className="cockpit-loading__table">
        <div className="cockpit-loading__table-header cockpit-loading__shimmer" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="cockpit-loading__table-row cockpit-loading__shimmer" />
        ))}
      </div>

      <style>{`
        /* Scoped styles — no class collisions with the rest of the app */
        .cockpit-loading {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Shimmer keyframe */
        @keyframes ck-shimmer {
          0%   { background-position: -800px 0; }
          100% { background-position:  800px 0; }
        }

        .cockpit-loading__shimmer {
          background: linear-gradient(
            90deg,
            #e5e7eb 25%,
            #f3f4f6 50%,
            #e5e7eb 75%
          );
          background-size: 800px 100%;
          animation: ck-shimmer 1.4s ease-in-out infinite;
          border-radius: 6px;
        }

        /* KPI row */
        .cockpit-loading__kpi-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .cockpit-loading__kpi-card {
          height: 80px;
        }

        /* Tab bar */
        .cockpit-loading__tab-bar {
          display: flex;
          gap: 12px;
          padding-bottom: 10px;
          border-bottom: 2px solid #e5e7eb;
        }

        .cockpit-loading__tab {
          height: 30px;
          flex-shrink: 0;
        }

        /* Table */
        .cockpit-loading__table {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .cockpit-loading__table-header {
          height: 44px;
          margin: 0;
          border-radius: 0;
          border-bottom: 2px solid #e5e7eb;
          background: linear-gradient(
            90deg,
            #d1d5db 25%,
            #e5e7eb 50%,
            #d1d5db 75%
          );
          background-size: 800px 100%;
          animation: ck-shimmer 1.4s ease-in-out infinite;
        }

        .cockpit-loading__table-row {
          height: 40px;
          border-radius: 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .cockpit-loading__table-row:last-child {
          border-bottom: none;
        }

        /* Responsive — collapse to 2-col KPI grid on narrow screens */
        @media (max-width: 640px) {
          .cockpit-loading__kpi-row {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
