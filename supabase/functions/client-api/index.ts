import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function getCorsHeaders(req: Request) {
  const allowedOrigins = [
    'https://o1ne.onrender.com',
    'https://one-iota-three.vercel.app',
    'https://one-phi-blush.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const origin = req.headers.get('Origin') || '';
  const allowed = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Apikey, X-Client-Info',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Rate limiter: max 30 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  if (rateLimitMap.size > 100) {
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key);
    }
  }
  const entry = rateLimitMap.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= RATE_LIMIT) return false;
    entry.count++;
  } else {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
  }
  return true;
}

async function hashToken(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyAdminSession(
  supabase: ReturnType<typeof createClient>,
  adminSession: { admin_id: string; token: string } | undefined
): Promise<boolean> {
  if (!adminSession?.admin_id || !adminSession?.token) return false;
  const tokenHash = await hashToken(adminSession.token);
  const { data } = await supabase
    .from("admin_accounts")
    .select("id, is_active, session_expires_at")
    .eq("id", adminSession.admin_id)
    .eq("session_token", tokenHash)
    .eq("is_active", true)
    .maybeSingle();
  if (data && data.session_expires_at && new Date(data.session_expires_at) < new Date()) return false;
  return !!data;
}

/**
 * Telegram initData verification using HMAC-SHA256
 */
function verifyTelegramInitData(
  initData: string,
  botToken: string
): { valid: boolean; user?: { id: number; first_name: string; last_name?: string; username?: string; language_code?: string }; error?: string } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    const authDate = params.get("auth_date");

    if (!hash || !authDate) {
      return { valid: false, error: "Missing hash or auth_date" };
    }

    const authTimestamp = parseInt(authDate, 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authTimestamp > 86400) {
      return { valid: false, error: "InitData expired (>24 hours)" };
    }

    const pairs: string[] = [];
    for (const [key, value] of params.entries()) {
      if (key !== "hash") {
        pairs.push(`${key}=${value}`);
      }
    }
    pairs.sort();
    const dataCheckString = pairs.join("\n");

    const computedHash = hmacSha256Hex(botToken, dataCheckString);
    if (!timingSafeEqual(computedHash, hash)) {
      return { valid: false, error: "Invalid hash" };
    }

    const userStr = params.get("user");
    let user: { id: number; first_name: string; last_name?: string; username?: string; language_code?: string } | undefined;
    if (userStr) {
      try { user = JSON.parse(userStr); } catch { /* malformed */ }
    }

    return { valid: true, user };
  } catch (err) {
    return { valid: false, error: `Verification error: ${(err as Error).message}` };
  }
}

function hmacSha256Hex(key: string, message: string): string {
  const BLOCK_SIZE = 64;
  const keyBytes = new TextEncoder().encode(key);
  let keyPadded: Uint8Array;

  if (keyBytes.length > BLOCK_SIZE) {
    keyPadded = sha256(keyBytes);
  } else {
    keyPadded = new Uint8Array(BLOCK_SIZE);
    keyPadded.set(keyBytes);
  }

  const ipad = new Uint8Array(BLOCK_SIZE);
  const opad = new Uint8Array(BLOCK_SIZE);
  for (let i = 0; i < BLOCK_SIZE; i++) {
    ipad[i] = keyPadded[i] ^ 0x36;
    opad[i] = keyPadded[i] ^ 0x5c;
  }

  const msgBytes = new TextEncoder().encode(message);
  const innerMsg = new Uint8Array(BLOCK_SIZE + msgBytes.length);
  innerMsg.set(ipad);
  innerMsg.set(msgBytes, BLOCK_SIZE);
  const innerHash = sha256(innerMsg);

  const outerMsg = new Uint8Array(BLOCK_SIZE + 32);
  outerMsg.set(opad);
  outerMsg.set(innerHash, BLOCK_SIZE);
  const outerHash = sha256(outerMsg);

  return hex(outerHash);
}

