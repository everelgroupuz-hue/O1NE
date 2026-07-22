-- ============================================================
-- NUCLEAR OPTION: Drop ALL policies on sensitive tables
-- and recreate with strict service_role-only access.
-- Public tables get explicit anon SELECT.
-- ============================================================

-- ========== ORDERS ==========
DO $$ BEGIN
  DROP POLICY IF EXISTS "orders_select_own" ON orders;
  DROP POLICY IF EXISTS "orders_insert_checkout" ON orders;
  DROP POLICY IF EXISTS "orders_service_all" ON orders;
  DROP POLICY IF EXISTS "orders_anon_nothing" ON orders;
  DROP POLICY IF EXISTS "anon_select_orders" ON orders;
  DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
  DROP POLICY IF EXISTS "anon_update_orders" ON orders;
  DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
  DROP POLICY IF EXISTS "Anyone can insert orders" ON orders;
  DROP POLICY IF EXISTS "Anyone can read orders" ON orders;
  DROP POLICY IF EXISTS "Anyone can update orders" ON orders;
  DROP POLICY IF EXISTS "Anyone can view orders" ON orders;
  DROP POLICY IF EXISTS "Authenticated users can update orders" ON orders;
  DROP POLICY IF EXISTS "Service role full access to orders" ON orders;
  DROP POLICY IF EXISTS "Anon can insert orders" ON orders;
  DROP POLICY IF EXISTS "Anon can read own orders" ON orders;
  DROP POLICY IF EXISTS "Service role can update orders" ON orders;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "orders_full_access" ON orders FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "orders_anon_denied" ON orders FOR SELECT USING (false);

-- ========== USERS ==========
DO $$ BEGIN
  DROP POLICY IF EXISTS "users_select_own" ON users;
  DROP POLICY IF EXISTS "users_service_all" ON users;
  DROP POLICY IF EXISTS "users_anon_nothing" ON users;
  DROP POLICY IF EXISTS "anon_select_users" ON users;
  DROP POLICY IF EXISTS "anon_insert_users" ON users;
  DROP POLICY IF EXISTS "anon_update_users" ON users;
  DROP POLICY IF EXISTS "anon_delete_users" ON users;
  DROP POLICY IF EXISTS "Anyone can insert users" ON users;
  DROP POLICY IF EXISTS "Anyone can read users" ON users;
  DROP POLICY IF EXISTS "Anyone can update users" ON users;
  DROP POLICY IF EXISTS "Anyone can view users" ON users;
  DROP POLICY IF EXISTS "Service role full access to users" ON users;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "users_full_access" ON users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "users_anon_denied" ON users FOR SELECT USING (false);

-- ========== FAVORITES ==========
DO $$ BEGIN
  DROP POLICY IF EXISTS "favorites_select_own" ON favorites;
  DROP POLICY IF EXISTS "favorites_update_own" ON favorites;
  DROP POLICY IF EXISTS "favorites_delete_own" ON favorites;
  DROP POLICY IF EXISTS "favorites_service_all" ON favorites;
  DROP POLICY IF EXISTS "favorites_anon_nothing" ON favorites;
  DROP POLICY IF EXISTS "anon_select_favorites" ON favorites;
  DROP POLICY IF EXISTS "anon_insert_favorites" ON favorites;
  DROP POLICY IF EXISTS "anon_update_favorites" ON favorites;
  DROP POLICY IF EXISTS "anon_delete_favorites" ON favorites;
  DROP POLICY IF EXISTS "Anyone can insert favorites" ON favorites;
  DROP POLICY IF EXISTS "Anyone can read favorites" ON favorites;
  DROP POLICY IF EXISTS "Service role full access to favorites" ON favorites;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "favorites_full_access" ON favorites FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "favorites_anon_denied" ON favorites FOR SELECT USING (false);

-- ========== NOTIFICATIONS ==========
DO $$ BEGIN
  DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
  DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
  DROP POLICY IF EXISTS "notifications_insert_any" ON notifications;
  DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
  DROP POLICY IF EXISTS "notifications_service_all" ON notifications;
  DROP POLICY IF EXISTS "notifications_anon_nothing" ON notifications;
  DROP POLICY IF EXISTS "anon_select_notifications" ON notifications;
  DROP POLICY IF EXISTS "anon_insert_notifications" ON notifications;
  DROP POLICY IF EXISTS "anon_update_notifications" ON notifications;
  DROP POLICY IF EXISTS "anon_delete_notifications" ON notifications;
  DROP POLICY IF EXISTS "Anyone can insert notifications" ON notifications;
  DROP POLICY IF EXISTS "Anyone can read notifications" ON notifications;
  DROP POLICY IF EXISTS "Service role full access to notifications" ON notifications;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "notifications_full_access" ON notifications FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "notifications_anon_denied" ON notifications FOR SELECT USING (false);

