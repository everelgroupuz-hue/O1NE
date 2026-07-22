import { ArrowLeft, Phone, Mail, MapPin, MessageCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useTranslation } from '../hooks/useTranslation';

export const ContactUs = () => {
  const { language } = useTranslation();

  const contacts = [
    {
      icon: Phone,
      label: language === 'ru' ? 'Телефон' : 'Telefon',
      value: '+998 90 123 45 67',
      action: 'tel:+998901234567',
    },
    {
      icon: MessageCircle,
      label: 'Telegram',
      value: '@styletech_shop',
      action: 'https://t.me/styletech_shop',
    },
    {
      icon: Mail,
      label: 'Email',
      value: 'info@styletech.uz',
      action: 'mailto:info@styletech.uz',
    },
    {
      icon: MapPin,
      label: language === 'ru' ? 'Адрес' : 'Manzil',
      value: language === 'ru' ? 'г. Ташкент, ул. Амира Темура, 108' : 'Toshkent sh., Amir Temur ko\'., 108',
    },
    {
      icon: Clock,
      label: language === 'ru' ? 'Режим работы' : 'Ish vaqti',
      value: language === 'ru' ? 'Пн-Сб: 09:00 - 21:00' : 'Du-Sha: 09:00 - 21:00',
    },
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
              {language === 'ru' ? 'Связаться с нами' : "Biz bilan bog'lanish"}
            </h1>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-6 space-y-3">
          <p className="text-sm text-text-secondary mb-4">
            {language === 'ru'
              ? 'Мы всегда рады помочь вам с любыми вопросами'
              : "Biz har doim sizga yordam berishga tayyormiz"}
          </p>

          {contacts.map(({ icon: Icon, label, value, action }, i) => (
            <div
              key={i}
              className="bg-surface rounded-2xl border border-border p-4 flex items-center gap-4"
            >
              <div className="w-11 h-11 rounded-xl bg-surface-muted flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-secondary">{label}</p>
                {action ? (
                  <a href={action} className="text-sm font-semibold text-text hover:underline truncate block">
                    {value}
                  </a>
                ) : (
                  <p className="text-sm font-semibold text-text truncate">{value}</p>
                )}
              </div>
            </div>
          ))}
        </main>
      </div>
    </Layout>
  );
};
