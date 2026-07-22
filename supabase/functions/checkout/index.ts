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

import { notifyNewOrder } from "../_shared/telegram-notify.ts";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

interface OrderItem {
  productId: string;
  name: { ru: string; uz: string } | string;
  price: number;
  quantity: number;
  size?: string;
  color?: string;
  image?: string;
}

interface CheckoutRequest {
  telegram_user_id: number;
  items: OrderItem[];
  total_amount: number;
  customer_info: {
    name: string;
    phone: string;
    city: string;
    address: string;
    zone_id?: string;
    region?: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  delivery_type: string;
  delivery_cost: number;
  payment_method: string;
  notes?: string;
  coupon_id?: string;
  discount_amount?: number;
  init_data?: string;
}

async function verifyTelegramInitData(initData: string, botToken: string): Promise<boolean> {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) return false;

    const authDate = urlParams.get('auth_date');
    if (authDate) {
      const authTimestamp = parseInt(authDate, 10);
      const now = Math.floor(Date.now() / 1000);
      if (now - authTimestamp > 86400) return false;
    }

    urlParams.delete('hash');
    const dataCheckArr: string[] = [];
    urlParams.forEach((value, key) => {
      dataCheckArr.push(`${key}=${value}`);
    });
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join('\n');

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(botToken),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(dataCheckString)
    );
    const hmacHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return timingSafeEqual(hmacHex, hash);
  } catch {
    return false;
  }
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

    const body: CheckoutRequest = await req.json();

    console.log("[Checkout] Request received:", {
      telegram_user_id: body.telegram_user_id,
      hasInitData: !!body.init_data,
      itemsCount: body.items?.length,
      total_amount: body.total_amount,
      payment_method: body.payment_method,
    });

    // Verify Telegram init_data for security
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
    if (botToken && body.init_data) {
      console.log("[Checkout] Verifying Telegram init_data...");
      const isValid = await verifyTelegramInitData(body.init_data, botToken);
      if (!isValid) {
        console.error("[Checkout] Telegram init_data verification FAILED");
        return new Response(
          JSON.stringify({ error: "Invalid Telegram data" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("[Checkout] Telegram init_data verified OK");
    } else {
      console.log("[Checkout] Skipping init_data verification", { botToken: !!botToken, initData: !!body.init_data });
    }

    // Validate required fields
    if (!body.telegram_user_id || !body.items?.length || !body.total_amount) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate customer info
    if (!body.customer_info?.name || !body.customer_info?.phone || !body.customer_info?.address) {
      return new Response(
        JSON.stringify({ error: "Missing customer info" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify stock for all items before creating order
    for (const item of body.items) {
      if (item.quantity <= 0) {
        return new Response(
          JSON.stringify({ error: `Invalid quantity for product ${item.productId}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: product, error: prodError } = await supabase
        .from("products")
        .select("id, stock, price, is_active")
        .eq("id", item.productId)
        .maybeSingle();

      if (prodError || !product) {
        return new Response(
          JSON.stringify({ error: `Product ${item.productId} not found` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!product.is_active) {
        return new Response(
          JSON.stringify({ error: `Product ${item.productId} is not available` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (product.stock < item.quantity) {
        return new Response(
          JSON.stringify({ error: `Insufficient stock for product ${item.productId}. Available: ${product.stock}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify price matches (prevent price tampering)
      if (Math.abs(Number(product.price) - item.price) > 1) {
        return new Response(
          JSON.stringify({ error: `Price mismatch for product ${item.productId}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Validate coupon if provided
    let discountAmount = body.discount_amount || 0;
    if (body.coupon_id) {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("id, type, value, min_order_amount, is_active, valid_from, valid_until")
        .eq("id", body.coupon_id)
        .eq("is_active", true)
        .maybeSingle();

      if (!coupon) {
        return new Response(
          JSON.stringify({ error: "Invalid coupon" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify coupon validity
      if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Coupon expired" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (new Date(coupon.valid_from) > new Date()) {
        return new Response(
          JSON.stringify({ error: "Coupon not yet active" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Recalculate discount server-side
      const subtotal = body.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      if (subtotal < coupon.min_order_amount) {
        return new Response(
          JSON.stringify({ error: `Minimum order amount: ${coupon.min_order_amount}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      discountAmount = coupon.type === "percent"
        ? Math.round(subtotal * coupon.value / 100)
        : Math.min(coupon.value, subtotal);
    }

    // Create order with atomic stock deduction using a transaction
    const { data: orderResult, error: orderError } = await supabase.rpc("create_order_with_stock", {
      p_telegram_user_id: body.telegram_user_id,
      p_items: body.items,
      p_total_amount: body.total_amount,
      p_customer_info: body.customer_info,
      p_delivery_type: body.delivery_type,
      p_delivery_cost: body.delivery_cost,
      p_payment_method: body.payment_method,
      p_notes: body.notes || null,
      p_coupon_id: body.coupon_id || null,
      p_discount_amount: discountAmount,
      p_status: body.payment_method === "cash" ? "new" : "processing",
    });

    const order = Array.isArray(orderResult) ? orderResult[0] : orderResult;

    if (orderError || !order) {
      console.error("[Checkout] Order creation FAILED:", orderError);
      return new Response(
        JSON.stringify({ error: orderError?.message || "Failed to create order" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Checkout] Order created successfully:", { id: order.id, status: order.status });

    // Record coupon usage if applicable
    if (body.coupon_id) {
      try {
        await supabase.from("coupon_usage").insert({
          coupon_id: body.coupon_id,
          telegram_user_id: body.telegram_user_id,
          order_id: order.id,
        });
      } catch { /* non-critical */ }
    }

    // Log the order creation
    try {
      await supabase.from("audit_log").insert({
        admin_id: "system",
        action: "order_created",
        entity_type: "orders",
        entity_id: order.id,
        details: {
          telegram_user_id: body.telegram_user_id,
          total_amount: body.total_amount,
          payment_method: body.payment_method,
          items_count: body.items.length,
        },
      });
    } catch { /* non-critical */ }

    // Notify admin about new order
    await notifyNewOrder({
      orderId: order.id,
      totalAmount: Number(body.total_amount),
      paymentMethod: body.payment_method,
      customerName: body.customer_info.name,
      customerPhone: body.customer_info.phone,
      customerCity: body.customer_info.city,
      customerAddress: body.customer_info.address,
      items: body.items.map((it) => ({
        name: typeof it.name === "object" ? (it.name as { ru: string }).ru : String(it.name),
        quantity: it.quantity,
      })),
    });

    return new Response(
      JSON.stringify({
        success: true,
        order: {
          id: order.id,
          status: order.status,
          total_amount: order.total_amount,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Checkout error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: "Internal error", detail: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
