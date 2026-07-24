import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore } from './toast-api';
import type { Toast } from './toast-api';

// Re-export toast API for backward compatibility
// eslint-disable-next-line react-refresh/only-export-components
export { toast, useToastStore } from './toast-api';
export type { Toast } from './toast-api';

const toastConfig = {
  success: {
    icon: CheckCircle,
    bg: 'bg-success-light dark:bg-success/10',
    border: 'border-success/20 dark:border-success/30',
    text: 'text-success-dark dark:text-success',
    iconColor: 'text-success',
  },
  error: {
    icon: XCircle,
    bg: 'bg-danger-light dark:bg-danger/10',
    border: 'border-danger/20 dark:border-danger/30',
    text: 'text-danger-dark dark:text-danger',
    iconColor: 'text-danger',
  },
  warning: {
    icon: AlertCircle,
    bg: 'bg-warning-light dark:bg-warning/10',
    border: 'border-warning/20 dark:border-warning/30',
    text: 'text-warning-dark dark:text-warning',
    iconColor: 'text-warning',
  },
  info: {
    icon: Info,
    bg: 'bg-navy-50 dark:bg-navy-900/30',
    border: 'border-navy-200 dark:border-navy-700',
    text: 'text-navy-800 dark:text-navy-200',
    iconColor: 'text-navy-500',
  },
};

const ToastItem = ({ toast: t }: { toast: Toast }) => {
  const { removeToast } = useToastStore();
  const config = toastConfig[t.type];
  const Icon = config.icon;

  return (
    <div
      className={`${config.bg} ${config.border} border rounded-2xl p-3 sm:p-3.5 shadow-elevated flex items-center gap-2.5 sm:gap-3 min-w-0 sm:min-w-[280px] max-w-[calc(100vw-2rem)] sm:max-w-sm animate-fade-in-down backdrop-blur-sm`}
    >
      <div className={`flex-shrink-0 ${config.iconColor}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className={`flex-1 text-sm font-medium ${config.text}`}>{t.message}</p>
      <button
        onClick={() => removeToast(t.id)}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-text-tertiary"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastContainer = () => {
  const toasts = useToastStore((state) => state.toasts);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto w-full max-w-sm">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  );
};
