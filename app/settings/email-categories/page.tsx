// /settings/email-categories — operator-managed email category rules.
// Edits update sales.email_categories + sales.email_category_rules via /api/sales/email-categories.

import PageHeader from '@/components/layout/PageHeader';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import CategoriesEditor from './_components/CategoriesEditor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface CategoryRow {
  key: string; label: string; display_order: number; active: boolean;
  default_category: boolean; description: string | null;
}
interface RuleRow {
  id: string; category_key: string;
  match_field: 'from_email'|'from_domain'|'subject'|'body'|'intended_mailbox';
  match_op: 'ilike'|'endswith'|'equals'|'regex';
  pattern: string; priority: number; active: boolean; notes: string | null;
}

async function load() {
  const sb = getSupabaseAdmin();
  const [{ data: cats }, { data: rules }] = await Promise.all([
    sb.schema('sales').from('email_categories').select('*').order('display_order'),
    sb.schema('sales').from('email_category_rules').select('*').order('priority'),
  ]);
  return {
    categories: (cats ?? []) as CategoryRow[],
    rules: (rules ?? []) as RuleRow[],
  };
}

export default async function EmailCategoriesPage() {
  const { categories, rules } = await load();
  return (
    <>
      <PageHeader
        pillar="Settings"
        tab="Email categories"
        title={<>Email cockpit · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>category rules</em></>}
        lede="Edit which mail buckets into which kind. Add a sender pattern to push it into the bucket you want — first match wins."
      />
      <CategoriesEditor categories={categories} rules={rules} />
    </>
  );
}
