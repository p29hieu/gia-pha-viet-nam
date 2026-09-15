/**
 * Định tuyến bằng hash.
 *
 * Dùng hash (`#/c/main`) chứ không dùng đường dẫn thật (`/c/main`) vì GitHub
 * Pages là host tĩnh: mở thẳng một đường dẫn con sẽ ra trang 404 của GitHub,
 * phải dựng mẹo `404.html` mới lách được. Hash thì không bao giờ chạm tới máy
 * chủ, nên link gửi cho người nhà lúc nào cũng mở được.
 *
 * Toàn bộ file là hàm thuần để test không cần trình duyệt; phần bắt sự kiện
 * nằm ở `src/hooks/useHashRoute.ts`.
 */

export type Route =
  | { kind: 'home' }
  | { kind: 'clan'; clanId: string }
  | { kind: 'invite'; clanId: string; code: string }
  | { kind: 'compare'; clanId: string; aId: string; bId: string };

const HOME: Route = { kind: 'home' };

/** Hash gõ tay có thể hỏng; giữ nguyên đoạn thô còn hơn ném lỗi làm sập trang. */
function decode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#/, '').split('/').filter(Boolean).map(decode);

  if (parts[0] !== 'c' || !parts[1]) return HOME;
  const clanId = parts[1];

  if (parts[2] === 'moi' && parts[3]) {
    return { kind: 'invite', clanId, code: parts[3] };
  }
  if (parts[2] === 'so' && parts[3] && parts[4]) {
    return { kind: 'compare', clanId, aId: parts[3], bId: parts[4] };
  }
  return { kind: 'clan', clanId };
}

export function routeToHash(route: Route): string {
  const e = encodeURIComponent;
  switch (route.kind) {
    case 'home':
      return '#/';
    case 'clan':
      return `#/c/${e(route.clanId)}`;
    case 'invite':
      return `#/c/${e(route.clanId)}/moi/${e(route.code)}`;
    case 'compare':
      return `#/c/${e(route.clanId)}/so/${e(route.aId)}/${e(route.bId)}`;
  }
}

/** Cây gia phả mà đường dẫn đang trỏ tới, hoặc null khi còn ở trang chọn cây. */
export function clanOf(route: Route): string | null {
  return route.kind === 'home' ? null : route.clanId;
}
