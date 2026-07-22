-- Hide delivered orders from client after 14 days
-- Orders within 14 days of delivery remain visible for return requests

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
    AND (
      o.status != 'delivered'
      OR (
        o.status = 'delivered'
        AND (
          SELECT (elem->>'changed_at')::timestamptz
          FROM jsonb_array_elements(o.status_history) AS elem
          WHERE elem->>'status' = 'delivered'
          ORDER BY (elem->>'changed_at')::timestamptz DESC
          LIMIT 1
        ) > now() - interval '14 days'
      )
    )
  ORDER BY o.created_at DESC
  LIMIT 50;
END;
$$;
