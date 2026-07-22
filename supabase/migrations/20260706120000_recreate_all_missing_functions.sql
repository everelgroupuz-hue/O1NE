-- Recreate all RPC functions that were lost during pgdelta SSL error

-- 1. increment_views
CREATE OR REPLACE FUNCTION increment_views(p_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products SET views = views + 1 WHERE id = p_id;
END;
$$;

-- 2. verify_admin_password
CREATE OR REPLACE FUNCTION verify_admin_password(p_email text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin RECORD;
  v_valid boolean := false;
BEGIN
  SELECT id, email, first_name, role, password_hash, is_active
  INTO v_admin
  FROM admin_accounts
  WHERE email = lower(trim(p_email))
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Admin not found');
  END IF;

  IF v_admin.password_hash LIKE '$2%' THEN
    IF extensions.crypt(p_password, v_admin.password_hash) = v_admin.password_hash THEN
      v_valid := true;
    END IF;
  ELSIF v_admin.password_hash = p_password THEN
    v_valid := true;
  END IF;

  IF NOT v_valid THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid password');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'id', v_admin.id,
    'email', v_admin.email,
    'first_name', v_admin.first_name,
    'role', v_admin.role
  );
END;
$$;

-- 3. get_client_orders (latest version with qualified columns)
CREATE OR REPLACE FUNCTION get_client_orders(p_telegram_user_id bigint)
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
SECURITY DEFINER
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

-- 4. append_order_status (latest version with stock return and archiving)
CREATE OR REPLACE FUNCTION append_order_status(
  p_order_id uuid,
  p_status text,
  p_changed_by text DEFAULT 'Admin',
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_should_archive boolean := false;
  v_should_return_stock boolean := false;
  v_order RECORD;
  v_item jsonb;
  v_items_array jsonb;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  IF p_status IN ('cancelled', 'delivered', 'returned') THEN
    v_should_archive := true;
  END IF;

  IF p_status = 'cancelled' AND v_order.status != 'cancelled' THEN
    v_should_return_stock := true;
  END IF;

  IF jsonb_typeof(v_order.items) = 'string' THEN
    v_items_array := v_order.items::text::jsonb;
  ELSE
    v_items_array := v_order.items;
  END IF;

  IF v_should_return_stock THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items_array)
    LOOP
      UPDATE products
      SET stock = stock + COALESCE((v_item->>'quantity')::int, 1),
          updated_at = now()
      WHERE id = (v_item->>'productId')::uuid;
    END LOOP;
  END IF;

  UPDATE orders
  SET status = p_status,
      status_history = status_history || jsonb_build_array(
        jsonb_build_object(
          'status', p_status,
          'changed_at', now()::text,
          'changed_by', p_changed_by,
          'note', p_note
        )
      ),
      updated_at = now(),
      visible_to_client = CASE WHEN v_should_archive THEN false ELSE visible_to_client END,
      archived_at = CASE WHEN v_should_archive THEN now() ELSE archived_at END,
      cancellation_reason = CASE 
        WHEN p_status = 'cancelled' AND p_note IS NOT NULL THEN p_note
        ELSE cancellation_reason
      END
  WHERE id = p_order_id
  RETURNING jsonb_build_object(
    'id', id,
    'status', status,
    'total_amount', total_amount,
    'status_history', status_history,
    'customer_info', customer_info,
    'delivery_type', delivery_type,
    'delivery_cost', delivery_cost,
    'payment_method', payment_method,
    'notes', notes,
    'created_at', created_at,
    'updated_at', updated_at,
    'visible_to_client', visible_to_client,
    'archived_at', archived_at,
    'cancellation_reason', cancellation_reason,
    'telegram_user_id', telegram_user_id,
    'items', items
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 5. create_order_with_stock (latest version with race condition fix)
CREATE OR REPLACE FUNCTION create_order_with_stock(
  p_telegram_user_id bigint,
  p_items jsonb,
  p_total_amount numeric,
  p_customer_info jsonb,
  p_delivery_type text,
  p_delivery_cost numeric,
  p_payment_method text,
  p_notes text,
  p_coupon_id uuid,
  p_discount_amount numeric,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id uuid;
  v_item jsonb;
  v_product_id text;
  v_quantity int;
  v_new_stock int;
  v_result jsonb;
  v_items_array jsonb;
  v_product_name text;
BEGIN
  v_order_id := gen_random_uuid();

  IF jsonb_typeof(p_items) = 'string' THEN
    v_items_array := p_items::text::jsonb;
  ELSE
    v_items_array := p_items;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items_array)
  LOOP
    v_product_id := v_item->>'productId';
    v_quantity := COALESCE((v_item->>'quantity')::int, 1);

    UPDATE products
    SET stock = stock - v_quantity,
        updated_at = now()
    WHERE id = v_product_id::uuid
      AND stock >= v_quantity
      AND is_active = true
    RETURNING stock INTO v_new_stock;

    IF v_new_stock IS NULL THEN
      SELECT name->'ru' INTO v_product_name FROM products WHERE id = v_product_id::uuid;
      IF v_product_name IS NULL THEN
        RAISE EXCEPTION 'Товар не найден: %', v_product_id;
      ELSE
        RAISE EXCEPTION 'Недостаточно товара "%". Попробуйте уменьшить количество.', v_product_name;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO orders (
    id, telegram_user_id, items, total_amount, status, customer_info,
    delivery_type, delivery_cost, payment_method, notes, coupon_id,
    discount_amount, created_at, updated_at, status_history
  ) VALUES (
    v_order_id, p_telegram_user_id, v_items_array, p_total_amount, p_status,
    p_customer_info, p_delivery_type, p_delivery_cost, p_payment_method,
    p_notes, p_coupon_id, p_discount_amount, now(), now(),
    jsonb_build_array(jsonb_build_object('status', p_status, 'changed_at', now()::text, 'changed_by', 'System'))
  )
  RETURNING jsonb_build_object('id', id::text, 'status', status, 'total_amount', total_amount) INTO v_result;

  RETURN v_result;
END;
$$;

-- 6. process_return_stock
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
  WHERE id = p_return_id
  RETURNING jsonb_build_object(
    'id', id,
    'status', status,
    'refund_amount', refund_amount,
    'admin_note', admin_note
  );

  RETURN jsonb_build_object('status', p_status, 'refund_amount', v_refund_amount);
END;
$$;

-- 7. adjust_stock
CREATE OR REPLACE FUNCTION adjust_stock(p_product_id uuid, p_delta int)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_stock int;
BEGIN
  UPDATE products
  SET stock = GREATEST(0, stock + p_delta),
      updated_at = now()
  WHERE id = p_product_id
  RETURNING stock INTO v_new_stock;

  IF v_new_stock IS NULL THEN
    RAISE EXCEPTION 'Product % not found', p_product_id;
  END IF;

  RETURN jsonb_build_object('id', p_product_id, 'stock', v_new_stock);
END;
$$;

-- 8. update_updated_at_column trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 9. get_admin_orders
CREATE OR REPLACE FUNCTION get_admin_orders(
  p_status_filter text DEFAULT NULL,
  p_search_query text DEFAULT NULL,
  p_include_archived boolean DEFAULT true
)
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
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id, o.telegram_user_id, o.items, o.total_amount, o.status, o.customer_info,
    o.delivery_type, o.delivery_cost, o.payment_method, o.notes, o.created_at, o.updated_at,
    o.status_history, o.deleted_at, o.coupon_id, o.discount_amount, o.transaction_id,
    o.paid_at, o.visible_to_client, o.archived_at, o.cancellation_reason
  FROM orders o
  WHERE 
    (p_status_filter IS NULL OR o.status = p_status_filter)
    AND o.deleted_at IS NULL
    AND (
      p_search_query IS NULL 
      OR o.id::text ILIKE '%' || p_search_query || '%'
      OR o.telegram_user_id::text ILIKE '%' || p_search_query || '%'
      OR o.customer_info::text ILIKE '%' || p_search_query || '%'
    )
  ORDER BY o.created_at DESC
  LIMIT 200;
END;
$$;
