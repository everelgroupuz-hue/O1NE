-- Fix process_return_stock: remove RETURNING without INTO
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
