import { getChildren, getSpouses, type FamilyGraph } from './graph';
import type { Member } from './types';

export interface DeleteCheck {
  allowed: boolean;
  /** Những người đang nhận người này làm cha hoặc mẹ */
  children: Member[];
  /** Những gì sẽ mất đi nếu xoá */
  consequences: string[];
  /** Lý do không xoá được, nếu bị chặn */
  reason?: string;
}

/**
 * Xoá một người là thao tác không hoàn tác được, nên phải nói trước hệ quả.
 * Chặn hẳn khi người đó còn con nối vào: xoá đi thì cả nhánh bên dưới mất gốc,
 * mà người dùng lại không nhìn thấy điều đó xảy ra.
 */
export function checkCanDelete(graph: FamilyGraph, id: string, noteCount = 0): DeleteCheck {
  const member = graph.members.get(id);
  if (!member) {
    return { allowed: false, children: [], consequences: [], reason: 'Không tìm thấy người này.' };
  }

  const children = getChildren(graph, id)
    .map((cid) => graph.members.get(cid))
    .filter((m): m is Member => Boolean(m));

  if (children.length > 0) {
    const names = children.slice(0, 3).map((c) => c.fullName).join(', ');
    const more = children.length > 3 ? `, và ${children.length - 3} người nữa` : '';
    return {
      allowed: false,
      children,
      consequences: [],
      reason:
        `${member.fullName} đang là cha/mẹ của ${children.length} người (${names}${more}). ` +
        'Xoá đi thì cả nhánh bên dưới mất gốc. Hãy chuyển hoặc xoá những người đó trước.',
    };
  }

  const spouseCount = getSpouses(graph, id).length;
  const consequences: string[] = [];
  if (spouseCount > 0) {
    consequences.push(`Gỡ ${spouseCount} liên kết vợ/chồng`);
  }
  if (noteCount > 0) {
    consequences.push(`Xoá ${noteCount} ghi chú về người này`);
  }
  consequences.push('Không khôi phục lại được');

  return { allowed: true, children: [], consequences };
}

/** Các trường được phép sửa trên một thành viên. */
export const EDITABLE_FIELDS = [
  'fullName',
  'gender',
  'birthDate',
  'deathDate',
  'birthOrder',
  'address',
  'occupation',
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];

/** Chỉ gửi lên những trường thực sự đổi, để không ghi đè dữ liệu người khác vừa sửa. */
export function diffMember(original: Member, next: Partial<Member>): Partial<Member> {
  const patch: Partial<Member> = {};
  EDITABLE_FIELDS.forEach((field) => {
    if (!(field in next)) return;
    const before = original[field] ?? '';
    const after = next[field] ?? '';
    if (before !== after) {
      Object.assign(patch, { [field]: next[field] ?? '' });
    }
  });
  return patch;
}
