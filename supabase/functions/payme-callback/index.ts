import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { notifyPaymentSuccess, notifyPaymentFailed } from "../_shared/telegram-notify.ts";

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

interface PaymeParams {
  id?: number | string;
  account?: { order_id?: string };
  amount?: number;
  reason?: number;
}

type PaymeResult = Record<string, unknown>;

function verifyPaymeAuth(req: Request): boolean {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false;
  }

  const merchantKey = Deno.env.get("PAYME_MERCHANT_KEY") ?? "";
  if (!merchantKey) return false;

  const decoded = atob(authHeader.slice(6));
  const [, password] = decoded.split(":");

  return password === merchantKey;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Verify request is from Payme
    if (!verifyPaymeAuth(req)) {
      return new Response(
        JSON.stringify({ error: { code: -32504, message: "Unauthorized" } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let payload;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: { code: -32700, message: "Parse error" } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { method, params } = payload;

    if (!method || !params) {
      return new Response(
        JSON.stringify({ error: { code: -32600, message: "Invalid request" } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: PaymeResult = {};

    switch (method) {
      case "CheckPerformTransaction":
        result = await checkPerformTransaction(params, supabase);
        break;
      case "CreateTransaction":
        result = await createTransaction(params, supabase);
        break;
      case "PerformTransaction":
        result = await performTransaction(params, supabase);
        break;
      case "CancelTransaction":
        result = await cancelTransaction(params, supabase);
        break;
      case "CheckTransaction":
        result = await checkTransaction(params, supabase);
        break;
      default:
        return new Response(
          JSON.stringify({ error: { code: -32601, message: "Method not found" } }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({ result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: { code: -32400, message: (error as Error).message ?? "Internal error" } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function checkPerformTransaction(params: PaymeParams, supabase: SupabaseClient) {
  const { account, amount } = params;
  const orderId = account?.order_id;

  if (!orderId) {
    throw new Error("Order ID is required");
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, total_amount, status, transaction_id")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    throw new Error("Order not found");
  }

  if (order.transaction_id) {
    throw new Error("Order already has a transaction");
  }

  if (order.status === "paid" || order.status === "cancelled") {
    throw new Error("Order is not eligible for payment");
  }

  // Payme sends amount in tiyin (1/100 of sum)
  const amountInTiyin = Number(amount);
  const expectedTiyin = Number(order.total_amount) * 100;
  if (amountInTiyin !== expectedTiyin) {
    throw new Error("Incorrect amount");
  }

  return { allow: true };
}

async function createTransaction(params: PaymeParams, supabase: SupabaseClient) {
  const { id, account, amount } = params;
  const orderId = account?.order_id;

  if (!orderId || !id) {
    throw new Error("Missing required params");
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, total_amount, status, transaction_id")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    throw new Error("Order not found");
  }

  if (order.transaction_id && order.transaction_id !== id.toString()) {
    throw new Error("Order already has a different transaction");
  }

  // Verify amount
  const amountInTiyin = Number(amount);
  const expectedTiyin = Number(order.total_amount) * 100;
  if (amountInTiyin !== expectedTiyin) {
    throw new Error("Incorrect amount");
  }

  await supabase
    .from("orders")
    .update({
      transaction_id: id.toString(),
      status: "processing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  return {
    create_time: Date.now(),
    transaction: id.toString(),
    state: 1,
  };
}

async function performTransaction(params: PaymeParams, supabase: SupabaseClient) {
  const { id } = params;

  if (!id) throw new Error("Transaction ID is required");

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status")
    .eq("transaction_id", id.toString())
    .maybeSingle();

  if (error || !order) {
    throw new Error("Transaction not found");
  }

  if (order.status !== "processing") {
    throw new Error("Invalid order state for payment");
  }

  await supabase
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  // Notify admin about successful payment
  const { data: orderDetails } = await supabase
    .from("orders")
    .select("total_amount, payment_method")
    .eq("id", order.id)
    .maybeSingle();
  if (orderDetails) {
    notifyPaymentSuccess(order.id, Number(orderDetails.total_amount), orderDetails.payment_method || "payme");
  }

  return {
    transaction: id.toString(),
    perform_time: Date.now(),
    state: 2,
  };
}

async function cancelTransaction(params: PaymeParams, supabase: SupabaseClient) {
  const { id, reason } = params;

  if (!id) throw new Error("Transaction ID is required");

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status")
    .eq("transaction_id", id.toString())
    .maybeSingle();

  if (error || !order) {
    throw new Error("Transaction not found");
  }

  await supabase
    .from("orders")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  // Notify admin about failed payment
  const { data: orderDetails } = await supabase
    .from("orders")
    .select("total_amount, payment_method")
    .eq("id", order.id)
    .maybeSingle();
  if (orderDetails) {
    notifyPaymentFailed(order.id, Number(orderDetails.total_amount), orderDetails.payment_method || "payme", `Payme reason code: ${reason ?? 0}`);
  }

  return {
    transaction: id.toString(),
    cancel_time: Date.now(),
    state: -1,
    reason: reason ?? 0,
  };
}

async function checkTransaction(params: PaymeParams, supabase: SupabaseClient) {
  const { id } = params;

  if (!id) throw new Error("Transaction ID is required");

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status, transaction_id, created_at, paid_at")
    .eq("transaction_id", id.toString())
    .maybeSingle();

  if (error || !order) {
    throw new Error("Transaction not found");
  }

  const stateMap: Record<string, number> = {
    processing: 1,
    paid: 2,
    cancelled: -1,
  };

  return {
    transaction: id.toString(),
    state: stateMap[order.status] ?? 1,
    create_time: new Date(order.created_at).getTime(),
    perform_time: order.paid_at ? new Date(order.paid_at).getTime() : 0,
  };
}
