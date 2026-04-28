// app/agents/layout.tsx

import SubNav from '@/components/nav/SubNav';

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubNav
        items={[
          { label: 'Roster',   href: '/agents/roster' },
          { label: 'Run',      href: '/agents/run' },
          { label: 'History',  href: '/agents/history' },
          { label: 'Settings', href: '/agents/settings' },
        ]}
      />
      {children}
    </>
  );
}
