-- Parity schema setup — ticket #596
-- Run once against the Supabase project (or wrap in a migration).
-- Skipped from supabase/migrations/ per Carla rules; place in a one-off
-- SQL file that PBS applies manually or via supabase db push.

-- -----------------------------------------------------------------------
-- 1. parity_observations table
-- -----------------------------------------------------------------------
create table if not exists revenue.parity_observations (
  id          bigserial primary key,
  scraped_at  timestamptz not null default now(),
  date        date        not null,
  channel     text        not null,
  competitor_name text    not null,
  comp_rate   numeric(12,2) not null,
  our_rate    numeric(12,2) not null,
  source_url  text
);

create index if not exists parity_obs_date_channel_idx
  on revenue.parity_observations (date, channel);

-- -----------------------------------------------------------------------
-- 2. parity_breaches view (real-time, >10% threshold)
-- -----------------------------------------------------------------------
create or replace view revenue.parity_breaches as
select
  date,
  channel,
  min(comp_rate)                              as comp_lowest,
  max(our_rate)                               as our_rate,
  round(
    (max(our_rate) - min(comp_rate))
    / nullif(min(comp_rate), 0) * 100, 2
  )                                           as breach_pct,
  count(*)                                    as competitor_count,
  max(scraped_at)                             as last_scraped_at
from revenue.parity_observations
group by date, channel
having min(comp_rate) > 0
   and max(our_rate) > min(comp_rate) * 1.10
order by date, channel;

-- -----------------------------------------------------------------------
-- 3. Helper function: active breach count (used by frontend badge)
-- -----------------------------------------------------------------------
create or replace function revenue.active_breach_count()
returns bigint
language sql stable
as $$
  select count(*)
  from revenue.parity_breaches
  where date >= current_date;
$$;
