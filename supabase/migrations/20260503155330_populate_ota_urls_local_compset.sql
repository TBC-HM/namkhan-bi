-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503155330
-- Name:    populate_ota_urls_local_compset
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Populate Expedia, Agoda, and Trip.com URLs for the 11 properties in Local — manual set
-- All URLs verified via web search 2026-05-03

-- 1. The Namkhan (self) — SLH version preferred (id 113620175), legacy ecolodge ID 48038857 deprecated
UPDATE revenue.competitor_property
SET 
  agoda_url = 'https://www.agoda.com/namkhan-ecolodge/hotel/luang-prabang-la.html',
  expedia_url = 'https://www.expedia.com/Luang-Prabang-Hotels-NamKhan-Ecolodge.h39493734.Hotel-Information',
  trip_url = 'https://www.trip.com/hotels/luang-prabang-hotel-detail-113620175/the-namkhana-small-luxury-hotel-of-the-world/',
  agoda_property_id = '9805294',
  trip_property_id = '113620175',
  notes = COALESCE(notes, '') || ' | OTA URLs populated 2026-05-03 (SLH trip.com listing preferred over legacy ecolodge id 48038857)'
WHERE property_name = 'The Namkhan';

-- 2. Maison Dalabua
UPDATE revenue.competitor_property
SET 
  agoda_url = 'https://www.agoda.com/maison-dalabua-luangprabang-hotel/hotel/luang-prabang-la.html',
  expedia_url = 'https://www.expedia.com/Luang-Prabang-Hotels-Maison-Dalabua.h8797997.Hotel-Information',
  trip_url = 'https://www.trip.com/hotels/luang-prabang-hotel-detail-754002/maison-dalabua/',
  trip_property_id = '754002',
  notes = COALESCE(notes, '') || ' | OTA URLs populated 2026-05-03'
WHERE property_name = 'Maison Dalabua';

-- 3. The Belle Rive
UPDATE revenue.competitor_property
SET 
  agoda_url = 'https://www.agoda.com/the-belle-rive-boutique-hotel/hotel/luang-prabang-la.html',
  expedia_url = 'https://www.expedia.com/Luang-Prabang-Hotels-The-Belle-Rive-Boutique-Hotel.h15909434.Hotel-Information',
  trip_url = 'https://www.trip.com/hotels/luang-prabang-hotel-detail-754143/the-belle-rive-boutique-hotel/',
  trip_property_id = '754143',
  notes = COALESCE(notes, '') || ' | OTA URLs populated 2026-05-03'
WHERE property_name = 'The Belle Rive Boutique Hotel';

-- 4. Burasari Heritage
UPDATE revenue.competitor_property
SET 
  agoda_url = 'https://www.agoda.com/burasari-heritage-luang-prabang/hotel/luang-prabang-la.html',
  expedia_url = 'https://www.expedia.com/Luang-Prabang-Hotels-Burasari-Heritage-Luang-Prabang.h5478271.Hotel-Information',
  trip_url = 'https://www.trip.com/hotels/luang-prabang-hotel-detail-2024865/burasari-heritage-luang-prabang/',
  trip_property_id = '2024865',
  notes = COALESCE(notes, '') || ' | OTA URLs populated 2026-05-03'
WHERE property_name = 'Burasari Heritage Luang Prabang';

-- 5. U Luang Prabang
UPDATE revenue.competitor_property
SET 
  agoda_url = 'https://www.agoda.com/u-luang-prabang/hotel/luang-prabang-la.html',
  trip_url = 'https://www.trip.com/hotels/luang-prabang-hotel-detail-123835934/u-luang-prabang/',
  trip_property_id = '123835934',
  notes = COALESCE(notes, '') || ' | OTA URLs populated 2026-05-03 | Expedia listing not yet found - hotel opened late 2024'
WHERE property_name = 'U Luang Prabang';

