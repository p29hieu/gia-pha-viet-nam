import { useCallback, useEffect, useState } from 'react';
import { parseHash, routeToHash, type Route } from '../lib/route';

/**
 * Đường dẫn hiện tại, đọc từ hash và tự cập nhật khi người dùng bấm nút lùi.
 *
 * Phần biến đổi chuỗi nằm ở `src/lib/route.ts` (hàm thuần, test không cần trình
 * duyệt); ở đây chỉ còn việc bắt sự kiện và đổi hash.
 */

const CLAN_KEY = 'giapha_clan_cuoi';

/** Nhớ cây vừa xem để lần sau mở app vào thẳng, khỏi phải chọn lại. */
export function rememberClan(clanId: string): void {
  try {
    localStorage.setItem(CLAN_KEY, clanId);
  } catch {
    // Safari có thể chặn — chỉ mất tiện lợi, không ảnh hưởng gì khác.
  }
}

export function recallClan(): string {
  try {
    return localStorage.getItem(CLAN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function forgetClan(): void {
  try {
    localStorage.removeItem(CLAN_KEY);
  } catch {
    // bỏ qua
  }
}

export interface HashRoute {
  route: Route;
  /** Đi tới trang mới, có ghi vào lịch sử để nút lùi quay về được. */
  go: (next: Route) => void;
  /** Đổi đường dẫn tại chỗ, không ghi lịch sử — dùng khi tự mở lại cây vừa xem. */
  replace: (next: Route) => void;
}

export function useHashRoute(): HashRoute {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const doc = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', doc);
    return () => window.removeEventListener('hashchange', doc);
  }, []);

  const go = useCallback((next: Route) => {
    const hash = routeToHash(next);
    if (window.location.hash === hash) return;
    window.location.hash = hash;
  }, []);

  const replace = useCallback((next: Route) => {
    // replaceState không phát sự kiện hashchange nên phải tự đặt lại state.
    window.history.replaceState(null, '', routeToHash(next));
    setRoute(next);
  }, []);

  return { route, go, replace };
}
