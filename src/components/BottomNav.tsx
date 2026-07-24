import { ShoppingCart, Package, User, LayoutGrid, Heart } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { useCartStore } from '../store/useCartStore';
import { useFavoriteIds } from '../lib/supabase/hooks';
import { useUserId } from '../hooks/useUserId';
import { cn } from '../lib/utils';

export const BottomNav = () => {
  const { t, language } = useTranslation();
  const location = useLocation();
  const totalItems = useCartStore((state) => state.getTotalItems());
  const userId = useUserId();
  const { data: favoriteIds = [] } = useFavoriteIds(userId);

  const navItems = [
    { path: '/catalog', icon: LayoutGrid, label: t('catalog'), isLogo: true },
    { path: '/favorites', icon: Heart, label: language === 'ru' ? 'Избранное' : 'Tanlangan', badge: favoriteIds.length },
    { path: '/cart', icon: ShoppingCart, label: t('cart'), badge: totalItems },
    { path: '/orders', icon: Package, label: t('orders') },
    { path: '/profile', icon: User, label: t('profile') },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border/50 pb-safe bottom-nav-bar">
      <div className="flex items-stretch justify-around h-14 sm:h-16">
        {navItems.map(({ path, icon: Icon, label, badge, isLogo }) => {
          const isActive = location.pathname === path ||
            (path === '/catalog' && location.pathname.startsWith('/product'));
          const isFavorites = path === '/favorites';
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex flex-col items-center justify-center flex-1 gap-1 relative transition-all duration-200',
                isActive ? 'text-text' : 'text-text-tertiary active:text-text-secondary'
              )}
            >
              <div className="relative">
                <div className={cn(
                  'p-1 rounded-xl transition-all duration-200',
                  isActive && 'bg-surface-muted'
                )}>
                  {isLogo ? (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={isActive ? 'var(--accent)' : 'currentColor'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={cn("transition-all duration-200", !isActive && "text-text-tertiary")}
                    >
                      <line x1="4" y1="6" x2="12" y2="6" />
                      <line x1="4" y1="12" x2="20" y2="12" />
                      <line x1="4" y1="18" x2="16" y2="18" />
                    </svg>
                  ) : (
                    <Icon
                      className="w-5 h-5 transition-all duration-200"
                      strokeWidth={isActive ? 2.5 : 1.8}
                      style={isActive && isFavorites ? { fill: 'var(--accent)', color: 'var(--accent)' } : undefined}
                    />
                  )}
                </div>
                {badge != null && badge > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 flex items-center justify-center px-1 bg-accent text-text-inverse text-2xs font-bold rounded-full animate-bounce-in">
                    {badge}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-2xs transition-all duration-200",
                isActive ? "font-bold" : "font-medium"
              )}>
                {label}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-accent rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
