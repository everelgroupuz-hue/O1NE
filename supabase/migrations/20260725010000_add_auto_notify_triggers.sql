-- Auto-notify: create database triggers for automatic notifications.
-- These triggers log notification events to audit_log.
-- The actual sending is handled by Supabase Dashboard Webhooks.
--
-- SETUP IN SUPABASE DASHBOARD (Database → Webhooks):
--
-- Webhook 1: "auto-notify-stock"
--   Table: products
--   Events: UPDATE
--   URL: https://wrjixyedostqulufnjpw.supabase.co/functions/v1/auto-notify
--   Method: POST
--   Headers: Content-Type: application/json
--            Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
--   Body: {"product_id": "{{NEW.id}}", "type": "stock_available"}
--   Condition: OLD.stock = 0 AND NEW.stock > 0
--
-- Webhook 2: "auto-notify-price"
--   Table: products
--   Events: UPDATE
--   URL: https://wrjixyedostqulufnjpw.supabase.co/functions/v1/auto-notify
--   Method: POST
--   Headers: Content-Type: application/json
--            Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
--   Body: {"product_id": "{{NEW.id}}", "type": "price_drop"}
--   Condition: NEW.price < OLD.price

-- Create a function to log product changes for notification tracking
CREATE OR REPLACE FUNCTION log_product_change()
RETURNS TRIGGER AS $$
DECLARE
  notify_type text;
BEGIN
  IF TG_OP != 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD.stock = 0 AND NEW.stock > 0 THEN
    notify_type := 'stock_available';
  ELSIF NEW.price < OLD.price THEN
    notify_type := 'price_drop';
  ELSE
    RETURN NEW;
  END IF;

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

-- Stock available trigger
DROP TRIGGER IF EXISTS on_stock_available_log ON products;
CREATE TRIGGER on_stock_available_log
  AFTER UPDATE ON products
  FOR EACH ROW
  WHEN (OLD.stock = 0 AND NEW.stock > 0)
  EXECUTE FUNCTION log_product_change();

-- Price drop trigger
DROP TRIGGER IF EXISTS on_price_drop_log ON products;
CREATE TRIGGER on_price_drop_log
  AFTER UPDATE ON products
  FOR EACH ROW
  WHEN (NEW.price < OLD.price)
  EXECUTE FUNCTION log_product_change();

-- Indexes for faster notification queries
CREATE INDEX IF NOT EXISTS idx_favorites_notify_price ON favorites (product_id) WHERE notify_price = true;
CREATE INDEX IF NOT EXISTS idx_favorites_notify_stock ON favorites (product_id) WHERE notify_stock = true;
