import type { ToastItem } from '../../hooks/useToasts';

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

const ICON: Record<ToastItem['kind'], string> = {
  success: '✓',
  error: '!',
  info: '⋯',
};

export function ToastStack({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          className={`toast toast--${t.kind}`}
          type="button"
          key={t.id}
          onClick={() => onDismiss(t.id)}
          aria-label={`${t.message}. Chạm để đóng`}
        >
          <span className="toast__icon" aria-hidden="true">
            {ICON[t.kind]}
          </span>
          <span className="toast__text">{t.message}</span>
        </button>
      ))}
    </div>
  );
}
