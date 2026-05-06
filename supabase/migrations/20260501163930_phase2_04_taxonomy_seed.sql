-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501163930
-- Name:    phase2_04_taxonomy_seed
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =============================================================================
-- TAXONOMY SEED — Namkhan-specific controlled vocabulary
-- 12 categories · 218 tags · hand-curated 2026-05-01
-- =============================================================================

-- ---------- SUBJECT (45) ----------
INSERT INTO marketing.media_taxonomy (tag_slug, tag_label, category, synonyms) VALUES
('river_namkhan',       'Nam Khan river',         'subject', ARRAY['nam_khan','khan_river','namkhan']),
('river_mekong',         'Mekong river',           'subject', ARRAY['mae_khong','mekong']),
('river_confluence',     'River confluence',       'subject', ARRAY['two_rivers','river_meeting']),
('mountains',            'Mountains',              'subject', ARRAY['hills','peaks','mountain_range']),
('jungle',               'Jungle',                 'subject', ARRAY['forest','tropical_forest','rainforest']),
('rice_paddy',           'Rice paddy',             'subject', ARRAY['rice_field','paddy','rice_terrace']),
('bamboo',               'Bamboo',                 'subject', ARRAY['bamboo_grove','bamboo_forest']),
('lotus',                'Lotus flower',           'subject', ARRAY['lotus_pond','water_lily']),
('frangipani',           'Frangipani',             'subject', ARRAY['plumeria','dok_champa']),
('orchid',               'Orchid',                 'subject', ARRAY['wild_orchid']),
('palm_tree',            'Palm tree',              'subject', ARRAY['coconut_palm','palms']),
('garden_path',          'Garden path',            'subject', ARRAY['stone_path','walkway']),
('infinity_pool',        'Infinity pool',          'subject', ARRAY['pool','swimming_pool','horizon_pool']),
('hammock',              'Hammock',                'subject', ARRAY['hanging_chair']),
('daybed',               'Daybed',                 'subject', ARRAY['lounge_bed','sun_bed']),
('terrace',              'Terrace',                'subject', ARRAY['private_terrace','deck']),
('balcony',              'Balcony',                'subject', ARRAY['private_balcony']),
('outdoor_bath',         'Outdoor bath',           'subject', ARRAY['soaking_tub','copper_bath','tub']),
('canopy_bed',           'Canopy bed',             'subject', ARRAY['four_poster','draped_bed']),
('mosquito_net',         'Mosquito net',           'subject', ARRAY['bed_drape']),
('candle',               'Candle',                 'subject', ARRAY['candles','candlelight']),
('lantern',              'Lantern',                'subject', ARRAY['paper_lantern','hanging_lantern']),
('longboat',             'Long-tail boat',         'subject', ARRAY['longtail','river_boat','wooden_boat']),
('bicycle',              'Bicycle',                'subject', ARRAY['bike','vintage_bike']),
('tuk_tuk',              'Tuk-tuk',                'subject', ARRAY['three_wheeler']),
('kayak',                'Kayak',                  'subject', ARRAY['kayaking_gear']),
('drone_aerial',         'Aerial drone shot',      'subject', ARRAY['birds_eye','top_down']),
('temple',               'Temple',                 'subject', ARRAY['wat','buddhist_temple','stupa']),
('buddha_statue',        'Buddha statue',          'subject', ARRAY['buddha','image_of_buddha']),
('saffron_robes',        'Saffron robes',          'subject', ARRAY['monks_robes','orange_robes']),
('lao_silk',             'Lao silk weaving',       'subject', ARRAY['silk_loom','handwoven_silk']),
('hand_weaving',         'Hand weaving',           'subject', ARRAY['loom','traditional_weaving']),
('riverbank',            'Riverbank',              'subject', ARRAY['riverside_edge','river_shore']),
('waterfall',            'Waterfall',              'subject', ARRAY['kuang_si','tat_kuang_si','cascade']),
('cave',                 'Cave',                   'subject', ARRAY['pak_ou','grotto']),
('night_market',         'Night market',           'subject', ARRAY['handicraft_market','luang_prabang_market']),
('mount_phousi',         'Mount Phousi',           'subject', ARRAY['phousi_hill','sunset_hill']),
('elephant',             'Elephant',               'subject', ARRAY['elephants','asian_elephant']),
('water_buffalo',        'Water buffalo',          'subject', ARRAY['buffalo']),
('bird',                 'Bird',                   'subject', ARRAY['birdlife','tropical_bird']),
('butterfly',            'Butterfly',              'subject', ARRAY['butterflies']),
('moss_stone',           'Moss-covered stone',     'subject', ARRAY['stone_texture','wet_stone']),
('teak_wood',            'Teak wood',              'subject', ARRAY['hardwood','wood_grain']),
('rattan',               'Rattan',                 'subject', ARRAY['cane_furniture','wicker']),
('linen_textile',        'Linen textile',          'subject', ARRAY['linen','natural_fabric']);

