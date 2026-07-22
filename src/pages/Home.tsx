import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { getTelegramUser, tg, refreshTg } from '../lib/telegram';
import { ChevronRight, Sparkles, TrendingUp, Shield, Truck, Send } from 'lucide-react';
import { useProducts, useBanners, useFavoriteIds } from '../lib/supabase/hooks';
import { SplashScreen } from '../components/SplashScreen';
import { BannerSlider } from '../components/BannerSlider';
import { ProductCard } from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/Skeleton';

export const Home = () => {
  const navigate = useNavigate();
  const { language, setLanguage, setTelegramUserId, isRegistered } = useAppStore();
  const [splashDone, setSplashDone] = useState(false);
  const [entered, setEntered] = useState(false);

  refreshTg();
  const user = getTelegramUser();
  const userId = user?.id || 0;
  const { data: favoriteIds = [] } = useFavoriteIds(userId);
  const { data: banners = [] } = useBanners(true);
  const { data: productsData, isLoading: productsLoading } = useProducts(
    undefined,
    { field: 'views', order: 'desc' }
  );
  const featuredProducts = productsData?.pages.flatMap((p) => p.items) ?? [];

  useEffect(() => {
    if (user) {
      setTelegramUserId(user.id);
      const langCode = user.language_code;
      if (langCode === 'uz' || langCode === 'ru') {
        setLanguage(langCode);
      }
    }
  }, [user?.id, setLanguage, setTelegramUserId]);

  const handleSplashComplete = useCallback(() => {
    setSplashDone(true);
  }, []);

  const handleLanguageSelect = (lang: 'ru' | 'uz') => {
    setLanguage(lang);
    setEntered(true);
    setTimeout(() => {
      if (user?.id || isRegistered()) {
        navigate('/catalog');
      } else {
        navigate('/register');
      }
    }, 300);
  };

  if (!splashDone) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (!entered) {
    return (
      <div
        className="min-h-screen flex flex-col relative overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #FFFFFF 0%, #F8F8F8 30%, #F0F0F0 70%, #E8E8E8 100%)',
        }}
      >
        <div className="absolute top-[-80px] right-[-60px] w-[200px] sm:w-[280px] h-[200px] sm:h-[280px] rounded-full bg-accent/4 blur-3xl" />
        <div className="absolute bottom-[-60px] left-[-40px] w-[150px] sm:w-[200px] h-[150px] sm:h-[200px] rounded-full bg-surface-muted/6 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] rounded-full bg-accent/2 blur-3xl" />

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 relative z-10">
          <div className="w-full max-w-sm">
            <div className="text-center mb-14 animate-fade-in-up">
              <div className="inline-flex items-center justify-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center shadow-lg">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="4" y1="6" x2="12" y2="6" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="18" x2="16" y2="18" />
                  </svg>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-text tracking-[0.08em] mb-1">
                ONE
              </h1>
              <p className="text-text-tertiary text-sm text-balance max-w-xs mx-auto leading-relaxed">
                {language === 'ru'
                  ? 'Модная одежда и аксессуары с доставкой по всему Узбекистану'
                  : "O'zbekiston bo'ylab yetkazib berish bilan moda kiyimlar va aksessuarlar"}
              </p>
            </div>

            <div className="space-y-3 mb-10 animate-fade-in-up stagger-2">
              <button
                onClick={() => handleLanguageSelect('ru')}
                className="w-full flex items-center gap-3 sm:gap-4 bg-white/70 dark:bg-surface-elevated/70 hover:bg-white dark:hover:bg-surface-elevated active:scale-[0.98] backdrop-blur-sm border border-border text-text py-3.5 sm:py-4 px-4 sm:px-5 rounded-2xl font-semibold text-sm sm:text-base transition-all duration-200 group shadow-sm hover:shadow-md"
              >
                <span className="text-2xl">🇷🇺</span>
                <div className="text-left flex-1">
                  <p className="font-semibold">Русский</p>
                  <p className="text-xs text-text-tertiary font-normal">Russian</p>
                </div>
                <ChevronRight className="w-4 h-4 text-text-tertiary group-hover:text-text group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                onClick={() => handleLanguageSelect('uz')}
                className="w-full flex items-center gap-3 sm:gap-4 bg-white/70 dark:bg-surface-elevated/70 hover:bg-white dark:hover:bg-surface-elevated active:scale-[0.98] backdrop-blur-sm border border-border text-text py-3.5 sm:py-4 px-4 sm:px-5 rounded-2xl font-semibold text-sm sm:text-base transition-all duration-200 group shadow-sm hover:shadow-md"
              >
                <span className="text-2xl">🇺🇿</span>
                <div className="text-left flex-1">
                  <p className="font-semibold">O'zbekcha</p>
                  <p className="text-xs text-text-tertiary font-normal">Uzbek</p>
                </div>
                <ChevronRight className="w-4 h-4 text-text-tertiary group-hover:text-text group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>

            <div className="flex items-center justify-center gap-6 animate-fade-in-up stagger-6">
              <div className="flex items-center gap-1.5 text-text-tertiary">
                <Truck className="w-3.5 h-3.5" />
                <span className="text-2xs">{language === 'ru' ? 'Доставка' : 'Yetkazish'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-text-tertiary">
                <Shield className="w-3.5 h-3.5" />
                <span className="text-2xs">{language === 'ru' ? 'Гарантия' : 'Kafolat'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-text-tertiary">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="text-2xs">{language === 'ru' ? 'Качество' : 'Sifat'}</span>
              </div>
            </div>

            <p className="text-center text-text-tertiary text-2xs mt-8">
              ONE v1.0
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Catalog preview for logged-in users
  return (
    <div className="min-h-screen bg">
      {/* Hero Banner */}
      {banners.length > 0 && (
        <div className="animate-fade-in">
          <BannerSlider banners={banners} language={language} />
        </div>
      )}

      <div className="px-4 py-4 space-y-6">
        {/* Features strip */}
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4">
          {[
            { icon: Truck, label: language === 'ru' ? 'Быстрая доставка' : 'Tez yetkazish', color: 'bg-surface-muted text-surface-700' },
            { icon: Shield, label: language === 'ru' ? 'Гарантия качества' : 'Sifat kafolati', color: 'bg-surface-muted text-surface-700' },
            { icon: Sparkles, label: language === 'ru' ? 'Новинки каждую неделю' : 'Har hafta yangiliklar', color: 'bg-surface-muted text-surface-700' },
          ].map(({ icon: Icon, label, color }, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl whitespace-nowrap ${color} animate-fade-in-up`}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-semibold">{label}</span>
            </div>
          ))}
        </div>

        {/* Popular Products */}
        <section className="animate-fade-in-up stagger-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title">
              <TrendingUp className="w-5 h-5 text-text-secondary" />
              {language === 'ru' ? 'Популярное' : 'Mashhur'}
            </h2>
            <button
              onClick={() => navigate('/catalog')}
              className="text-xs font-semibold text-text hover:text-surface-700 transition-colors"
            >
              {language === 'ru' ? 'Все' : 'Hammasi'} →
            </button>
          </div>

          {productsLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {featuredProducts.slice(0, 4).map((product, i) => (
                <div key={product.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.08}s` }}>
                  <ProductCard product={product} language={language} favoriteIds={favoriteIds} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* CTA */}
        <div className="rounded-2xl p-5 text-text-inverse animate-fade-in-up stagger-4 bg-accent">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-5 h-5" />
            <h3 className="font-bold">
              {language === 'ru' ? 'Скидка 10% на первый заказ' : "Birinchi buyurtmaga 10% chegirma"}
            </h3>
          </div>
          <p className="text-text-inverse/70 text-xs mb-3">
            {language === 'ru'
              ? 'Используйте промокод ONE при оформлении заказа'
              : "ONE promo kodini kiriting buyurtma paytida"}
          </p>
          <button
            onClick={() => navigate('/catalog')}
            className="bg-white dark:bg-surface-inset text-text px-4 py-2 rounded-xl text-xs font-bold hover:bg-white/90 dark:hover:bg-surface-muted active:scale-95 transition-all"
          >
            {language === 'ru' ? 'Купить сейчас' : 'Hozir xarid qilish'}
          </button>
        </div>

        {/* Channel Subscribe Banner */}
        <div className="rounded-2xl p-4 bg-surface-muted border border-border animate-fade-in-up stagger-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
              <Send className="w-5 h-5 text-text-inverse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text">
                {language === 'ru' ? 'Наш канал' : 'Bizning kanal'}
              </p>
              <p className="text-xs text-text-secondary">
                {language === 'ru' ? 'Акции, скидки и новинки' : 'Aksiyalar, chegirmalar va yangiliklar'}
              </p>
            </div>
            <button
              onClick={() => {
                tg?.openTelegramLink?.('https://t.me/kupishop');
              }}
              className="px-3 py-2 rounded-xl bg-accent hover:bg-surface-elevated text-text-inverse text-xs font-bold active:scale-95 transition-all"
            >
              {language === 'ru' ? 'Подписаться' : 'Obuna bo\'lish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
