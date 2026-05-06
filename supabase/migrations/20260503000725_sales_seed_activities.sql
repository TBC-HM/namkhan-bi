-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503000725
-- Name:    sales_seed_activities
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

INSERT INTO sales.activity_categories (slug, name, glyph, sort_order) VALUES
  ('cultural',  'Cultural',     '*', 10),
  ('nature',    'Nature',       '*', 20),
  ('food',      'Food & drink', '*', 30),
  ('wellness',  'Wellness',     '*', 40),
  ('active',    'Active',       '*', 50),
  ('family',    'Family',       '*', 60),
  ('signature', 'Signature',    '*', 70)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sales.activity_partners (property_id, slug, name, partner_type, status) VALUES
  (260955, 'green-discovery', 'Green Discovery Laos',     'tour_operator', 'active'),
  (260955, 'mandalao',        'MandaLao Elephant Sanctuary', 'tour_operator', 'active'),
  (260955, 'white-elephant',  'White Elephant Adventures',   'guide',         'active'),
  (260955, 'ock-pop-tok',     'Ock Pop Tok',                 'tour_operator', 'active'),
  (260955, 'living-land',     'Living Land Farm',            'tour_operator', 'active'),
  (260955, 'motolao',         'MotoLao',                     'tour_operator', 'active'),
  (260955, 'uxo-laos',        'UXO Laos Visitor Centre',     'tour_operator', 'active')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sales.activity_catalog (property_id, kind, partner_id, category_id, slug, title, short_summary, duration_min, capacity_max, sell_lak, cost_lak, is_signature)
