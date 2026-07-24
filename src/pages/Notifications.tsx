import { Layout } from '../components/Layout';
import { NotificationCenter } from '../components/NotificationCenter';
import { getTelegramUser } from '../lib/telegram';
import { useAppStore } from '../store/useAppStore';
import { useTranslation } from '../hooks/useTranslation';

export const Notifications = () => {
  const getUserId = useAppStore((s) => s.getUserId);
  const userId = getTelegramUser()?.id || getUserId();
  const { language } = useTranslation();

  return (
    <Layout>
      <div className="px-4 pt-5 pb-2">
        <h1 className="text-xl font-bold text-text tracking-tight">
          {language === 'ru' ? 'Уведомления' : 'Bildirishnomalar'}
        </h1>
      </div>
      <div className="px-4 pb-24 pt-3">
        {userId > 0 ? (
          <NotificationCenter />
        ) : (
          <div className="text-center py-20 text-sm text-text-secondary">
            {language === 'ru' ? 'Войдите, чтобы видеть уведомления' : "Bildirishnomalarni ko'rish uchun kiring"}
          </div>
        )}
      </div>
    </Layout>
  );
};
