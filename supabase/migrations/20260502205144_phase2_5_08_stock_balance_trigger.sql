-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502205144
-- Name:    phase2_5_08_stock_balance_trigger
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Phase 2.5 — stock_balance auto-update trigger using LAST-COST method.
--
-- Two triggers on inv.movements:
--   BEFORE INSERT: if movement is outgoing (issue/consume/waste/transfer_out)
--     and unit_cost_usd is null, backfill from inv.items.last_unit_cost_usd
--     so total_cost_usd is meaningful for COGS.
--   AFTER INSERT:
--     1. Upsert inv.stock_balance (qty += movement.quantity).
--     2. If receive: update inv.items.last_unit_cost_usd / _lak / fx_rate_used
--        from movement (LAST-COST methodology — newest receive cost wins).
--     3. If count_correction: also bump stock_balance.last_count_at.
--
-- Conventions:
--   movement.quantity is signed: + for inbound, - for outbound.
--   transfer_in/out create TWO rows (one per side); each row updates only its
--   own side's stock_balance.

CREATE OR REPLACE FUNCTION inv.fn_movement_backfill_cost()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_last_usd NUMERIC; v_last_lak NUMERIC; v_fx NUMERIC;
BEGIN
  IF NEW.movement_type IN ('issue','consume','waste','transfer_out')
     AND NEW.unit_cost_usd IS NULL THEN
    SELECT last_unit_cost_usd, last_unit_cost_lak, fx_rate_used
      INTO v_last_usd, v_last_lak, v_fx
    FROM inv.items WHERE item_id = NEW.item_id;
    NEW.unit_cost_usd  := v_last_usd;
    NEW.unit_cost_lak  := v_last_lak;
    NEW.fx_rate_used   := v_fx;
    NEW.total_cost_usd := ABS(NEW.quantity) * COALESCE(v_last_usd, 0);
    NEW.total_cost_lak := ABS(NEW.quantity) * COALESCE(v_last_lak, 0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inv_movements_backfill ON inv.movements;
CREATE TRIGGER trg_inv_movements_backfill
  BEFORE INSERT ON inv.movements
  FOR EACH ROW EXECUTE FUNCTION inv.fn_movement_backfill_cost();

CREATE OR REPLACE FUNCTION inv.fn_movement_update_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- 1. Upsert stock_balance for this item × location
  INSERT INTO inv.stock_balance (item_id, location_id, quantity_on_hand,
                                 last_movement_at, last_count_at, updated_at)
  VALUES (NEW.item_id, NEW.location_id, NEW.quantity, NEW.moved_at,
          CASE WHEN NEW.movement_type = 'count_correction' THEN NEW.moved_at END,
          now())
  ON CONFLICT (item_id, location_id) DO UPDATE
    SET quantity_on_hand = inv.stock_balance.quantity_on_hand + NEW.quantity,
        last_movement_at = NEW.moved_at,
        last_count_at    = CASE WHEN NEW.movement_type = 'count_correction'
                                THEN NEW.moved_at
                                ELSE inv.stock_balance.last_count_at END,
        updated_at       = now();

  -- 2. LAST-COST: on receives, update items.last_unit_cost from this movement.
  IF NEW.movement_type = 'receive' AND NEW.unit_cost_usd IS NOT NULL THEN
    UPDATE inv.items
       SET last_unit_cost_usd = NEW.unit_cost_usd,
           last_unit_cost_lak = NEW.unit_cost_lak,
           fx_rate_used       = NEW.fx_rate_used,
           updated_at         = now()
     WHERE item_id = NEW.item_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inv_movements_update_balance ON inv.movements;
CREATE TRIGGER trg_inv_movements_update_balance
  AFTER INSERT ON inv.movements
  FOR EACH ROW EXECUTE FUNCTION inv.fn_movement_update_balance();

REVOKE ALL ON FUNCTION inv.fn_movement_backfill_cost()  FROM PUBLIC;
REVOKE ALL ON FUNCTION inv.fn_movement_update_balance() FROM PUBLIC;
