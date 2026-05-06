-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503230955
-- Name:    create_gl_vat_rates_lookup
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE TABLE IF NOT EXISTS gl.vat_rates (
  id           bigserial PRIMARY KEY,
  usali_subcategory text NOT NULL UNIQUE,
  vat_rate_pct numeric(5,2) NOT NULL CHECK (vat_rate_pct >= 0 AND vat_rate_pct <= 100),
  applies_to   text NOT NULL DEFAULT 'budget' CHECK (applies_to IN ('budget','actual','both','none')),
  notes        text,
  updated_at   timestamptz DEFAULT now(),
  updated_by   text
);

COMMENT ON TABLE gl.vat_rates IS
'Per-subcategory VAT rates used to bring gross plan.lines budgets down to net for vs-QB-actual comparison. Default 10% for VAT-applicable subcats; 0% for payroll/depreciation/interest/tax/FX/non-op. Editable from /settings/vat-rates.';

INSERT INTO gl.vat_rates (usali_subcategory, vat_rate_pct, applies_to, notes) VALUES
  ('Revenue',                  10.00, 'budget', 'Lao standard VAT on hospitality services'),
  ('Cost of Sales',            10.00, 'budget', 'Vendor invoices VAT-inclusive in budget; QB nets via input VAT'),
  ('Other Operating Expenses', 10.00, 'budget', 'Most operating supplies VAT-applicable'),
  ('A&G',                      10.00, 'budget', 'Consulting/audit/system fees usually VAT-applicable'),
  ('Sales & Marketing',        10.00, 'budget', 'Ads, commissions, marketing services'),
  ('POM',                      10.00, 'budget', 'Maintenance vendor invoices'),
  ('Utilities',                10.00, 'budget', 'Electricity/water/telecom'),
  ('Mgmt Fees',                10.00, 'budget', 'Default — change to 0 if mgmt fees are paid net'),
  ('Payroll & Related',         0.00, 'none',   'No VAT on labour'),
  ('Depreciation',              0.00, 'none',   'Non-cash, no VAT'),
  ('Interest',                  0.00, 'none',   'Financial — no VAT'),
  ('Income Tax',                0.00, 'none',   'No VAT on tax'),
  ('FX Gain/Loss',              0.00, 'none',   'No VAT'),
  ('Non-Operating',             0.00, 'none',   'Unclassified — no default VAT')
ON CONFLICT (usali_subcategory) DO NOTHING;

-- Allow service role + authenticated to read; only service role to write (for now).
GRANT SELECT ON gl.vat_rates TO authenticated, anon;
GRANT ALL    ON gl.vat_rates TO service_role;
GRANT USAGE, SELECT ON SEQUENCE gl.vat_rates_id_seq TO service_role;
