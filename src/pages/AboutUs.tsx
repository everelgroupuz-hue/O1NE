import { ArrowLeft, Shield, Truck, Heart, Star, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useTranslation } from '../hooks/useTranslation';
import { Logo } from '../components/Logo';

export const AboutUs = () => {
  const { language } = useTranslation();

  const values = [
    { icon: Shield, title: { ru: 'Гарантия качества', uz: 'Sifat kafolati' }, desc: { ru: 'Только оригинальные товары от проверенных поставщиков', uz: 'Faqat ishonchli yetkazib beruvchilardan original mahsulotlar' } },
    { icon: Truck, title: { ru: 'Быстрая доставка', uz: 'Tez yetkazish' }, desc: { ru: 'Доставим по всему Узбекистану за 1-3 дня', uz: "O'zbekiston bo'ylab 1-3 kunda yetkazamiz" } },
    { icon: Heart, title: { ru: 'Забота о клиентах', uz: 'Mijozlar g\'amxo\'rligi' }, desc: { ru: 'Всегда на связи и готовы помочь с выбором', uz: "Har doim aloqada va tanlovda yordam berishga tayyor" } },
    { icon: Star, title: { ru: 'Лучшие цены', uz: 'Eng yaxshi narxlar' }, desc: { ru: 'Доступные цены без посредников', uz: "O'rtachachilarsiz mavjud narxlar" } },
  ];

  const stats = [
    { value: '10 000+', label: { ru: 'Довольных клиентов', uz: 'Mamnun mijozlar' } },
    { value: '5 000+', label: { ru: 'Товаров в каталоге', uz: 'Katalogdagi mahsulotlar' } },
    { value: '4.8', label: { ru: 'Средний рейтинг', uz: 'O\'rtacha reyting' } },
    { value: '24/7', label: { ru: 'Поддержка клиентов', uz: 'Mijozlar qo\'llab-quvvatlashi' } },
  ];

  return (
    <Layout showBottomNav={false}>
      <div className="min-h-screen bg">
        <header className="sticky top-0 z-40 bg-surface border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
            <Link to="/" className="p-2 rounded-lg text-text-secondary hover:text-text dark:hover:text-text-inverse hover:bg-surface-muted transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-bold text-text">
              {language === 'ru' ? 'О нас' : 'Biz haqimizda'}
            </h1>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Hero */}
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center mb-4">
              <Logo size="lg" variant="full" className="!flex-col !items-center !gap-3" />
            </div>
            <p className="text-sm text-text-secondary leading-relaxed max-w-sm mx-auto">
              {language === 'ru'
                ? 'ONE — ваш надёжный магазин модной одежды и аксессуаров с доставкой по всему Узбекистану. Мы предлагаем качественные товары по доступным ценам.'
                : "ONE — O'zbekiston bo'ylab yetkazib berish bilan moda kiyimlar va aksessuarlar do'koni. Biz sifatli mahsulotlarni mavjud narxlarda taklif qilamiz."}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            {stats.map(({ value, label }, i) => (
              <div key={i} className="bg-surface rounded-2xl border border-border p-4 text-center">
                <p className="text-xl font-bold text-text">{value}</p>
                <p className="text-xs text-text-secondary mt-1">{label[language]}</p>
              </div>
            ))}
          </div>

          {/* Values */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-text uppercase tracking-wide">
              {language === 'ru' ? 'Наши ценности' : 'Bizning qadriyatlarimiz'}
            </h2>
            {values.map(({ icon: Icon, title, desc }, i) => (
              <div key={i} className="bg-surface rounded-2xl border border-border p-4 flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-surface-muted flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-text-secondary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text">{title[language]}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{desc[language]}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Mission */}
          <div className="bg-accent rounded-2xl p-5 text-text-inverse">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-5 h-5" />
              <h3 className="font-bold text-sm">
                {language === 'ru' ? 'Наша миссия' : 'Bizning missiyamiz'}
              </h3>
            </div>
            <p className="text-text-inverse/80 text-sm leading-relaxed">
              {language === 'ru'
                ? 'Сделать моду доступной для каждого жителя Узбекистана. Мы работаем напрямую с производителями, чтобы предложить вам лучшее качество по честным ценам.'
                : "O'zbekiston har bir aholisiga modani mavjud qilish. Biz ishlab chiqaruvchilar bilan to'g'ridan-to'g'ri ishlaymiz, sizga eng yaxshi sifatni halol narxlarda taklif etish uchun."}
            </p>
          </div>
        </main>
      </div>
    </Layout>
  );
};
