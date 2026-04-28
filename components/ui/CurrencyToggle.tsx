'use client';

// components/ui/CurrencyToggle.tsx
// USD ↔ LAK toggle. Persisted in localStorage so currency choice
// survives page navigation. Custom 'currency-changed' event lets
// other components on the same page re-render.

import { useEffect, useState } from 'react';

export type Currency = 'USD' | 'LAK';

const KEY = 'namkhan-bi:currency';

export function getCurrency(): Currency {
  if (typeof window === 'undefined') return 'USD';
  const v = window.localStorage.getItem(KEY);
  return v === 'LAK' ? 'LAK' : 'USD';
}

export function setCurrency(c: Currency) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, c);
  window.dispatchEvent(new CustomEvent('currency-changed', { detail: c }));
}

export default function CurrencyToggle() {
  const [c, setC] = useState<Currency>('USD');

  useEffect(() => {
    setC(getCurrency());
    const onChange = (e: Event) => {
      const ce = e as CustomEvent<Currency>;
      setC(ce.detail);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setC((e.newValue as Currency) ?? 'USD');
    };
    window.addEventListener('currency-changed', onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('currency-changed', onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  function pick(next: Currency) {
    setCurrency(next);
    setC(next);
  }

  return (
    <div className="currency-toggle" role="group" aria-label="Currency">
      <button
        className={c === 'USD' ? 'active' : ''}
        onClick={() => pick('USD')}
        aria-pressed={c === 'USD'}
      >
        USD
      </button>
      <button
        className={c === 'LAK' ? 'active' : ''}
        onClick={() => pick('LAK')}
        aria-pressed={c === 'LAK'}
      >
        LAK
      </button>
    </div>
  );
}
