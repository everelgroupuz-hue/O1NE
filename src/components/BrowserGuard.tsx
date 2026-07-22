import { isTelegramWebApp } from '../lib/telegram';

export const BrowserGuard = ({ children }: { children: React.ReactNode }) => {
  if (isTelegramWebApp()) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-surface-muted flex items-center justify-center mb-6">
        <span className="text-4xl">&#128722;</span>
      </div>
      <h1 className="text-xl font-bold text-text mb-2">ONE работает в Telegram</h1>
      <p className="text-sm text-text-secondary mb-6 max-w-xs">
        Откройте ONE через Telegram, чтобы пользоваться магазином.
      </p>
      <a
        href="https://t.me/kupishop?startapp"
        className="inline-flex items-center gap-2 bg-accent text-text-inverse font-semibold px-6 py-3 rounded-xl transition hover:bg-accent-hover active:scale-95"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121L8.32 13.617l-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" />
        </svg>
        Открыть в Telegram
      </a>
    </div>
  );
};
