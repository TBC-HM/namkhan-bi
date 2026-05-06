-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503154805
-- Name:    populate_booking_urls_local_compset
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Populate Booking.com URLs + direct booking URLs for all properties in Local — manual set
-- Uses property_name match so it updates self-row + comp rows in any set the property appears in.

-- 1. The Namkhan (self)
UPDATE revenue.competitor_property
SET 
  bdc_url = 'https://www.booking.com/hotel/la/namkhan-ecolodge.html',
  direct_url = 'https://thenamkhan.com/',
  notes = COALESCE(notes, '') || ' | URLs populated 2026-05-03'
WHERE property_name = 'The Namkhan';

-- 2. Maison Dalabua
UPDATE revenue.competitor_property
SET 
  bdc_url = 'https://www.booking.com/hotel/la/maison-dalabua.html',
  direct_url = 'https://www.maisondalabua.com/en/',
  notes = COALESCE(notes, '') || ' | URLs populated 2026-05-03'
WHERE property_name = 'Maison Dalabua';

-- 3. The Belle Rive
UPDATE revenue.competitor_property
SET 
  bdc_url = 'https://www.booking.com/hotel/la/the-belle-rive.html',
  direct_url = 'https://www.thebellerive.com/',
  notes = COALESCE(notes, '') || ' | URLs populated 2026-05-03'
WHERE property_name = 'The Belle Rive Boutique Hotel';

-- 4. Burasari Heritage
UPDATE revenue.competitor_property
SET 
  bdc_url = 'https://www.booking.com/hotel/la/burasari-heritage.html',
  direct_url = 'https://www.burasariheritage.com/',
  notes = COALESCE(notes, '') || ' | URLs populated 2026-05-03'
WHERE property_name = 'Burasari Heritage Luang Prabang';

-- 5. U Luang Prabang
UPDATE revenue.competitor_property
SET 
  bdc_url = 'https://www.booking.com/hotel/la/u-luang-prabang.html',
  direct_url = 'https://www.uhotelsresorts.com/uluangprabang',
  notes = COALESCE(notes, '') || ' | URLs populated 2026-05-03'
WHERE property_name = 'U Luang Prabang';

-- 6. 3 Nagas - MGallery (Accor)
UPDATE revenue.competitor_property
SET 
  bdc_url = 'https://www.booking.com/hotel/la/3-nagas-luang-prabang-by-accor.html',
  direct_url = 'https://all.accor.com/hotel/9641/index.en.shtml',
  notes = COALESCE(notes, '') || ' | URLs populated 2026-05-03 | Accor hotel ID 9641'
WHERE property_name = '3 Nagas Luang Prabang - MGallery';

-- 7. Homm Souvannaphoum (Banyan)
UPDATE revenue.competitor_property
SET 
  bdc_url = 'https://www.booking.com/hotel/la/maison-souvannaphoum.html',
  direct_url = 'https://www.hommhotels.com/hotels/homm-luang-prabang',
  notes = COALESCE(notes, '') || ' | URLs populated 2026-05-03 | BDC URL retains old Maison Souvannaphoum slug from rebrand'
WHERE property_name = 'Homm Souvannaphoum Luang Prabang';

-- 8. Satri House
UPDATE revenue.competitor_property
SET 
  bdc_url = 'https://www.booking.com/hotel/la/satri-house.html',
  direct_url = 'https://satrihouse.com/',
  notes = COALESCE(notes, '') || ' | URLs populated 2026-05-03'
WHERE property_name = 'Satri House';

-- 9. Sofitel Luang Prabang (Accor)
UPDATE revenue.competitor_property
SET 
  bdc_url = 'https://www.booking.com/hotel/la/sofitel-luang-prabang.html',
  direct_url = 'https://www.sofitel-luangprabang.com/',
  notes = COALESCE(notes, '') || ' | URLs populated 2026-05-03 | Accor hotel ID 9669'
WHERE property_name = 'Sofitel Luang Prabang';

-- 10. The Luang Say Residence
UPDATE revenue.competitor_property
SET 
  bdc_url = 'https://www.booking.com/hotel/la/the-luang-say-residence.html',
  direct_url = 'https://www.luangsayresidence.la/',
  notes = COALESCE(notes, '') || ' | URLs populated 2026-05-03 | SLH-affiliated'
WHERE property_name = 'The Luang Say Residence';

-- 11. The Grand Luang Prabang (Meliá)
UPDATE revenue.competitor_property
SET 
  bdc_url = 'https://www.booking.com/hotel/la/the-grand-luang-prabang.html',
  direct_url = 'https://www.melia.com/en/hotels/laos/luang-prabang/the-grand-luang-prabang-affiliated-by-melia',
  notes = COALESCE(notes, '') || ' | URLs populated 2026-05-03 | Meliá brand'
WHERE property_name = 'The Grand Luang Prabang Affiliated by Meliá';