const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function sha256(msg: Uint8Array): Uint8Array {
  const l = msg.length;
  const bitLen = l * 8;
  const padLen = (l % 64 < 56) ? 56 - (l % 64) : 120 - (l % 64);
  const padded = new Uint8Array(l + padLen + 8);
  padded.set(msg);
  padded[l] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen, false);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);

  let h0 = H[0], h1 = H[1], h2 = H[2], h3 = H[3];
  let h4 = H[4], h5 = H[5], h6 = H[6], h7 = H[7];

  for (let i = 0; i < padded.length; i += 64) {
    const w = new Uint32Array(64);
    for (let j = 0; j < 16; j++) w[j] = view.getUint32(i + j * 4, false);
    for (let j = 16; j < 64; j++) {
      const s0 = rot32(w[j - 15], 7) ^ rot32(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rot32(w[j - 2], 17) ^ rot32(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let j = 0; j < 64; j++) {
      const S1 = rot32(e, 6) ^ rot32(e, 11) ^ rot32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[j] + w[j]) | 0;
      const S0 = rot32(a, 2) ^ rot32(a, 13) ^ rot32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  const result = new Uint8Array(32);
  const rv = new DataView(result.buffer);
  rv.setUint32(0, h0, false); rv.setUint32(4, h1, false);
  rv.setUint32(8, h2, false); rv.setUint32(12, h3, false);
  rv.setUint32(16, h4, false); rv.setUint32(20, h5, false);
  rv.setUint32(24, h6, false); rv.setUint32(28, h7, false);
  return result;
}

function rot32(x: number, n: number): number {
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

function hex(arr: Uint8Array): string {
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const ADMIN_ACTIONS = ["insert_notification"];
const USER_SCOPED_ACTIONS = [
  "upsert_user",
  "add_favorite", "remove_favorite", "update_favorite",
  "insert_review", "mark_notification_read", "mark_all_notifications_read",
  "insert_return", "record_coupon_usage", "insert_order",
];

async function notifyAdmin(botToken: string, text: string): Promise<void> {
  const adminId = Deno.env.get("ADMIN_TELEGRAM_ID");
  if (!botToken || !adminId) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: adminId, text, parse_mode: "HTML" }),
    });
  } catch { /* non-critical */ }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded" }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? Deno.env.get("BOT_TOKEN") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, admin_session, init_data, ...params } = await req.json();

    console.log(`[ClientAPI] Action: ${action}`, {
      hasInitData: !!init_data,
      hasAdminSession: !!admin_session,
      paramsKeys: Object.keys(params),
    });

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Missing action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify admin session for admin-only actions
    if (ADMIN_ACTIONS.includes(action)) {
      const valid = await verifyAdminSession(supabase, admin_session);
      if (!valid) {
        return new Response(
          JSON.stringify({ error: "Admin session required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Verify Telegram initData for user-scoped actions
    if (USER_SCOPED_ACTIONS.includes(action)) {
      if (botToken && init_data) {
        console.log(`[ClientAPI] Verifying initData for action: ${action}`);
        const verification = verifyTelegramInitData(init_data, botToken);
        if (!verification.valid) {
          console.error(`[ClientAPI] InitData verification failed: ${verification.error}`);
          return new Response(
            JSON.stringify({ error: `InitData verification failed: ${verification.error}` }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        console.log(`[ClientAPI] InitData verified. User ID: ${verification.user?.id}`);
        if (verification.user?.id) {
          params.p_telegram_user_id = verification.user.id;
          params.p_telegram_id = verification.user.id;
        }
      } else if (!botToken) {
        console.warn("[ClientAPI] TELEGRAM_BOT_TOKEN not set, skipping initData verification");
      } else {
        console.error(`[ClientAPI] init_data required for action: ${action}, but not provided`);
        return new Response(
          JSON.stringify({ error: "init_data required for this action" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate telegram_user_id (either p_telegram_user_id or p_telegram_id)
      const tid = params.p_telegram_user_id ?? params.p_telegram_id;
      if (!tid || (typeof tid === "number" && tid <= 0) || (typeof tid === "string" && !/^\d+$/.test(tid))) {
        return new Response(
          JSON.stringify({ error: "Valid telegram_user_id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let result;
    switch (action) {
      case "upsert_user": {
        const { data, error } = await supabase.rpc("upsert_user", {
          p_telegram_id: params.p_telegram_id,
          p_first_name: params.p_first_name,
          p_username: params.p_username ?? null,
          p_language: params.p_language ?? "ru",
          p_phone: params.p_phone ?? null,
          p_address: params.p_address ?? null,
          p_latitude: params.p_latitude ?? null,
          p_longitude: params.p_longitude ?? null,
        }).single();
        if (error) {
          console.error(`[ClientAPI] upsert_user RPC error:`, error);
          throw error;
        }
        console.log(`[ClientAPI] upsert_user success:`, { id: data?.id, telegram_id: data?.telegram_id });
        result = data;
        if (botToken) {
          const displayName = params.p_first_name || "Без имени";
          const username = params.p_username ? ` (@${params.p_username})` : "";
          await notifyAdmin(botToken,
            `👤 <b>Новый пользователь</b>\n\n` +
            `Имя: ${displayName}${username}\n` +
            `Telegram ID: ${params.p_telegram_id}`
          );
        }
        break;
      }
      case "add_favorite": {
        const { error } = await supabase.rpc("add_favorite", {
          p_telegram_user_id: params.p_telegram_user_id,
          p_product_id: params.p_product_id,
          p_notify_price: params.p_notify_price ?? false,
          p_notify_stock: params.p_notify_stock ?? false,
        });
        if (error) throw error;
        result = { ok: true };
        break;
      }
      case "remove_favorite": {
        const { error } = await supabase.rpc("remove_favorite", {
          p_telegram_user_id: params.p_telegram_user_id,
          p_product_id: params.p_product_id,
        });
        if (error) throw error;
        result = { ok: true };
        break;
      }
      case "update_favorite": {
        const { error } = await supabase.rpc("update_favorite", {
          p_telegram_user_id: params.p_telegram_user_id,
          p_product_id: params.p_product_id,
          p_notify_price: params.p_notify_price ?? null,
          p_notify_stock: params.p_notify_stock ?? null,
        });
        if (error) throw error;
        result = { ok: true };
        break;
      }
      case "insert_review": {
        const { data, error } = await supabase.rpc("insert_review", {
          p_product_id: params.p_product_id,
          p_telegram_user_id: params.p_telegram_user_id,
          p_user_name: params.p_user_name,
          p_rating: params.p_rating,
          p_comment: params.p_comment ?? null,
          p_images: params.p_images ?? [],
          p_photos: params.p_photos ?? [],
        }).single();
        if (error) throw error;
        result = data;
        break;
      }
      case "mark_notification_read": {
        const { error } = await supabase.rpc("mark_notification_read", {
          p_id: params.p_id,
        });
        if (error) throw error;
        result = { ok: true };
        break;
      }
      case "mark_all_notifications_read": {
        const { error } = await supabase.rpc("mark_all_notifications_read", {
          p_telegram_user_id: params.p_telegram_user_id,
        });
        if (error) throw error;
        result = { ok: true };
        break;
      }
      case "insert_notification": {
        const { data, error } = await supabase.rpc("insert_notification", {
          p_telegram_user_id: params.p_telegram_user_id,
          p_type: params.p_type,
          p_title: params.p_title,
          p_body: params.p_body,
          p_data: params.p_data ?? {},
        }).single();
        if (error) throw error;
        result = data;
        break;
      }
      case "insert_return": {
        const { data, error } = await supabase.rpc("insert_return", {
          p_telegram_user_id: params.p_telegram_user_id,
          p_order_id: params.p_order_id,
          p_items: params.p_items,
          p_reason: params.p_reason,
          p_photos: params.p_photos ?? [],
        }).single();
        if (error) throw error;
        result = data;

        // Notify admin about new return
        if (botToken) {
          const shortOrderId = String(params.p_order_id).slice(0, 8).toUpperCase();
          const itemsArr = Array.isArray(params.p_items) ? params.p_items : [];
          const itemsList = itemsArr.map((it: { name?: string }) => `  • ${it.name || "Товар"}`).join("\n");
          await notifyAdmin(botToken,
            `🔄 <b>Новая заявка на возврат</b>\n\n` +
            `📦 Заказ: #${shortOrderId}\n` +
            `👤 Пользователь: ${params.p_telegram_user_id}\n` +
            `📝 Причина: ${params.p_reason}\n` +
            (itemsList ? `📋 Товары:\n${itemsList}` : "")
          );
        }
        break;
      }
      case "record_coupon_usage": {
        const { error } = await supabase.rpc("record_coupon_usage", {
          p_coupon_id: params.p_coupon_id,
          p_telegram_user_id: params.p_telegram_user_id,
          p_order_id: params.p_order_id ?? null,
        });
        if (error) throw error;
        result = { ok: true };
        break;
      }
      case "insert_order": {
        const { data, error } = await supabase.rpc("insert_order", {
          p_telegram_user_id: params.p_telegram_user_id,
          p_items: params.p_items,
          p_total_amount: params.p_total_amount,
          p_customer_info: params.p_customer_info,
          p_delivery_type: params.p_delivery_type,
          p_delivery_cost: params.p_delivery_cost,
          p_payment_method: params.p_payment_method,
          p_notes: params.p_notes ?? null,
          p_coupon_id: params.p_coupon_id ?? null,
          p_discount_amount: params.p_discount_amount ?? 0,
        }).single();
        if (error) throw error;
        result = data;
        break;
      }
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
