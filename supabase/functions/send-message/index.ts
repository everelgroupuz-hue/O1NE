import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2";

function getCorsHeaders(req: Request) {
  const allowedOrigins = [
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
): Promise<{ ok: boolean; error?: string }> {
  if (!adminSession?.admin_id || !adminSession?.token) {
    return { ok: false, error: "Admin session required" };
  }
  const tokenHash = await hashToken(adminSession.token);
  const { data } = await supabase
    .from("admin_accounts")
    .select("id, is_active, session_expires_at")
    .eq("id", adminSession.admin_id)
    .eq("session_token", tokenHash)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) {
    return { ok: false, error: "Invalid or expired admin session" };
  }
  if (data.session_expires_at && new Date(data.session_expires_at) < new Date()) {
    return { ok: false, error: "Session expired" };
  }
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { telegram_user_id, message, parse_mode, product_id, type, admin_session, sender_type } = body;

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || Deno.env.get("BOT_TOKEN");
    if (!botToken) {
      return new Response(
        JSON.stringify({ error: "Telegram bot token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Product notification mode: send to all users with notify_price or notify_stock
    if (product_id && type) {
      const auth = await verifyAdminSession(supabase, admin_session);
      if (!auth.ok) {
        return new Response(
          JSON.stringify({ error: auth.error }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: product } = await supabase
        .from("products")
        .select("id, name, price, slug")
        .eq("id", product_id)
        .maybeSingle();

      if (!product) {
        return new Response(
          JSON.stringify({ error: "Product not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const productName = typeof product.name === "object" ? (product.name as { ru: string }).ru : product.name;

      const field = type === "price_drop" ? "notify_price" : "notify_stock";
      const { data: favorites } = await supabase
        .from("favorites")
        .select("telegram_user_id")
        .eq("product_id", product_id)
        .eq(field, true);

      if (!favorites || favorites.length === 0) {
        return new Response(
          JSON.stringify({ success: true, sent: 0, message: "No users to notify" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const chatIds = [...new Set(favorites.map((f) => f.telegram_user_id))];
      let sent = 0;
      let errors = 0;

      for (const chatId of chatIds) {
        try {
          const text = type === "price_drop"
            ? `🔥 Товар из избранного стал дешевле!\n\n📦 ${productName}\n💰 Новая цена: ${product.price} сум\n\nОткройте каталог, чтобы оформить заказ.`
            : `📦 Товар снова в наличии!\n\n📦 ${productName}\n\nУспейте заказать!`;

          const response = await fetch(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: "HTML",
              }),
            }
          );

          if (response.ok) {
            sent++;
          } else {
            errors++;
          }
        } catch {
          errors++;
        }
        await new Promise((r) => setTimeout(r, 35));
      }

      return new Response(
        JSON.stringify({ success: true, sent, errors, total: chatIds.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin direct message: verify admin session
    if (admin_session) {
      const auth = await verifyAdminSession(supabase, admin_session);
      if (!auth.ok) {
        return new Response(
          JSON.stringify({ error: auth.error }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Require admin session for admin sender type to prevent spoofing
    if (sender_type === 'admin' && !admin_session) {
      return new Response(
        JSON.stringify({ error: "Admin session required for admin messages" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Direct message mode (customer or admin)
    if (!telegram_user_id || !message) {
      return new Response(
        JSON.stringify({ error: "telegram_user_id and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegram_user_id,
          text: message,
          parse_mode: parse_mode || "HTML",
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Telegram API error:", result);
      return new Response(
        JSON.stringify({
          success: false,
          error: result.description || "Failed to send message",
          error_code: result.error_code,
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message_id: result.result?.message_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Send message error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
