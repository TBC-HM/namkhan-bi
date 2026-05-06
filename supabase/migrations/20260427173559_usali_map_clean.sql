-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427173559
-- Name:    usali_map_clean
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE TABLE IF NOT EXISTS usali_category_map (
  id bigserial PRIMARY KEY,
  match_pattern text NOT NULL,
  match_type text NOT NULL DEFAULT 'ilike',
  usali_dept text NOT NULL,
  usali_subdept text,
  notes text,
  priority int NOT NULL DEFAULT 100,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO usali_category_map(match_pattern, usali_dept, usali_subdept, priority) VALUES
  ('rate', 'Rooms', 'Transient', 10),
  ('tax', 'Tax', NULL, 20),
  ('fee', 'Fee', NULL, 20),
  ('Main Courses', 'F&B', 'Food', 30),
  ('Starters', 'F&B', 'Food', 30),
  ('Salads', 'F&B', 'Food', 30),
  ('Desserts', 'F&B', 'Food', 30),
  ('Side', 'F&B', 'Food', 30),
  ('Breakfast', 'F&B', 'Food', 30),
  ('Sandwich', 'F&B', 'Food', 30),
  ('Pizza', 'F&B', 'Food', 30),
  ('Pasta', 'F&B', 'Food', 30),
  ('Soft Drinks', 'F&B', 'Beverage', 30),
  ('Juices', 'F&B', 'Beverage', 30),
  ('Coffee', 'F&B', 'Beverage', 30),
  ('Tea', 'F&B', 'Beverage', 30),
  ('Wine', 'F&B', 'Beverage', 30),
  ('Sparkling', 'F&B', 'Beverage', 30),
  ('Beer', 'F&B', 'Beverage', 30),
  ('Cocktail', 'F&B', 'Beverage', 30),
  ('Spirit', 'F&B', 'Beverage', 30),
  ('Liquor', 'F&B', 'Beverage', 30),
  ('Spa', 'Other Operated', 'Spa', 40),
  ('Massage', 'Other Operated', 'Spa', 40),
  ('Inside Activity', 'Other Operated', 'Activities', 40),
  ('Outside Activity', 'Other Operated', 'Activities', 40),
  ('Excursion', 'Other Operated', 'Activities', 40),
  ('Tour', 'Other Operated', 'Activities', 40),
  ('Transportation', 'Other Operated', 'Transportation', 40),
  ('Transfer', 'Other Operated', 'Transportation', 40),
  ('Laundry', 'Other Operated', 'Laundry', 40),
  ('product', 'Retail', NULL, 50),
  ('Shop', 'Retail', NULL, 50),
  ('Boutique', 'Retail', NULL, 50);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS usali_dept text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS usali_subdept text;
CREATE INDEX IF NOT EXISTS idx_tx_usali_dept ON transactions(usali_dept);
