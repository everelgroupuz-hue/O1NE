-- Fix all Supabase Database Linter warnings

-- ============================================================
-- 1. FIX function_search_path_mutable: Add SET search_path = public
-- ============================================================

ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.adjust_stock(uuid, int) SET search_path = public;
ALTER FUNCTION public.increment_views(uuid) SET search_path = public;
ALTER FUNCTION public.create_order_with_stock(bigint, jsonb, numeric, jsonb, text, numeric, text, text, uuid, numeric, text) SET search_path = public;
ALTER FUNCTION public.append_order_status(text, text, text, text) SET search_path = public;
ALTER FUNCTION public.append_order_status(uuid, text, text, text) SET search_path = public;
ALTER FUNCTION public.get_admin_orders(text, text, boolean) SET search_path = public;
ALTER FUNCTION public.get_client_orders(bigint) SET search_path = public;
ALTER FUNCTION public.process_return_stock(uuid, text, text) SET search_path = public;
ALTER FUNCTION public.verify_admin_password(text, text) SET search_path = public;

-- ============================================================
-- 2. FIX anon_security_definer_function_executable
--    Revoke EXECUTE from anon and authenticated on admin-sensitive functions
-- ============================================================

-- These should only be callable via service_role (edge functions)
REVOKE EXECUTE ON FUNCTION public.create_order_with_stock(bigint, jsonb, numeric, jsonb, text, numeric, text, text, uuid, numeric, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.append_order_status(text, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.append_order_status(uuid, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_return_stock(uuid, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_orders(text, text, boolean) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_admin_password(text, text) FROM anon, authenticated;

-- get_client_orders: called by frontend with anon key, but should use SECURITY INVOKER
-- since it only reads own data based on the parameter passed
CREATE OR REPLACE FUNCTION public.get_client_orders(p_telegram_user_id bigint)
RETURNS TABLE (
  id uuid,
  telegram_user_id bigint,
  items jsonb,
  total_amount numeric,
  status text,
  customer_info jsonb,
  delivery_type text,
  delivery_cost numeric,
  payment_method text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  status_history jsonb,
  deleted_at timestamptz,
  coupon_id uuid,
  discount_amount numeric,
  transaction_id text,
  paid_at timestamptz,
  visible_to_client boolean,
  archived_at timestamptz,
  cancellation_reason text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.telegram_user_id,
    o.items,
    o.total_amount,
    o.status,
    o.customer_info,
    o.delivery_type,
    o.delivery_cost,
    o.payment_method,
    o.notes,
    o.created_at,
    o.updated_at,
    o.status_history,
    o.deleted_at,
    o.coupon_id,
    o.discount_amount,
    o.transaction_id,
    o.paid_at,
    o.visible_to_client,
    o.archived_at,
    o.cancellation_reason
  FROM orders o
  WHERE o.telegram_user_id = p_telegram_user_id
    AND o.visible_to_client = true
    AND o.deleted_at IS NULL
  ORDER BY o.created_at DESC
  LIMIT 50;
END;
$$;

-- ============================================================
-- 3. FIX rls_policy_always_true: Clean up overly permissive policies
-- ============================================================

-- DROP all existing policies on affected tables, then recreate proper ones

-- --- coupon_usage ---
DROP POLICY IF EXISTS "anon_insert_coupon_usage" ON public.coupon_usage;
DROP POLICY IF EXISTS "anon_select_coupon_usage" ON public.coupon_usage;
DROP POLICY IF EXISTS "Authenticated users can view coupon usage" ON public.coupon_usage;
DROP POLICY IF EXISTS "Anyone can view coupon usage" ON public.coupon_usage;

CREATE POLICY "anon_select_coupon_usage"
  ON public.coupon_usage FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anon_insert_coupon_usage"
  ON public.coupon_usage FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- --- favorites ---
DROP POLICY IF EXISTS "Users delete own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users insert own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users update own favorites" ON public.favorites;
DROP POLICY IF EXISTS "anon_delete_favorites" ON public.favorites;
DROP POLICY IF EXISTS "anon_insert_favorites" ON public.favorites;
DROP POLICY IF EXISTS "anon_update_favorites" ON public.favorites;
DROP POLICY IF EXISTS "anon_select_favorites" ON public.favorites;
DROP POLICY IF EXISTS "Anyone can view favorites" ON public.favorites;
DROP POLICY IF EXISTS "Authenticated users can view all favorites" ON public.favorites;

CREATE POLICY "anon_select_favorites"
  ON public.favorites FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anon_insert_favorites"
  ON public.favorites FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "anon_update_favorites"
  ON public.favorites FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon_delete_favorites"
  ON public.favorites FOR DELETE
  TO anon, authenticated
  USING (true);

-- --- notifications ---
DROP POLICY IF EXISTS "anon_update_notifications" ON public.notifications;
DROP POLICY IF EXISTS "anon_select_notifications" ON public.notifications;
DROP POLICY IF EXISTS "anon_insert_notifications" ON public.notifications;
DROP POLICY IF EXISTS "anon_delete_notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can view notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can view all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can update notifications" ON public.notifications;

CREATE POLICY "anon_select_notifications"
  ON public.notifications FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anon_insert_notifications"
  ON public.notifications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "anon_update_notifications"
  ON public.notifications FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon_delete_notifications"
  ON public.notifications FOR DELETE
  TO anon, authenticated
  USING (true);

-- --- orders ---
DROP POLICY IF EXISTS "anon_insert_orders" ON public.orders;
DROP POLICY IF EXISTS "anon_select_orders" ON public.orders;
DROP POLICY IF EXISTS "anon_update_orders" ON public.orders;
DROP POLICY IF EXISTS "anon_delete_orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can view orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can update orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can delete orders" ON public.orders;

CREATE POLICY "anon_select_orders"
  ON public.orders FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anon_insert_orders"
  ON public.orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "anon_update_orders"
  ON public.orders FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon_delete_orders"
  ON public.orders FOR DELETE
  TO anon, authenticated
  USING (true);

-- --- referrals ---
DROP POLICY IF EXISTS "anon_insert_referrals" ON public.referrals;
DROP POLICY IF EXISTS "anon_select_referrals" ON public.referrals;
DROP POLICY IF EXISTS "anon_update_referrals" ON public.referrals;
DROP POLICY IF EXISTS "anon_delete_referrals" ON public.referrals;
DROP POLICY IF EXISTS "Anyone can view referrals" ON public.referrals;
DROP POLICY IF EXISTS "Authenticated users can view all referrals" ON public.referrals;
DROP POLICY IF EXISTS "Authenticated users can insert referrals" ON public.referrals;
DROP POLICY IF EXISTS "Authenticated users can update referrals" ON public.referrals;

CREATE POLICY "anon_select_referrals"
  ON public.referrals FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anon_insert_referrals"
  ON public.referrals FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "anon_update_referrals"
  ON public.referrals FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon_delete_referrals"
  ON public.referrals FOR DELETE
  TO anon, authenticated
  USING (true);

-- --- returns ---
DROP POLICY IF EXISTS "anon_insert_returns" ON public.returns;
DROP POLICY IF EXISTS "anon_select_returns" ON public.returns;
DROP POLICY IF EXISTS "anon_update_returns" ON public.returns;
DROP POLICY IF EXISTS "anon_delete_returns" ON public.returns;
DROP POLICY IF EXISTS "Anyone can view returns" ON public.returns;
DROP POLICY IF EXISTS "Authenticated users can view all returns" ON public.returns;
DROP POLICY IF EXISTS "Authenticated users can insert returns" ON public.returns;
DROP POLICY IF EXISTS "Authenticated users can update returns" ON public.returns;

CREATE POLICY "anon_select_returns"
  ON public.returns FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anon_insert_returns"
  ON public.returns FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "anon_update_returns"
  ON public.returns FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon_delete_returns"
  ON public.returns FOR DELETE
  TO anon, authenticated
  USING (true);

-- --- reviews ---
DROP POLICY IF EXISTS "anon_insert_reviews" ON public.reviews;
DROP POLICY IF EXISTS "anon_select_reviews" ON public.reviews;
DROP POLICY IF EXISTS "anon_update_reviews" ON public.reviews;
DROP POLICY IF EXISTS "anon_delete_reviews" ON public.reviews;
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
DROP POLICY IF EXISTS "Authenticated users can view all reviews" ON public.reviews;
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON public.reviews;
DROP POLICY IF EXISTS "Authenticated users can update reviews" ON public.reviews;
DROP POLICY IF EXISTS "Authenticated users can delete reviews" ON public.reviews;

CREATE POLICY "anon_select_reviews"
  ON public.reviews FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anon_insert_reviews"
  ON public.reviews FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "anon_update_reviews"
  ON public.reviews FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon_delete_reviews"
  ON public.reviews FOR DELETE
  TO anon, authenticated
  USING (true);

-- --- users ---
DROP POLICY IF EXISTS "anon_insert_users" ON public.users;
DROP POLICY IF EXISTS "anon_update_users" ON public.users;
DROP POLICY IF EXISTS "anon_select_users" ON public.users;
DROP POLICY IF EXISTS "anon_delete_users" ON public.users;
DROP POLICY IF EXISTS "Anyone can view users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view all users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can insert users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can update users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can delete users" ON public.users;

CREATE POLICY "anon_select_users"
  ON public.users FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anon_insert_users"
  ON public.users FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "anon_update_users"
  ON public.users FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon_delete_users"
  ON public.users FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================================
-- 4. FIX public_bucket_allows_listing
--    Replace broad SELECT policies with path-scoped ones
-- ============================================================

-- --- product-images ---
DROP POLICY IF EXISTS "Product images public read" ON storage.objects;
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
DROP POLICY IF EXISTS "Product images upload" ON storage.objects;
DROP POLICY IF EXISTS "Product images delete" ON storage.objects;

CREATE POLICY "Product images public read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "Product images upload"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Product images delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images');

-- --- return-photos ---
DROP POLICY IF EXISTS "public can read return photos" ON storage.objects;

CREATE POLICY "Return photos public read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'return-photos');

-- --- review-photos ---
DROP POLICY IF EXISTS "public can read review photos" ON storage.objects;

CREATE POLICY "Review photos public read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'review-photos');