-- ---------- MOOD (15) ----------
INSERT INTO marketing.media_taxonomy (tag_slug, tag_label, category, synonyms) VALUES
('romantic',             'Romantic',               'mood', ARRAY['intimate','tender']),
('serene',               'Serene',                 'mood', ARRAY['calm','peaceful','tranquil']),
('contemplative',        'Contemplative',          'mood', ARRAY['reflective','meditative']),
('adventurous',          'Adventurous',            'mood', ARRAY['exploratory','active']),
('playful',              'Playful',                'mood', ARRAY['joyful','lighthearted']),
('festive',              'Festive',                'mood', ARRAY['celebratory','party']),
('moody',                'Moody',                  'mood', ARRAY['dramatic','brooding']),
('candlelit',            'Candlelit',              'mood', ARRAY['warm_glow','intimate_lighting']),
('golden',               'Golden glow',            'mood', ARRAY['warm_tones','honeyed']),
('lush',                 'Lush',                   'mood', ARRAY['verdant','overgrown']),
('refined',              'Refined',                'mood', ARRAY['elegant','understated']),
('barefoot_luxury',      'Barefoot luxury',        'mood', ARRAY['relaxed_luxury','laid_back_chic']),
('wild',                 'Wild',                   'mood', ARRAY['untamed','rugged']),
('quiet',                'Quiet',                  'mood', ARRAY['still','silent']),
('alive',                'Alive',                  'mood', ARRAY['vibrant','energetic']);

-- ---------- TIME OF DAY (9) ----------
INSERT INTO marketing.media_taxonomy (tag_slug, tag_label, category, synonyms) VALUES
('sunrise',              'Sunrise',                'time_of_day', ARRAY['dawn','daybreak','first_light']),
('golden_hour_morning',  'Morning golden hour',    'time_of_day', ARRAY['early_morning_light']),
('morning',              'Morning',                'time_of_day', ARRAY['am','breakfast_hour']),
('midday',               'Midday',                 'time_of_day', ARRAY['noon','high_sun']),
('afternoon',            'Afternoon',              'time_of_day', ARRAY['pm','late_day']),
('golden_hour_evening',  'Evening golden hour',    'time_of_day', ARRAY['magic_hour','dusk_glow']),
('sunset',               'Sunset',                 'time_of_day', ARRAY['dusk','sundown']),
('blue_hour',            'Blue hour',              'time_of_day', ARRAY['twilight']),
('night',                'Night',                  'time_of_day', ARRAY['nighttime','after_dark']);

-- ---------- SEASON (4) ----------
INSERT INTO marketing.media_taxonomy (tag_slug, tag_label, category, synonyms) VALUES
('dry_season',           'Dry season',             'season', ARRAY['cool_dry','november_to_february']),
('hot_season',            'Hot season',            'season', ARRAY['hot_dry','march_to_may']),
('wet_season',            'Wet season',            'season', ARRAY['monsoon_season','june_to_october']),
('shoulder_season',       'Shoulder season',       'season', ARRAY['transition']);

-- ---------- WEATHER (7) ----------
INSERT INTO marketing.media_taxonomy (tag_slug, tag_label, category, synonyms) VALUES
('clear_sky',            'Clear sky',              'weather', ARRAY['blue_sky','cloudless']),
('dramatic_sky',         'Dramatic sky',           'weather', ARRAY['stormy_sky','epic_clouds']),
('mist',                 'Mist',                   'weather', ARRAY['morning_mist','river_mist']),
('fog',                  'Fog',                    'weather', ARRAY['heavy_fog']),
('rain',                 'Rain',                   'weather', ARRAY['monsoon_rain','rainfall']),
('rainbow',              'Rainbow',                'weather', ARRAY['arc_of_light']),
('overcast',             'Overcast',               'weather', ARRAY['cloudy','grey_skies']);

