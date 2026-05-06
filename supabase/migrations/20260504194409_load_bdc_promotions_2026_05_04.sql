-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504194409
-- Name:    load_bdc_promotions_2026_05_04
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

DO $$
DECLARE u_promo uuid := gen_random_uuid();
BEGIN
INSERT INTO revenue.ota_uploads (id, ota_source, file_kind, file_name, snapshot_date, parser_version, status, period_from, period_to, notes) VALUES
  (u_promo, 'Booking.com', 'promo', 'ACTIVE+INACTIVE_promotions_2026-05-04.xlsx', '2026-05-04', 'bdc-v1', 'parsed', '2025-05-04', '2026-05-04', 'Active+Inactive promos merged');
INSERT INTO revenue.bdc_promotions (upload_id, snapshot_date, name, discount_pct, bookable_from, bookable_to, stay_dates_raw, bookings, room_nights, adr_usd, revenue_usd, canceled_room_nights, status, promo_seq) VALUES
(u_promo, '2026-05-04', 'China country rate', 15.0, '2026-04-10'::date, NULL::date, 'Always active Excluding 245 dates', 1, 2, 215.9, 431.8, NULL, 'active', 1),
(u_promo, '2026-05-04', 'Thailand country rate', 15.0, '2026-04-16'::date, NULL::date, 'Always active Excluding 273 dates', 4, 10, 151.87, 1518.74, 2, 'active', 2),
(u_promo, '2026-05-04', 'Vietnam country rate', 15.0, '2026-04-10'::date, NULL::date, 'Always active Excluding 245 dates', 1, 2, 491.83, 983.66, NULL, 'active', 3),
(u_promo, '2026-05-04', 'Getaway Deal 3rd', 30.0, '2026-03-12'::date, '2026-09-30'::date, 'Mar 26, 2026 - Sep 30, 2026', 11, 28, 124.57, 3487.82, NULL, 'active', 4),
(u_promo, '2026-05-04', 'Mobile rate', 10.0, '2025-08-06'::date, '2025-12-28'::date, 'Always active Excluding 15 dates', 52, 138, 201.46, 27801.62, 55, 'inactive', 5),
(u_promo, '2026-05-04', 'Japan country rate', 5.0, '2025-09-13'::date, '2025-12-28'::date, 'Always active Excluding 14 dates', NULL, NULL, NULL, NULL, NULL, 'inactive', 6),
(u_promo, '2026-05-04', 'Malaysia country rate', 5.0, '2025-09-13'::date, '2025-12-28'::date, 'Always active Excluding 14 dates', NULL, NULL, NULL, NULL, NULL, 'inactive', 7),
(u_promo, '2026-05-04', 'International country rate', 5.0, '2024-03-13'::date, '2025-08-06'::date, 'Always active', 72, 250, 186.49, 46622.96, 119, 'inactive', 8),
(u_promo, '2026-05-04', 'Canada country rate', 10.0, '2025-04-02'::date, '2025-05-06'::date, 'Always active Excluding 92 dates', NULL, NULL, NULL, NULL, NULL, 'inactive', 9),
(u_promo, '2026-05-04', 'Domestic country rate', 10.0, '2025-09-21'::date, '2025-12-28'::date, 'Always active Excluding 13 dates', 17, 31, 131.39, 4072.96, 4, 'inactive', 10),
(u_promo, '2026-05-04', 'European Economic Area country rate', 10.0, '2025-12-30'::date, '2026-01-16'::date, 'Always active Excluding 21 dates', 22, 104, 195.73, 20355.75, 33, 'inactive', 11),
(u_promo, '2026-05-04', 'Russia country rate', 10.0, '2025-10-07'::date, '2025-12-28'::date, 'Always active Excluding 49 dates', 1, 2, 510.3, 1020.6, NULL, 'inactive', 12),
(u_promo, '2026-05-04', 'United Kingdom country rate', 5.0, '2024-03-13'::date, '2025-10-07'::date, 'Always active Excluding 15 dates', 2, 6, 143.48, 860.9, NULL, 'inactive', 13),
(u_promo, '2026-05-04', 'Singapore country rate', 10.0, '2025-09-21'::date, '2025-12-28'::date, 'Always active Excluding 14 dates', 6, 21, 229.48, 4818.98, 2, 'inactive', 14),
(u_promo, '2026-05-04', 'South Korea country rate', 10.0, '2025-09-13'::date, '2025-10-02'::date, 'Always active Excluding 14 dates', NULL, NULL, NULL, NULL, NULL, 'inactive', 15),
(u_promo, '2026-05-04', 'Basic Deal', 10.0, '2025-09-13'::date, '2025-12-14'::date, 'Sep 13, 2025 - Dec 13, 2025', 16, 57, 170.13, 9697.54, 9, 'inactive', 16),
(u_promo, '2026-05-04', 'November Deal _ created on 3 Nov 2025', 8.0, '2025-11-03'::date, '2025-11-30'::date, 'Nov 3, 2025 - Nov 30, 2025 Excluding 9 dates', NULL, NULL, NULL, NULL, NULL, 'inactive', 17),
(u_promo, '2026-05-04', 'Flash Sale Apr', 30.0, '2026-04-13'::date, '2026-04-19'::date, 'Apr 13, 2026 - Apr 30, 2026', 3, 3, 118.65, 355.95, 1, 'inactive', 18),
(u_promo, '2026-05-04', 'November Deal _ created on 31 Oct 2025', 8.0, '2025-10-31'::date, '2025-11-30'::date, 'Nov 1, 2025 - Nov 30, 2025 Excluding 9 dates', NULL, NULL, NULL, NULL, NULL, 'inactive', 19),
(u_promo, '2026-05-04', 'Nov - Dec 2025 Deal _ created on 3 Nov 2025', 8.0, '2025-11-06'::date, '2025-12-17'::date, 'Nov 15, 2025 - Dec 21, 2025', 14, 23, 151.12, 3475.67, 2, 'inactive', 20),
(u_promo, '2026-05-04', 'Riverfront Glamping', 5.0, '2026-01-22'::date, '2026-05-01'::date, 'Feb 20, 2026 - Apr 30, 2026', NULL, NULL, NULL, NULL, NULL, 'inactive', 21),
(u_promo, '2026-05-04', 'Dec 2025 & Jan 2026 Deal', 5.0, '2025-11-05'::date, '2026-01-17'::date, 'Dec 1, 2025 - Jan 17, 2026 Excluding 14 dates', 1, 3, 155.75, 467.25, NULL, 'inactive', 22),
(u_promo, '2026-05-04', 'Luang Prabang Half Marathon 2025', 18.0, '2025-09-24'::date, '2025-10-11'::date, 'Oct 22, 2025 - Oct 25, 2025', NULL, NULL, NULL, NULL, NULL, 'inactive', 23),
(u_promo, '2026-05-04', 'Early Booker Deal', 8.0, '2025-09-13'::date, '2025-12-29'::date, 'Sep 21, 2025 - Jan 31, 2027', 1, 3, 242.63, 727.9, NULL, 'inactive', 24),
(u_promo, '2026-05-04', 'Early Booker Deal 45D Jan - Mar', 6.0, '2025-12-02'::date, '2026-03-10'::date, 'Jan 5, 2026 - Mar 31, 2026', 1, 3, 158.83, 476.48, NULL, 'inactive', 25),
(u_promo, '2026-05-04', 'Stay 4 Pay 3', 18.0, '2025-11-11'::date, '2025-12-16'::date, 'Nov 11, 2025 - Dec 15, 2025', 5, 23, 149.74, 3444.05, NULL, 'inactive', 26),
(u_promo, '2026-05-04', '10% - Early booker 20.12', 10.0, '2025-01-10'::date, '2025-08-06'::date, 'Aug 5, 2025 - Sep 19, 2025', 54, 165, 143.34, 23651.14, 70, 'inactive', 27),
(u_promo, '2026-05-04', 'Stay 4 Pay 3', 25.0, '2025-03-04'::date, '2025-05-27'::date, 'Apr 1, 2025 - Sep 30, 2025', NULL, NULL, NULL, NULL, NULL, 'inactive', 28),
(u_promo, '2026-05-04', 'Last Minute Deal explorer', 15.0, '2025-09-21'::date, '2025-09-28'::date, 'Oct 2, 2025 - Oct 16, 2025', NULL, NULL, NULL, NULL, NULL, 'inactive', 29),
(u_promo, '2026-05-04', 'Last Minute Super  Deal', 20.0, '2025-09-21'::date, '2025-10-02'::date, 'Sep 26, 2025 - Oct 2, 2025', NULL, NULL, NULL, NULL, NULL, 'inactive', 30),
(u_promo, '2026-05-04', 'Last Minute Deal', 8.0, '2025-08-01'::date, '2025-11-09'::date, 'Sep 8, 2025 - Nov 30, 2025 Excluding 19 dates', 9, 12, 129.16, 1549.95, 1, 'inactive', 31),
(u_promo, '2026-05-04', 'Last Minute Deal 44D - Jan- Mar', 10.0, '2025-12-02'::date, '2026-03-10'::date, 'Jan 5, 2026 - Mar 31, 2026', 9, 30, 182.92, 5487.69, NULL, 'inactive', 32),
(u_promo, '2026-05-04', 'Limited Time Deal - only 2 days- 13-14 Apr', 30.0, '2026-04-13'::date, '2026-04-14'::date, 'Apr 12, 2026 - Apr 30, 2026', NULL, NULL, NULL, NULL, NULL, 'inactive', 33),
(u_promo, '2026-05-04', '40% - Limited-Time Deal - Sep 12, 2025', 40.0, '2025-09-18'::date, '2025-09-19'::date, 'Sep 20, 2025 - Nov 15, 2025', 1, 3, 131.87, 395.62, NULL, 'inactive', 34),
(u_promo, '2026-05-04', '35% - Limited-Time Deal - Aug 30, 2025', 35.0, '2025-08-31'::date, '2025-09-01'::date, 'Sep 1, 2025 - Sep 19, 2025', NULL, NULL, NULL, NULL, NULL, 'inactive', 35),
(u_promo, '2026-05-04', '30% - Limited-time Deal - 2 Oct 2025', 30.0, '2025-10-04'::date, '2025-10-05'::date, 'Oct 6, 2025 - Nov 9, 2025 Excluding 12 dates', NULL, NULL, NULL, NULL, NULL, 'inactive', 36),
(u_promo, '2026-05-04', 'Early Year Deal (3rd)', 20.0, '2025-12-06'::date, '2026-04-01'::date, 'Jan 1, 2026 - Apr 1, 2026', 14, 20, 132.15, 2642.96, 4, 'inactive', 37),
(u_promo, '2026-05-04', 'Early Year Deal', 20.0, '2025-12-06'::date, '2026-04-01'::date, 'Jan 1, 2026 - Apr 1, 2026', 53, 164, 214.57, 35190.16, 54, 'inactive', 38),
(u_promo, '2026-05-04', 'Early Year Deal', 15.0, '2025-12-06'::date, '2026-04-01'::date, 'Jan 1, 2026 - Apr 1, 2026', NULL, NULL, NULL, NULL, NULL, 'inactive', 39),
(u_promo, '2026-05-04', 'Early Year Deal', 20.0, '2025-12-06'::date, '2026-04-01'::date, 'Jan 1, 2026 - Apr 1, 2026', 49, 154, 179.36, 27621.88, 36, 'inactive', 40),
(u_promo, '2026-05-04', 'Early Year Deal', 15.0, '2025-12-06'::date, '2026-04-01'::date, 'Jan 1, 2026 - Apr 1, 2026', 1, 5, 116.33, 581.64, NULL, 'inactive', 41),
(u_promo, '2026-05-04', 'Getaway Deal', 25.0, '2025-03-13'::date, '2025-09-30'::date, 'Sep 1, 2025 - Sep 30, 2025', 2, 2, 91.51, 183.02, NULL, 'inactive', 42),
(u_promo, '2026-05-04', 'Getaway Deal (2nd)', 20.0, '2026-03-12'::date, '2026-09-30'::date, 'Mar 26, 2026 - Sep 30, 2026', 14, 46, 157.84, 7260.84, 13, 'inactive', 43),
(u_promo, '2026-05-04', 'Getaway Deal', 20.0, '2025-03-13'::date, '2025-09-30'::date, 'Jun 1, 2025 - Jul 31, 2025', 1, 2, 67.32, 134.64, NULL, 'inactive', 44),
(u_promo, '2026-05-04', 'Getaway Deal', 20.0, '2026-03-12'::date, '2026-09-30'::date, 'Mar 26, 2026 - Sep 30, 2026', 2, 9, 125.6, 1130.4, 9, 'inactive', 45),
(u_promo, '2026-05-04', 'Getaway Deal', 20.0, '2025-03-13'::date, '2025-09-30'::date, 'May 1, 2025 - May 24, 2025 Excluding 3 dates', NULL, NULL, NULL, NULL, NULL, 'inactive', 46),
(u_promo, '2026-05-04', 'Getaway Deal (2nd)_Value add', 20.0, '2026-03-12'::date, '2026-09-30'::date, 'Mar 26, 2026 - Sep 30, 2026', NULL, NULL, NULL, NULL, NULL, 'inactive', 47),
(u_promo, '2026-05-04', 'Late Escape Deal', 15.0, '2025-09-04'::date, '2026-01-07'::date, 'Oct 1, 2025 - Jan 7, 2026 Excluding 32 dates', 3, 4, 142.67, 570.68, 4, 'inactive', 48);
END $$;