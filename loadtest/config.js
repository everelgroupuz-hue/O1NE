// ─── Load Test Configuration ────────────────────────────────────────────────
// KUPI Shop — 1000 concurrent users load test

export const CONFIG = {
  // Supabase
  SUPABASE_URL: 'https://wrjixyedostqulufnjpw.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyaml4eWVkb3N0cXVsdWZuanB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyODAwMDQsImV4cCI6MjA5ODg1NjAwNH0.ljKFFBT-msdUV-L2QBCSCRL7nWpGU9goQEGRu21AFU8',

  // Test phases
  PHASES: [
    { name: 'warmup',     users: 50,   duration: 30 },   // 30s warmup
    { name: 'ramp-up',    users: 200,  duration: 30 },   // ramp to 200
    { name: 'steady-200', users: 200,  duration: 60 },   // hold 200 for 60s
    { name: 'ramp-up-2',  users: 500,  duration: 30 },   // ramp to 500
    { name: 'steady-500', users: 500,  duration: 60 },   // hold 500 for 60s
    { name: 'ramp-up-3',  users: 1000, duration: 30 },   // ramp to 1000
    { name: 'peak',       users: 1000, duration: 60 },   // hold 1000 for 60s
    { name: 'cooldown',   users: 50,   duration: 15 },   // cooldown
  ],

  // Scenario weights (probability distribution)
  SCENARIOS: {
    browse_catalog:   0.30,  // 30% — just browse
    view_product:     0.25,  // 25% — open product detail
    search:           0.15,  // 15% — search products
    add_to_cart:      0.10,  // 10% — add to cart
    checkout:         0.05,  // 5%  — place order (now deployed)
    view_orders:      0.05,  // 5%  — view order history
    view_favorites:   0.05,  // 5%  — view favorites
    view_profile:     0.00,  // 0%  — not implemented
    client_api:       0.05,  // 5%  — client API calls (now deployed)
  },

  // Thresholds
  THRESHOLDS: {
    max_response_time_ms: 3000,     // fail if > 3s
    max_error_rate_pct:  5.0,       // fail if > 5% errors
    min_success_rate_pct: 95.0,     // must have > 95% success
  },
};
