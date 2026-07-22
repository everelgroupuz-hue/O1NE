import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { getTelegramUser, readyApp, expandApp, refreshTg } from './lib/telegram';
import { useAppStore } from './store/useAppStore';

// Global error handlers
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

async function initializeUser(attempt = 1): Promise<void> {
  refreshTg();
  const tgUser = getTelegramUser();

  if (tgUser?.id) {
    useAppStore.getState().setTelegramUserId(tgUser.id);

    try {
      const { userQueries } = await import('./lib/supabase/hooks');
      const result = await userQueries.upsert(tgUser.id, {
        first_name: tgUser.first_name || '',
        username: tgUser.username || null,
        language: tgUser.language_code || 'ru',
      });
    } catch (err) {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, attempt * 1000));
        return initializeUser(attempt + 1);
      }
    }
  } else {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, attempt * 500));
      return initializeUser(attempt + 1);
    }
  }
}

initializeUser();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
