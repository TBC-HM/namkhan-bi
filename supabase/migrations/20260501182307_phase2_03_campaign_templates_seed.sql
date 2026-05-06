-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501182307
-- Name:    phase2_03_campaign_templates_seed
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Seed 17 channel templates (one per campaign_channel enum value).
-- Idempotent: uses UPSERT keyed on channel.

INSERT INTO marketing.campaign_templates
  (channel, name, aspect_ratio, output_width, output_height, min_assets, max_assets, caption_max_chars, hashtag_max, license_filter, logo_position)
VALUES
  ('instagram_post',       'Instagram · Single post',     '1:1',  1080, 1080, 1,  1,  2200, 12, ARRAY['social_organic','paid_ads'], 'bottom-right'),
  ('instagram_carousel',   'Instagram · Carousel',        '1:1',  1080, 1080, 2, 10,  2200, 12, ARRAY['social_organic','paid_ads'], 'bottom-right'),
  ('instagram_reel',       'Instagram · Reel',            '9:16', 1080, 1920, 1,  1,  2200, 12, ARRAY['social_organic','paid_ads'], 'bottom-right'),
  ('instagram_story',      'Instagram · Story',           '9:16', 1080, 1920, 1,  1,    0,  0, ARRAY['social_organic','paid_ads'], 'bottom-right'),
  ('facebook_post',        'Facebook · Post',             '1.91:1',1200,  630, 1,  1,   500,  6, ARRAY['social_organic','paid_ads'], 'bottom-right'),
  ('tiktok',               'TikTok · Vertical video',     '9:16', 1080, 1920, 1,  1,  2200, 10, ARRAY['social_organic','paid_ads'], 'bottom-right'),
  ('email_header',         'Email · Header banner',       '4:1',  1600,  400, 1,  1,     0,  0, ARRAY['email','direct'], 'none'),
  ('email_full',           'Email · Full newsletter',     '3:2',  1200,  800, 1,  6,     0,  0, ARRAY['email','direct'], 'bottom-right'),
  ('booking_com_gallery',  'Booking.com · Gallery refresh','3:2',  2048, 1365, 5, 50,     0,  0, ARRAY['ota'],          'none'),
  ('expedia_gallery',      'Expedia · Gallery refresh',   '3:2',  2048, 1365, 5, 50,     0,  0, ARRAY['ota'],          'none'),
  ('agoda_gallery',        'Agoda · Gallery refresh',     '3:2',  2048, 1365, 5, 50,     0,  0, ARRAY['ota'],          'none'),
  ('slh_gallery',          'SLH · Submission package',    '3:2',  3000, 2000, 6, 30,     0,  0, ARRAY['print','editorial'], 'none'),
  ('website_hero',         'Website · Hero rotation',     '16:9', 1920, 1080, 1, 10,    80,  0, ARRAY['website'],      'none'),
  ('pdf_offer',            'PDF · Offer one-pager',       '210:297',2480,3508, 1,  4,    0,  0, ARRAY['print','direct'], 'top-left'),
  ('print_poster',         'Print · Poster A2',           '420:594',4960,7016, 1,  3,    0,  0, ARRAY['print'],        'top-left'),
  ('blog_header',          'Blog · Header image',         '16:9', 1920, 1080, 1,  1,     0,  0, ARRAY['website'],      'none'),
  ('other',                'Custom · Generic',            '1:1',  1080, 1080, 1, 10,  2200, 12, ARRAY['social_organic'], 'bottom-right')
ON CONFLICT DO NOTHING;