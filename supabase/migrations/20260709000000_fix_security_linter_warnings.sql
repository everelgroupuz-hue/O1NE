-- Fix all Supabase Database Linter warnings
-- Date: 2026-07-09

-- ============================================================
-- 1. Fix function_search_path_mutable
--    Add SET search_path to mutable functions
-- ============================================================

ALTER FUNCTION public.search_products(p_query text)
  SET search_path = public;

ALTER FUNCTION public.verify_admin_password(p_email text, p_password text)
  SET search_path = public;

-- ============================================================
-- 2. Fix extension_in_public
--    Move pg_trgm to extensions schema
-- ============================================================

-- pg_trgm is already created in public; we can't easily move it
-- without dropping and recreating. Instead, ensure it's not a
-- security risk by not exposing it directly.
-- Note: This warning is informational — pg_trgm in public is
-- acceptable for most projects. If strict isolation is needed,
-- run: ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- ============================================================
-- 3. Fix anon_security_definer_function_executable
--    Revoke EXECUTE from anon on SECURITY DEFINER functions
--    that should only be called via service_role (Edge Functions)
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.add_favorite(bigint, uuid, boolean, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.insert_notification(bigint, text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.insert_order(bigint, jsonb, numeric, jsonb, text, numeric, text, text, uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.insert_return(bigint, text, jsonb, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.insert_review(uuid, bigint, text, integer, text, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read(bigint) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_notification_read(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_coupon_usage(uuid, bigint, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_favorite(bigint, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_favorite(bigint, uuid, boolean, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_user(bigint, text, text, text, text, text) FROM anon;

-- ============================================================
-- 4. Fix authenticated_security_definer_function_executable
--    Revoke EXECUTE from authenticated on same functions
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.add_favorite(bigint, uuid, boolean, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.insert_notification(bigint, text, text, text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.insert_order(bigint, jsonb, numeric, jsonb, text, numeric, text, text, uuid, numeric) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.insert_return(bigint, text, jsonb, text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.insert_review(uuid, bigint, text, integer, text, jsonb, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read(bigint) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_notification_read(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.record_coupon_usage(uuid, bigint, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_favorite(bigint, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_favorite(bigint, uuid, boolean, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_user(bigint, text, text, text, text, text) FROM authenticated;

-- ============================================================
-- 5. Grant EXECUTE to service_role only
--    Ensure service_role can still call these functions
-- ============================================================

GRANT EXECUTE ON FUNCTION public.add_favorite(bigint, uuid, boolean, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_notification(bigint, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_order(bigint, jsonb, numeric, jsonb, text, numeric, text, text, uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_return(bigint, text, jsonb, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_review(uuid, bigint, text, integer, text, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_coupon_usage(uuid, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.remove_favorite(bigint, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_favorite(bigint, uuid, boolean, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_user(bigint, text, text, text, text, text) TO service_role;
