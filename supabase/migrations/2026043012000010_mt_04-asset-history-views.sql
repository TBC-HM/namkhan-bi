-- Gap-M3 (free) v_asset_history + v_asset_health
create or replace view ops.v_asset_history as
  select
    t.asset_id,
    a.category,
    a.room_no,
    count(*) filter (where t.priority = 'urgent') as urgent_tickets_lifetime,
    count(*) as total_tickets_lifetime,
    sum(t.cost_usd) as total_cost_usd,
    max(t.reported_at) as last_failure
  from ops.maintenance_tickets t
  join ops.assets a on a.id = t.asset_id
  group by t.asset_id, a.category, a.room_no;

create or replace view ops.v_asset_health as
  select
    a.id,
    a.category,
    a.room_no,
    a.install_date,
    a.mtbf_months,
    extract(year from age(current_date, a.install_date))*12
      + extract(month from age(current_date, a.install_date)) as age_months,
    coalesce(h.total_tickets_lifetime, 0) as failures,
    greatest(0, 100
      - least(40, ((extract(year from age(current_date, a.install_date))*12
                  + extract(month from age(current_date, a.install_date)))
                  * 40 / nullif(a.mtbf_months,0)))
      - least(40, coalesce(h.total_tickets_lifetime,0) * 4)
      - least(20, coalesce(h.urgent_tickets_lifetime,0) * 5)
    )::int as health_score
  from ops.assets a
  left join ops.v_asset_history h on h.asset_id = a.id;
