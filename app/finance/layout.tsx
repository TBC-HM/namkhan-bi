import DeptEntryNav from '@/components/nav/DeptEntryNav';

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#ffffff' }}>
      <DeptEntryNav />
      {children}
    </div>
  );
}
