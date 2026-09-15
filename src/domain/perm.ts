import type { Role } from '../api/firestoreClient';

/**
 * Mức quyền và những gì mỗi mức làm được.
 *
 * Ba mức cấp được cho người đóng góp, theo đúng lời anh Hiếu:
 *   viewer    — chỉ xem, có tìm kiếm
 *   commenter — xem + thêm ghi chú
 *   admin     — toàn quyền: sửa người, sửa quan hệ, mời và duyệt người vào
 *
 * `owner` không phải mức cấp được: đó là người lập cây. Khác admin đúng hai
 * điểm, và cả hai đều để tránh khoá chết dòng họ: không ai hạ được quyền chủ,
 * và chỉ chủ mới đụng được vào bản ghi thành viên của chính chủ.
 *
 * QUAN TRỌNG: bảng này phải khớp từng dòng với `firebase/firestore.rules`.
 * Giao diện ẩn nút đi chỉ là phép lịch sự — chặn thật nằm ở luật Firestore,
 * vì cấu hình client vốn công khai, ai cũng gọi thẳng API được. Hai nơi lệch
 * nhau thì hoặc người dùng thấy nút, bấm vào lại báo lỗi; hoặc tệ hơn: nút bị
 * ẩn nhưng dữ liệu thực ra vẫn ghi được.
 */

/** Từ thấp lên cao. Vị trí trong mảng chính là thứ bậc. */
export const ROLE_ORDER: readonly Role[] = ['viewer', 'commenter', 'admin', 'owner'] as const;

export const ROLE_LABEL: Record<Role, string> = {
  viewer: 'Chỉ xem',
  commenter: 'Bình luận',
  admin: 'Toàn quyền',
  owner: 'Chủ họ',
};

export const ROLE_HINT: Record<Role, string> = {
  viewer: 'Xem và tìm kiếm trong gia phả. Không sửa, không ghi chú.',
  commenter: 'Xem, tìm kiếm và thêm ghi chú. Không sửa thông tin người.',
  admin: 'Toàn quyền: thêm sửa xoá người và quan hệ, mời và duyệt người vào.',
  owner: 'Người lập cây. Như toàn quyền, và không ai hạ quyền được.',
};

/** Mức cấp được cho người khác — quyền chủ họ không nằm trong đây. */
export const GRANTABLE_ROLES: readonly Role[] = ['viewer', 'commenter', 'admin'] as const;

/**
 * Giá trị cũ còn nằm trong Firestore từ trước khi đổi tên mức.
 * Đọc thì quy về mức mới, không phải sửa dữ liệu.
 */
const LEGACY: Record<string, Role> = { editor: 'admin' };

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLE_ORDER as readonly string[]).includes(value);
}

/** Bất cứ giá trị nào đọc từ Firestore đều phải đi qua đây trước khi dùng. */
export function normaliseRole(value: unknown): Role {
  if (isRole(value)) return value;
  if (typeof value === 'string' && LEGACY[value]) return LEGACY[value];
  // Không nhận ra thì cho mức thấp nhất, không phải mức cao nhất.
  return 'viewer';
}

/** Vai này có đủ tầm của vai kia không. */
export function atLeast(role: Role, min: Role): boolean {
  return ROLE_ORDER.indexOf(role) >= ROLE_ORDER.indexOf(min);
}

export interface Permissions {
  /** Xem cây và tìm kiếm */
  canView: boolean;
  /** Thêm và xoá ghi chú của mình */
  canComment: boolean;
  /** Thêm, sửa, xoá người và quan hệ */
  canEdit: boolean;
  /** Mời người, duyệt người xin vào, đổi mức quyền của người khác */
  canManage: boolean;
  /** Người lập cây — không ai hạ quyền được */
  isOwner: boolean;
}

export function permissionsOf(role: Role): Permissions {
  return {
    canView: atLeast(role, 'viewer'),
    canComment: atLeast(role, 'commenter'),
    canEdit: atLeast(role, 'admin'),
    canManage: atLeast(role, 'admin'),
    isOwner: role === 'owner',
  };
}

/** Người chưa được vào họ thì không có quyền gì, kể cả xem. */
export const NO_PERMISSIONS: Permissions = {
  canView: false,
  canComment: false,
  canEdit: false,
  canManage: false,
  isOwner: false,
};
