-- db/proposed/budget-2026-v2/01_budget_2026_v2.sql
-- Namkhan (260955) FY2026 budget, rebuilt from a driver model with PBS 2026-09-06.
--
-- WHY: 'Budget 2026 v1' assumed $1.38M and was running -71% by April. It was also
-- imported wrong -- annual totals tied to the "26 NK" sheet but 11 of 12 monthly
-- phasings were replaced by hand-typed round numbers, and $143,842 of budgeted
-- operating cost never made it in.
--
-- DRIVERS (approved by PBS): rooms available -> occupancy % -> ADR -> ancillary per
-- occupied room. Capacity 24 rooms Jan-Jun, 30 from July (6 new tents).
--   occ%   50 62 31 30 27 18 19 15 22 45 50 55
--   ADR   215 205 175 185 160 170 170 165 165 230 240 250
--   aux/RN 2025 actual +5% Jan-Sep, +15% Oct-Dec. October 2025 normalised from
--          $147.60 to $90.00 -- 49% of that month's ancillary was one group
--          (reservation 5587990653891, $59,210), which must not set a baseline.
--
-- RESULT: 3,460 room nights, ADR $207, aux $87.77/RN.
--   net of tax & service   1,021,413
--   all-in (x1.2257)       1,251,946   <- the figure PBS approved
--
-- BASIS: plan.lines stores VAT-inclusive; finance.v_gl_budget_lines divides by
-- (1 + vat_rate/100) and Revenue carries 10%. Values below are net x 1.10 so the
-- P&L screen shows 1,021,413. The x1.2257 tax+service factor is NOT the same thing
-- as VAT and is deliberately not stored here.
--
-- Ancillary is split across accounts using the 'Actuals 2025' revenue mix.
-- Cost lines are copied unchanged from v1 -- costs were not part of this exercise
-- and still need their own pass (see README).

BEGIN;

INSERT INTO plan.scenarios
  (scenario_id, property_id, name, scenario_type, fiscal_year, status,
   parent_scenario_id, created_by, notes)
VALUES
  (gen_random_uuid(), 260955, 'Budget 2026 v2', 'budget', 2026, 'approved',
   (SELECT scenario_id FROM plan.scenarios WHERE name='Budget 2026 v1'),
   'PBS',
   'Driver-based rebuild approved 2026-09-06. Net 1,021,413 / all-in 1,251,946. '
   'Occupancy ask is +0.5pts vs REAL 2025 (34.6%, not the 31.7% the system shows -- '
   'rooms_available never recorded the 2025 flood closure). Growth is capacity +23% '
   'and ADR +23%, not occupancy. Supersedes v1; v1 retained for history.');

