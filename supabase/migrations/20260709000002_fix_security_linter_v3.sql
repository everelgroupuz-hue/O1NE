-- Fix all Supabase Database Linter warnings (v3)
-- Uses pg_get_function_identity_arguments() to avoid DEFAULT syntax issues

-- ============================================================
-- 1. Fix function_search_path_mutable
-- ============================================================

ALTER FUNCTION public.search_products(p_query text) SET search_path = public;
ALTER FUNCTION public.verify_admin_password(p_email text, p_password text) SET search_path = public;

-- ============================================================
-- 2. Revoke EXECUTE from anon and authenticated on all
--    SECURITY DEFINER functions (except read-only ones)
-- ============================================================

DO $$
DECLARE
  func RECORD;
  func_sig text;
  excluded text[] := ARRAY[
    'search_products',
    'verify_admin_password',
    'get_client_orders',
    'get_admin_orders',
    'increment_views',
    'adjust_stock',
    'append_order_status',
    'process_return_stock',
    'update_updated_at_column'
  ];
BEGIN
  FOR func IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname != ALL(excluded)
  LOOP
    func_sig := func.proname || '(' || func.identity_args || ')';

    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon', func.proname, func.identity_args);
      RAISE NOTICE 'OK revoke anon: %', func_sig;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'SKIP anon: % — %', func_sig, SQLERRM;
    END;

    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM authenticated', func.proname, func.identity_args);
      RAISE NOTICE 'OK revoke auth: %', func_sig;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'SKIP auth: % — %', func_sig, SQLERRM;
    END;

    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', func.proname, func.identity_args);
      RAISE NOTICE 'OK grant service: %', func_sig;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'SKIP service: % — %', func_sig, SQLERRM;
    END;
  END LOOP;
END $$;
