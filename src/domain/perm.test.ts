import { describe, expect, it } from 'vitest';
import type { Role } from '../api/firestoreClient';
import {
  GRANTABLE_ROLES,
  NO_PERMISSIONS,
  ROLE_LABEL,
  ROLE_ORDER,
  atLeast,
  isRole,
  permissionsOf,
} from './perm';

describe('thứ bậc mức quyền', () => {
  it('xếp từ thấp lên cao', () => {
    expect([...ROLE_ORDER]).toEqual(['viewer', 'commenter', 'editor', 'owner']);
  });

  it('vai cao có đủ tầm của vai thấp', () => {
    expect(atLeast('owner', 'viewer')).toBe(true);
    expect(atLeast('editor', 'commenter')).toBe(true);
  });

  it('vai thấp không với tới vai cao', () => {
    expect(atLeast('viewer', 'commenter')).toBe(false);
    expect(atLeast('commenter', 'editor')).toBe(false);
    expect(atLeast('editor', 'owner')).toBe(false);
  });

  it('vai bằng chính nó thì đủ', () => {
    ROLE_ORDER.forEach((r) => expect(atLeast(r, r)).toBe(true));
  });
});

describe('quyền của từng mức', () => {
  it('chỉ xem: đọc được, không ghi chú, không sửa', () => {
    expect(permissionsOf('viewer')).toEqual({
      canView: true,
      canComment: false,
      canEdit: false,
      isOwner: false,
    });
  });

  it('bình luận: ghi chú được nhưng không sửa được người', () => {
    expect(permissionsOf('commenter')).toEqual({
      canView: true,
      canComment: true,
      canEdit: false,
      isOwner: false,
    });
  });

  it('sửa: làm được mọi thứ trừ việc của chủ họ', () => {
    expect(permissionsOf('editor')).toEqual({
      canView: true,
      canComment: true,
      canEdit: true,
      isOwner: false,
    });
  });

  it('chủ họ: toàn quyền', () => {
    expect(permissionsOf('owner')).toEqual({
      canView: true,
      canComment: true,
      canEdit: true,
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
    expect([...GRANTABLE_ROLES]).toEqual(['viewer', 'commenter', 'editor']);
  });
});

describe('nhận ra giá trị hợp lệ', () => {
  it('nhận đúng bốn mức', () => {
    ROLE_ORDER.forEach((r) => expect(isRole(r)).toBe(true));
  });

  it('từ chối giá trị lạ đọc từ Firestore', () => {
    expect(isRole('admin')).toBe(false);
    expect(isRole('')).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole(3)).toBe(false);
  });
});

describe('nhãn hiển thị', () => {
  it('mức nào cũng có nhãn tiếng Việt', () => {
    ROLE_ORDER.forEach((r: Role) => expect(ROLE_LABEL[r]).toBeTruthy());
  });
});