-- ========== RETURNS ==========
DO $$ BEGIN
  DROP POLICY IF EXISTS "returns_select_own" ON returns;
  DROP POLICY IF EXISTS "returns_service_all" ON returns;
  DROP POLICY IF EXISTS "returns_anon_nothing" ON returns;
  DROP POLICY IF EXISTS "anon_select_returns" ON returns;
  DROP POLICY IF EXISTS "anon_insert_returns" ON returns;
  DROP POLICY IF EXISTS "anon_update_returns" ON returns;
  DROP POLICY IF EXISTS "anon_delete_returns" ON returns;
  DROP POLICY IF EXISTS "Anyone can insert returns" ON returns;
  DROP POLICY IF EXISTS "Anyone can read returns" ON returns;
  DROP POLICY IF EXISTS "Service role full access to returns" ON returns;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "returns_full_access" ON returns FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "returns_anon_denied" ON returns FOR SELECT USING (false);

-- ========== MESSAGES ==========
DO $$ BEGIN
  DROP POLICY IF EXISTS "messages_select_own" ON messages;
  DROP POLICY IF EXISTS "messages_insert_admin" ON messages;
  DROP POLICY IF EXISTS "messages_insert_customer" ON messages;
  DROP POLICY IF EXISTS "messages_update_read" ON messages;
  DROP POLICY IF EXISTS "messages_service_all" ON messages;
  DROP POLICY IF EXISTS "messages_anon_nothing" ON messages;
  DROP POLICY IF EXISTS "anon_select_messages" ON messages;
  DROP POLICY IF EXISTS "anon_insert_messages" ON messages;
  DROP POLICY IF EXISTS "anon_update_messages" ON messages;
  DROP POLICY IF EXISTS "anon_delete_messages" ON messages;
  DROP POLICY IF EXISTS "Anyone can insert messages" ON messages;
  DROP POLICY IF EXISTS "Anyone can read messages" ON messages;
  DROP POLICY IF EXISTS "Service role full access to messages" ON messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "messages_full_access" ON messages FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "messages_anon_denied" ON messages FOR SELECT USING (false);

-- ========== REFERRALS ==========
DO $$ BEGIN
  DROP POLICY IF EXISTS "referrals_service_all" ON referrals;
  DROP POLICY IF EXISTS "referrals_anon_nothing" ON referrals;
  DROP POLICY IF EXISTS "anon_select_referrals" ON referrals;
  DROP POLICY IF EXISTS "anon_insert_referrals" ON referrals;
  DROP POLICY IF EXISTS "Anyone can insert referrals" ON referrals;
  DROP POLICY IF EXISTS "Anyone can read referrals" ON referrals;
  DROP POLICY IF EXISTS "Service role full access to referrals" ON referrals;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "referrals_full_access" ON referrals FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "referrals_anon_denied" ON referrals FOR SELECT USING (false);

-- ========== COUPON_USAGE ==========
DO $$ BEGIN
  DROP POLICY IF EXISTS "coupon_usage_service_all" ON coupon_usage;
  DROP POLICY IF EXISTS "coupon_usage_anon_nothing" ON coupon_usage;
  DROP POLICY IF EXISTS "anon_select_coupon_usage" ON coupon_usage;
  DROP POLICY IF EXISTS "anon_insert_coupon_usage" ON coupon_usage;
  DROP POLICY IF EXISTS "Anyone can insert coupon_usage" ON coupon_usage;
  DROP POLICY IF EXISTS "Anyone can read coupon_usage" ON coupon_usage;
  DROP POLICY IF EXISTS "Service role full access to coupon_usage" ON coupon_usage;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "coupon_usage_full_access" ON coupon_usage FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "coupon_usage_anon_denied" ON coupon_usage FOR SELECT USING (false);

-- ========== BROADCAST_JOBS ==========
DO $$ BEGIN
  DROP POLICY IF EXISTS "broadcast_service_all" ON broadcast_jobs;
  DROP POLICY IF EXISTS "broadcast_anon_nothing" ON broadcast_jobs;
  DROP POLICY IF EXISTS "anon_select_broadcast_jobs" ON broadcast_jobs;
  DROP POLICY IF EXISTS "anon_insert_broadcast_jobs" ON broadcast_jobs;
  DROP POLICY IF EXISTS "Anyone can insert broadcast_jobs" ON broadcast_jobs;
  DROP POLICY IF EXISTS "Anyone can read broadcast_jobs" ON broadcast_jobs;
  DROP POLICY IF EXISTS "Service role full access to broadcast_jobs" ON broadcast_jobs;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "broadcast_full_access" ON broadcast_jobs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "broadcast_anon_denied" ON broadcast_jobs FOR SELECT USING (false);

-- ========== AUDIT_LOG ==========
DO $$ BEGIN
  DROP POLICY IF EXISTS "audit_service_all" ON audit_log;
  DROP POLICY IF EXISTS "audit_anon_nothing" ON audit_log;
  DROP POLICY IF EXISTS "anon_select_audit_log" ON audit_log;
  DROP POLICY IF EXISTS "anon_insert_audit_log" ON audit_log;
  DROP POLICY IF EXISTS "Anyone can insert audit_log" ON audit_log;
  DROP POLICY IF EXISTS "Anyone can read audit_log" ON audit_log;
  DROP POLICY IF EXISTS "Service role full access to audit_log" ON audit_log;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "audit_full_access" ON audit_log FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "audit_anon_denied" ON audit_log FOR SELECT USING (false);

