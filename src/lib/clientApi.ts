import { tg, refreshTg } from './telegram';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Call client-api Edge Function with Telegram initData verification.
 * Used for user-scoped operations that need identity verification.
 */
export async function clientApiCall<T = unknown>(
  action: string,
  params: Record<string, unknown>
): Promise<T> {
  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase not configured');
  }

  refreshTg();
  const initData = tg?.initData;

  const response = await fetch(`${supabaseUrl}/functions/v1/client-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'Apikey': anonKey,
    },
    body: JSON.stringify({
      action,
      init_data: initData || undefined,
      ...params,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    console.error(`[ClientApi] ${action} FAILED:`, error);
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}
