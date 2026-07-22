-- Fix append_order_status: restore stock-return on cancellation + cancellation_reason
-- The 20260710100000 migration accidentally removed these features

CREATE OR REPLACE FUNCTION append_order_status(
  p_order_id uuid,
  p_status text,
  p_changed_by text DEFAULT 'Admin',
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_should_archive boolean := false;
  v_new_status_history jsonb;
  v_item jsonb;
  v_items_array jsonb;
BEGIN
  SELECT id, status, status_history, visible_to_client, items
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

  -- Return stock on cancellation (if was not already cancelled)
  IF p_status = 'cancelled' AND v_order.status != 'cancelled' THEN
    IF jsonb_typeof(v_order.items) = 'string' THEN
      v_items_array := v_order.items::text::jsonb;
    ELSE
      v_items_array := v_order.items;
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items_array)
    LOOP
      UPDATE products
      SET stock = stock + COALESCE((v_item->>'quantity')::int, 1),
          updated_at = now()
      WHERE id = (v_item->>'productId')::uuid;
    END LOOP;
  END IF;

  UPDATE orders
  SET
    status = p_status,
    status_history = v_new_status_history,
    updated_at = now(),
    visible_to_client = CASE WHEN v_should_archive THEN false ELSE visible_to_client END,
    archived_at = CASE WHEN v_should_archive THEN now() ELSE archived_at END,
    cancellation_reason = CASE
      WHEN p_status = 'cancelled' AND p_note IS NOT NULL THEN p_note
      ELSE cancellation_reason
    END
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'id', p_order_id,
    'status', p_status,
    'status_history', v_new_status_history
  );
END;
$$;

GRANT EXECUTE ON FUNCTION append_order_status(uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION append_order_status(uuid, text, text, text) TO service_role;
