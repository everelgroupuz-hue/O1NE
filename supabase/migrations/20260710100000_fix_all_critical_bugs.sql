-- ============================================================
-- FIX ALL 5 CRITICAL BUGS
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. NOTIFICATIONS: Add clear_read function + auto-cleanup
-- ────────────────────────────────────────────────────────────

-- Allow users to clear their own read notifications
CREATE OR REPLACE FUNCTION clear_read_notifications(p_telegram_user_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM notifications
  WHERE telegram_user_id = p_telegram_user_id
    AND is_read = true;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Auto-cleanup: delete notifications older than 90 days
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM notifications
  WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 2. ORDERS: Stop archiving delivered orders
-- ────────────────────────────────────────────────────────────

-- Recreate append_order_status WITHOUT archiving 'delivered' orders
CREATE OR REPLACE FUNCTION append_order_status(
  p_order_id uuid,
  p_status text,
  p_changed_by text DEFAULT 'System',
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_should_archive boolean := false;
  v_new_status_history jsonb;
BEGIN
  SELECT id, status, status_history, visible_to_client
  INTO v_order
  FROM orders
  WHERE id = p_order_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Order not found');
  END IF;

  -- Build new status history entry
  v_new_status_history := COALESCE(v_order.status_history, '[]'::jsonb) ||
    jsonb_build_object(
      'status', p_status,
      'changed_at', to_char(now(), 'YYYY-MM-DD HH24:MI:SS.MS+00'),
      'changed_by', p_changed_by,
      'note', p_note
    );

  -- Archive ONLY cancelled/returned orders (NOT delivered)
  IF p_status IN ('cancelled', 'returned') THEN
    v_should_archive := true;
  END IF;

  UPDATE orders
  SET
    status = p_status,
    status_history = v_new_status_history,
    updated_at = now(),
    visible_to_client = CASE WHEN v_should_archive THEN false ELSE visible_to_client END,
    archived_at = CASE WHEN v_should_archive THEN now() ELSE archived_at END
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'id', p_order_id,
    'status', p_status,
    'status_history', v_new_status_history
  );
END;
$$;

-- Retroactively restore visibility for delivered orders
UPDATE orders
SET visible_to_client = true, archived_at = NULL
WHERE status = 'delivered' AND visible_to_client = false;

-- ────────────────────────────────────────────────────────────
-- 3. RETURNS: Fix process_return_stock function
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION process_return_stock(
  p_return_id uuid,
  p_status text,
  p_admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_return RECORD;
  v_item jsonb;
  v_items_array jsonb;
  v_refund_amount numeric := 0;
BEGIN
  SELECT * INTO v_return FROM returns WHERE id = p_return_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Return not found: %', p_return_id;
  END IF;

  IF p_status NOT IN ('approved', 'refunded') THEN
    UPDATE returns
    SET status = p_status,
        admin_note = COALESCE(p_admin_note, admin_note),
        updated_at = now()
    WHERE id = p_return_id;
    RETURN jsonb_build_object('status', p_status);
  END IF;

  IF jsonb_typeof(v_return.items) = 'string' THEN
    v_items_array := v_return.items::text::jsonb;
  ELSE
    v_items_array := v_return.items;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items_array)
  LOOP
    v_refund_amount := v_refund_amount + COALESCE((v_item->>'price')::numeric, 0) * COALESCE((v_item->>'quantity')::int, 1);
    IF p_status = 'refunded' THEN
      UPDATE products
      SET stock = stock + COALESCE((v_item->>'quantity')::int, 1),
          updated_at = now()
      WHERE id = (v_item->>'productId')::uuid;
    END IF;
  END LOOP;

  UPDATE returns
  SET status = p_status,
      admin_note = COALESCE(p_admin_note, admin_note),
      refund_amount = v_refund_amount,
      updated_at = now()
  WHERE id = p_return_id;

  RETURN jsonb_build_object('id', p_return_id, 'status', p_status, 'refund_amount', v_refund_amount);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 4. MESSAGES: Enable Realtime for faster delivery
-- ────────────────────────────────────────────────────────────

-- Enable Realtime on messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ────────────────────────────────────────────────────────────
-- 5. PRODUCT VIEWS: Fix increment_views to be SECURITY DEFINER
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_views(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE products SET views = views + 1 WHERE id = p_id;
END;
$$;

-- Also add track_product_event to the security linter exclusion list
-- (this is a comment for documentation - the function exists and works)
