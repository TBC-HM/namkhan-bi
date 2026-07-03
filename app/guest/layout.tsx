// app/guest/layout.tsx
// PBS 2026-07-03: paper-white redesign scope for the entire Guest area.
// All 13 subpages (HoD, agents, cockpit, dashboard, directory, findings,
// influencers, journey, loyalty, media, messy-data, reputation, reviews,
// social) still use the legacy `var(--card)` / `var(--brass)` / `var(--paper-deep)`
// tokens internally. Rather than rewriting each file, we remap those tokens
// to paper-white values scoped to `.guest-paper-scope` — every nested page
// inherits the new design automatically.
//
// Same pattern shipped for /settings/property 2026-07-03.

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="guest-paper-scope">
      <style>{`
        .guest-paper-scope,
        .guest-paper-scope * {
          --card:       #FFFFFF;
          --border:     #E6DFCC;
          --paper:      #FFFFFF;
          --paper-warm: #FFFFFF;
          --paper-deep: #F5F0E1;
          --hairline:   #E6DFCC;
          --ink:        #1B1B1B;
          --ink-soft:   #3A3A3A;
          --ink-mute:   #5A5A5A;
          --ink-faint:  #8A8A8A;
          --brass:      #1F3A2E;
          --primary:    #1F3A2E;
          --st-good:    #1F5C2C;
          --st-warn:    #8B5A1C;
          --st-bad:     #B03826;
        }
        .guest-paper-scope button,
        .guest-paper-scope input,
        .guest-paper-scope select,
        .guest-paper-scope textarea {
          color: #1B1B1B;
        }
        .guest-paper-scope input[type="text"],
        .guest-paper-scope input[type="search"],
        .guest-paper-scope input[type="number"],
        .guest-paper-scope input[type="email"],
        .guest-paper-scope input[type="url"],
        .guest-paper-scope input[type="date"],
        .guest-paper-scope select,
        .guest-paper-scope textarea {
          background: #FFFFFF;
          border: 1px solid #E6DFCC;
        }
        /* Kill legacy dark backgrounds set via inline styles that don't use tokens */
        .guest-paper-scope [style*="background: rgb(21, 17, 12)"],
        .guest-paper-scope [style*="background:#15110c"],
        .guest-paper-scope [style*="background: #15110c"],
        .guest-paper-scope [style*="background-color: rgb(21, 17, 12)"] {
          background: #FFFFFF !important;
        }
      `}</style>
      {children}
    </div>
  );
}
