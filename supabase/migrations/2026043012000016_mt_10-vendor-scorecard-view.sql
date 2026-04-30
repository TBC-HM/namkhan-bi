-- Vendor scorecard (view; assumes assigned_to_acked_at column exists; if not, adapt)
create or replace view ops.v_vendor_scorecard_90d as
  select
    v.id, v.name,
    count(t.id) as tickets,
    avg(extract(epoch from (t.resolved_at - t.reported_at)) / 3600.0)
      filter (where t.resolved_at is not null) as avg_resolve_h,
    count(t.id) filter (where t.priority = 'urgent') as urgent_tickets,
    count(t.id) filter (where t.cost_usd is not null) as billable_tickets
  from ops.vendors v
  left join ops.maintenance_tickets t
    on t.vendor_id = v.id
    and t.reported_at >= now() - interval '90 days'
  group by v.id, v.name;
