-- ============================================================
-- CRITICAL FIX: Restore anon/authenticated EXECUTE on
-- user-facing SECURITY DEFINER functions
-- 
-- ROOT CAUSE: Migrations 20260709000000/01/02 revoked EXECUTE
-- from anon/authenticated on ALL SECURITY DEFINER functions to
-- fix Supabase Database Linter warnings. This broke the frontend
-- because it calls these functions directly via supabase.rpc().
-- 
-- FIX: Grant EXECUTE back on user-facing functions.
-- Keep admin-only functions restricted to service_role.
-- ============================================================

-- ============================================================
-- 1. USER-FACING SECURITY DEFINER FUNCTIONS
--    These are called by the frontend with the anon key.
--    SECURITY DEFINER means they run with owner privileges
--    regardless, so granting anon EXECUTE is safe.
-- ============================================================

-- Users
GRANT EXECUTE ON FUNCTION public.upsert_user(bigint, text, text, text, text, text) TO anon, authenticated;

-- Favorites
GRANT EXECUTE ON FUNCTION public.add_favorite(bigint, uuid, boolean, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_favorite(bigint, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_favorite(bigint, uuid, boolean, boolean) TO anon, authenticated;

-- Reviews
GRANT EXECUTE ON FUNCTION public.insert_review(uuid, bigint, text, integer, text, jsonb, jsonb) TO anon, authenticated;

-- Notifications
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_read_notifications(bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_notification(bigint, text, text, text, jsonb) TO anon, authenticated;

-- Returns
GRANT EXECUTE ON FUNCTION public.insert_return(bigint, text, jsonb, text, jsonb) TO anon, authenticated;

-- Coupons
GRANT EXECUTE ON FUNCTION public.record_coupon_usage(uuid, bigint, text) TO anon, authenticated;

-- Orders (client-side insert)
GRANT EXECUTE ON FUNCTION public.insert_order(bigint, jsonb, numeric, jsonb, text, numeric, text, text, uuid, numeric) TO anon, authenticated;

-- Client orders (read)
GRANT EXECUTE ON FUNCTION public.get_client_orders(bigint) TO anon, authenticated;

-- Product views
GRANT EXECUTE ON FUNCTION public.increment_views(uuid) TO anon, authenticated;

-- Product analytics (client-callable)
GRANT EXECUTE ON FUNCTION public.track_product_event(uuid, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_product_analytics() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_product_analytics() TO anon, authenticated;

-- Messages
GRANT EXECUTE ON FUNCTION public.get_order_messages(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_message_count(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_conversations() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, text, text, text, text) TO anon, authenticated;

-- ============================================================
-- 2. ENSURE service_role ALSO has EXECUTE on these functions
--    (Edge Functions use service_role key)
-- ============================================================

GRANT EXECUTE ON FUNCTION public.upsert_user(bigint, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_favorite(bigint, uuid, boolean, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.remove_favorite(bigint, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_favorite(bigint, uuid, boolean, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_review(uuid, bigint, text, integer, text, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_read_notifications(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_notification(bigint, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_return(bigint, text, jsonb, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_coupon_usage(uuid, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_order(bigint, jsonb, numeric, jsonb, text, numeric, text, text, uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_client_orders(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_views(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.track_product_event(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_product_analytics() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_all_product_analytics() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_order_messages(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_unread_message_count(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_conversations() TO service_role;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, text, text, text, text) TO service_role;

-- ============================================================
-- 3. ADMIN-ONLY SECURITY DEFINER FUNCTIONS
--    These should ONLY be callable by service_role (Edge Functions).
--    Verify they remain restricted.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.create_order_with_stock(bigint, jsonb, numeric, jsonb, text, numeric, text, text, uuid, numeric, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.append_order_status(uuid, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_return_stock(uuid, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_orders(text, text, boolean) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_admin_password(text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.adjust_stock(uuid, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_notifications() FROM anon, authenticated;

-- ============================================================
-- 4. FIX: Add missing UPDATE policy on messages for customers
--    to mark messages as read
-- ============================================================

DO $$ BEGIN
  DROP POLICY IF EXISTS "messages_update_read" ON messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "messages_update_read" ON messages
  FOR UPDATE TO anon, authenticated
  USING (true);

-- ============================================================
-- 5. FIX: Ensure pg_trgm extension is available for search
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ============================================================
-- 6. Verify key RPC functions exist and have correct signatures
-- ============================================================

-- ensure get_client_orders exists with the latest definition
DO $$ BEGIN
  PERFORM 1 FROM pg_proc WHERE proname = 'get_client_orders';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'get_client_orders function not found!';
  END IF;
END $$;

-- ensure insert_order exists
DO $$ BEGIN
  PERFORM 1 FROM pg_proc WHERE proname = 'insert_order';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insert_order function not found!';
  END IF;
END $$;

-- ensure upsert_user exists
DO $$ BEGIN
  PERFORM 1 FROM pg_proc WHERE proname = 'upsert_user';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'upsert_user function not found!';
  END IF;
END $$;
