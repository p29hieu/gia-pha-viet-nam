import { describe, expect, it } from 'vitest';
import type { Role } from '../api/firestoreClient';
import {
  GRANTABLE_ROLES,
  NO_PERMISSIONS,
  ROLE_LABEL,
  ROLE_ORDER,
  atLeast,
  isRole,
  normaliseRole,
  permissionsOf,
} from './perm';

describe('thứ bậc mức quyền', () => {
  it('xếp từ thấp lên cao', () => {
    expect([...ROLE_ORDER]).toEqual(['viewer', 'commenter', 'admin', 'owner']);
  });

  it('vai cao có đủ tầm của vai thấp', () => {
    expect(atLeast('owner', 'viewer')).toBe(true);
    expect(atLeast('admin', 'commenter')).toBe(true);
  });

  it('vai thấp không với tới vai cao', () => {
    expect(atLeast('viewer', 'commenter')).toBe(false);
    expect(atLeast('commenter', 'admin')).toBe(false);
    expect(atLeast('admin', 'owner')).toBe(false);
  });

  it('vai bằng chính nó thì đủ', () => {
    ROLE_ORDER.forEach((r) => expect(atLeast(r, r)).toBe(true));
  });
});

describe('quyền của từng mức', () => {
  it('chỉ xem: xem và tìm kiếm, không ghi chú, không sửa', () => {
    expect(permissionsOf('viewer')).toEqual({
      canView: true,
      canComment: false,
      canEdit: false,
      canManage: false,
      isOwner: false,
    });
  });

  it('bình luận: ghi chú được nhưng không sửa được người', () => {
    expect(permissionsOf('commenter')).toEqual({
      canView: true,
      canComment: true,
      canEdit: false,
      canManage: false,
      isOwner: false,
    });
  });

  it('toàn quyền: sửa được người và quản được người vào', () => {
    expect(permissionsOf('admin')).toEqual({
      canView: true,
      canComment: true,
      canEdit: true,
      canManage: true,
      isOwner: false,
    });
  });

  it('chủ họ: như toàn quyền, thêm chỗ đứng không ai hạ được', () => {
    expect(permissionsOf('owner')).toEqual({
      canView: true,
      canComment: true,
      canEdit: true,
      canManage: true,
      isOwner: true,
    });
  });

  it('chưa được vào họ thì không có quyền gì, kể cả xem', () => {
    expect(NO_PERMISSIONS.canView).toBe(false);
  });
});

describe('cấp quyền cho người khác', () => {
  it('không cấp được quyền chủ họ — tránh mất kiểm soát dòng họ', () => {
    expect(GRANTABLE_ROLES).not.toContain('owner');
  });

  it('cấp được đúng ba mức anh Hiếu yêu cầu', () => {
    expect([...GRANTABLE_ROLES]).toEqual(['viewer', 'commenter', 'admin']);
  });
});

describe('đọc giá trị từ Firestore', () => {
  it('nhận đúng bốn mức', () => {
    ROLE_ORDER.forEach((r) => expect(isRole(r)).toBe(true));
  });

  it('quy giá trị cũ "editor" về "admin", khỏi phải sửa dữ liệu', () => {
    expect(normaliseRole('editor')).toBe('admin');
  });

  it('giá trị lạ hoặc thiếu thì cho mức THẤP nhất, không phải mức cao nhất', () => {
    expect(normaliseRole('superuser')).toBe('viewer');
    expect(normaliseRole('')).toBe('viewer');
    expect(normaliseRole(undefined)).toBe('viewer');
    expect(normaliseRole(null)).toBe('viewer');
    expect(normaliseRole(3)).toBe('viewer');
    expect(normaliseRole({ role: 'owner' })).toBe('viewer');
  });

  it('từ chối giá trị cũ khi chỉ hỏi có phải mức hợp lệ không', () => {
    expect(isRole('editor')).toBe(false);
    expect(isRole('admin')).toBe(true);
    expect(isRole(undefined)).toBe(false);
  });
});

describe('nhãn hiển thị', () => {
  it('mức nào cũng có nhãn tiếng Việt', () => {
    ROLE_ORDER.forEach((r: Role) => expect(ROLE_LABEL[r]).toBeTruthy());
  });
});
