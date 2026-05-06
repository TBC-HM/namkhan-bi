-- Gap-H3 ops.linen_pars + ops.laundry_cycle
create table if not exists ops.linen_pars (
  property_id text not null,
  item_code   text not null,
  par_target  int not null,
  on_hand     int not null,
  in_wash     int not null default 0,
  in_transit  int not null default 0,
  expected_back timestamptz,
  measured_at timestamptz not null default now(),
  primary key (property_id, item_code, measured_at)
);
create or replace view ops.v_linen_breach_forecast as
  with f as (
    select property_id, item_code, on_hand, par_target,
           (on_hand::float / nullif(par_target,0)) as pct
    from ops.linen_pars
    where measured_at >= now() - interval '6 hours'
  )
  select *, case
    when pct < 0.70 then 'high'
    when pct < 0.85 then 'med'
    when pct < 0.90 then 'low'
    else 'ok' end as severity
  from f;
alter table ops.linen_pars enable row level security;
create policy lp_read on ops.linen_pars for select
  using (auth.jwt() ->> 'role' in ('staff','manager','owner'));