-- ---------- ROOM_TYPE (10) — match public.room_types ----------
INSERT INTO marketing.media_taxonomy (tag_slug, tag_label, category, synonyms) VALUES
('art_deluxe_family_room',          'Art Deluxe Family Room',     'room_type', ARRAY['adf','family_room']),
('art_deluxe_room',                 'Art Deluxe Room',            'room_type', ARRAY['adr','art_deluxe']),
('art_deluxe_suite',                'Art Deluxe Suite',           'room_type', ARRAY['ads']),
('explorer_glamping',               'Explorer Glamping',          'room_type', ARRAY['exg','explorer_tent']),
('riverfront_glamping',             'Riverfront Glamping',        'room_type', ARRAY['rfg','riverfront_tent']),
('riverfront_suite',                'Riverfront Suite',           'room_type', ARRAY['rfs']),
('riverview_suite',                 'Riverview Suite',            'room_type', ARRAY['rvs']),
('sunset_luang_prabang_villa',      'Sunset Luang Prabang Villa', 'room_type', ARRAY['sv9','lp_villa']),
('sunset_namkhan_river_villa',      'Sunset Namkhan River Villa', 'room_type', ARRAY['sv8','namkhan_villa']),
('namkhan_glamping_tent',           'The Namkhan Glamping Tent',  'room_type', ARRAY['nkt']);

-- ---------- PROPERTY_AREA (14) ----------
INSERT INTO marketing.media_taxonomy (tag_slug, tag_label, category, synonyms) VALUES
('riverside',            'Riverside',              'property_area', ARRAY['riverbank','river_view']),
('pool_area',            'Pool area',              'property_area', ARRAY['poolside','infinity_pool_deck']),
('roots_restaurant',     'Roots restaurant',       'property_area', ARRAY['roots','main_restaurant','dining_room']),
('spa_jungle',           'Spa jungle pavilion',    'property_area', ARRAY['spa','wellness_pavilion','treatment_room']),
('lobby_reception',      'Lobby & reception',      'property_area', ARRAY['arrival','front_desk','reception']),
('garden',               'Garden',                 'property_area', ARRAY['gardens','tropical_garden']),
('organic_farm',         'Organic farm',           'property_area', ARRAY['kitchen_garden','farm','herb_garden']),
('bicycle_workshop',     'Bicycle workshop',       'property_area', ARRAY['bike_shed']),
('tuk_tuk_lounge',       'Tuk-tuk lounge',         'property_area', ARRAY['arrival_lounge']),
('river_dock',           'River dock',             'property_area', ARRAY['boat_dock','jetty']),
('exterior_facade',      'Exterior facade',        'property_area', ARRAY['building_exterior','entrance']),
('staff_areas',          'Staff areas',            'property_area', ARRAY['back_of_house','heart_of_house']),
('library',              'Library',                'property_area', ARRAY['reading_room']),
('rooftop',              'Rooftop',                'property_area', ARRAY['terrace_view']);

