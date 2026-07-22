import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Language } from '../lib/translations';

type Theme = 'light';

interface AppStore {
  language: Language;
  setLanguage: (language: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  telegramUserId: number | null;
  setTelegramUserId: (id: number | null) => void;
  registeredPhone: string | null;
  registeredName: string | null;
  setRegistration: (name: string, phone: string) => void;
  clearRegistration: () => void;
  isRegistered: () => boolean;
  getUserId: () => number;
}

function phoneToNumericId(phone: string): number {
  const digits = phone.replace(/\D/g, '');
  return parseInt(digits.slice(-9), 10) || Date.now();
}

function applyTheme() {
  document.documentElement.classList.remove('dark');
}

applyTheme();

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      language: 'ru',
      setLanguage: (language) => set({ language }),
      theme: 'light' as Theme,
      setTheme: () => {
        applyTheme();
      },
      telegramUserId: null,
      setTelegramUserId: (id) => set({ telegramUserId: id }),
      registeredPhone: null,
      registeredName: null,
      setRegistration: (name, phone) => set({ registeredName: name, registeredPhone: phone }),
      clearRegistration: () => set({ registeredName: null, registeredPhone: null }),
      isRegistered: () => {
        const state = get();
        return !!(state.telegramUserId || state.registeredPhone);
      },
      getUserId: () => {
        const state = get();
        if (state.telegramUserId) return state.telegramUserId;
        if (state.registeredPhone) return phoneToNumericId(state.registeredPhone);
        try {
          const liveUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
          if (liveUser?.id) return liveUser.id;
        } catch { /* noop */ }
        return 0;
      },
    }),
    {
      name: 'app-storage',
      onRehydrateStorage: () => (state) => {
        if (state && state.theme !== 'light') {
          state.theme = 'light';
          set({ theme: 'light' });
        }
        applyTheme();
      },
    }
  )
);
