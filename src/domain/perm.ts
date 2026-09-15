import type { Role } from '../api/firestoreClient';

/**
 * Mức quyền và những gì mỗi mức làm được.
 *
 * QUAN TRỌNG: bảng này phải khớp từng dòng với `firebase/firestore.rules`.
 * Giao diện ẩn nút đi chỉ là phép lịch sự — chặn thật nằm ở luật Firestore,
 * vì cấu hình client vốn công khai, ai cũng gọi thẳng API được. Hai nơi lệch
 * nhau thì hoặc người dùng thấy nút, bấm vào lại báo lỗi; hoặc tệ hơn: nút bị
 * ẩn nhưng dữ liệu thực ra vẫn ghi được.
 */

/** Từ thấp lên cao. Vị trí trong mảng chính là thứ bậc. */
export const ROLE_ORDER: readonly Role[] = ['viewer', 'commenter', 'editor', 'owner'] as const;

export const ROLE_LABEL: Record<Role, string> = {
  viewer: 'Chỉ xem',
  commenter: 'Bình luận',
  editor: 'Sửa',
  owner: 'Chủ họ',
};

export const ROLE_HINT: Record<Role, string> = {
  viewer: 'Xem cây gia phả, không sửa và không ghi chú được.',
  commenter: 'Xem và ghi chú, nhưng không sửa được thông tin người.',
  editor: 'Thêm, sửa, xoá người và quan hệ.',
  owner: 'Toàn quyền, kể cả mời người khác và duyệt người vào.',
};

/** Mức quyền cấp được cho người khác — không ai tự phong mình làm chủ họ. */
export const GRANTABLE_ROLES: readonly Role[] = ['viewer', 'commenter', 'editor'] as const;

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLE_ORDER as readonly string[]).includes(value);
}

/** Vai này có đủ tầm của vai kia không. */
export function atLeast(role: Role, min: Role): boolean {
  return ROLE_ORDER.indexOf(role) >= ROLE_ORDER.indexOf(min);
}

export interface Permissions {
  canView: boolean;
  canComment: boolean;
  canEdit: boolean;
  isOwner: boolean;
}

export function permissionsOf(role: Role): Permissions {
  return {
    canView: atLeast(role, 'viewer'),
    canComment: atLeast(role, 'commenter'),
    canEdit: atLeast(role, 'editor'),
    isOwner: role === 'owner',
  };
}

/** Người chưa được vào họ thì không có quyền gì, kể cả xem. */
export const NO_PERMISSIONS: Permissions = {
  canView: false,
  canComment: false,
  canEdit: false,
  isOwner: false,
};
