// app/holding/settings/page.tsx
// PBS 2026-07-09: Holding settings. Central config for the holding entity
// (Beyond Circle / TBC Management - FZC). Powers invoice template sender
// block, brand assets, contact roster. Backed by holding.settings JSONB store.

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import SettingsEditor from './_components/SettingsEditor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SettingRow = { key: string; value: Record<string, string> };

const SECTIONS: {
  key: string;
  title: string;
  subtitle: string;
  fields: { key: string; label: string; type?: 'text' | 'textarea' | 'email' | 'color' | 'url' }[];
}[] = [
  {
    key: 'entity_identity',
    title: 'Entity identity',
    subtitle: 'Legal + trade name · address · tax IDs · used on invoices, contracts, memos.',
    fields: [
      { key: 'legal_name',    label: 'Legal name' },
      { key: 'trade_name',    label: 'Trade name' },
      { key: 'address_line1', label: 'Address line 1' },
      { key: 'address_line2', label: 'Address line 2' },
      { key: 'city',          label: 'City' },
      { key: 'country',       label: 'Country' },
      { key: 'premises_no',   label: 'Premises / license #' },
      { key: 'tax_id',        label: 'Tax ID / VAT #' },
      { key: 'email',         label: 'Contact email', type: 'email' },
      { key: 'phone',         label: 'Phone' },
      { key: 'website',       label: 'Website', type: 'url' },
    ],
  },
  {
    key: 'banking',
    title: 'Banking',
    subtitle: 'For invoice payments. Auto-appears in generated invoices when populated.',
    fields: [
      { key: 'beneficiary',  label: 'Beneficiary name' },
      { key: 'bank_name',    label: 'Bank name' },
      { key: 'iban',         label: 'IBAN' },
      { key: 'swift',        label: 'SWIFT / BIC' },
      { key: 'bank_address', label: 'Bank address' },
      { key: 'notes',        label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'contacts',
    title: 'Team contacts',
    subtitle: 'Holding-level key roles. Not the ops directory — that lives per-property.',
    fields: [
      { key: 'ceo_name',        label: 'CEO name' },
      { key: 'ceo_email',       label: 'CEO email', type: 'email' },
      { key: 'clo_name',        label: 'Chief legal officer' },
      { key: 'clo_email',       label: 'CLO email', type: 'email' },
      { key: 'ops_email',       label: 'General ops inbox', type: 'email' },
      { key: 'accounting_email', label: 'Accounting inbox', type: 'email' },
    ],
  },
  {
    key: 'brand',
    title: 'Brand',
    subtitle: 'Colors + logo used across invoices, newsletters, decks.',
    fields: [
      { key: 'primary_color', label: 'Primary color (hex)', type: 'color' },
      { key: 'accent_color',  label: 'Accent color (hex)',  type: 'color' },
      { key: 'logo_url',      label: 'Logo URL', type: 'url' },
      { key: 'tagline',       label: 'Tagline' },
      { key: 'website',       label: 'Public website', type: 'url' },
    ],
  },
];

async function loadSettings(): Promise<Record<string, Record<string, string>>> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('v_holding_settings').select('key, value');
  const out: Record<string, Record<string, string>> = {};
  for (const row of (data ?? []) as SettingRow[]) {
    out[row.key] = row.value ?? {};
  }
  return out;
}

export default async function HoldingSettingsPage() {
  const settings = await loadSettings();

  return (
    <DashboardPage
      title="Holding · Settings"
      subtitle="Entity identity · banking · contacts · brand · shared across every /holding surface"
      tabs={[
        { key: 'back', label: 'HoD', href: '/holding' },
      ]}
    >
      {SECTIONS.map((section) => (
        <div key={section.key} style={{ gridColumn: '1 / -1' }}>
          <Container title={section.title} subtitle={section.subtitle} density="compact">
            <SettingsEditor
              settingKey={section.key}
              initial={settings[section.key] ?? {}}
              fields={section.fields}
            />
          </Container>
        </div>
      ))}
    </DashboardPage>
  );
}