-- Revenue: 11 accounts x 12 months, stored VAT-inclusive.
INSERT INTO plan.lines (scenario_id, period_year, period_month, account_code, amount_usd)
SELECT s.scenario_id, 2026, v.mon, v.acct, v.amt
FROM plan.scenarios s
CROSS JOIN (VALUES
    ('708010', 1, 87978.0000),
    ('708020', 1, 13653.7978),
    ('708120', 1, 6338.5746),
    ('708040', 1, 3799.4875),
    ('708030', 1, 3144.5321),
    ('708070', 1, 2747.7026),
    ('708050', 1, 2505.1265),
    ('708090', 1, 2246.2543),
    ('708060', 1, 403.1738),
    ('708110', 1, 263.7237),
    ('708080', 1, 129.7471),
    ('708010', 2, 93952.3200),
    ('708020', 2, 13143.1679),
    ('708120', 2, 6101.5222),
    ('708040', 2, 3657.3928),
    ('708030', 2, 3026.9317),
    ('708070', 2, 2644.9430),
    ('708050', 2, 2411.4388),
    ('708090', 2, 2162.2480),
    ('708060', 2, 388.0958),
    ('708110', 2, 253.8609),
    ('708080', 2, 124.8948),
    ('708010', 3, 44398.2000),
    ('708020', 3, 7344.5063),
    ('708120', 3, 3409.5789),
    ('708040', 3, 2043.7801),
    ('708030', 3, 1691.4734),
    ('708070', 3, 1478.0151),
    ('708050', 3, 1347.5311),
    ('708090', 3, 1208.2813),
    ('708060', 3, 216.8710),
    ('708110', 3, 141.8595),
    ('708080', 3, 69.7922),
    ('708010', 4, 43956.0000),
    ('708020', 4, 8001.6749),
    ('708120', 4, 3714.6598),
    ('708040', 4, 2226.6525),
    ('708030', 4, 1842.8223),
    ('708070', 4, 1610.2643),
    ('708050', 4, 1468.1049),
    ('708090', 4, 1316.3954),
    ('708060', 4, 236.2761),
    ('708110', 4, 154.5527),
    ('708080', 4, 76.0370),
    ('708010', 5, 35354.8800),
    ('708020', 5, 4915.3672),
    ('708120', 5, 2281.8869),
    ('708040', 5, 1367.8155),
    ('708030', 5, 1132.0316),
    ('708070', 5, 989.1729),
    ('708050', 5, 901.8455),
    ('708090', 5, 808.6516),
    ('708060', 5, 145.1426),
    ('708110', 5, 94.9405),
    ('708080', 5, 46.7090),
    ('708010', 6, 24235.2000),
    ('708020', 6, 4729.1832),
    ('708120', 6, 2195.4537),
    ('708040', 6, 1316.0055),
    ('708030', 6, 1089.1525),
    ('708070', 6, 951.7051),
    ('708050', 6, 867.6855),
    ('708090', 6, 778.0215),
    ('708060', 6, 139.6449),
    ('708110', 6, 91.3444),
    ('708080', 6, 44.9397),
    ('708010', 7, 33042.9000),
    ('708020', 7, 4625.0059),
    ('708120', 7, 2147.0909),
    ('708040', 7, 1287.0157),
    ('708030', 7, 1065.1600),
    ('708070', 7, 930.7404),
    ('708050', 7, 848.5716),
    ('708090', 7, 760.8828),
    ('708060', 7, 136.5687),
    ('708110', 7, 89.3322),
    ('708080', 7, 43.9498),
    ('708010', 8, 25319.2500),
    ('708020', 8, 4133.0093),
    ('708120', 8, 1918.6887),
    ('708040', 8, 1150.1062),
    ('708030', 8, 951.8510),
    ('708070', 8, 831.7305),
    ('708050', 8, 758.3027),
    ('708090', 8, 679.9420),
    ('708060', 8, 122.0409),
    ('708110', 8, 79.8293),
    ('708080', 8, 39.2745),
    ('708010', 9, 35937.0000),
    ('708020', 9, 6026.5779),
    ('708120', 9, 2797.7501),
    ('708040', 9, 1677.0358),
    ('708030', 9, 1387.9485),
    ('708070', 9, 1212.7940),
    ('708050', 9, 1105.7246),
    ('708090', 9, 991.4624),
    ('708060', 9, 177.9548),
    ('708110', 9, 116.4036),
    ('708080', 9, 57.2684),
    ('708010', 10, 105880.5000),
    ('708020', 10, 18464.7396),
    ('708120', 10, 8571.9835),
    ('708040', 10, 5138.2442),
    ('708030', 10, 4252.5140),
    ('708070', 10, 3715.8608),
    ('708050', 10, 3387.8126),
    ('708090', 10, 3037.7263),
    ('708060', 10, 545.2329),
    ('708110', 10, 356.6473),
    ('708080', 10, 175.4637),
    ('708010', 11, 118800.0000),
    ('708020', 11, 20909.6319),
    ('708120', 11, 9706.9888),
    ('708040', 11, 5818.5924),
    ('708030', 11, 4815.5839),
    ('708070', 11, 4207.8731),
    ('708050', 11, 3836.3885),
    ('708090', 11, 3439.9477),
    ('708060', 11, 617.4265),
    ('708110', 11, 403.8705),
    ('708080', 11, 198.6967),
    ('708010', 12, 140662.5000),
    ('708020', 12, 23505.6234),
    ('708120', 12, 10912.1396),
    ('708040', 12, 6540.9876),
    ('708030', 12, 5413.4526),
    ('708070', 12, 4730.2928),
    ('708050', 12, 4312.6873),
    ('708090', 12, 3867.0272),
    ('708060', 12, 694.0818),
    ('708110', 12, 454.0122),
    ('708080', 12, 223.3654)
) AS v(acct, mon, amt)
WHERE s.name = 'Budget 2026 v2';

-- Costs: carried forward from v1 unchanged.
INSERT INTO plan.lines (scenario_id, period_year, period_month, account_code, amount_usd)
SELECT v2.scenario_id, l.period_year, l.period_month, l.account_code, l.amount_usd
FROM plan.lines l
JOIN plan.scenarios v1 ON v1.scenario_id = l.scenario_id AND v1.name = 'Budget 2026 v1'
JOIN finance.gl_accounts a ON a.account_id = l.account_code
CROSS JOIN (SELECT scenario_id FROM plan.scenarios WHERE name='Budget 2026 v2') v2
WHERE a.usali_subcategory IS DISTINCT FROM 'Revenue';

COMMIT;
