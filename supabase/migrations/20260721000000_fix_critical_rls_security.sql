-- ============================================================
-- FIX CRITICAL RLS POLICIES (2026-07-21)
-- Replaces permissive USING (true) SELECT policies with
-- proper telegram_user_id filtering
-- ============================================================

-- 1. ORDERS: Fix SELECT policy to only allow reading own orders
DROP POLICY IF EXISTS "orders_select_own" ON orders;
DROP POLICY IF EXISTS "orders_select_checkout" ON orders;
DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "orders_select_own" ON orders
  FOR SELECT USING (
    telegram_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::bigint
    OR telegram_user_id::text = current_setting('request.headers', true)::json->>'x-telegram-user-id'
  );

-- 2. USERS: Fix SELECT policy to only allow reading own profile
DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (
    telegram_id = (current_setting('request.jwt.claims', true)::json->>'sub')::bigint
    OR telegram_id::text = current_setting('request.headers', true)::json->>'x-telegram-user-id'
  );

-- 3. FAVORITES: Fix SELECT policy
DROP POLICY IF EXISTS "favorites_select_own" ON favorites;
CREATE POLICY "favorites_select_own" ON favorites
  FOR SELECT USING (
    telegram_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::bigint
    OR telegram_user_id::text = current_setting('request.headers', true)::json->>'x-telegram-user-id'
  );

-- 4. NOTIFICATIONS: Fix SELECT policy
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (
    telegram_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::bigint
    OR telegram_user_id::text = current_setting('request.headers', true)::json->>'x-telegram-user-id'
  );

-- 5. RETURNS: Fix SELECT policy
DROP POLICY IF EXISTS "returns_select_own" ON returns;
CREATE POLICY "returns_select_own" ON returns
  FOR SELECT USING (
    telegram_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::bigint
    OR telegram_user_id::text = current_setting('request.headers', true)::json->>'x-telegram-user-id'
  );

-- 6. MESSAGES: Fix SELECT policy — only see own conversations
DROP POLICY IF EXISTS "messages_select_own" ON messages;
CREATE POLICY "messages_select_own" ON messages
  FOR SELECT USING (
    sender_id::text = current_setting('request.headers', true)::json->>'x-telegram-user-id'
    OR receiver_id::text = current_setting('request.headers', true)::json->>'x-telegram-user-id'
  );

-- 7. MESSAGES: Fix INSERT policy — prevent admin spoofing without session
DROP POLICY IF EXISTS "messages_insert_admin" ON messages;
DROP POLICY IF EXISTS "messages_insert_customer" ON messages;
CREATE POLICY "messages_insert_customer" ON messages
  FOR INSERT TO anon
  WITH CHECK (sender_type = 'customer');

-- 8. NOTIFICATIONS: Fix INSERT — prevent inserting for other users
DROP POLICY IF EXISTS "notifications_insert_any" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_own" ON notifications
  FOR INSERT TO anon
  WITH CHECK (
    telegram_user_id::text = current_setting('request.headers', true)::json->>'x-telegram-user-id'
  );

-- 9. FAVORITES: Fix UPDATE/DELETE to only own
DROP POLICY IF EXISTS "favorites_update_own" ON favorites;
DROP POLICY IF EXISTS "favorites_delete_own" ON favorites;
CREATE POLICY "favorites_update_own" ON favorites
  FOR UPDATE USING (
    telegram_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::bigint
    OR telegram_user_id::text = current_setting('request.headers', true)::json->>'x-telegram-user-id'
  );
CREATE POLICY "favorites_delete_own" ON favorites
  FOR DELETE USING (
    telegram_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::bigint
    OR telegram_user_id::text = current_setting('request.headers', true)::json->>'x-telegram-user-id'
  );

-- 10. NOTIFICATIONS: Fix UPDATE to only own
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (
    telegram_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::bigint
    OR telegram_user_id::text = current_setting('request.headers', true)::json->>'x-telegram-user-id'
  );

-- 11. MESSAGES: Fix UPDATE to only own read status
DROP POLICY IF EXISTS "messages_update_read" ON messages;
CREATE POLICY "messages_update_read" ON messages
  FOR UPDATE USING (
    receiver_id::text = current_setting('request.headers', true)::json->>'x-telegram-user-id'
  );

-- 12. Ensure session_expires_at column exists on admin_accounts
ALTER TABLE admin_accounts ADD COLUMN IF NOT EXISTS session_expires_at timestamptz;

-- 13. Revoke get_admin_conversations from anon — only service_role and authenticated
REVOKE EXECUTE ON FUNCTION get_admin_conversations() FROM anon;
GRANT EXECUTE ON FUNCTION get_admin_conversations() TO authenticated;