-- ---------- ACTIVITY (38) ----------
INSERT INTO marketing.media_taxonomy (tag_slug, tag_label, category, synonyms) VALUES
('kayaking',             'Kayaking',               'activity', ARRAY['paddling']),
('river_tubing',         'River tubing',           'activity', ARRAY['tubing']),
('sup_paddleboarding',   'SUP paddleboarding',     'activity', ARRAY['stand_up_paddle']),
('candle_making',        'Candle making workshop', 'activity', ARRAY['beeswax_candle','candle_workshop']),
('weaving_workshop',     'Weaving workshop',       'activity', ARRAY['silk_weaving','loom_workshop']),
('lao_cooking_class',    'Lao cooking class',      'activity', ARRAY['cooking_class','culinary_workshop']),
('alms_giving',          'Alms giving',            'activity', ARRAY['tak_bat','dawn_alms']),
('monk_chat',            'Monk chat',              'activity', ARRAY['monk_conversation']),
('kuang_si_visit',       'Kuang Si waterfall visit','activity', ARRAY['waterfall_excursion','tat_kuang_si']),
('pak_ou_caves',         'Pak Ou caves excursion', 'activity', ARRAY['cave_visit']),
('night_market_visit',   'Night market visit',     'activity', ARRAY['market_walk']),
('mount_phousi_climb',   'Mount Phousi climb',     'activity', ARRAY['phousi_sunset','sunset_climb']),
('elephant_sanctuary',   'Elephant sanctuary',     'activity', ARRAY['elephant_visit','mandalao']),
('mountain_biking',      'Mountain biking',        'activity', ARRAY['mtb','off_road_cycling']),
('hiking',               'Hiking',                 'activity', ARRAY['trekking','jungle_walk']),
('village_walk',         'Village walk',           'activity', ARRAY['rural_walk','homestay_visit']),
('sunset_cruise',        'Sunset river cruise',    'activity', ARRAY['boat_cruise','mekong_cruise']),
('picnic',               'Picnic setup',           'activity', ARRAY['riverside_picnic','bush_picnic']),
('yoga',                 'Yoga',                   'activity', ARRAY['yoga_class','asana']),
('meditation',           'Meditation',             'activity', ARRAY['silent_sitting','mindfulness']),
('sound_bath',           'Sound bath',             'activity', ARRAY['singing_bowls']),
('spa_massage',          'Spa massage',            'activity', ARRAY['massage_treatment','body_massage']),
('herbal_steam',         'Herbal steam',           'activity', ARRAY['steam_bath','herbal_sauna']),
('spa_facial',           'Facial treatment',       'activity', ARRAY['facial']),
('couples_treatment',    'Couples spa treatment',  'activity', ARRAY['side_by_side_spa']),
('flower_arranging',     'Flower arranging',       'activity', ARRAY['ikebana','floral_workshop']),
('rice_planting',        'Rice planting',          'activity', ARRAY['paddy_planting']),
('baci_ceremony',        'Baci ceremony',          'activity', ARRAY['sou_khouan','string_blessing']),
('private_dining',       'Private dining setup',   'activity', ARRAY['romantic_dinner','exclusive_dining']),
('riverside_breakfast',  'Riverside breakfast',    'activity', ARRAY['breakfast_by_the_river']),
('storytelling_dinner',  'Storytelling dinner',    'activity', ARRAY['hosted_dinner']),
('photography_walk',     'Photography walk',       'activity', ARRAY['photo_tour']),
('fishing',              'Fishing',                'activity', ARRAY['river_fishing']),
('birdwatching',         'Birdwatching',           'activity', ARRAY['bird_safari']),
('ox_cart_ride',         'Ox cart ride',           'activity', ARRAY['village_ox_cart']),
('temple_tour',          'Temple tour',            'activity', ARRAY['wat_visit']),
('night_safari',         'Night nature walk',      'activity', ARRAY['night_walk']),
('helicopter_transfer',  'Helicopter transfer',    'activity', ARRAY['heli_arrival']);

-- ---------- FOOD_BEVERAGE (28) ----------
INSERT INTO marketing.media_taxonomy (tag_slug, tag_label, category, synonyms) VALUES
('lao_breakfast',        'Lao breakfast',          'food_beverage', ARRAY['traditional_breakfast']),
('continental_breakfast','Continental breakfast',  'food_beverage', ARRAY['western_breakfast']),
('breakfast_basket',     'In-villa breakfast basket','food_beverage', ARRAY['breakfast_in_room']),
('set_menu',             'Set menu',               'food_beverage', ARRAY['table_dhote']),
('tasting_menu',         'Tasting menu',           'food_beverage', ARRAY['degustation','chefs_menu']),
('a_la_carte',           'A la carte',             'food_beverage', ARRAY['menu_dining']),
('signature_cocktail',   'Signature cocktail',     'food_beverage', ARRAY['house_cocktail','craft_cocktail']),
('lao_lao',              'Lao lao spirit',         'food_beverage', ARRAY['rice_whisky','lao_lao']),
('local_beer',           'Local beer',             'food_beverage', ARRAY['beerlao']),
('coffee_pour',          'Lao coffee',             'food_beverage', ARRAY['arabica','bolaven_coffee','french_drip']),
('tea_service',          'Tea service',            'food_beverage', ARRAY['herbal_tea','tea_pot']),
('sticky_rice',          'Sticky rice',            'food_beverage', ARRAY['khao_niao','glutinous_rice']),
('larb',                 'Larb',                   'food_beverage', ARRAY['laab','larp','lao_salad']),
('mok_pa',               'Mok pa fish',            'food_beverage', ARRAY['steamed_fish','banana_leaf_fish']),
('jeow_bong',            'Jeow bong relish',       'food_beverage', ARRAY['lao_chili_paste']),
('kao_soi',              'Khao soi noodle',        'food_beverage', ARRAY['lao_kao_soi']),
('grilled_river_fish',   'Grilled river fish',     'food_beverage', ARRAY['ping_pa']),
('garden_vegetables',    'Garden vegetables',      'food_beverage', ARRAY['organic_veg','farm_to_table']),
('charcuterie',          'Charcuterie board',      'food_beverage', ARRAY['cheese_board']),
('cocktail_pairing',     'Cocktail pairing',       'food_beverage', ARRAY['drinks_pairing']),
('wine_pairing',         'Wine pairing',           'food_beverage', ARRAY['wine_flight']),
('candlelit_dinner',     'Candlelit dinner',       'food_beverage', ARRAY['romantic_dinner']),
('riverside_dining',     'Riverside dining',       'food_beverage', ARRAY['by_the_river_dinner']),
('bbq_grill',            'BBQ grill',              'food_beverage', ARRAY['grill','barbecue']),
('food_flatlay',         'Food flatlay',           'food_beverage', ARRAY['top_down_food']),
('plated_dish',          'Plated dish',            'food_beverage', ARRAY['fine_dining_plate']),
('dessert',              'Dessert',                'food_beverage', ARRAY['sweet','pastry']),
('fresh_fruit',          'Tropical fresh fruit',   'food_beverage', ARRAY['mango','dragonfruit','papaya']);

