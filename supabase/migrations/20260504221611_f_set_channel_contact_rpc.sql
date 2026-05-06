-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504221611
-- Name:    f_set_channel_contact_rpc
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE OR REPLACE FUNCTION public.f_set_channel_contact(
  p_source_name           text,
  p_account_id            text,
  p_property_url          text,
  p_channel_manager_name  text,
  p_channel_manager_role  text,
  p_channel_manager_email text,
  p_channel_manager_phone text,
  p_accounting_name       text,
  p_accounting_email      text,
  p_accounting_phone      text,
  p_connectivity_provider text,
  p_commission_pct        numeric,
  p_contract_start        date,
  p_contract_renewal      date,
  p_notes                 text
) RETURNS revenue.channel_contacts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = revenue, public
AS $$
DECLARE
  result revenue.channel_contacts;
BEGIN
  INSERT INTO revenue.channel_contacts (
    source_name, account_id, property_url,
    channel_manager_name, channel_manager_role, channel_manager_email, channel_manager_phone,
    accounting_name, accounting_email, accounting_phone,
    connectivity_provider, commission_pct, contract_start, contract_renewal, notes,
    updated_at
  ) VALUES (
    p_source_name, NULLIF(p_account_id,''), NULLIF(p_property_url,''),
    NULLIF(p_channel_manager_name,''), NULLIF(p_channel_manager_role,''),
    NULLIF(p_channel_manager_email,''), NULLIF(p_channel_manager_phone,''),
    NULLIF(p_accounting_name,''), NULLIF(p_accounting_email,''), NULLIF(p_accounting_phone,''),
    NULLIF(p_connectivity_provider,''), p_commission_pct,
    p_contract_start, p_contract_renewal, NULLIF(p_notes,''),
    now()
  )
  ON CONFLICT (source_name) DO UPDATE SET
    account_id            = EXCLUDED.account_id,
    property_url          = EXCLUDED.property_url,
    channel_manager_name  = EXCLUDED.channel_manager_name,
    channel_manager_role  = EXCLUDED.channel_manager_role,
    channel_manager_email = EXCLUDED.channel_manager_email,
    channel_manager_phone = EXCLUDED.channel_manager_phone,
    accounting_name       = EXCLUDED.accounting_name,
    accounting_email      = EXCLUDED.accounting_email,
    accounting_phone      = EXCLUDED.accounting_phone,
    connectivity_provider = EXCLUDED.connectivity_provider,
    commission_pct        = EXCLUDED.commission_pct,
    contract_start        = EXCLUDED.contract_start,
    contract_renewal      = EXCLUDED.contract_renewal,
    notes                 = EXCLUDED.notes,
    updated_at            = now()
  RETURNING * INTO result;
  RETURN result;
END $$;

GRANT EXECUTE ON FUNCTION public.f_set_channel_contact(
  text, text, text, text, text, text, text, text, text, text, text, numeric, date, date, text
) TO authenticated, anon, service_role;