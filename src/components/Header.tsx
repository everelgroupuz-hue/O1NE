import { ShoppingBag, User, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCartStore } from '../store/useCartStore';
import { useUnreadNotificationCount } from '../lib/supabase/hooks';
import { getTelegramUser } from '../lib/telegram';
import { useAppStore } from '../store/useAppStore';
import { Logo } from './Logo';

export const Header = () => {
  const totalItems = useCartStore((state) => state.getTotalItems());
  const getUserId = useAppStore((s) => s.getUserId);
  const userId = getTelegramUser()?.id || getUserId();
  const { data: unreadCount = 0 } = useUnreadNotificationCount(userId);

  return (
    <header className="sticky top-0 z-50 glass border-b border-border/30">
      <div className="px-3 sm:px-4 h-12 sm:h-14 flex items-center justify-between">
        <Link to="/catalog" className="flex items-center gap-2">
          <Logo size="sm" variant="icon" />
          <span className="text-sm font-bold tracking-[0.08em] text-text uppercase">
            ONE
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            to="/cart"
            className="relative p-2.5 rounded-xl hover:bg-surface-muted transition-colors"
          >
            <ShoppingBag className="w-5 h-5 text-text-secondary" />
            {totalItems > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-accent text-text-inverse text-2xs font-bold rounded-full animate-bounce-in">
                {totalItems}
              </span>
            )}
          </Link>

          <Link
            to="/notifications"
            className="relative p-2.5 rounded-xl hover:bg-surface-muted transition-colors"
          >
            <Bell className="w-5 h-5 text-text-secondary" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-accent text-text-inverse text-2xs font-bold rounded-full animate-bounce-in">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>

          <Link
            to="/profile"
            className="p-2.5 rounded-xl hover:bg-surface-muted transition-colors"
          >
            <User className="w-5 h-5 text-text-secondary" />
          </Link>
        </div>
      </div>
    </header>
  );
};
