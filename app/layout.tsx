import '../styles/globals.css';
import type { Metadata } from 'next';
import { TopNav } from '@/components/nav/TopNav';
import { CurrencyProvider } from '@/components/ui/CurrencyToggle';
import { Brand } from '@/components/nav/Brand';

export const metadata: Metadata = {
  title: 'The Namkhan · BI',
  description: 'Owner intelligence dashboard'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CurrencyProvider>
          <Brand />
          <TopNav />
          <main className="max-w-[1500px] mx-auto px-8 pb-20">{children}</main>
          <footer className="max-w-[1500px] mx-auto px-8 pt-10 pb-12 border-t border-line text-muted text-[10px] tracking-wide3 uppercase flex justify-between">
            <span>The Namkhan · Luang Prabang · LAK base</span>
            <span>v0.1 · Phase 1</span>
          </footer>
        </CurrencyProvider>
      </body>
    </html>
  );
}
