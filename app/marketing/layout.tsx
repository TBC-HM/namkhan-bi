// app/marketing/layout.tsx
// Marketing section layout — adds horizontal sub-navigation.

import SubNav from '@/components/nav/SubNav';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubNav
        items={[
          { label: 'Reviews',     href: '/marketing/reviews' },
          { label: 'Social',      href: '/marketing/social' },
          { label: 'Influencers', href: '/marketing/influencers' },
          { label: 'Media',       href: '/marketing/media' },
        ]}
      />
      {children}
    </>
  );
}
