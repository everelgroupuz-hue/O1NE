import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, X, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { adminQueries, getAdminSession } from '../../lib/adminApi';
import { getCurrentAdmin } from '../../lib/auth';
import { toast } from '../../components/Toast';
import { useCategories } from '../../lib/supabase/hooks';
import { useUploadProductImages } from '../../lib/supabase/hooks';
import { generateSlug } from '../../lib/utils';
import { auditLogQueries } from '../../lib/supabase/queries';

interface ProductForm {
  name_ru: string;
  name_uz: string;
  slug: string;
  price: number;
  description_ru: string;
  description_uz: string;
  category_id: string;
  images: string[];
  sizes: string[];
  colors: Array<{ name: string; hex: string }>;
  stock: number;
  is_active: boolean;
}

interface OriginalData {
  price: number;
  stock: number;
}

const EMPTY_FORM: ProductForm = {
  name_ru: '',
  name_uz: '',
  slug: '',
  price: 0,
  description_ru: '',
  description_uz: '',
  category_id: '',
  images: [],
  sizes: [],
  colors: [],
  stock: 0,
  is_active: true,
};

async function notifyPriceDrop(productId: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return;
  const admin_session = getAdminSession();
  await fetch(`${supabaseUrl}/functions/v1/send-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}`, Apikey: anonKey },
    body: JSON.stringify({ product_id: productId, type: 'price_drop', admin_session }),
  }).catch(() => {});
}

async function notifyStockAvailable(productId: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return;
  const admin_session = getAdminSession();
  await fetch(`${supabaseUrl}/functions/v1/send-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}`, Apikey: anonKey },
    body: JSON.stringify({ product_id: productId, type: 'stock_available', admin_session }),
  }).catch(() => {});
}

