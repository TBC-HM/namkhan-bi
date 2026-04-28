// app/finance/page.tsx
import { redirect } from 'next/navigation';

export default function FinanceIndex() {
  redirect('/finance/pnl');
}
