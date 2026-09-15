import { collectAncestors, getChildren, type FamilyGraph } from './graph';
import { findMarriage, marriagesOf } from './marriage';
import type { Gender, Member } from './types';

/**
 * Kiem tra truoc khi noi hai nguoi voi nhau.
 *
 * Quan trong nhat la chan vong lap: dat cha cua A la mot nguoi von la con chau
 * cua A thi cay gia pha thanh vong tron, ham dung cay va ham tinh danh xung se
 * chay mai khong dung. Phai chan o day chu khong de xay ra roi moi xu ly.
 */

export type ParentSlot = 'father' | 'mother';

export interface Check {
  ok: boolean;
  reason?: string;
}

const OK: Check = { ok: true };

/** Nguoi nay co phai con chau cua goc khong. */
export function isDescendantOf(graph: FamilyGraph, candidateId: string, rootId: string): boolean {
  const seen = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur || seen.has(cur)) continue;
    seen.add(cur);
    for (const child of getChildren(graph, cur)) {
      if (child === candidateId) return true;
      queue.push(child);
    }
  }
  return false;
}

/** Hai nguoi co cung huyet thong truc he khong (to tien hoac con chau). */
export function isDirectLine(graph: FamilyGraph, a: string, b: string): boolean {
  if (collectAncestors(graph, a).has(b)) return true;
  if (collectAncestors(graph, b).has(a)) return true;
  return false;
}

export function canSetParent(
  graph: FamilyGraph,
  childId: string,
  parentId: string,
  slot: ParentSlot,
): Check {
  if (childId === parentId) return { ok: false, reason: 'Không thể chọn chính người này làm cha mẹ.' };

  const parent = graph.members.get(parentId);
  const child = graph.members.get(childId);
  if (!parent || !child) return { ok: false, reason: 'Không tìm thấy người này trong gia phả.' };

  const wanted: Gender = slot === 'father' ? 'M' : 'F';
  if (parent.gender !== wanted) {
    return {
      ok: false,
      reason: `${parent.fullName} là ${parent.gender === 'M' ? 'nam' : 'nữ'}, không đặt làm ${slot === 'father' ? 'bố' : 'mẹ'} được.`,
    };
  }

  if (isDescendantOf(graph, parentId, childId)) {
    return {
      ok: false,
      reason: `${parent.fullName} là con cháu của ${child.fullName}, đặt làm cha mẹ sẽ tạo vòng lặp trong gia phả.`,
    };
  }

  return OK;
}

export function canSetSpouse(graph: FamilyGraph, aId: string, bId: string): Check {
  if (aId === bId) return { ok: false, reason: 'Không thể chọn chính người này.' };

  const a = graph.members.get(aId);
  const b = graph.members.get(bId);
  if (!a || !b) return { ok: false, reason: 'Không tìm thấy người này trong gia phả.' };

  if (findMarriage(graph.marriages, aId, bId)) {
    return { ok: false, reason: `${a.fullName} và ${b.fullName} đã là vợ chồng.` };
  }

  if (isDirectLine(graph, aId, bId)) {
    return {
      ok: false,
      reason: `${a.fullName} và ${b.fullName} là người cùng huyết thống trực hệ, không thể là vợ chồng.`,
    };
  }

  return OK;
}

export interface CurrentRelations {
  father?: Member;
  mother?: Member;
  spouse?: { member: Member; marriageId: string };
  children: Member[];
}

/** Doc ra cac quan he truc tiep cua mot nguoi de hien thi va sua. */
export function readRelations(graph: FamilyGraph, id: string): CurrentRelations {
  const me = graph.members.get(id);
  const marriage = marriagesOf(graph.marriages, id)[0];
  const spouseId = marriage
    ? marriage.husbandId === id
      ? marriage.wifeId
      : marriage.husbandId
    : undefined;
  const spouseMember = spouseId ? graph.members.get(spouseId) : undefined;

  return {
    father: me?.fatherId ? graph.members.get(me.fatherId) : undefined,
    mother: me?.motherId ? graph.members.get(me.motherId) : undefined,
    spouse: marriage && spouseMember ? { member: spouseMember, marriageId: marriage.id } : undefined,
    children: getChildren(graph, id)
      .map((cid) => graph.members.get(cid))
      .filter((m): m is Member => Boolean(m)),
  };
}
