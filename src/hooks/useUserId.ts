import { getTelegramUser } from '../lib/telegram';
import { useAppStore } from '../store/useAppStore';

export function useUserId(): number {
  const getUserId = useAppStore((s) => s.getUserId);
  return getTelegramUser()?.id || getUserId();
}
