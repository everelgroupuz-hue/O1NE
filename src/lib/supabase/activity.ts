import { supabase, isSupabaseConfigured, Database } from '../supabase';
import { adminQueries } from '../adminApi';
import { clientApiCall } from '../clientApi';
import { tg, refreshTg } from '../telegram';

export type Return = Database['public']['Tables']['returns']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type AuditLogEntry = Database['public']['Tables']['audit_log']['Row'];

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

export const returnQueries = {
  uploadPhoto: async (file: File) => {
    if (!isSupabaseConfigured) { await delay(); return URL.createObjectURL(file); }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `returns/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('return-photos').upload(path, file, { upsert: false });
    if (error) throw error;
    return supabase.storage.from('return-photos').getPublicUrl(path).data.publicUrl;
  },

  create: async (returnData: Omit<Return, 'id' | 'created_at' | 'updated_at' | 'status' | 'refund_amount' | 'admin_note'>) => {
    if (!isSupabaseConfigured) return { ...returnData, id: `ret-${Date.now()}`, status: 'pending' as const, refund_amount: 0, admin_note: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Return;
    const rpcParams = {
      p_telegram_user_id: returnData.telegram_user_id,
      p_order_id: returnData.order_id,
      p_items: returnData.items,
      p_reason: returnData.reason,
      p_photos: returnData.photos ?? [],
    };
    refreshTg();
    if (tg?.initData) {
      try {
        const data = await clientApiCall<Return>('insert_return', rpcParams);
        return data;
      } catch {
        // fallback to direct RPC
      }
    }
    const { data, error } = await supabase.rpc('insert_return', rpcParams).single();
    if (error) throw error;
    return data as Return;
  },

  getByUser: async (telegramUserId: number) => {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.from('returns').select('*').eq('telegram_user_id', telegramUserId).order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  getAll: async () => {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.from('returns').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  updateStatus: async (id: string, status: Return['status'], adminNote?: string) => {
    if (!isSupabaseConfigured) return {} as Return;
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (adminNote) updates.admin_note = adminNote;
    if (status === 'refunded') updates.refund_amount = 0;
    return adminQueries.updateReturnStatus(id, updates) as Promise<Return>;
  },
};

export const notificationQueries = {
  getByUser: async (telegramUserId: number) => {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.from('notifications').select('*').eq('telegram_user_id', telegramUserId).order('created_at', { ascending: false }).limit(30);
    if (error) throw error;
    return data ?? [];
  },

  getUnreadCount: async (telegramUserId: number) => {
    if (!isSupabaseConfigured) return 0;
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('telegram_user_id', telegramUserId).eq('is_read', false);
    return count ?? 0;
  },

  markAsRead: async (id: string) => {
    if (!isSupabaseConfigured) return;
    refreshTg();
    if (tg?.initData) {
      try {
        await clientApiCall('mark_notification_read', { p_id: id });
        return;
      } catch {
        // fallback to direct RPC
      }
    }
    const { error } = await supabase.rpc('mark_notification_read', { p_id: id });
    if (error) throw error;
  },

  markAllAsRead: async (telegramUserId: number) => {
    if (!isSupabaseConfigured) return;
    refreshTg();
    if (tg?.initData) {
      try {
        await clientApiCall('mark_all_notifications_read', { p_telegram_user_id: telegramUserId });
        return;
      } catch {
        // fallback to direct RPC
      }
    }
    const { error } = await supabase.rpc('mark_all_notifications_read', { p_telegram_user_id: telegramUserId });
    if (error) throw error;
  },

  clearAllRead: async (telegramUserId: number) => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.rpc('clear_read_notifications', { p_telegram_user_id: telegramUserId });
    if (error) throw error;
  },

  create: async (notification: Omit<Notification, 'id' | 'created_at' | 'is_read' | 'sent_at'>) => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.rpc('insert_notification', {
      p_telegram_user_id: notification.telegram_user_id,
      p_type: notification.type,
      p_title: notification.title,
      p_body: notification.body,
      p_data: notification.data ?? {},
    });
    if (error) throw error;
  },
};

export const auditLogQueries = {
  log: async (entry: Omit<AuditLogEntry, 'id' | 'created_at' | 'ip_address' | 'entity_id'> & { entity_id?: string | null; ip_address?: string | null }) => {
    if (!isSupabaseConfigured) return;
    try {
      await adminQueries.insertAuditLog({ ...entry, entity_id: entry.entity_id ?? null, ip_address: entry.ip_address ?? null });
    } catch { /* non-critical */ }
  },

  getAll: async (limit = 100) => {
    if (!isSupabaseConfigured) return [];
    try {
      const data = await adminQueries.getAuditLogFiltered({});
      return (Array.isArray(data) ? data : []).slice(0, limit);
    } catch { return []; }
  },

  getByEntity: async (entityType: string, entityId?: string) => {
    if (!isSupabaseConfigured) return [];
    try {
      const filters: Record<string, unknown> = { entity_type: entityType };
      if (entityId) filters.entity_id = entityId;
      const data = await adminQueries.getAuditLogFiltered(filters);
      return Array.isArray(data) ? data.slice(0, 50) : [];
    } catch { return []; }
  },

  getByAdmin: async (adminId: string) => {
    if (!isSupabaseConfigured) return [];
    try {
      const data = await adminQueries.getAuditLogFiltered({ admin_id: adminId });
      return Array.isArray(data) ? data.slice(0, 100) : [];
    } catch { return []; }
  },
};
