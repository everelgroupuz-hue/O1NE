-- Create messages table for customer-admin chat

CREATE TABLE IF NOT EXISTS messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  sender_type text NOT NULL CHECK (sender_type IN ('customer', 'admin')),
  sender_id text NOT NULL,
  receiver_id text,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_order_id ON messages(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_type, sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, is_read);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "messages_select_own" ON messages;
CREATE POLICY "messages_select_own" ON messages
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "messages_insert_customer" ON messages;
CREATE POLICY "messages_insert_customer" ON messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (sender_type = 'customer');

DROP POLICY IF EXISTS "messages_insert_admin" ON messages;
CREATE POLICY "messages_insert_admin" ON messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (sender_type = 'admin');

DROP POLICY IF EXISTS "messages_update_read" ON messages;
CREATE POLICY "messages_update_read" ON messages
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RPC: Get conversation for an order
CREATE OR REPLACE FUNCTION get_order_messages(p_order_id uuid)
RETURNS SETOF messages
LANGUAGE sql STABLE
AS $$
  SELECT * FROM messages
  WHERE order_id = p_order_id
  ORDER BY created_at ASC;
$$;

-- RPC: Get unread message count for customer
CREATE OR REPLACE FUNCTION get_unread_message_count(p_sender_id text)
RETURNS integer
LANGUAGE sql STABLE
AS $$
  SELECT COUNT(*)::integer FROM messages
  WHERE receiver_id = p_sender_id AND is_read = false;
$$;

-- RPC: Send message
CREATE OR REPLACE FUNCTION send_message(
  p_order_id uuid,
  p_sender_type text,
  p_sender_id text,
  p_receiver_id text,
  p_content text
)
RETURNS messages
LANGUAGE plpgsql
AS $$
DECLARE
  v_message messages;
BEGIN
  INSERT INTO messages (order_id, sender_type, sender_id, receiver_id, content)
  VALUES (p_order_id, p_sender_type, p_sender_id, p_receiver_id, p_content)
  RETURNING * INTO v_message;

  RETURN v_message;
END;
$$;

-- RPC: Mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_read(p_order_id uuid, p_sender_id text)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE messages
  SET is_read = true, updated_at = now()
  WHERE order_id = p_order_id
    AND sender_id != p_sender_id
    AND is_read = false;
$$;

-- RPC: Get conversations list for admin
CREATE OR REPLACE FUNCTION get_admin_conversations()
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

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_messages_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_messages_updated_at();
