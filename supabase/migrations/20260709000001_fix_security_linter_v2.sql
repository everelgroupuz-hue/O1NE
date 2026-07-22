-- Fix all Supabase Database Linter warnings (v2)
-- The previous migration didn't work because functions were recreated
-- This migration uses a DO block to dynamically fix all SECURITY DEFINER functions

-- ============================================================
-- 1. Fix function_search_path_mutable
-- ============================================================

DO $$
BEGIN
  -- Fix search_products
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'search_products') THEN
    ALTER FUNCTION public.search_products(p_query text) SET search_path = public;
  END IF;

  -- Fix verify_admin_password
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'verify_admin_password') THEN
    ALTER FUNCTION public.verify_admin_password(p_email text, p_password text) SET search_path = public;
  END IF;
END $$;

-- ============================================================
-- 2. Revoke EXECUTE from anon and authenticated on all
--    SECURITY DEFINER functions that should only be called
--    via service_role (Edge Functions)
-- ============================================================

DO $$
DECLARE
  func RECORD;
  func_sig text;
BEGIN
  FOR func IN
    SELECT p.proname, pg_get_function_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true  -- SECURITY DEFINER
      AND p.proname NOT IN (
        'search_products',
        'verify_admin_password',
        'get_client_orders',
        'get_admin_orders',
        'increment_views',
        'adjust_stock',
        'append_order_status',
        'process_return_stock',
        'update_updated_at_column'
      )
  LOOP
    func_sig := func.proname || '(' || func.args || ')';

    -- Revoke from anon
    BEGIN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION public.%s FROM anon',
        func_sig
      );
      RAISE NOTICE 'Revoked EXECUTE from anon: %', func_sig;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not revoke from anon: % — %', func_sig, SQLERRM;
    END;

    -- Revoke from authenticated
    BEGIN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION public.%s FROM authenticated',
        func_sig
      );
      RAISE NOTICE 'Revoked EXECUTE from authenticated: %', func_sig;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not revoke from authenticated: % — %', func_sig, SQLERRM;
    END;

    -- Grant to service_role
    BEGIN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.%s TO service_role',
        func_sig
      );
      RAISE NOTICE 'Granted EXECUTE to service_role: %', func_sig;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not grant to service_role: % — %', func_sig, SQLERRM;
    END;
  END LOOP;
END $$;
