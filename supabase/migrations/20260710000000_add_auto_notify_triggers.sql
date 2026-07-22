-- Auto-notify triggers for stock and price changes
-- This migration adds database triggers and audit logging for automatic notifications.
--
-- SETUP REQUIRED (in Supabase Dashboard):
-- 1. Go to Database → Webhooks
-- 2. Create webhook "auto-notify-stock":
--    - Table: products
--    - Events: UPDATE
--    - URL: https://<your-project>.supabase.co/functions/v1/auto-notify
--    - HTTP Method: POST
--    - Headers: Content-Type: application/json
--    - Body: {"product_id": "{{NEW.id}}", "type": "stock_available"}
--    - Condition: OLD.stock = 0 AND NEW.stock > 0
-- 3. Create webhook "auto-notify-price":
--    - Table: products
--    - Events: UPDATE
--    - URL: https://<your-project>.supabase.co/functions/v1/auto-notify
--    - HTTP Method: POST
--    - Headers: Content-Type: application/json
--    - Body: {"product_id": "{{NEW.id}}", "type": "price_drop"}
--    - Condition: NEW.price < OLD.price

-- Create a function to log product changes for notification tracking
CREATE OR REPLACE FUNCTION log_product_change()
RETURNS TRIGGER AS $$
DECLARE
  notify_type text;
BEGIN
  -- Only process UPDATE operations
  IF TG_OP != 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Determine notification type based on what changed
  IF OLD.stock = 0 AND NEW.stock > 0 THEN
    notify_type := 'stock_available';
  ELSIF NEW.price < OLD.price THEN
    notify_type := 'price_drop';
  ELSE
    -- No notification needed
    RETURN NEW;
  END IF;

  -- Log the notification event for audit trail
  INSERT INTO audit_log (
    admin_id,
    action,
    entity_type,
    entity_id,
    details
  ) VALUES (
    'system',
    'auto_notify',
    'products',
    NEW.id,
    jsonb_build_object(
      'type', notify_type,
      'old_stock', OLD.stock,
      'new_stock', NEW.stock,
      'old_price', OLD.price,
      'new_price', NEW.price,
      'product_name', NEW.name
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for stock available notifications
-- Fires when stock changes from 0 to > 0
DROP TRIGGER IF EXISTS on_stock_available_log ON products;
CREATE TRIGGER on_stock_available_log
  AFTER UPDATE ON products
  FOR EACH ROW
  WHEN (OLD.stock = 0 AND NEW.stock > 0)
  EXECUTE FUNCTION log_product_change();

-- Create trigger for price drop notifications
-- Fires when price decreases
DROP TRIGGER IF EXISTS on_price_drop_log ON products;
CREATE TRIGGER on_price_drop_log
  AFTER UPDATE ON products
  FOR EACH ROW
  WHEN (NEW.price < OLD.price)
  EXECUTE FUNCTION log_product_change();

-- Add index for faster notification queries
CREATE INDEX IF NOT EXISTS idx_favorites_notify_price ON favorites (product_id) WHERE notify_price = true;
CREATE INDEX IF NOT EXISTS idx_favorites_notify_stock ON favorites (product_id) WHERE notify_stock = true;
