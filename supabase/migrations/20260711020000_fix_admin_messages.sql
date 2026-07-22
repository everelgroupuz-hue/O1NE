-- Fix admin messages: add customer_telegram_id to get_admin_conversations
-- Must DROP first because we're changing the return type

DROP FUNCTION IF EXISTS get_admin_conversations();

CREATE FUNCTION get_admin_conversations()
RETURNS TABLE (
  order_id uuid,
  order_number text,
  customer_name text,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint,
  customer_telegram_id bigint
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (m.order_id)
    m.order_id,
    LEFT(m.order_id::text, 8) as order_number,
    COALESCE(
      (SELECT customer_info->>'name' FROM orders WHERE id = m.order_id),
      'Пользователь'
    ) as customer_name,
    m.content as last_message,
    m.created_at as last_message_at,
    (SELECT COUNT(*) FROM messages m2
     WHERE m2.order_id = m.order_id
       AND m2.sender_type = 'customer'
       AND m2.is_read = false) as unread_count,
    (SELECT o.telegram_user_id FROM orders o WHERE o.id = m.order_id) as customer_telegram_id
  FROM messages m
  WHERE m.sender_type = 'customer'
  ORDER BY m.order_id, m.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_admin_conversations() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_admin_conversations() TO service_role;
