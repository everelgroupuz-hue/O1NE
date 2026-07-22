import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { notifyOrderStatusChanged, notifyProductOutOfStock, notifyProductBackInStock, notifyProductPriceChanged } from "../_shared/telegram-notify.ts";

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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };
}

const ALLOWED_TABLES = [
  "products", "categories", "orders", "users", "banners",
  "delivery_zones", "coupons", "coupon_usage", "returns",
  "reviews", "audit_log", "admin_accounts", "product_collections",
  "promotions", "favorites", "notifications", "product_relations",
  "referrals",
];

// Tables that only require read (no session needed for SELECT)
// ALL mutations require a valid admin session token
const MUTATION_ACTIONS = ["insert", "update", "delete", "updateOrderStatus"];

async function hashToken(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyAdminSession(
  supabase: ReturnType<typeof createClient>,
  admin_session: { admin_id: string; token: string } | undefined
): Promise<{ ok: boolean; error?: string }> {
  if (!admin_session?.admin_id || !admin_session?.token) {
    return { ok: false, error: "Admin session required" };
  }
  const tokenHash = await hashToken(admin_session.token);
  const { data } = await supabase
    .from("admin_accounts")
    .select("id, is_active, session_expires_at")
    .eq("id", admin_session.admin_id)
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
    const { action, table, data, filters, id, admin_session } = body;

    // Actions that don't require a table parameter
    const TABLELESS_ACTIONS = ["processReturn"];

    if (!action || (!table && !TABLELESS_ACTIONS.includes(action))) {
      return new Response(
        JSON.stringify({ error: "Missing action or table" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (table && !ALLOWED_TABLES.includes(table)) {
      return new Response(
        JSON.stringify({ error: "Table not allowed" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ALL actions require a valid admin session
    const SENSITIVE_TABLES = ["admin_accounts", "orders", "users", "audit_log", "notifications", "returns"];
    const needsAuth = MUTATION_ACTIONS.includes(action) || SENSITIVE_TABLES.includes(table) || TABLELESS_ACTIONS.includes(action);
    if (needsAuth) {
      const check = await verifyAdminSession(supabase, admin_session);
      if (!check.ok) {
        return new Response(
          JSON.stringify({ error: check.error }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let result;

    switch (action) {
      case "select": {
        let query = supabase.from(table).select(data || "*");
        if (filters) {
          for (const [key, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null) {
              query = query.eq(key, value as string);
            }
          }
        }
        if (table === "orders") {
          query = query.order("created_at", { ascending: false }).range(0, 499);
        } else if (table === "audit_log") {
          query = query.order("created_at", { ascending: false }).limit(200);
        } else {
          query = query.order("created_at", { ascending: false }).range(0, 499);
        }
        const { data: rows, error } = await query;
        if (error) throw error;
        result = rows;
        break;
      }

      case "insert": {
        const { data: inserted, error } = await supabase
          .from(table)
          .insert(data)
          .select()
          .single();
        if (error) throw error;
        result = inserted;
        break;
      }

      case "update": {
        if (id === "__bulk__" && filters) {
          let query = supabase
            .from(table)
            .update({ ...data, updated_at: new Date().toISOString() });
          for (const [key, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null) {
              query = query.eq(key, value as string);
            }
          }
          const { error } = await query;
          if (error) throw error;
          result = { success: true };
        } else {
          if (!id) throw new Error("ID required for update");

          const { error } = await supabase
            .from(table)
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq("id", id);
          if (error) throw error;
          result = { success: true };

          if (table === "products" && (data.price !== undefined || data.stock !== undefined)) {
            const { data: oldProduct } = await supabase
              .from("products")
              .select("price, stock, name")
              .eq("id", id)
              .maybeSingle();

            if (oldProduct) {
              const productName = typeof oldProduct.name === "object"
                ? (oldProduct.name as { ru: string }).ru
                : String(oldProduct.name || "Товар");

              const priceDropped = data.price !== undefined && oldProduct.price !== undefined && Number(data.price) < Number(oldProduct.price);
              const priceIncreased = data.price !== undefined && oldProduct.price !== undefined && Number(data.price) > Number(oldProduct.price);
              const stockAvailable = data.stock !== undefined && oldProduct.stock !== undefined && Number(oldProduct.stock) <= 0 && Number(data.stock) > 0;
              const stockOut = data.stock !== undefined && oldProduct.stock !== undefined && Number(oldProduct.stock) > 0 && Number(data.stock) <= 0;

              if (priceDropped) {
                notifyProductPriceChanged(id, productName, Number(oldProduct.price), Number(data.price));
                // Also notify users with price alerts
                const supabaseUrl = Deno.env.get("SUPABASE_URL");
                const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
                if (supabaseUrl && anonKey) {
                  try {
                    await fetch(`${supabaseUrl}/functions/v1/auto-notify`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}`, "Apikey": anonKey },
                      body: JSON.stringify({ product_id: id, type: "price_drop" }),
                    });
                  } catch { console.error("Failed to trigger auto-notify"); }
                }
              } else if (priceIncreased) {
                notifyProductPriceChanged(id, productName, Number(oldProduct.price), Number(data.price));
              }

              if (stockOut) {
                notifyProductOutOfStock(id, productName);
              } else if (stockAvailable) {
                notifyProductBackInStock(id, productName);
                // Notify users with stock alerts
                const supabaseUrl = Deno.env.get("SUPABASE_URL");
                const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
                if (supabaseUrl && anonKey) {
                  try {
                    await fetch(`${supabaseUrl}/functions/v1/auto-notify`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}`, "Apikey": anonKey },
                      body: JSON.stringify({ product_id: id, type: "stock_available" }),
                    });
                  } catch { console.error("Failed to trigger auto-notify"); }
                }
              }
            }
          }
        }
        break;
      }

      case "delete": {
        if (id === "__filter__" && filters) {
          let query = supabase.from(table).delete();
          for (const [key, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null) {
              query = query.eq(key, value as string);
            }
          }
          const { error } = await query;
          if (error) throw error;
        } else {
          if (!id) throw new Error("ID required for delete");
          const { error } = await supabase.from(table).delete().eq("id", id);
          if (error) throw error;
        }
        result = { success: true };
        break;
      }

      case "updateOrderStatus": {
        if (!id) throw new Error("ID required");
        const { status, changed_by, note } = data || {};

        // Fetch order first to get telegram_user_id for notifications
        const { data: orderRow } = await supabase
          .from("orders")
          .select("telegram_user_id")
          .eq("id", id)
          .maybeSingle();

        const telegramUserId = orderRow?.telegram_user_id;

        // Use RPC function which handles auto-archiving and stock return
        const { data: updatedOrder, error: rpcErr } = await supabase.rpc("append_order_status", {
          p_order_id: id as unknown as never,
          p_status: status,
          p_changed_by: changed_by || "Admin",
          p_note: note || null,
        }).maybeSingle();

        if (rpcErr) throw rpcErr;

        if (telegramUserId) {
          const STATUS_LABELS: Record<string, string> = {
            new: "Новый", processing: "В обработке", assembling: "В сборке",
            assembled: "Собран", shipping: "В пути", delivered: "Доставлен",
            cancelled: "Отменён", return_requested: "Запрос возврата", returned: "Возвращён",
            paid: "Оплачен", shipped: "Отправлен",
          };

          const STATUS_MESSAGES: Record<string, string> = {
            new: "Ваш заказ принят!",
            processing: "Заказ обрабатывается",
            assembling: "Заказ собирается",
            assembled: "Заказ собран",
            shipping: "Заказ в пути к вам",
            delivered: "Заказ доставлен! Спасибо за покупку!",
            cancelled: "Заказ отменён",
            return_requested: "Запрос на возврат получен",
            returned: "Возврат оформлен",
            paid: "Оплата получена",
            shipped: "Заказ отправлен",
          };

          const shortOrderId = id.slice(0, 8).toUpperCase();

          await supabase.from("notifications").insert({
            telegram_user_id: telegramUserId,
            type: `order_${status}`,
            title: `📦 Заказ #${shortOrderId}`,
            body: STATUS_MESSAGES[status] || `Статус: ${STATUS_LABELS[status] || status}`,
            data: { order_id: id, status },
          }).catch(() => {});

          const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || Deno.env.get("BOT_TOKEN");
          if (botToken) {
            const emoji = status === "delivered" ? "✅" : status === "cancelled" ? "❌" : status === "shipping" ? "🚚" : "📦";
            const text = `${emoji} <b>${STATUS_MESSAGES[status] || STATUS_LABELS[status]}</b>\n\n` +
              `Заказ #${shortOrderId}\n` +
              `Статус: <b>${STATUS_LABELS[status] || status}</b>`;

            try {
              const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: String(telegramUserId),
                  text: text,
                  parse_mode: "HTML",
                }),
              });
              if (!resp.ok) {
                const errBody = await resp.text();
                console.error(`Telegram send failed for order ${shortOrderId}: ${resp.status} ${errBody}`);
              }
            } catch (e) {
              console.error(`Telegram send error for order ${shortOrderId}:`, e);
            }
          } else {
            console.warn("No TELEGRAM_BOT_TOKEN or BOT_TOKEN configured — skipping order notification");
          }
        }

        // Notify admin about status change
        notifyOrderStatusChanged(id, status, changed_by || "Admin");

        result = updatedOrder;
        break;
      }

      case "processReturn": {
        const { return_id, status, admin_note } = data || {};
        if (!return_id || !status) throw new Error("return_id and status required");

        const { data: updated, error: rpcErr } = await supabase.rpc("process_return_stock", {
          p_return_id: return_id,
          p_status: status,
          p_admin_note: admin_note || null,
        }).maybeSingle();

        if (rpcErr) throw rpcErr;
        result = updated;

        const { data: ret } = await supabase
          .from("returns")
          .select("telegram_user_id, order_id")
          .eq("id", return_id)
          .maybeSingle();

        if (ret?.order_id && status === "refunded") {
          const { data: currentOrder } = await supabase
            .from("orders")
            .select("status")
            .eq("id", ret.order_id)
            .maybeSingle();

          if (currentOrder && currentOrder.status !== "returned") {
            await supabase.rpc("append_order_status", {
              p_order_id: ret.order_id,
              p_status: "returned",
              p_changed_by: "System",
              p_note: "Возврат завершён",
            }).catch(() => {});
          }
        }

        if (ret?.telegram_user_id) {
          const STATUS_LABELS: Record<string, string> = {
            approved: "одобрен", rejected: "отклонён", refunded: "возврат средств выполнен",
          };
          const shortOrderId = ret.order_id?.slice(0, 8).toUpperCase() || "";

          await supabase.from("notifications").insert({
            telegram_user_id: ret.telegram_user_id,
            type: `return_${status}`,
            title: `🔄 Возврат #${shortOrderId}`,
            body: status === "refunded"
              ? "Возврат завершён. Информация о заказе скрыта из ваших заказов."
              : `Ваша заявка на возврат ${STATUS_LABELS[status] || status}`,
            data: { order_id: ret.order_id, return_id, status },
          }).catch(() => {});

          const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || Deno.env.get("BOT_TOKEN");
          if (botToken) {
            const emoji = status === "approved" ? "✅" : status === "rejected" ? "❌" : "💰";
            const telegramText = status === "refunded"
              ? `${emoji} <b>Возврат #${shortOrderId}</b>\n\nВозврат завершён. Заказ скрыт из списка заказов.`
              : `${emoji} <b>Возврат #${shortOrderId}</b>\n\nВаша заявка ${STATUS_LABELS[status] || status}`;
            try {
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: String(ret.telegram_user_id),
                  text: telegramText,
                  parse_mode: "HTML",
                }),
              });
            } catch { /* non-critical */ }
          }
        }
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Admin API error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
