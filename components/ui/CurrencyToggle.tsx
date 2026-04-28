'use client';
import { createContext, useContext, useState, ReactNode } from 'react';
import type { Currency } from '@/lib/format';

type Ctx = { ccy: Currency; setCcy: (c: Currency) => void };
const CcyCtx = createContext<Ctx>({ ccy: 'USD', setCcy: () => {} });

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [ccy, setCcy] = useState<Currency>('USD');
  return <CcyCtx.Provider value={{ ccy, setCcy }}>{children}</CcyCtx.Provider>;
}

export function useCcy() { return useContext(CcyCtx); }

export function CurrencyToggle() {
  const { ccy, setCcy } = useCcy();
  return (
    <div className="flex border border-line text-[10px] tracking-wide2 uppercase">
      {(['USD','LAK'] as Currency[]).map(c => (
        <button
          key={c}
          onClick={() => setCcy(c)}
          className={`px-3 py-1 ${ccy===c ? 'bg-sand text-ink' : 'text-muted hover:text-text'}`}
        >{c}</button>
      ))}
    </div>
  );
}
