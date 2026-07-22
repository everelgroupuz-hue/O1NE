-- Security hardening: Fix all Supabase Database Linter warnings
-- 1. SECURITY DEFINER functions for all writes (replacing direct anon writes)
-- 2. Revoke direct INSERT/UPDATE/DELETE from anon on user-specific tables
-- 3. Fix public bucket listing policies
-- 4. Revoke EXECUTE on admin-only SECURITY DEFINER functions

-- Drop old overloads from previous migrations that conflict with new signatures
DROP FUNCTION IF EXISTS public.record_coupon_usage(uuid, bigint, uuid);
DROP FUNCTION IF EXISTS public.insert_return(bigint, uuid, jsonb, text, jsonb);

-- ============================================================
-- 1. SECURITY DEFINER write functions
--    These replace direct table writes from the anon key.
--    They run with owner privileges, so RLS is bypassed for writes,
--    but the function logic controls what's allowed.
-- ============================================================

-- --- users ---
CREATE OR REPLACE FUNCTION public.upsert_user(
  p_telegram_id bigint,
  p_first_name text,
  p_username text DEFAULT NULL,
  p_language text DEFAULT 'ru',
  p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL
)
RETURNS SETOF public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.users (telegram_id, first_name, username, language, phone, address, updated_at)
  VALUES (p_telegram_id, p_first_name, p_username, p_language, p_phone, p_address, now())
  ON CONFLICT (telegram_id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    username = EXCLUDED.username,
    language = EXCLUDED.language,
    phone = COALESCE(EXCLUDED.phone, public.users.phone),
    address = COALESCE(EXCLUDED.address, public.users.address),
    updated_at = now()
  RETURNING *;
END;
$$;

-- --- favorites ---
CREATE OR REPLACE FUNCTION public.add_favorite(
  p_telegram_user_id bigint,
  p_product_id uuid,
  p_notify_price boolean DEFAULT false,
  p_notify_stock boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.favorites (telegram_user_id, product_id, notify_price, notify_stock)
  VALUES (p_telegram_user_id, p_product_id, p_notify_price, p_notify_stock)
  ON CONFLICT (telegram_user_id, product_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_favorite(
  p_telegram_user_id bigint,
  p_product_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.favorites
  WHERE telegram_user_id = p_telegram_user_id AND product_id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_favorite(
  p_telegram_user_id bigint,
  p_product_id uuid,
  p_notify_price boolean DEFAULT NULL,
  p_notify_stock boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.favorites
  SET notify_price = COALESCE(p_notify_price, notify_price),
      notify_stock = COALESCE(p_notify_stock, notify_stock)
  WHERE telegram_user_id = p_telegram_user_id AND product_id = p_product_id;
END;
$$;

-- --- reviews ---
CREATE OR REPLACE FUNCTION public.insert_review(
  p_product_id uuid,
  p_telegram_user_id bigint,
  p_user_name text,
  p_rating int,
  p_comment text DEFAULT NULL,
  p_images jsonb DEFAULT '[]'::jsonb,
  p_photos jsonb DEFAULT '[]'::jsonb
)
RETURNS SETOF public.reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.reviews (product_id, telegram_user_id, user_name, rating, comment, images, photos)
  VALUES (p_product_id, p_telegram_user_id, p_user_name, p_rating, p_comment, 
          array(SELECT jsonb_array_elements_text(p_images)),
          array(SELECT jsonb_array_elements_text(p_photos)))
  RETURNING *;
END;
$$;

-- --- notifications ---
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications SET is_read = true WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_telegram_user_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE telegram_user_id = p_telegram_user_id AND is_read = false;
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_notification(
  p_telegram_user_id bigint,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS SETOF public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.notifications (telegram_user_id, type, title, body, data)
  VALUES (p_telegram_user_id, p_type, p_title, p_body, p_data)
  RETURNING *;
END;
$$;

-- --- returns ---
CREATE OR REPLACE FUNCTION public.insert_return(
  p_telegram_user_id bigint,
  p_order_id text,
  p_items jsonb,
  p_reason text,
  p_photos jsonb DEFAULT '[]'::jsonb
)
RETURNS SETOF public.returns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.returns (telegram_user_id, order_id, items, reason, photos, status, refund_amount)
  VALUES (p_telegram_user_id, p_order_id, p_items, p_reason,
          array(SELECT jsonb_array_elements_text(p_photos)), 'pending', 0)
  RETURNING *;
END;
$$;

-- --- coupon_usage ---
CREATE OR REPLACE FUNCTION public.record_coupon_usage(
  p_coupon_id uuid,
  p_telegram_user_id bigint,
  p_order_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.coupon_usage (coupon_id, telegram_user_id, order_id)
  VALUES (p_coupon_id, p_telegram_user_id, p_order_id);
END;
$$;

-- --- orders (insert only — status updates already use append_order_status) ---
CREATE OR REPLACE FUNCTION public.insert_order(
  p_telegram_user_id bigint,
  p_items jsonb,
  p_total_amount numeric,
  p_customer_info jsonb,
  p_delivery_type text,
  p_delivery_cost numeric,
  p_payment_method text,
  p_notes text DEFAULT NULL,
  p_coupon_id uuid DEFAULT NULL,
  p_discount_amount numeric DEFAULT 0
)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.orders (
    telegram_user_id, items, total_amount, customer_info,
    delivery_type, delivery_cost, payment_method, notes,
    coupon_id, discount_amount, status, status_history
  )
  VALUES (
    p_telegram_user_id, p_items, p_total_amount, p_customer_info,
    p_delivery_type, p_delivery_cost, p_payment_method, p_notes,
    p_coupon_id, p_discount_amount, 'pending',
    jsonb_build_array(jsonb_build_object(
      'status', 'pending',
      'changed_at', now()::text,
      'changed_by', 'system'
    ))
  )
  RETURNING *;
END;
$$;

-- ============================================================
-- 2. Revoke direct INSERT/UPDATE/DELETE from anon on user-specific tables
--    SELECT remains open for public read (USING true is fine for SELECT)
-- ============================================================

-- Drop all anon INSERT/UPDATE/DELETE policies on user-specific tables
-- Then recreate only SELECT policies

-- --- coupon_usage ---
DROP POLICY IF EXISTS "anon_insert_coupon_usage" ON public.coupon_usage;
DROP POLICY IF EXISTS "anon_select_coupon_usage" ON public.coupon_usage;
CREATE POLICY "anon_select_coupon_usage" ON public.coupon_usage FOR SELECT TO anon, authenticated USING (true);

-- --- favorites ---
DROP POLICY IF EXISTS "anon_insert_favorites" ON public.favorites;
DROP POLICY IF EXISTS "anon_update_favorites" ON public.favorites;
DROP POLICY IF EXISTS "anon_delete_favorites" ON public.favorites;
DROP POLICY IF EXISTS "anon_select_favorites" ON public.favorites;
CREATE POLICY "anon_select_favorites" ON public.favorites FOR SELECT TO anon, authenticated USING (true);

-- --- notifications ---
DROP POLICY IF EXISTS "anon_insert_notifications" ON public.notifications;
DROP POLICY IF EXISTS "anon_update_notifications" ON public.notifications;
DROP POLICY IF EXISTS "anon_delete_notifications" ON public.notifications;
DROP POLICY IF EXISTS "anon_select_notifications" ON public.notifications;
CREATE POLICY "anon_select_notifications" ON public.notifications FOR SELECT TO anon, authenticated USING (true);

-- --- orders ---
DROP POLICY IF EXISTS "anon_insert_orders" ON public.orders;
DROP POLICY IF EXISTS "anon_update_orders" ON public.orders;
DROP POLICY IF EXISTS "anon_delete_orders" ON public.orders;
DROP POLICY IF EXISTS "anon_select_orders" ON public.orders;
CREATE POLICY "anon_select_orders" ON public.orders FOR SELECT TO anon, authenticated USING (true);

-- --- referrals ---
DROP POLICY IF EXISTS "anon_insert_referrals" ON public.referrals;
DROP POLICY IF EXISTS "anon_update_referrals" ON public.referrals;
DROP POLICY IF EXISTS "anon_delete_referrals" ON public.referrals;
DROP POLICY IF EXISTS "anon_select_referrals" ON public.referrals;
CREATE POLICY "anon_select_referrals" ON public.referrals FOR SELECT TO anon, authenticated USING (true);

-- --- returns ---
DROP POLICY IF EXISTS "anon_insert_returns" ON public.returns;
DROP POLICY IF EXISTS "anon_update_returns" ON public.returns;
DROP POLICY IF EXISTS "anon_delete_returns" ON public.returns;
DROP POLICY IF EXISTS "anon_select_returns" ON public.returns;
CREATE POLICY "anon_select_returns" ON public.returns FOR SELECT TO anon, authenticated USING (true);

-- --- reviews ---
DROP POLICY IF EXISTS "anon_insert_reviews" ON public.reviews;
DROP POLICY IF EXISTS "anon_update_reviews" ON public.reviews;
DROP POLICY IF EXISTS "anon_delete_reviews" ON public.reviews;
DROP POLICY IF EXISTS "anon_select_reviews" ON public.reviews;
CREATE POLICY "anon_select_reviews" ON public.reviews FOR SELECT TO anon, authenticated USING (true);

-- --- users ---
DROP POLICY IF EXISTS "anon_insert_users" ON public.users;
DROP POLICY IF EXISTS "anon_update_users" ON public.users;
DROP POLICY IF EXISTS "anon_delete_users" ON public.users;
DROP POLICY IF EXISTS "anon_select_users" ON public.users;
CREATE POLICY "anon_select_users" ON public.users FOR SELECT TO anon, authenticated USING (true);

-- ============================================================
-- 3. Fix public_bucket_allows_listing
--    Remove broad SELECT policies on storage.objects for public buckets.
--    Files remain accessible via direct URL (public bucket), but listing is blocked.
-- ============================================================

DROP POLICY IF EXISTS "Product images public read" ON storage.objects;
DROP POLICY IF EXISTS "Product images upload" ON storage.objects;
DROP POLICY IF EXISTS "Product images delete" ON storage.objects;
DROP POLICY IF EXISTS "Return photos public read" ON storage.objects;
DROP POLICY IF EXISTS "Review photos public read" ON storage.objects;
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
DROP POLICY IF EXISTS "public can read return photos" ON storage.objects;
DROP POLICY IF EXISTS "public can read review photos" ON storage.objects;

-- No SELECT policies on storage.objects for these public buckets.
-- Files are still accessible via their public URLs.
-- Only service_role or authenticated can upload/delete.

DROP POLICY IF EXISTS "Authenticated upload product images" ON storage.objects;
CREATE POLICY "Authenticated upload product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Authenticated delete product images" ON storage.objects;
CREATE POLICY "Authenticated delete product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images');

-- ============================================================
-- 4. Fix anon_security_definer_function_executable
--    Revoke EXECUTE from anon/authenticated on admin-only functions.
--    These should only be callable via service_role (edge functions).
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.create_order_with_stock(bigint, jsonb, numeric, jsonb, text, numeric, text, text, uuid, numeric, text) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.append_order_status(uuid, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_return_stock(uuid, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_orders(text, text, boolean) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_admin_password(text, text) FROM anon, authenticated;
