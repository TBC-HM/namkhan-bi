-- Gap-H5 ops.v_dnd_streaks (view, derives from H1)
create or replace view ops.v_dnd_streaks as
  with dnd_days as (
    select property_id, room_no, date(changed_at) as d
    from ops.room_status
    where status = 'dnd'
    group by 1,2,3
  ), streaks as (
    select property_id, room_no, d,
           d - (row_number() over (partition by property_id, room_no order by d))::int as grp
    from dnd_days
  )
  select property_id, room_no,
         min(d) as streak_start, max(d) as streak_end,
         count(*) as days,
         current_date - max(d) as days_since
  from streaks
  group by 1,2,grp
  having current_date = max(d) or max(d) >= current_date - 1;
