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

// Simple in-memory rate limiter (resets on cold start)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(key: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (entry && now < entry.resetAt) {
    if (entry.count >= MAX_ATTEMPTS) {
      return { allowed: false, retryAfterMs: entry.resetAt - now };
    }
  }
  return { allowed: true };
}

function recordAttempt(key: string) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (entry && now < entry.resetAt) {
    entry.count++;
    if (entry.count >= MAX_ATTEMPTS) {
      entry.resetAt = now + LOCKOUT_MS;
    }
  } else {
    loginAttempts.set(key, { count: 1, resetAt: now + LOCKOUT_MS });
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

    const { email, password, verify_session, admin_id, token } = await req.json();

    // Session verification mode
    if (verify_session && admin_id && token) {
      const encoder = new TextEncoder();
      const data = encoder.encode(token);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { data: admin } = await supabase
        .from("admin_accounts")
        .select("id, session_expires_at")
        .eq("id", admin_id)
        .eq("session_token", tokenHash)
        .eq("is_active", true)
        .maybeSingle();

      if (admin && admin.session_expires_at && new Date(admin.session_expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ valid: false, error: "Session expired" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ valid: !!admin }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit check
    const rateLimitKey = `login:${email.trim().toLowerCase()}`;
    const rateCheck = checkRateLimit(rateLimitKey);
    if (!rateCheck.allowed) {
      const minutes = Math.ceil((rateCheck.retryAfterMs ?? 0) / 60000);
      return new Response(
        JSON.stringify({ error: `Too many login attempts. Try again in ${minutes} minutes.` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use the SQL function to verify password (handles bcrypt + plain text)
    const { data: result, error } = await supabase.rpc("verify_admin_password", {
      p_email: email.trim().toLowerCase(),
      p_password: password,
    }).maybeSingle();

    if (error || !result?.valid) {
      recordAttempt(rateLimitKey);
      return new Response(
        JSON.stringify({ error: result?.error || "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reset rate limit on successful login
    loginAttempts.delete(rateLimitKey);

    // Generate session token
    const sessionToken = crypto.randomUUID();
    const tokenHash = await hashToken(sessionToken);

    // Update session in DB
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("admin_accounts")
      .update({
        last_login_at: new Date().toISOString(),
        session_token: tokenHash,
        session_expires_at: expiresAt,
      })
      .eq("id", result.id);

    // Log the login
    await supabase.from("audit_log").insert({
      admin_id: result.id,
      action: "login",
      entity_type: "admin_accounts",
      entity_id: result.id,
      details: { email: result.email },
    });

    return new Response(
      JSON.stringify({
        success: true,
        admin: {
          id: result.id,
          email: result.email,
          first_name: result.first_name,
          role: result.role,
        },
        sessionToken,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Admin login error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function hashToken(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
