import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Finance Reports — Namkhan BI',
};

export default async function FinanceReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="space-y-6">
      <div className="border-b border-stone-200 pb-4">
        <h1 className="text-2xl font-semibold text-stone-900">Finance Reports</h1>
        <p className="mt-1 text-sm text-stone-600">
          Download and generate financial reports
        </p>
      </div>

      <Suspense fallback={<div className="text-sm text-stone-500">Loading reports…</div>}>
        <div className="rounded-lg border border-stone-200 bg-white p-8 text-center">
          <p className="text-stone-600">Reports interface coming soon.</p>
        </div>
      </Suspense>
    </div>
  );
}