-- ========== PUBLIC TABLES (read allowed) ==========

-- REVIEWS
DO $$ BEGIN
  DROP POLICY IF EXISTS "reviews_select_approved" ON reviews;
  DROP POLICY IF EXISTS "reviews_select_public" ON reviews;
  DROP POLICY IF EXISTS "reviews_service_all" ON reviews;
  DROP POLICY IF EXISTS "anon_select_reviews" ON reviews;
  DROP POLICY IF EXISTS "anon_insert_reviews" ON reviews;
  DROP POLICY IF EXISTS "Anyone can insert reviews" ON reviews;
  DROP POLICY IF EXISTS "Anyone can read reviews" ON reviews;
  DROP POLICY IF EXISTS "Service role full access to reviews" ON reviews;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "reviews_anon_select" ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_full_access" ON reviews FOR ALL USING (auth.role() = 'service_role');

-- COUPONS
DO $$ BEGIN
  DROP POLICY IF EXISTS "coupons_select_active" ON coupons;
  DROP POLICY IF EXISTS "coupons_select_public" ON coupons;
  DROP POLICY IF EXISTS "coupons_service_all" ON coupons;
  DROP POLICY IF EXISTS "anon_select_coupons" ON coupons;
  DROP POLICY IF EXISTS "anon_insert_coupons" ON coupons;
  DROP POLICY IF EXISTS "Anyone can insert coupons" ON coupons;
  DROP POLICY IF EXISTS "Anyone can read coupons" ON coupons;
  DROP POLICY IF EXISTS "Service role full access to coupons" ON coupons;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "coupons_anon_select" ON coupons FOR SELECT USING (true);
CREATE POLICY "coupons_full_access" ON coupons FOR ALL USING (auth.role() = 'service_role');

-- DELIVERY_ZONES
DO $$ BEGIN
  DROP POLICY IF EXISTS "zones_select_public" ON delivery_zones;
  DROP POLICY IF EXISTS "zones_service_all" ON delivery_zones;
  DROP POLICY IF EXISTS "anon_select_delivery_zones" ON delivery_zones;
  DROP POLICY IF EXISTS "anon_insert_delivery_zones" ON delivery_zones;
  DROP POLICY IF EXISTS "Anyone can insert delivery_zones" ON delivery_zones;
  DROP POLICY IF EXISTS "Anyone can read delivery_zones" ON delivery_zones;
  DROP POLICY IF EXISTS "Service role full access to delivery_zones" ON delivery_zones;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "zones_anon_select" ON delivery_zones FOR SELECT USING (true);
CREATE POLICY "zones_full_access" ON delivery_zones FOR ALL USING (auth.role() = 'service_role');

-- CATEGORIES
DO $$ BEGIN
  DROP POLICY IF EXISTS "categories_select_public" ON categories;
  DROP POLICY IF EXISTS "categories_service_all" ON categories;
  DROP POLICY IF EXISTS "anon_select_categories" ON categories;
  DROP POLICY IF EXISTS "anon_insert_categories" ON categories;
  DROP POLICY IF EXISTS "Anyone can insert categories" ON categories;
  DROP POLICY IF EXISTS "Anyone can read categories" ON categories;
  DROP POLICY IF EXISTS "Service role full access to categories" ON categories;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "categories_anon_select" ON categories FOR SELECT USING (true);
CREATE POLICY "categories_full_access" ON categories FOR ALL USING (auth.role() = 'service_role');

-- BANNERS
DO $$ BEGIN
  DROP POLICY IF EXISTS "banners_select_public" ON banners;
  DROP POLICY IF EXISTS "banners_service_all" ON banners;
  DROP POLICY IF EXISTS "anon_select_banners" ON banners;
  DROP POLICY IF EXISTS "anon_insert_banners" ON banners;
  DROP POLICY IF EXISTS "Anyone can insert banners" ON banners;
  DROP POLICY IF EXISTS "Anyone can read banners" ON banners;
  DROP POLICY IF EXISTS "Service role full access to banners" ON banners;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "banners_anon_select" ON banners FOR SELECT USING (true);
CREATE POLICY "banners_full_access" ON banners FOR ALL USING (auth.role() = 'service_role');

-- PRODUCTS (already public, just ensure clean state)
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_select_products" ON products;
  DROP POLICY IF EXISTS "anon_insert_products" ON products;
  DROP POLICY IF EXISTS "anon_update_products" ON products;
  DROP POLICY IF EXISTS "anon_delete_products" ON products;
  DROP POLICY IF EXISTS "Anyone can read products" ON products;
  DROP POLICY IF EXISTS "Anyone can insert products" ON products;
  DROP POLICY IF EXISTS "Service role full access to products" ON products;
  DROP POLICY IF EXISTS "products_full_access" ON products;
  DROP POLICY IF EXISTS "products_anon_select" ON products;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "products_anon_select" ON products FOR SELECT USING (true);
CREATE POLICY "products_full_access" ON products FOR ALL USING (auth.role() = 'service_role');

-- Revoke get_admin_conversations from anon
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION get_admin_conversations() FROM anon;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