SELECT 260955, 'internal'::sales.activity_kind, NULL, c.id, v.slug, v.title, v.short_summary, v.duration_min, v.capacity_max, v.sell_lak, v.cost_lak, v.is_signature
FROM (VALUES
  ('signature', 'sunrise-mekong-cruise', 'Sunrise Mekong cruise',       '06:30 departure on the Namkhan boat, 2h on the river', 120,  8, 1200000::numeric, 250000::numeric, true),
  ('food',      'roots-tasting-menu',    'Tasting menu at The Roots',   '6-course Lao-French paired with local wines',          150, 24, 1635000::numeric, 450000::numeric, true),
  ('wellness',  'couples-massage-90',    '90-min couples massage',      'Spa pavilion, two therapists, herbal compress',         90,  2, 3050000::numeric, 600000::numeric, false),
  ('food',      'chef-vong-cooking',     'Cooking class with Chef Vong','Private kitchen, 4-dish Lao menu',                     240,  6, 2200000::numeric, 350000::numeric, false),
  ('food',      'sunset-bbq-deck',       'Sunset BBQ on the deck',      'Mekong-side BBQ with seasonal grills',                 180, 30, 1200000::numeric, 400000::numeric, false),
  ('cultural',  'almsgiving-namkhan',    'Almsgiving guided',           '05:30 walk to Tak Bat with monk-led briefing',          90, 12,  650000::numeric, 100000::numeric, false),
  ('active',    'bicycle-rental',        'Bicycle rental (per day)',    'Trek hybrid, helmet, paper map',                       480, 50,  300000::numeric,  60000::numeric, false),
  ('wellness',  'morning-yoga',          'Morning yoga on the deck',    '60min hatha, seasonal teacher',                         60, 12,  400000::numeric,  80000::numeric, false),
  ('food',      'breakfast-on-river',    'Breakfast on the river',      'Private floating breakfast, seasonal',                 120,  4, 1800000::numeric, 350000::numeric, false),
  ('cultural',  'lunar-meditation',      'Full Moon meditation',        'Twice monthly, river-side seated meditation',           90, 25,  500000::numeric,  60000::numeric, false),
  ('nature',    'garden-walk',           'Garden & herb walk',          'Property tour with the head gardener',                  60, 15,        0::numeric,      0::numeric, false),
  ('cultural',  'transfer-airport',      'Airport return transfer',     'Private SUV, one-way',                                  30,  4, 1300000::numeric, 200000::numeric, false)
) AS v(cat_slug, slug, title, short_summary, duration_min, capacity_max, sell_lak, cost_lak, is_signature)
JOIN sales.activity_categories c ON c.slug = v.cat_slug
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sales.activity_catalog (property_id, kind, partner_id, category_id, slug, title, short_summary, duration_min, capacity_max, sell_lak, cost_lak, is_signature)
SELECT 260955, 'external'::sales.activity_kind, p.id, c.id, v.slug, v.title, v.short_summary, v.duration_min, v.capacity_max, v.sell_lak, v.cost_lak, v.is_signature
FROM (VALUES
  ('green-discovery', 'signature', 'kuang-si-falls',         'Kuang Si Falls full day',        'Tiered turquoise pools, 30km, lunch incl.',     480, 16, 1750000::numeric, 850000::numeric, true),
  ('green-discovery', 'cultural',  'pak-ou-caves',           'Pak Ou caves boat trip',         'Half-day, Mekong cruise + cave shrines',        240, 14, 1200000::numeric, 600000::numeric, false),
  ('mandalao',        'signature', 'mandalao-elephants',     'MandaLao elephant sanctuary',    'Walk-with-elephants ethical experience',        300, 12, 2400000::numeric,1300000::numeric, true),
  ('white-elephant',  'cultural',  'phou-si-sunset',         'Phou Si sunset hike',            'Guided walk to summit + city overlook',         120, 20,  600000::numeric, 250000::numeric, false),
  ('white-elephant',  'cultural',  'wat-xieng-thong',        'Wat Xieng Thong tour',           'Royal monastery, 1h licensed guide',             60, 16,  500000::numeric, 200000::numeric, false),
  ('ock-pop-tok',     'cultural',  'weaving-ock-pop-tok',    'Ock Pop Tok weaving class',      'Half-day weaving + natural dye',                240, 10, 1400000::numeric, 700000::numeric, false),
  ('living-land',     'family',    'living-land-rice',       'Living Land rice farm',          'Hands-on rice farm, all-ages friendly',         360, 25, 1600000::numeric, 800000::numeric, false),
  ('white-elephant',  'cultural',  'royal-palace',           'Royal Palace Museum',            'Guided 1h, ticket included',                     60, 20,  450000::numeric, 180000::numeric, false),
  ('motolao',         'active',    'motolao-day',            'MotoLao countryside ride',       'Honda dual-sport, scenic backroads',            480,  4, 3500000::numeric,1700000::numeric, false),
  ('white-elephant',  'cultural',  'weaving-village-banpho', 'Ban Phanom weaving village',     'Half-day, traditional cotton weaving',          180, 12,  800000::numeric, 400000::numeric, false),
  ('white-elephant',  'cultural',  'whisky-village',         'Ban Xang Hai whisky village',    'Lao-Lao distillery + Mekong stop',              120, 16,  500000::numeric, 220000::numeric, false),
  ('green-discovery', 'active',    'kayak-namkhan',          'Kayak the Namkhan river',        'Half-day, grade I-II + lunch',                  240, 12, 1600000::numeric, 750000::numeric, false),
  ('green-discovery', 'nature',    'tat-sae-falls',          'Tat Sae waterfalls',             'Boat + falls, best in wet season',              300, 20, 1300000::numeric, 600000::numeric, false),
  ('uxo-laos',        'cultural',  'uxo-visitor-centre',     'UXO Laos visitor centre',        'Sobering 90min, donation-based',                 90, 30,  300000::numeric, 100000::numeric, false),
  ('white-elephant',  'cultural',  'night-market-guided',    'Night market with guide',        'Curated stalls, food tasting',                   90, 10,  500000::numeric, 200000::numeric, false),
  ('white-elephant',  'cultural',  'bamboo-bridge-sunset',   'Bamboo bridge sunset',           'Seasonal, dry months only',                      60, 15,  300000::numeric, 100000::numeric, false),
  ('green-discovery', 'active',    'mountain-bike-half',     'Mountain biking half-day',       'Trail riding, mid-difficulty',                  240,  8, 1800000::numeric, 850000::numeric, false),
  ('green-discovery', 'signature', 'coffee-trail-half',      'Coffee Trail half-day',          'Plantation tour + tasting, highland origin',    300, 12, 1430000::numeric, 650000::numeric, true)
) AS v(partner_slug, cat_slug, slug, title, short_summary, duration_min, capacity_max, sell_lak, cost_lak, is_signature)
JOIN sales.activity_partners p ON p.slug = v.partner_slug
JOIN sales.activity_categories c ON c.slug = v.cat_slug
ON CONFLICT (slug) DO NOTHING;