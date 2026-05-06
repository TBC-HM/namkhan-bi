-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260506004132
-- Name:    grant_anon_select_for_revenue_pages
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Channel RPCs (used by /revenue/channels and BDC page)
GRANT EXECUTE ON FUNCTION public.f_channel_mix_weekly_trend(date, date) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.f_channel_net_value_for_range(date, date) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.f_channel_velocity_28d_by_cat() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.f_channel_econ_for_range(date, date) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.f_channel_daily_for_range(text, date, date) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.f_channel_room_mix_for_range(text, date, date) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.f_channel_pickup_for_source(text, integer) TO authenticated, anon, service_role;

-- Matviews used by Channels index page
GRANT SELECT ON public.mv_channel_economics TO authenticated, anon;
GRANT SELECT ON public.mv_channel_x_roomtype TO authenticated, anon;