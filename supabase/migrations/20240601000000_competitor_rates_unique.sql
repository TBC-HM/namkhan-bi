-- Ticket #594: ensure idempotent upserts for Nimble compset agent
-- Adds UNIQUE constraint on revenue.competitor_rates(comp_id, stay_date, channel)
-- if it does not already exist. Safe to run multiple times.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conrelid = 'revenue.competitor_rates'::regclass
    AND    contype  = 'u'
    AND    conname  = 'competitor_rates_comp_stay_channel_key'
  ) THEN
    ALTER TABLE revenue.competitor_rates
      ADD CONSTRAINT competitor_rates_comp_stay_channel_key
      UNIQUE (comp_id, stay_date, channel);
  END IF;
END;
$$;
