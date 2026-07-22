import { supabase, isSupabaseConfigured, Database } from '../supabase';
import { adminQueries } from '../adminApi';
import { clientApiCall } from '../clientApi';
import { tg, refreshTg } from '../telegram';
import type { Product } from './products';

export type User = Database['public']['Tables']['users']['Row'];
export type Referral = Database['public']['Tables']['referrals']['Row'];

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

export const userQueries = {
  getByTelegramId: async (telegramId: number) => {
    if (!isSupabaseConfigured) {
      await delay();
      return { id: `${telegramId}`, telegram_id: telegramId, first_name: 'Гость', username: null, language: 'ru', phone: null, address: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    }
    const { data, error } = await supabase.from('users').select('*').eq('telegram_id', telegramId).maybeSingle();
    if (error) throw error;
    return data;
  },

  upsert: async (telegramId: number, userData: { first_name: string; username?: string | null; language?: string; phone?: string; latitude?: number | null; longitude?: number | null }) => {
    if (!isSupabaseConfigured) {
      await delay();
      return { id: `${telegramId}`, telegram_id: telegramId, ...userData, phone: null, address: null, latitude: null, longitude: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as User;
    }
    const rpcParams = {
      p_telegram_id: telegramId,
      p_first_name: userData.first_name,
      p_username: userData.username ?? null,
      p_language: userData.language ?? 'ru',
      p_phone: userData.phone ?? null,
      p_latitude: userData.latitude ?? null,
      p_longitude: userData.longitude ?? null,
    };
    refreshTg();
    if (tg?.initData) {
      try {
        const data = await clientApiCall<User>('upsert_user', rpcParams);
        return data;
      } catch {
        // fallback to direct RPC
      }
    }
    const { data, error } = await supabase.rpc('upsert_user', rpcParams).single();
    if (error) throw error;
    return data as User;
  },

  updateProfile: async (telegramId: number, updates: { phone?: string; address?: string; first_name?: string; latitude?: number | null; longitude?: number | null }) => {
    if (!isSupabaseConfigured) {
      await delay();
      return { id: `${telegramId}`, telegram_id: telegramId, first_name: updates.first_name || 'Гость', username: null, language: 'ru', phone: updates.phone ?? null, address: updates.address ?? null, latitude: updates.latitude ?? null, longitude: updates.longitude ?? null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as User;
    }
    const rpcParams = {
      p_telegram_id: telegramId,
      p_first_name: updates.first_name || 'Гость',
      p_phone: updates.phone ?? null,
      p_address: updates.address ?? null,
      p_latitude: updates.latitude ?? null,
      p_longitude: updates.longitude ?? null,
    };
    refreshTg();
    if (tg?.initData) {
      try {
        const data = await clientApiCall<User>('upsert_user', rpcParams);
        return data;
      } catch {
        // fallback to direct RPC
      }
    }
    const { data, error } = await supabase.rpc('upsert_user', rpcParams).single();
    if (error) throw error;
    return data as User;
  },
};

export const referralQueries = {
  getByCode: async (code: string) => {
    if (!isSupabaseConfigured) { await delay(); return null; }
    const { data, error } = await supabase.from('referrals').select('*').eq('referral_code', code).maybeSingle();
    if (error) throw error;
    return data;
  },

  create: async (telegramId: number) => {
    if (!isSupabaseConfigured) {
      await delay();
      return { id: `ref-${Date.now()}`, referrer_telegram_id: telegramId, referral_code: `REF${telegramId}${Math.random().toString(36).slice(7).toUpperCase()}`, bonus_amount: 50000, is_redeemed: false, redeemed_at: null, created_at: new Date().toISOString() } as Referral;
    }
    return adminQueries.createReferral({ referrer_telegram_id: telegramId, referral_code: `REF${telegramId}${Math.random().toString(36).slice(7).toUpperCase()}` }) as Promise<Referral>;
  },

  getByReferrer: async (telegramId: number) => {
    if (!isSupabaseConfigured) { await delay(); return []; }
    const { data, error } = await supabase.from('referrals').select('*').eq('referrer_telegram_id', telegramId);
    if (error) throw error;
    return data;
  },

  redeem: async (referralId: string, referredTelegramId: number) => {
    if (!isSupabaseConfigured) { await delay(); return null; }
    return adminQueries.updateReferral(referralId, { referred_telegram_id: referredTelegramId, is_redeemed: true, redeemed_at: new Date().toISOString() }) as Promise<Referral | null>;
  },
};

export const favoriteQueries = {
  getByUser: async (telegramUserId: number) => {
    if (!isSupabaseConfigured || !telegramUserId) return [];
    const { data, error } = await supabase.rpc('get_client_favorites', { p_telegram_user_id: telegramUserId });
    if (error) throw error;
    return (data ?? [])
      .filter((row: Record<string, unknown>) => row.id !== null)
      .map((row: Record<string, unknown>) => ({
        id: row.id as string,
        name: row.name,
        slug: row.slug as string,
        price: row.price as number,
        images: row.images as string[],
        is_active: row.is_active as boolean,
        stock: row.stock as number,
        sizes: row.sizes as string[],
        colors: row.colors as { name: string; hex: string }[],
        favoriteId: row.product_id as string,
        notify_price: row.notify_price as boolean,
        notify_stock: row.notify_stock as boolean,
      })) as (Product & { favoriteId: string; notify_price: boolean; notify_stock: boolean })[];
  },

  getProductIds: async (telegramUserId: number) => {
    if (!isSupabaseConfigured || !telegramUserId) return [] as string[];
    const { data, error } = await supabase.from('favorites').select('product_id').eq('telegram_user_id', telegramUserId);
    if (error) throw error;
    return (data ?? []).map((row) => row.product_id) as string[];
  },

  add: async (telegramUserId: number, productId: string) => {
    if (!isSupabaseConfigured) return;
    const rpcParams = { p_telegram_user_id: telegramUserId, p_product_id: productId };
    refreshTg();
    if (tg?.initData) {
      try {
        await clientApiCall('add_favorite', rpcParams);
        return;
      } catch {
        // fallback to direct RPC
      }
    }
    const { error } = await supabase.rpc('add_favorite', rpcParams);
    if (error) throw error;
  },

  remove: async (telegramUserId: number, productId: string) => {
    if (!isSupabaseConfigured) return;
    const rpcParams = { p_telegram_user_id: telegramUserId, p_product_id: productId };
    refreshTg();
    if (tg?.initData) {
      try {
        await clientApiCall('remove_favorite', rpcParams);
        return;
      } catch {
        // fallback to direct RPC
      }
    }
    const { error } = await supabase.rpc('remove_favorite', rpcParams);
    if (error) throw error;
  },

  updatePrefs: async (telegramUserId: number, productId: string, prefs: { notify_price?: boolean; notify_stock?: boolean }) => {
    if (!isSupabaseConfigured) return;
    const rpcParams = {
      p_telegram_user_id: telegramUserId,
      p_product_id: productId,
      p_notify_price: prefs.notify_price ?? null,
      p_notify_stock: prefs.notify_stock ?? null,
    };
    refreshTg();
    if (tg?.initData) {
      try {
        await clientApiCall('update_favorite', rpcParams);
        return;
      } catch {
        // fallback to direct RPC
      }
    }
    const { error } = await supabase.rpc('update_favorite', rpcParams);
    if (error) throw error;
  },

  getPrefs: async (telegramUserId: number, productId: string) => {
    if (!isSupabaseConfigured) return null;
    const { data } = await supabase.from('favorites').select('notify_price, notify_stock').eq('telegram_user_id', telegramUserId).eq('product_id', productId).maybeSingle();
    return data;
  },

  getAllStats: async () => {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.from('favorites').select('product_id, notify_price, notify_stock');
    if (error) throw error;
    const map: Record<string, { likes: number; notify_price: number; notify_stock: number }> = {};
    (data ?? []).forEach((row) => {
      if (!map[row.product_id]) map[row.product_id] = { likes: 0, notify_price: 0, notify_stock: 0 };
      map[row.product_id].likes++;
      if (row.notify_price) map[row.product_id].notify_price++;
      if (row.notify_stock) map[row.product_id].notify_stock++;
    });
    return Object.entries(map).map(([product_id, stats]) => ({ product_id, ...stats }));
  },

  getStatsForProduct: async (productId: string) => {
    if (!isSupabaseConfigured) return { likes: 0, notify_price: 0, notify_stock: 0 };
    const { data, error } = await supabase.from('favorites').select('notify_price, notify_stock').eq('product_id', productId);
    if (error) throw error;
    return { likes: data?.length ?? 0, notify_price: data?.filter((r) => r.notify_price).length ?? 0, notify_stock: data?.filter((r) => r.notify_stock).length ?? 0 };
  },

  getNotifyPriceUsers: async (productId: string) => {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.from('favorites').select('telegram_user_id').eq('product_id', productId).eq('notify_price', true);
    if (error) throw error;
    return (data ?? []).map((r) => r.telegram_user_id);
  },

  getNotifyStockUsers: async (productId: string) => {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.from('favorites').select('telegram_user_id').eq('product_id', productId).eq('notify_stock', true);
    if (error) throw error;
    return (data ?? []).map((r) => r.telegram_user_id);
  },
};

export const paymentQueries = {
  createPayment: async (orderId: string, amount: number, paymentMethod: 'payme' | 'click' | 'uzum') => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) { return { paymentUrl: null, orderId }; }
    const response = await fetch(`${supabaseUrl}/functions/v1/create-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'Apikey': anonKey },
      body: JSON.stringify({ orderId, amount, paymentMethod }),
    });
    if (!response.ok) throw new Error('Failed to create payment');
    return response.json();
  },
};
