CREATE OR REPLACE FUNCTION get_client_favorites(p_telegram_user_id bigint)
RETURNS TABLE (
  product_id uuid,
  notify_price boolean,
  notify_stock boolean,
  created_at timestamptz,
  id uuid,
  name jsonb,
  slug text,
  price numeric,
  images text[],
  is_active boolean,
  stock integer,
  sizes text[],
  colors jsonb[]
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    f.product_id,
    f.notify_price,
    f.notify_stock,
    f.created_at,
    p.id,
    p.name,
    p.slug,
    p.price,
    p.images,
    p.is_active,
    p.stock,
    p.sizes,
    p.colors
  FROM favorites f
  INNER JOIN products p ON p.id = f.product_id
  WHERE f.telegram_user_id = p_telegram_user_id
  ORDER BY f.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_client_favorites(bigint) TO anon, authenticated;