-- ---------- PEOPLE (11) ----------
INSERT INTO marketing.media_taxonomy (tag_slug, tag_label, category, synonyms) VALUES
('couple',               'Couple',                 'people', ARRAY['two_guests','romantic_couple']),
('family',               'Family',                 'people', ARRAY['family_guests','parents_with_children']),
('solo_traveller',       'Solo traveller',         'people', ARRAY['single_guest','lone_traveller']),
('group_friends',        'Group of friends',       'people', ARRAY['friend_group','small_group']),
('honeymoon',            'Honeymoon',              'people', ARRAY['newlyweds']),
('wedding',              'Wedding',                'people', ARRAY['bridal_couple','wedding_party']),
('child',                'Child',                  'people', ARRAY['children','kid']),
('no_people',            'No people in shot',      'people', ARRAY['empty_scene','unpopulated']),
('staff_in_uniform',     'Staff member in uniform','people', ARRAY['team_member','butler']),
('local_artisan',        'Local artisan',          'people', ARRAY['craftsperson','weaver']),
('guest_anonymous',      'Anonymous guest',        'people', ARRAY['guest_no_face','consent_unknown']);

-- ---------- STYLE (10) ----------
INSERT INTO marketing.media_taxonomy (tag_slug, tag_label, category, synonyms) VALUES
('lifestyle',            'Lifestyle',              'style', ARRAY['lifestyle_shoot']),
('editorial',            'Editorial',              'style', ARRAY['magazine_style']),
('documentary',          'Documentary',            'style', ARRAY['reportage','candid']),
('flatlay',              'Flatlay',                'style', ARRAY['overhead','top_down']),
('drone_aerial_style',   'Drone / aerial style',   'style', ARRAY['birds_eye_style']),
('detail_shot',          'Detail shot',            'style', ARRAY['macro','close_up']),
('wide_environmental',   'Wide environmental',     'style', ARRAY['wide_shot','establishing_shot']),
('portrait_style',       'Portrait style',         'style', ARRAY['portraiture']),
('action_shot',          'Action shot',            'style', ARRAY['movement','dynamic']),
('slow_motion',          'Slow motion',            'style', ARRAY['slow_mo']);

-- ---------- EVENT (7) ----------
INSERT INTO marketing.media_taxonomy (tag_slug, tag_label, category, synonyms) VALUES
('pi_mai_lao',           'Pi Mai Lao (New Year)',  'event', ARRAY['lao_new_year','songkran']),
('boun_ok_phansa',       'Boun Ok Phansa',         'event', ARRAY['festival_of_lights','end_of_lent']),
('that_luang',           'That Luang festival',    'event', ARRAY['vientiane_festival']),
('christmas',            'Christmas',              'event', ARRAY['xmas','holiday_season']),
('new_year_eve',         'New Year''s Eve',        'event', ARRAY['nye','western_new_year']),
('private_event',        'Private event',          'event', ARRAY['exclusive_event','buyout']),
('photo_shoot',          'Brand photo shoot',      'event', ARRAY['production_shoot']);
