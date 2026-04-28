// app/departments/layout.tsx

import SubNav from '@/components/nav/SubNav';

export default function DepartmentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubNav
        items={[
          { label: 'Roots', href: '/departments/roots' },
          { label: 'Spa & Activities', href: '/departments/spa-activities' },
        ]}
      />
      {children}
    </>
  );
}