-- 6. 3 Nagas Luang Prabang - MGallery
UPDATE revenue.competitor_property
SET 
  agoda_url = 'https://www.agoda.com/3-nagas-luang-prabang-mgallery-by-sofitel/hotel/luang-prabang-la.html',
  trip_url = 'https://www.trip.com/hotels/luang-prabang-hotel-detail-753894/3-nagas-hotel-luang-prabang-mgallery-collection/',
  trip_property_id = '753894',
  notes = COALESCE(notes, '') || ' | OTA URLs populated 2026-05-03 | Agoda slug retains legacy "by-sofitel" branding'
WHERE property_name = '3 Nagas Luang Prabang - MGallery';

-- 7. Homm Souvannaphoum (Banyan)
UPDATE revenue.competitor_property
SET 
  agoda_url = 'https://www.agoda.com/homm-souvannaphoum-luang-prabang-part-of-banyan-group-h65277/hotel/luang-prabang-la.html',
  expedia_url = 'https://www.expedia.com/Luang-Prabang-Hotels-Homm-Souvannaphoum-Luang-Prabang.h1151776.Hotel-Information',
  trip_url = 'https://www.trip.com/hotels/luang-prabang-hotel-detail-984592/homm-souvannaphoum-luang-prabang-part-of-banyan-group/',
  agoda_property_id = '65277',
  trip_property_id = '984592',
  notes = COALESCE(notes, '') || ' | OTA URLs populated 2026-05-03 | Hotels.com slug still "angsana-maison-souvannaphoum" - OTA rebrand incomplete'
WHERE property_name = 'Homm Souvannaphoum Luang Prabang';

-- 8. Satri House
UPDATE revenue.competitor_property
SET 
  agoda_url = 'https://www.agoda.com/satri-house-secret-retreats/hotel/luang-prabang-la.html',
  expedia_url = 'https://www.expedia.com/Luang-Prabang-Hotels-Satri-House.h3978019.Hotel-Information',
  trip_url = 'https://www.trip.com/hotels/luang-prabang-hotel-detail-753875/satri-house-secret-retreats/',
  trip_property_id = '753875',
  notes = COALESCE(notes, '') || ' | OTA URLs populated 2026-05-03'
WHERE property_name = 'Satri House';

-- 9. Sofitel Luang Prabang
UPDATE revenue.competitor_property
SET 
  agoda_url = 'https://www.agoda.com/sofitel-luang-prabang/hotel/luang-prabang-la.html',
  trip_url = 'https://www.trip.com/hotels/luang-prabang-hotel-detail-1521185/sofitel-luang-prabang/',
  trip_property_id = '1521185',
  notes = COALESCE(notes, '') || ' | OTA URLs populated 2026-05-03 | Expedia listing TBD'
WHERE property_name = 'Sofitel Luang Prabang';

-- 10. The Luang Say Residence
UPDATE revenue.competitor_property
SET 
  agoda_url = 'https://www.agoda.com/the-luang-say-residence-h79056568/hotel/luang-prabang-la.html',
  expedia_url = 'https://www.expedia.com/Luang-Prabang-Hotels-The-Luang-Say-Residence.h4326953.Hotel-Information',
  trip_url = 'https://www.trip.com/hotels/luang-prabang-hotel-detail-753909/the-luang-say-residence/',
  agoda_property_id = '79056568',
  trip_property_id = '753909',
  notes = COALESCE(notes, '') || ' | OTA URLs populated 2026-05-03 | SLH-affiliated'
WHERE property_name = 'The Luang Say Residence';

-- 11. The Grand Luang Prabang Affiliated by Meliá
UPDATE revenue.competitor_property
SET 
  agoda_url = 'https://www.agoda.com/the-grand-luang-prabang-affiliated-by-melia-h80221721/hotel/luang-prabang-la.html',
  expedia_url = 'https://www.expedia.com/Luang-Prabang-Hotels-The-Grand-Luang-Prabang.h1717162.Hotel-Information',
  trip_url = 'https://www.trip.com/hotels/luang-prabang-hotel-detail-753905/the-grand-luang-prabang-affiliated-by-meli/',
  agoda_property_id = '80221721',
  trip_property_id = '753905',
  notes = COALESCE(notes, '') || ' | OTA URLs populated 2026-05-03 | Meliá brand'
WHERE property_name = 'The Grand Luang Prabang Affiliated by Meliá';
