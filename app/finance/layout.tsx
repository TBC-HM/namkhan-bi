// app/finance/layout.tsx — PBS USALI task 4 (2026-05-25)
// Inject paper-white token overrides for the legacy --surf/--border/--text-1
// tokens so legacy finance tables/dropdowns render on the new design without
// touching 30+ component files. Scope: every descendant of /finance/* gets
// these overrides; outside /finance the legacy dark tokens remain intact.

// USALI task #16: mount FxRateHub at the top of every Finance page
import FxRateHub from '@/app/_components/finance/FxRateHub';

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="finance-paperwhite-scope">
      {/* @ts-expect-error Async Server Component in JSX */}
      <FxRateHub />
      <style>{`
        .finance-paperwhite-scope {
          /* Dark surface tokens → paper-white equivalents */
          --surf-0: #FFFFFF;
          --surf-1: #FAFAF7;
          --surf-2: #F4EFE2;
          --paper-warm: #FAFAF7;
          --paper-deep: #EDE7D4;
          /* Borders → hairlines */
          --border-1: #E6DFCC;
          --border-2: #D6CFB8;
          --border-3: #C8C0A6;
          --rule: #D6CFB8;
          /* Text tokens that were cream/orange → ink */
          --text-0: #1B1B1B;
          --text-1: #1B1B1B;
          --text-2: #2A2A2A;
          --text-warm: #1B1B1B;
          --text-soft: #5A5A5A;
          --text-mute: #5A5A5A;
          --text-dim: #7D7D7D;
          --text-place: #9A9A9A;
          --ink: #1B1B1B;
          --ink-mute: #5A5A5A;
          --ink-soft: #5A5A5A;
          --ink-faint: #9A9A9A;
          /* Hairlines for tables */
          --line-soft: #E6DFCC;
          --hairline: #E6DFCC;
          /* Brass accent only for HEADLINE accents (kept). For TABLE
             headers used to be brass — override to ink-soft so it looks
             like canonical paper-white tables. The brass token itself is
             not redefined, so KPI accents stay. */
        }
        /* Table headers inside finance: ink-soft (was brass) */
        .finance-paperwhite-scope table.usali th,
        .finance-paperwhite-scope thead th {
          color: #5A5A5A !important;
          background: #FAFAF7 !important;
          border-bottom: 1px solid #E6DFCC !important;
        }
        /* Generic legacy "panel dashed" blocks → paper */
        .finance-paperwhite-scope .panel,
        .finance-paperwhite-scope .panel.dashed {
          background: #FFFFFF !important;
          border-color: #E6DFCC !important;
          color: #1B1B1B !important;
        }
        /* Black <code> bg → soft paper */
        .finance-paperwhite-scope code {
          background: rgba(31, 58, 46, 0.06);
          color: #1B1B1B;
        }
      `}</style>
      {children}
    </div>
  );
}
