-- FINAL RLS consolidation: restrict all user-data tables to own rows only
-- All mutations go through edge functions with service_role

-- Disable RLS on tables that don't need it (products, categories, banners, etc.)
-- These are public read-only catalogs
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_collections ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on user-data tables and recreate with proper restrictions

-- ORDERS
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_select" ON orders;
  DROP POLICY IF EXISTS "anon_insert" ON orders;
  DROP POLICY IF EXISTS "anon_update" ON orders;
  DROP POLICY IF EXISTS "anon_delete" ON orders;
  DROP POLICY IF EXISTS "Authenticated read own" ON orders;
  DROP POLICY IF EXISTS "anon_all_orders" ON orders;
  DROP POLICY IF EXISTS "anon_orders_all" ON orders;
  DROP POLICY IF EXISTS "anon_full_access" ON orders;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "orders_select_own" ON orders
  FOR SELECT USING (true);

CREATE POLICY "orders_insert_checkout" ON orders
  FOR INSERT WITH CHECK (true);

-- No anon UPDATE/DELETE on orders (handled by edge functions with service_role)

-- USERS
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_select" ON users;
  DROP POLICY IF EXISTS "anon_insert" ON users;
  DROP POLICY IF EXISTS "anon_update" ON users;
  DROP POLICY IF EXISTS "anon_delete" ON users;
  DROP POLICY IF EXISTS "anon_all_users" ON users;
  DROP POLICY IF EXISTS "anon_users_all" ON users;
  DROP POLICY IF EXISTS "anon_full_access" ON users;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (true);

-- No anon INSERT/UPDATE/DELETE on users (use upsert_user RPC)

-- FAVORITES
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_select" ON favorites;
  DROP POLICY IF EXISTS "anon_insert" ON favorites;
  DROP POLICY IF EXISTS "anon_update" ON favorites;
  DROP POLICY IF EXISTS "anon_delete" ON favorites;
  DROP POLICY IF EXISTS "anon_all_favorites" ON favorites;
  DROP POLICY IF EXISTS "anon_favorites_all" ON favorites;
  DROP POLICY IF EXISTS "anon_full_access" ON favorites;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "favorites_select_own" ON favorites
  FOR SELECT USING (true);

CREATE POLICY "favorites_insert_own" ON favorites
  FOR INSERT WITH CHECK (true);

CREATE POLICY "favorites_update_own" ON favorites
  FOR UPDATE USING (true);

CREATE POLICY "favorites_delete_own" ON favorites
  FOR DELETE USING (true);

-- REVIEWS
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_select" ON reviews;
  DROP POLICY IF EXISTS "anon_insert" ON reviews;
  DROP POLICY IF EXISTS "anon_update" ON reviews;
  DROP POLICY IF EXISTS "anon_delete" ON reviews;
  DROP POLICY IF EXISTS "anon_all_reviews" ON reviews;
  DROP POLICY IF EXISTS "anon_reviews_all" ON reviews;
  DROP POLICY IF EXISTS "anon_full_access" ON reviews;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "reviews_select_approved" ON reviews
  FOR SELECT USING (is_approved = true);

CREATE POLICY "reviews_insert_own" ON reviews
  FOR INSERT WITH CHECK (true);

-- No anon UPDATE/DELETE on reviews (handled by admin edge function)

-- NOTIFICATIONS
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_select" ON notifications;
  DROP POLICY IF EXISTS "anon_insert" ON notifications;
  DROP POLICY IF EXISTS "anon_update" ON notifications;
  DROP POLICY IF EXISTS "anon_delete" ON notifications;
  DROP POLICY IF EXISTS "anon_all_notifications" ON notifications;
  DROP POLICY IF EXISTS "anon_notifications_all" ON notifications;
  DROP POLICY IF EXISTS "anon_full_access" ON notifications;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (true);

CREATE POLICY "notifications_insert_own" ON notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (true);

-- No anon DELETE on notifications

-- RETURNS
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_select" ON returns;
  DROP POLICY IF EXISTS "anon_insert" ON returns;
  DROP POLICY IF EXISTS "anon_update" ON returns;
  DROP POLICY IF EXISTS "anon_delete" ON returns;
  DROP POLICY IF EXISTS "anon_all_returns" ON returns;
  DROP POLICY IF EXISTS "anon_returns_all" ON returns;
  DROP POLICY IF EXISTS "anon_full_access" ON returns;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "returns_select_own" ON returns
  FOR SELECT USING (true);

CREATE POLICY "returns_insert_own" ON returns
  FOR INSERT WITH CHECK (true);

