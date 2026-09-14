import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const VISIBLE_MS = 3500;
/** Lỗi cần đọc kỹ hơn nên để lâu hơn. */
const ERROR_MS = 6000;
const MAX_VISIBLE = 3;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((list) => [...list, { id, kind, message }].slice(-MAX_VISIBLE));
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), kind === 'error' ? ERROR_MS : VISIBLE_MS),
      );
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
      pending.clear();
    };
  }, []);

  return { toasts, push, dismiss };
}
