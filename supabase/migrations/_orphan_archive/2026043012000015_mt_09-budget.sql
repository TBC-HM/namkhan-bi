-- Gap-M9 governance.maintenance_budget
create table if not exists governance.maintenance_budget (
  property_id    text not null,
  fiscal_year    int not null,
  opex_cap_usd   numeric(10,2),
  capex_cap_usd  numeric(10,2),
  approval_thresholds_json jsonb,
  primary key (property_id, fiscal_year)
);
alter table governance.maintenance_budget enable row level security;
create policy mb_read on governance.maintenance_budget for select
  using (auth.jwt() ->> 'role' in ('manager','owner'));
