-- ============================================================
-- FIX RLS: Block all anon access on sensitive tables
-- All user data access goes through edge functions with
-- service_role which bypasses RLS. Anon should see NOTHING.
-- ============================================================

-- 1. ORDERS: Block anon completely
DROP POLICY IF EXISTS "orders_select_own" ON orders;
DROP POLICY IF EXISTS "orders_insert_checkout" ON orders;
CREATE POLICY "orders_service_all" ON orders
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "orders_anon_nothing" ON orders
  FOR SELECT USING (false);

-- 2. USERS: Block anon completely
DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_service_all" ON users
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "users_anon_nothing" ON users
  FOR SELECT USING (false);

-- 3. FAVORITES: Block anon completely
DROP POLICY IF EXISTS "favorites_select_own" ON favorites;
DROP POLICY IF EXISTS "favorites_update_own" ON favorites;
DROP POLICY IF EXISTS "favorites_delete_own" ON favorites;
CREATE POLICY "favorites_service_all" ON favorites
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "favorites_anon_nothing" ON favorites
  FOR SELECT USING (false);

-- 4. NOTIFICATIONS: Block anon completely
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_service_all" ON notifications
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "notifications_anon_nothing" ON notifications
  FOR SELECT USING (false);

-- 5. RETURNS: Block anon completely
DROP POLICY IF EXISTS "returns_select_own" ON returns;
CREATE POLICY "returns_service_all" ON returns
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "returns_anon_nothing" ON returns
  FOR SELECT USING (false);

-- 6. MESSAGES: Block anon completely
DROP POLICY IF EXISTS "messages_select_own" ON messages;
DROP POLICY IF EXISTS "messages_insert_customer" ON messages;
DROP POLICY IF EXISTS "messages_update_read" ON messages;
CREATE POLICY "messages_service_all" ON messages
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "messages_anon_nothing" ON messages
  FOR SELECT USING (false);

-- 7. REVIEWS: Allow anon SELECT (public), block anon INSERT without product_id
DROP POLICY IF EXISTS "reviews_select_approved" ON reviews;
CREATE POLICY "reviews_select_public" ON reviews
  FOR SELECT USING (true);
CREATE POLICY "reviews_service_all" ON reviews
  FOR ALL USING (auth.role() = 'service_role');

-- 8. COUPONS: Allow anon SELECT (for CouponInput), block mutations
DROP POLICY IF EXISTS "coupons_select_active" ON coupons;
CREATE POLICY "coupons_select_public" ON coupons
  FOR SELECT USING (is_active = true);
CREATE POLICY "coupons_service_all" ON coupons
  FOR ALL USING (auth.role() = 'service_role');

-- 9. DELIVERY_ZONES: Allow anon SELECT (public), block mutations
CREATE POLICY "zones_select_public" ON delivery_zones
  FOR SELECT USING (true);
CREATE POLICY "zones_service_all" ON delivery_zones
  FOR ALL USING (auth.role() = 'service_role');

-- 10. CATEGORIES: Allow anon SELECT (public), block mutations
CREATE POLICY "categories_select_public" ON categories
  FOR SELECT USING (true);
CREATE POLICY "categories_service_all" ON categories
  FOR ALL USING (auth.role() = 'service_role');

-- 11. BANNERS: Allow anon SELECT (public), block mutations
CREATE POLICY "banners_select_public" ON banners
  FOR SELECT USING (true);
CREATE POLICY "banners_service_all" ON banners
  FOR ALL USING (auth.role() = 'service_role');

-- 12. BROADCAST_JOBS: Block anon completely
CREATE POLICY "broadcast_service_all" ON broadcast_jobs
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "broadcast_anon_nothing" ON broadcast_jobs
  FOR SELECT USING (false);

-- 13. REFERRALS: Block anon completely
CREATE POLICY "referrals_service_all" ON referrals
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "referrals_anon_nothing" ON referrals
  FOR SELECT USING (false);

-- 14. COUPON_USAGE: Block anon completely
CREATE POLICY "coupon_usage_service_all" ON coupon_usage
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "coupon_usage_anon_nothing" ON coupon_usage
  FOR SELECT USING (false);

-- 17. AUDIT_LOG: Block anon completely
CREATE POLICY "audit_service_all" ON audit_log
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "audit_anon_nothing" ON audit_log
  FOR SELECT USING (false);

-- 18. Revoke get_admin_conversations from anon
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION get_admin_conversations() FROM anon;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 19. Ensure session_expires_at column exists
ALTER TABLE admin_accounts ADD COLUMN IF NOT EXISTS session_expires_at timestamptz;
