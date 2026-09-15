import type { Marriage, Member, Note } from './types';

/**
 * Biến đổi dữ liệu ngay trên máy trước khi máy chủ xác nhận.
 *
 * Apps Script mất 2-4 giây mỗi lần ghi. Nếu chờ máy chủ rồi mới vẽ lại thì thao
 * tác nào cũng ì ạch. Thay vào đó ta áp thay đổi ngay, gửi lên ngầm, hỏng thì
 * hoàn nguyên về ảnh chụp cũ. Tất cả hàm dưới đây đều thuần và trả về bản sao mới.
 */
export interface FamilySnapshot {
  members: Member[];
  marriages: Marriage[];
  notes: Note[];
  myMemberId: string;
}

/** Id tạm dùng trong lúc chờ máy chủ cấp id thật. */
export function tempId(prefix = 'tmp'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isTempId(id: string): boolean {
  return id.startsWith('tmp_');
}

export function addMember(
  snapshot: FamilySnapshot,
  member: Member,
  spouseId?: string,
): FamilySnapshot {
  const marriages = spouseId
    ? [
        ...snapshot.marriages,
        {
          id: tempId('tmpw'),
          husbandId: member.gender === 'M' ? member.id : spouseId,
          wifeId: member.gender === 'M' ? spouseId : member.id,
          status: 'married' as const,
        },
      ]
    : snapshot.marriages;

  return { ...snapshot, members: [...snapshot.members, member], marriages };
}

/**
 * Máy chủ đã cấp id thật: thay id tạm ở mọi nơi đang trỏ tới nó.
 *
 * Phải đổi cả CHÍNH id của bản ghi chứ không chỉ các tham chiếu. Quên chỗ này
 * thì bản ghi giữ id tạm mãi, lệnh xoá gửi lên máy chủ trỏ vào document không
 * tồn tại và im lặng không làm gì — người dùng tưởng đã xoá mà thực ra chưa.
 */
export function commitId(snapshot: FamilySnapshot, from: string, to: string): FamilySnapshot {
  const swap = <T extends string | undefined>(id: T): T => (id === from ? (to as T) : id);
  const touches = (...ids: Array<string | undefined>) => ids.some((id) => id === from);

  return {
    ...snapshot,
    members: snapshot.members.map((m) =>
      touches(m.id, m.fatherId, m.motherId)
        ? { ...m, id: swap(m.id), fatherId: swap(m.fatherId), motherId: swap(m.motherId) }
        : m,
    ),
    marriages: snapshot.marriages.map((w) =>
      touches(w.id, w.husbandId, w.wifeId)
        ? { ...w, id: swap(w.id), husbandId: swap(w.husbandId), wifeId: swap(w.wifeId) }
        : w,
    ),
    notes: snapshot.notes.map((n) =>
      touches(n.id, n.memberId) ? { ...n, id: swap(n.id), memberId: swap(n.memberId) } : n,
    ),
    myMemberId: snapshot.myMemberId === from ? to : snapshot.myMemberId,
  };
}

export function updateMember(
  snapshot: FamilySnapshot,
  id: string,
  patch: Partial<Member>,
): FamilySnapshot {
  return {
    ...snapshot,
    members: snapshot.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
  };
}

/** Xoá người kèm mọi hôn nhân và ghi chú dính tới họ, đúng như máy chủ sẽ làm. */
export function removeMember(snapshot: FamilySnapshot, id: string): FamilySnapshot {
  return {
    members: snapshot.members.filter((m) => m.id !== id),
    marriages: snapshot.marriages.filter((w) => w.husbandId !== id && w.wifeId !== id),
    notes: snapshot.notes.filter((n) => n.memberId !== id),
    myMemberId: snapshot.myMemberId === id ? '' : snapshot.myMemberId,
  };
}

export function addMarriage(snapshot: FamilySnapshot, marriage: Marriage): FamilySnapshot {
  return { ...snapshot, marriages: [...snapshot.marriages, marriage] };
}

export function removeMarriage(snapshot: FamilySnapshot, id: string): FamilySnapshot {
  return { ...snapshot, marriages: snapshot.marriages.filter((w) => w.id !== id) };
}

export function addNote(snapshot: FamilySnapshot, note: Note): FamilySnapshot {
  return { ...snapshot, notes: [...snapshot.notes, note] };
}

export function removeNote(snapshot: FamilySnapshot, noteId: string): FamilySnapshot {
  return { ...snapshot, notes: snapshot.notes.filter((n) => n.id !== noteId) };
}
