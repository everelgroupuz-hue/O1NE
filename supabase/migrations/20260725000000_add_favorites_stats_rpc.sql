-- Admin favorites stats RPC (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_favorites_stats()
RETURNS TABLE (
  product_id uuid,
  likes bigint,
  notify_price bigint,
  notify_stock bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    f.product_id,
    COUNT(*)::bigint AS likes,
    COUNT(*) FILTER (WHERE f.notify_price)::bigint AS notify_price,
    COUNT(*) FILTER (WHERE f.notify_stock)::bigint AS notify_stock
  FROM public.favorites f
  GROUP BY f.product_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_favorites_stats() TO anon, authenticated, service_role;

-- Single product stats
CREATE OR REPLACE FUNCTION public.get_product_favorites_stats(p_product_id uuid)
RETURNS TABLE (
  likes bigint,
  notify_price bigint,
  notify_stock bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    COUNT(*)::bigint AS likes,
    COUNT(*) FILTER (WHERE f.notify_price)::bigint AS notify_price,
    COUNT(*) FILTER (WHERE f.notify_stock)::bigint AS notify_stock
  FROM public.favorites f
  WHERE f.product_id = p_product_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_favorites_stats(uuid) TO anon, authenticated, service_role;