export const AdminProductForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const admin = getCurrentAdmin();
  const isEditing = !!id;

  const { data: categories = [] } = useCategories();
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [originalData, setOriginalData] = useState<OriginalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newSize, setNewSize] = useState('');
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#000000');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadProductImages = useUploadProductImages();

  const loadProduct = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      if (data) {
        setForm({
          name_ru: (data.name as { ru: string; uz: string })?.ru || '',
          name_uz: (data.name as { ru: string; uz: string })?.uz || '',
          slug: data.slug || '',
          price: Number(data.price) || 0,
          description_ru: (data.description as { ru: string; uz: string })?.ru || '',
          description_uz: (data.description as { ru: string; uz: string })?.uz || '',
          category_id: data.category_id || '',
          images: data.images || [],
          sizes: data.sizes || [],
          colors: data.colors || [],
          stock: data.stock || 0,
          is_active: data.is_active ?? true,
        });
        setOriginalData({ price: Number(data.price) || 0, stock: data.stock || 0 });
      }
    } catch {
      toast.error('Не удалось загрузить товар');
      navigate('/nanyy/products');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (isEditing) {
      loadProduct();
    }
  }, [id, isEditing, loadProduct]);

  const handleNameChange = (value: string) => {
    setForm(prev => ({
      ...prev,
      name_ru: value,
      slug: prev.slug || generateSlug(value),
    }));
  };

  const handleSave = async () => {
    if (!form.name_ru.trim()) {
      toast.error('Введите название товара');
      return;
    }
    if (!form.slug.trim()) {
      toast.error('Slug обязателен');
      return;
    }
    if (form.price <= 0) {
      toast.error('Укажите цену');
      return;
    }
    if (form.images.length === 0) {
      toast.error('Добавьте хотя бы 1 изображение (макс. 6)');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: { ru: form.name_ru, uz: form.name_uz },
        slug: form.slug,
        price: form.price,
        description: { ru: form.description_ru, uz: form.description_uz },
        category_id: form.category_id || null,
        images: form.images,
        sizes: form.sizes,
        colors: form.colors,
        stock: form.stock,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      if (isEditing) {
        await adminQueries.updateProduct(id!, payload);
        toast.success('Товар обновлён');

        auditLogQueries.log({
          admin_id: admin?.id ?? 'unknown',
          action: 'update',
          entity_type: 'products',
          entity_id: id,
          details: { name: form.name_ru, price: form.price },
        }).catch(() => {});

        if (originalData) {
          if (form.price < originalData.price) {
            notifyPriceDrop(id!);
          }
          if (originalData.stock === 0 && form.stock > 0) {
            notifyStockAvailable(id!);
          }
        }
      } else {
        await adminQueries.createProduct(payload);
        toast.success('Товар создан');

        auditLogQueries.log({
          admin_id: admin?.id ?? 'unknown',
          action: 'create',
          entity_type: 'products',
          details: { name: form.name_ru, price: form.price },
        }).catch(() => {});
      }

      navigate('/nanyy/products');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка при сохранении';
      if (msg.includes('duplicate') && msg.includes('slug')) {
        toast.error('Товар с таким slug уже существует');
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const addImage = () => {
    if (form.images.length >= 6) {
      toast.error('Максимум 6 изображений');
      return;
    }
    if (newImageUrl.trim()) {
      setForm(prev => ({ ...prev, images: [...prev.images, newImageUrl.trim()] }));
      setNewImageUrl('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const remaining = 6 - form.images.length;
    if (remaining <= 0) {
      toast.error('Максимум 6 изображений');
      return;
    }
    setUploading(true);
    try {
      const filesToUpload = Array.from(files).slice(0, remaining);
      const urls = await uploadProductImages.mutateAsync(filesToUpload);
      setForm(prev => ({ ...prev, images: [...prev.images, ...urls] }));
    } catch {
      toast.error('Ошибка загрузки изображений');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  const addSize = () => {
    if (newSize.trim() && !form.sizes.includes(newSize.trim())) {
      setForm(prev => ({ ...prev, sizes: [...prev.sizes, newSize.trim()] }));
      setNewSize('');
    }
  };

  const removeSize = (index: number) => {
    setForm(prev => ({ ...prev, sizes: prev.sizes.filter((_, i) => i !== index) }));
  };

  const addColor = () => {
    if (newColorName.trim()) {
      setForm(prev => ({
        ...prev,
        colors: [...prev.colors, { name: newColorName.trim(), hex: newColorHex }],
      }));
      setNewColorName('');
      setNewColorHex('#000000');
    }
  };

  const removeColor = (index: number) => {
    setForm(prev => ({ ...prev, colors: prev.colors.filter((_, i) => i !== index) }));
  };

  if (!admin) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg flex items-center justify-center">
        <span className="w-8 h-8 border-4 border-surface-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg">
      <header className="sticky top-0 z-40 bg-surface border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/nanyy/products')}
              className="p-2 rounded-lg text-text-secondary hover:text-text dark:hover:text-text-inverse hover:bg-surface-muted transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-text">
              {isEditing ? 'Редактировать товар' : 'Новый товар'}
            </h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:bg-accent-muted text-text-inverse text-sm font-semibold px-4 py-2 rounded-xl transition shadow-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Basic Info */}
        <section className="bg-surface rounded-2xl border border-border p-5 space-y-4">
          <h2 className="text-sm font-bold text-text uppercase tracking-wide">Основная информация</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Название (RU) *</label>
              <input
                value={form.name_ru}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Футболка Premium"
                className="w-full px-3 py-2.5 bg dark:bg-surface-muted border border-border rounded-xl text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Название (UZ)</label>
              <input
                value={form.name_uz}
                onChange={(e) => setForm({ ...form, name_uz: e.target.value })}
                placeholder="Premium futbolka"
                className="w-full px-3 py-2.5 bg dark:bg-surface-muted border border-border rounded-xl text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Slug *</label>
              <input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="futbolka-premium"
                className="w-full px-3 py-2.5 bg dark:bg-surface-muted border border-border rounded-xl text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Цена (сум) *</label>
              <input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                className="w-full px-3 py-2.5 bg dark:bg-surface-muted border border-border rounded-xl text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Остаток</label>
              <input
                type="number"
                min={0}
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                className="w-full px-3 py-2.5 bg dark:bg-surface-muted border border-border rounded-xl text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Категория</label>
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full px-3 py-2.5 bg dark:bg-surface-muted border border-border rounded-xl text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Без категории</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {(cat.name as { ru: string; uz: string })?.ru || cat.slug}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Описание (RU)</label>
              <textarea
                rows={3}
                value={form.description_ru}
                onChange={(e) => setForm({ ...form, description_ru: e.target.value })}
                className="w-full px-3 py-2.5 bg dark:bg-surface-muted border border-border rounded-xl text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Описание (UZ)</label>
              <textarea
                rows={3}
                value={form.description_uz}
                onChange={(e) => setForm({ ...form, description_uz: e.target.value })}
                className="w-full px-3 py-2.5 bg dark:bg-surface-muted border border-border rounded-xl text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, is_active: !form.is_active })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? 'bg-accent' : 'bg-surface-muted dark:bg-gray-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm text-text">
              {form.is_active ? 'Активен (виден покупателям)' : 'Скрыт (черновик)'}
            </span>
          </div>
        </section>

        {/* Images */}
        <section className="bg-surface rounded-2xl border border-border p-5 space-y-4">
          <h2 className="text-sm font-bold text-text uppercase tracking-wide">Изображения <span className="text-text-secondary font-normal normal-case">({form.images.length}/6)</span></h2>

          {form.images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {form.images.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt="" className="w-full h-20 object-cover rounded-xl border border-border" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-text-inverse rounded-full opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              placeholder="https://images.pexels.com/..."
              onKeyDown={(e) => e.key === 'Enter' && addImage()}
              disabled={form.images.length >= 6 || uploading}
              className="flex-1 px-3 py-2.5 bg dark:bg-surface-muted border border-border rounded-xl text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
            />
            <button
              onClick={addImage}
              disabled={form.images.length >= 6 || uploading}
              className="px-4 py-2.5 bg-accent hover:bg-accent-hover text-text-inverse rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={form.images.length >= 6 || uploading}
              className="px-4 py-2.5 bg-surface border border-border hover:bg dark:hover:bg-surface-elevated text-text rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {uploading ? (
                <span className="w-4 h-4 border-2 border-border border-t-surface-900 rounded-full animate-spin" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              )}
              <span className="hidden sm:inline">{uploading ? '...' : 'Файл'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
          <p className="text-[10px] text-text-tertiary">
            Можно добавить по ссылке или загрузить файл (макс. 6 изображений)
          </p>
        </section>

        {/* Sizes */}
        <section className="bg-surface rounded-2xl border border-border p-5 space-y-4">
          <h2 className="text-sm font-bold text-text uppercase tracking-wide">Размеры</h2>

          {form.sizes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.sizes.map((size, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-sm font-medium bg-surface-muted text-surface-800 dark:text-gray-200 px-3 py-1.5 rounded-lg">
                  {size}
                  <button onClick={() => removeSize(i)} className="text-text-tertiary hover:text-red-500 transition">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              placeholder="S, M, L, XL..."
              onKeyDown={(e) => e.key === 'Enter' && addSize()}
              className="flex-1 px-3 py-2.5 bg dark:bg-surface-muted border border-border rounded-xl text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              onClick={addSize}
              className="px-4 py-2.5 bg-accent hover:bg-accent-hover text-text-inverse rounded-xl text-sm font-medium transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Colors */}
        <section className="bg-surface rounded-2xl border border-border p-5 space-y-4">
          <h2 className="text-sm font-bold text-text uppercase tracking-wide">Цвета</h2>

          {form.colors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.colors.map((color, i) => (
                <span key={i} className="inline-flex items-center gap-2 text-sm font-medium bg-surface-muted text-surface-800 dark:text-gray-200 px-3 py-1.5 rounded-lg">
                  <span className="w-4 h-4 rounded-full border border-border dark:border-gray-500" style={{ backgroundColor: color.hex }} />
                  {color.name}
                  <button onClick={() => removeColor(i)} className="text-text-tertiary hover:text-red-500 transition">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={newColorHex}
              onChange={(e) => setNewColorHex(e.target.value)}
              className="w-10 h-10 rounded-lg border border-border cursor-pointer"
            />
            <input
              value={newColorName}
              onChange={(e) => setNewColorName(e.target.value)}
              placeholder="Название цвета"
              onKeyDown={(e) => e.key === 'Enter' && addColor()}
              className="flex-1 px-3 py-2.5 bg dark:bg-surface-muted border border-border rounded-xl text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              onClick={addColor}
              className="px-4 py-2.5 bg-accent hover:bg-accent-hover text-text-inverse rounded-xl text-sm font-medium transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};
