'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function SubNav({ items }: { items: { href: string; label: string; live?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 mb-6 border-b border-line">
      {items.map(it => {
        const active = pathname === it.href;
        const live = it.live !== false;
        return (
          <Link key={it.href} href={it.href}
            className={`px-4 py-2 text-[10px] tracking-wide3 uppercase border-b-2 ${active ? 'border-sand text-text' : 'border-transparent text-muted hover:text-text'} ${!live ? 'opacity-50' : ''}`}>
            {it.label}{!live && ' · soon'}
          </Link>
        );
      })}
    </div>
  );
}
