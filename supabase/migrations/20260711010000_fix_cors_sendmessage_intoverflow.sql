-- ============================================================
-- FIX: send_message SECURITY DEFINER + integer overflow
-- ============================================================

-- ── 1. Fix send_message: add SECURITY DEFINER ─────────────

CREATE OR REPLACE FUNCTION send_message(
  p_order_id uuid,
  p_sender_type text,
  p_sender_id text,
  p_receiver_id text,
  p_content text
)
RETURNS messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message messages;
  v_telegram_user_id bigint;
  v_admin_telegram_id text;
BEGIN
  INSERT INTO messages (order_id, sender_type, sender_id, receiver_id, content)
  VALUES (p_order_id, p_sender_type, p_sender_id, p_receiver_id, p_content)
  RETURNING * INTO v_message;

  IF p_sender_type = 'admin' THEN
    SELECT o.telegram_user_id INTO v_telegram_user_id
    FROM orders o WHERE o.id = p_order_id;

    IF v_telegram_user_id IS NOT NULL THEN
      INSERT INTO notifications (telegram_user_id, type, title, body, data)
      VALUES (
        v_telegram_user_id,
        'new_message',
        '💬 Новое сообщение',
        LEFT(p_content, 200),
        jsonb_build_object('order_id', p_order_id::text, 'sender_type', 'admin')
      );
    END IF;
  END IF;

  IF p_sender_type = 'customer' THEN
    BEGIN
      v_admin_telegram_id := current_setting('app.settings.admin_telegram_id', true);
    EXCEPTION WHEN OTHERS THEN
      v_admin_telegram_id := NULL;
    END;

    IF v_admin_telegram_id IS NOT NULL AND v_admin_telegram_id != '' THEN
      INSERT INTO notifications (telegram_user_id, type, title, body, data)
      VALUES (
        v_admin_telegram_id::bigint,
        'admin_new_message',
        '💬 Сообщение от клиента',
        LEFT(p_content, 200),
        jsonb_build_object('order_id', p_order_id::text, 'sender_id', p_sender_id, 'sender_type', 'customer')
      );
    END IF;
  END IF;

  RETURN v_message;
END;
$$;

GRANT EXECUTE ON FUNCTION send_message(uuid, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION send_message(uuid, text, text, text, text) TO service_role;

-- ── 2. Fix integer overflow: telegram_user_id integer → bigint ──

-- Drop ALL policies that reference telegram_user_id on each table,
-- alter the column, then recreate the policies.

-- NOTIFICATIONS
DO $$ BEGIN
  DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
  DROP POLICY IF EXISTS "notifications_insert_any" ON notifications;
  DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
  DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
  DROP POLICY IF EXISTS "anon_select_notifications" ON notifications;
  DROP POLICY IF EXISTS "anon_insert_notifications" ON notifications;
  DROP POLICY IF EXISTS "anon_update_notifications" ON notifications;
  DROP POLICY IF EXISTS "anon_all_notifications" ON notifications;
  DROP POLICY IF EXISTS "anon_notifications_all" ON notifications;
  DROP POLICY IF EXISTS "anon_full_access" ON notifications;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE notifications
  ALTER COLUMN telegram_user_id SET DATA TYPE bigint;

CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "notifications_insert_own" ON notifications
  FOR INSERT TO anon, authenticated WITH CHECK (telegram_user_id IS NOT NULL);
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO anon, authenticated USING (true);

-- RETURNS
DO $$ BEGIN
  DROP POLICY IF EXISTS "returns_select_own" ON returns;
  DROP POLICY IF EXISTS "returns_insert_own" ON returns;
  DROP POLICY IF EXISTS "anon_select_returns" ON returns;
  DROP POLICY IF EXISTS "anon_insert_returns" ON returns;
  DROP POLICY IF EXISTS "anon_all_returns" ON returns;
  DROP POLICY IF EXISTS "anon_returns_all" ON returns;
  DROP POLICY IF EXISTS "anon_full_access" ON returns;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE returns
  ALTER COLUMN telegram_user_id SET DATA TYPE bigint;

CREATE POLICY "returns_select_own" ON returns
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "returns_insert_own" ON returns
  FOR INSERT TO anon, authenticated WITH CHECK (order_id IS NOT NULL AND reason IS NOT NULL);

-- COUPON_USAGE
DO $$ BEGIN
  DROP POLICY IF EXISTS "coupon_usage_select_own" ON coupon_usage;
  DROP POLICY IF EXISTS "coupon_usage_insert" ON coupon_usage;
  DROP POLICY IF EXISTS "anon_select_coupon_usage" ON coupon_usage;
  DROP POLICY IF EXISTS "anon_insert_coupon_usage" ON coupon_usage;
  DROP POLICY IF EXISTS "anon_all_coupon_usage" ON coupon_usage;
  DROP POLICY IF EXISTS "anon_coupon_usage_all" ON coupon_usage;
  DROP POLICY IF EXISTS "anon_full_access" ON coupon_usage;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE coupon_usage
  ALTER COLUMN telegram_user_id SET DATA TYPE bigint;

CREATE POLICY "coupon_usage_select_own" ON coupon_usage
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "coupon_usage_insert" ON coupon_usage
  FOR INSERT TO anon, authenticated WITH CHECK (coupon_id IS NOT NULL);

-- ABANDONED_CARTS
ALTER TABLE abandoned_carts
  ALTER COLUMN telegram_user_id SET DATA TYPE bigint;

-- ── 3. Fix get_order_messages: SECURITY DEFINER ────────────

CREATE OR REPLACE FUNCTION get_order_messages(p_order_id uuid)
RETURNS SETOF messages
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM messages
  WHERE order_id = p_order_id
  ORDER BY created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION get_order_messages(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_order_messages(uuid) TO service_role;
