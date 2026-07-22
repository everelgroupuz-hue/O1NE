import { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, X, Sparkles, ArrowUp } from 'lucide-react';
import { Layout } from '../components/Layout';
import { ProductCard } from '../components/ProductCard';
import { BannerSlider } from '../components/BannerSlider';
import { ProductCardSkeleton } from '../components/Skeleton';
import { CollectionSection } from '../components/CollectionSection';
import { useTranslation } from '../hooks/useTranslation';
import { useDebounce } from '../hooks/useDebounce';
import { useProducts, useCategories, useBanners, useCollections, useFavoriteIds } from '../lib/supabase/hooks';
import { useAppStore } from '../store/useAppStore';
import { getLocalizedValue, cn } from '../lib/utils';

export const Catalog = () => {
  const { t, language } = useTranslation();
  const userId = useAppStore((s) => s.getUserId());
  const { data: favoriteIds = [] } = useFavoriteIds(userId);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 350);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'created_at' | 'price' | 'views'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const { data: categories = [] } = useCategories();
  const { data: banners = [] } = useBanners(true);
  const { data: collections = [] } = useCollections(true);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const filters = {
    categoryId: selectedCategory,
    minPrice,
    maxPrice,
    sizes: selectedSizes.length > 0 ? selectedSizes : undefined,
    colors: selectedColors.length > 0 ? selectedColors : undefined,
    inStock: inStockOnly,
    search: debouncedSearch || undefined,
  };

  const sort = { field: sortBy, order: sortOrder };

  const {
    data: productsData,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useProducts(filters, sort);

  const products = productsData?.pages.flatMap((p) => p.items) ?? [];
  const total = productsData?.pages[0]?.total ?? 0;

  const allSizes = Array.from(new Set(products.flatMap((p) => p.sizes))).sort();
  const allColors = Array.from(
    new Map(products.flatMap((p) => p.colors).map((c: { name: string; hex: string }) => [c.hex, c])).values()
  );

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) => prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]);
  };

  const toggleColor = (hex: string) => {
    setSelectedColors((prev) => prev.includes(hex) ? prev.filter((c) => c !== hex) : [...prev, hex]);
  };

  const clearFilters = () => {
    setSelectedCategory(undefined);
    setSearchQuery('');
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setSelectedSizes([]);
    setSelectedColors([]);
    setInStockOnly(false);
  };

  const activeFiltersCount =
    (selectedCategory ? 1 : 0) + (minPrice ? 1 : 0) + (maxPrice ? 1 : 0) +
    selectedSizes.length + selectedColors.length + (inStockOnly ? 1 : 0);

  return (
    <Layout>
      {banners.length > 0 && (
        <div className="animate-fade-in">
          <BannerSlider banners={banners} language={language} />
        </div>
      )}

      <div className="px-4 pt-4 pb-2 space-y-3">
        {/* Search bar */}
        <div className="relative animate-fade-in-up">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-text-tertiary" />
          <input
            type="text"
            placeholder={t('search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-premium pl-10 pr-12"
          />
          {searchQuery && searchQuery !== debouncedSearch && (
            <div className="absolute right-12 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-border border-t-transparent rounded-full animate-spin" />
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all",
              showFilters ? "bg-accent text-text-inverse" : "hover:bg-surface-muted text-text-secondary"
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-accent text-text-inverse text-2xs rounded-full w-4 h-4 flex items-center justify-center font-bold animate-bounce-in">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Categories scroll */}
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
          <div className="flex gap-2 pb-1">
            <button
              onClick={() => setSelectedCategory(undefined)}
              className={cn(
                "px-4 py-2 rounded-xl whitespace-nowrap text-xs font-semibold transition-all duration-200",
                !selectedCategory
                  ? 'bg-accent text-text-inverse'
                  : 'bg-surface-muted text-text-secondary dark:text-text-tertiary hover:bg-surface-inset dark:hover:bg-surface-muted'
              )}
            >
              {t('all_products')}
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={cn(
                  "px-4 py-2 rounded-xl whitespace-nowrap text-xs font-semibold transition-all duration-200",
                  selectedCategory === category.id
                    ? 'bg-accent text-text-inverse'
                    : 'bg-surface-muted text-text-secondary dark:text-text-tertiary hover:bg-surface-inset dark:hover:bg-surface-muted'
                )}
              >
                {getLocalizedValue(category.name, language)}
              </button>
            ))}
          </div>
        </div>

        {/* Sort row */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-tertiary font-medium">
            {isLoading ? '...' : `${total} ${language === 'ru' ? 'товаров' : 'mahsulot'}`}
          </span>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-');
              setSortBy(field as 'created_at' | 'price' | 'views');
              setSortOrder(order as 'asc' | 'desc');
            }}
            className="px-3 py-1.5 rounded-xl border border-border bg-surface text-text-secondary dark:text-text-tertiary text-xs font-medium outline-none focus:ring-2 focus:ring-surface-100"
          >
            <option value="created_at-desc">{t('newest')}</option>
            <option value="price-asc">{t('price_low')}</option>
            <option value="price-desc">{t('price_high')}</option>
            <option value="views-desc">{t('popularity')}</option>
          </select>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="mx-4 mb-3 card-premium p-4 animate-fade-in-down">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-text flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-text-secondary" />
              {t('filters')}
            </h3>
            <div className="flex items-center gap-3">
              {activeFiltersCount > 0 && (
                <button onClick={clearFilters} className="text-xs text-text font-semibold hover:text-surface-700">
                  {t('reset')}
                </button>
              )}
              <button onClick={() => setShowFilters(false)} className="p-1 rounded-lg hover:bg-surface-muted">
                <X className="w-4 h-4 text-text-tertiary" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">
                {t('price_from')} - {t('price_to')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="0"
                  value={minPrice || ''}
                  onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : undefined)}
                  className="flex-1 input-premium !py-2 !px-3 text-sm"
                />
                <span className="text-text-tertiary text-sm">—</span>
                <input
                  type="number"
                  placeholder="∞"
                  value={maxPrice || ''}
                  onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)}
                  className="flex-1 input-premium !py-2 !px-3 text-sm"
                />
              </div>
            </div>

            {allSizes.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">{t('size')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {allSizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => toggleSize(size)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200",
                        selectedSizes.includes(size)
                          ? 'bg-accent text-text-inverse border-accent'
                          : 'bg-surface text-text-secondary dark:text-text-tertiary border-border hover:border-border'
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {allColors.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">{t('color')}</label>
                <div className="flex flex-wrap gap-2">
                  {allColors.map((color: { name: string; hex: string }) => (
                    <button
                      key={color.hex}
                      onClick={() => toggleColor(color.hex)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all duration-200",
                        selectedColors.includes(color.hex)
                          ? 'border-surface-900 scale-110 ring-2 ring-surface-200'
                          : 'border-border hover:scale-105'
                      )}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            )}

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="w-4 h-4 rounded text-text focus:ring-surface-100"
              />
              <span className="text-xs font-medium text-text-secondary dark:text-text-tertiary">{t('in_stock')}</span>
            </label>
          </div>
        </div>
      )}

      {/* Products */}
      <div className="pb-24">
        {/* Collection Sections — show only when no filters */}
        {collections.length > 0 && !debouncedSearch && !selectedCategory && activeFiltersCount === 0 && (
          <div className="mt-2">
            {collections.map((col) => (
              <CollectionSection key={col.id} collection={col} language={language} />
            ))}
          </div>
        )}

        <div className="px-4 pt-2">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-surface-muted flex items-center justify-center mx-auto mb-4">
              <Search className="w-7 h-7 text-text-tertiary" />
            </div>
            <p className="text-sm font-medium text-text-tertiary">
              {debouncedSearch || activeFiltersCount > 0
                ? language === 'ru' ? 'Товары не найдены' : 'Mahsulotlar topilmadi'
                : language === 'ru' ? 'Нет товаров' : "Mahsulotlar yo'q"}
            </p>
            {(debouncedSearch || activeFiltersCount > 0) && (
              <button
                onClick={clearFilters}
                className="mt-3 px-4 py-2 rounded-xl bg-surface-muted text-text-secondary text-xs font-semibold hover:bg-surface-inset dark:hover:bg-surface-muted transition"
              >
                {language === 'ru' ? 'Сбросить фильтры' : 'Filtrlarni tozalash'}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {products.map((product, i) => (
                <div key={product.id} className="animate-fade-in-up" style={{ animationDelay: `${Math.min(i, 5) * 0.05}s` }}>
                  <ProductCard product={product} language={language} favoriteIds={favoriteIds} />
                </div>
              ))}
            </div>

            {hasNextPage && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl border border-border bg-surface text-sm font-semibold text-text hover:bg-surface-muted transition-all disabled:opacity-60"
                >
                  {isFetchingNextPage ? (
                    <>
                      <span className="w-4 h-4 border-2 border-border border-t-surface-900 rounded-full animate-spin" />
                      {language === 'ru' ? 'Загрузка...' : 'Yuklanmoqda...'}
                    </>
                  ) : (
                    language === 'ru'
                      ? `Показать ещё (${total - products.length})`
                      : `Yana ko'rsatish (${total - products.length})`
                  )}
                </button>
              </div>
            )}
          </>
        )}
        </div>
      </div>

      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-24 right-4 z-40 w-11 h-11 rounded-full bg-accent text-text-inverse shadow-lg flex items-center justify-center transition-all duration-200 hover:bg-accent-hover active:scale-90 animate-fade-in"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </Layout>
  );
};
