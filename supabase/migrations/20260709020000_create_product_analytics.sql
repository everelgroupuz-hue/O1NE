-- Product analytics table for real-time statistics
-- Tracks: views, favorites, cart_adds, orders, purchases, returns

CREATE TABLE IF NOT EXISTS product_analytics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  views integer DEFAULT 0,
  favorites integer DEFAULT 0,
  cart_adds integer DEFAULT 0,
  orders integer DEFAULT 0,
  purchases integer DEFAULT 0,
  returns integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_analytics_product_id ON product_analytics(product_id);

-- Enable RLS
ALTER TABLE product_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "product_analytics_select" ON product_analytics;
CREATE POLICY "product_analytics_select" ON product_analytics
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "product_analytics_insert" ON product_analytics;
CREATE POLICY "product_analytics_insert" ON product_analytics
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "product_analytics_update" ON product_analytics;
CREATE POLICY "product_analytics_update" ON product_analytics
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RPC: Increment a counter for a product
CREATE OR REPLACE FUNCTION track_product_event(
  p_product_id uuid,
  p_event_type text,
  p_delta integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO product_analytics (product_id, views, favorites, cart_adds, orders, purchases, returns)
  VALUES (
    p_product_id,
    CASE WHEN p_event_type = 'views' THEN p_delta ELSE 0 END,
    CASE WHEN p_event_type = 'favorites' THEN p_delta ELSE 0 END,
    CASE WHEN p_event_type = 'cart_adds' THEN p_delta ELSE 0 END,
    CASE WHEN p_event_type = 'orders' THEN p_delta ELSE 0 END,
    CASE WHEN p_event_type = 'purchases' THEN p_delta ELSE 0 END,
    CASE WHEN p_event_type = 'returns' THEN p_delta ELSE 0 END
  )
  ON CONFLICT (product_id) DO UPDATE SET
    views = product_analytics.views + CASE WHEN p_event_type = 'views' THEN p_delta ELSE 0 END,
    favorites = product_analytics.favorites + CASE WHEN p_event_type = 'favorites' THEN p_delta ELSE 0 END,
    cart_adds = product_analytics.cart_adds + CASE WHEN p_event_type = 'cart_adds' THEN p_delta ELSE 0 END,
    orders = product_analytics.orders + CASE WHEN p_event_type = 'orders' THEN p_delta ELSE 0 END,
    purchases = product_analytics.purchases + CASE WHEN p_event_type = 'purchases' THEN p_delta ELSE 0 END,
    returns = product_analytics.returns + CASE WHEN p_event_type = 'returns' THEN p_delta ELSE 0 END,
    updated_at = now();
END;
$$;

-- RPC: Get analytics for a single product
CREATE OR REPLACE FUNCTION get_product_analytics(p_product_id uuid)
RETURNS SETOF product_analytics
LANGUAGE sql STABLE
AS $$
  SELECT * FROM product_analytics WHERE product_id = p_product_id;
$$;

-- RPC: Get analytics for all products (admin)
CREATE OR REPLACE FUNCTION get_all_product_analytics()
RETURNS TABLE (
  product_id uuid,
  name jsonb,
  slug text,
  price numeric,
  views integer,
  favorites integer,
  cart_adds integer,
  orders integer,
  purchases integer,
  returns integer,
  stock integer
)
LANGUAGE sql STABLE
AS $$
  SELECT
    pa.product_id,
    p.name,
    p.slug,
    p.price,
    pa.views,
    pa.favorites,
    pa.cart_adds,
    pa.orders,
    pa.purchases,
    pa.returns,
    p.stock
  FROM product_analytics pa
  JOIN products p ON p.id = pa.product_id
  WHERE p.is_active = true
  ORDER BY pa.views DESC;
$$;

-- RPC: Ensure all active products have an analytics row
CREATE OR REPLACE FUNCTION ensure_product_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO product_analytics (product_id)
  SELECT id FROM products WHERE is_active = true
  ON CONFLICT (product_id) DO NOTHING;
END;
$$;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_product_analytics_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_product_analytics_updated_at ON product_analytics;
CREATE TRIGGER update_product_analytics_updated_at
  BEFORE UPDATE ON product_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_product_analytics_updated_at();

-- Seed analytics for existing products
SELECT ensure_product_analytics();

-- Trigger: When an order is created, increment orders counter for each product
CREATE OR REPLACE FUNCTION on_order_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item jsonb;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    PERFORM track_product_event(
      (v_item->>'productId')::uuid,
      'orders',
      COALESCE((v_item->>'quantity')::int, 1)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_created ON orders;
CREATE TRIGGER trg_order_created
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION on_order_created();

-- Trigger: When order status changes to delivered, increment purchases
CREATE OR REPLACE FUNCTION on_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item jsonb;
  v_old_status text;
BEGIN
  v_old_status := OLD.status;

  IF NEW.status = 'delivered' AND v_old_status != 'delivered' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      PERFORM track_product_event(
        (v_item->>'productId')::uuid,
        'purchases',
        COALESCE((v_item->>'quantity')::int, 1)
      );
    END LOOP;
  END IF;

  IF NEW.status = 'returned' AND v_old_status != 'returned' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      PERFORM track_product_event(
        (v_item->>'productId')::uuid,
        'returns',
        COALESCE((v_item->>'quantity')::int, 1)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_status_change ON orders;
CREATE TRIGGER trg_order_status_change
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION on_order_status_change();
