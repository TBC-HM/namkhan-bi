-- ============================================================================
-- Migration: 08_stock_balance_trigger  (Phase 2.5)
-- Version:   20260502230017
-- Date:      2026-05-02
-- ----------------------------------------------------------------------------
-- LAST-COST stock balance maintenance.
--
-- Two triggers on inv.movements:
--   BEFORE INSERT: backfill unit_cost on outgoing movements from
--     inv.items.last_unit_cost_usd so total_cost / COGS is meaningful.
--   AFTER INSERT:
--     1. Upsert inv.stock_balance (qty += movement.quantity).
--     2. On 'receive': update inv.items.last_unit_cost_* from movement
--        (LAST COST method — newest receive cost wins for valuation).
--     3. On 'count_correction': also bump stock_balance.last_count_at.
--
-- Convention: movement.quantity is SIGNED. + inbound, - outbound.
-- Transfers between locations are TWO rows (one transfer_out at A,
-- one transfer_in at B). Each row updates its own location's balance.
-- ============================================================================

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
