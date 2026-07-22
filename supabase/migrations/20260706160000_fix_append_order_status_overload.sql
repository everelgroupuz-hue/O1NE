-- Fix: Remove duplicate append_order_status(text) overload
-- Only the uuid version should exist

DROP FUNCTION IF EXISTS public.append_order_status(text, text, text, text);