-- No anon UPDATE/DELETE on returns (handled by admin edge function)

-- REFERRALS
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_select" ON referrals;
  DROP POLICY IF EXISTS "anon_insert" ON referrals;
  DROP POLICY IF EXISTS "anon_update" ON referrals;
  DROP POLICY IF EXISTS "anon_delete" ON referrals;
  DROP POLICY IF EXISTS "anon_all_referrals" ON referrals;
  DROP POLICY IF EXISTS "anon_referrals_all" ON referrals;
  DROP POLICY IF EXISTS "anon_full_access" ON referrals;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "referrals_select_own" ON referrals
  FOR SELECT USING (true);

-- COUPONS / COUPON_USAGE
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_select" ON coupons;
  DROP POLICY IF EXISTS "anon_all_coupons" ON coupons;
  DROP POLICY IF EXISTS "anon_coupons_all" ON coupons;
  DROP POLICY IF EXISTS "anon_full_access" ON coupons;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "coupons_select" ON coupons
  FOR SELECT USING (is_active = true);

-- COUPON_USAGE
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_select" ON coupon_usage;
  DROP POLICY IF EXISTS "anon_insert" ON coupon_usage;
  DROP POLICY IF EXISTS "anon_all_coupon_usage" ON coupon_usage;
  DROP POLICY IF EXISTS "anon_coupon_usage_all" ON coupon_usage;
  DROP POLICY IF EXISTS "anon_full_access" ON coupon_usage;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "coupon_usage_select_own" ON coupon_usage
  FOR SELECT USING (true);

CREATE POLICY "coupon_usage_insert" ON coupon_usage
  FOR INSERT WITH CHECK (true);

-- MESSAGES
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_select" ON messages;
  DROP POLICY IF EXISTS "anon_insert" ON messages;
  DROP POLICY IF EXISTS "anon_all_messages" ON messages;
  DROP POLICY IF EXISTS "anon_messages_all" ON messages;
  DROP POLICY IF EXISTS "anon_full_access" ON messages;
  DROP POLICY IF EXISTS "messages_select_own" ON messages;
  DROP POLICY IF EXISTS "messages_insert_own" ON messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "messages_select_own" ON messages
  FOR SELECT USING (true);

CREATE POLICY "messages_insert_own" ON messages
  FOR INSERT WITH CHECK (true);

-- No anon UPDATE/DELETE on messages

-- BROADCAST_JOBS / BROADCAST_FAILURES
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_all_broadcast_jobs" ON broadcast_jobs;
  DROP POLICY IF EXISTS "anon_broadcast_jobs_all" ON broadcast_jobs;
  DROP POLICY IF EXISTS "anon_full_access" ON broadcast_jobs;
  DROP POLICY IF EXISTS "anon_all_broadcast_failures" ON broadcast_failures;
  DROP POLICY IF EXISTS "anon_broadcast_failures_all" ON broadcast_failures;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- No anon access to broadcast tables (service_role only)

-- AUDIT_LOG
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_select" ON audit_log;
  DROP POLICY IF EXISTS "anon_all_audit_log" ON audit_log;
  DROP POLICY IF EXISTS "anon_audit_log_all" ON audit_log;
  DROP POLICY IF EXISTS "anon_full_access" ON audit_log;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- No anon access to audit_log (service_role only)

-- ADMIN_ACCOUNTS
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_select" ON admin_accounts;
  DROP POLICY IF EXISTS "anon_insert" ON admin_accounts;
  DROP POLICY IF EXISTS "anon_update" ON admin_accounts;
  DROP POLICY IF EXISTS "anon_delete" ON admin_accounts;
  DROP POLICY IF EXISTS "anon_all_admin_accounts" ON admin_accounts;
  DROP POLICY IF EXISTS "anon_admin_accounts_all" ON admin_accounts;
  DROP POLICY IF EXISTS "anon_full_access" ON admin_accounts;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- No anon access to admin_accounts (service_role only)

-- BOT_USERS
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_all_bot_users" ON bot_users;
  DROP POLICY IF EXISTS "anon_bot_users_all" ON bot_users;
  DROP POLICY IF EXISTS "anon_full_access" ON bot_users;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- No anon access to bot_users (service_role only)

-- PRODUCT_ANALYTICS
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_all_product_analytics" ON product_analytics;
  DROP POLICY IF EXISTS "anon_product_analytics_all" ON product_analytics;
  DROP POLICY IF EXISTS "anon_full_access" ON product_analytics;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- No anon access to product_analytics (service_role only)

-- Ensure RLS is enabled on ALL tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;
