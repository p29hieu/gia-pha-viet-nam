import { collectAncestors, getChildren, type FamilyGraph } from './graph';
import { findMarriage, marriagesOf } from './marriage';
import type { Gender, Member } from './types';

/**
 * Cac loai quan he cha me va quy tac noi hai nguoi voi nhau.
 *
 * Moi nguoi giu toi da mot nguoi o moi o: cha ruot, me ruot, cha nuoi, me nuoi,
 * cha do dau, me do dau. Cha me RUOT la co so duy nhat de tinh danh xung va
 * dung cay huyet thong; nuoi va do dau ghi rieng de khong khang dinh co ho o
 * cho thuc ra khong co.
 *
 * Quan trong nhat trong file nay la chan vong lap: dat cha cua A la mot nguoi
 * von la con chau cua A thi cay thanh vong tron, ham dung cay va ham tinh danh
 * xung se chay mai khong dung.
 */

export const PARENT_SLOTS = [
  'father',
  'mother',
  'adoptiveFather',
  'adoptiveMother',
  'godFather',
  'godMother',
] as const;

export type ParentSlot = (typeof PARENT_SLOTS)[number];
export type ParentKind = 'blood' | 'adoptive' | 'god';

export interface SlotInfo {
  label: string;
  /** Nhan cho chieu nguoc lai: nguoi kia goi minh la gi. */
  childLabel: string;
  gender: Gender;
  field: 'fatherId' | 'motherId' | 'adoptiveFatherId' | 'adoptiveMotherId' | 'godFatherId' | 'godMotherId';
  kind: ParentKind;
}

export const SLOTS: Record<ParentSlot, SlotInfo> = {
  father: { label: 'Bố', childLabel: 'con', gender: 'M', field: 'fatherId', kind: 'blood' },
  mother: { label: 'Mẹ', childLabel: 'con', gender: 'F', field: 'motherId', kind: 'blood' },
  adoptiveFather: {
    label: 'Bố nuôi',
    childLabel: 'con nuôi',
    gender: 'M',
    field: 'adoptiveFatherId',
    kind: 'adoptive',
  },
  adoptiveMother: {
    label: 'Mẹ nuôi',
    childLabel: 'con nuôi',
    gender: 'F',
    field: 'adoptiveMotherId',
    kind: 'adoptive',
  },
  godFather: {
    label: 'Bố đỡ đầu',
    childLabel: 'con đỡ đầu',
    gender: 'M',
    field: 'godFatherId',
    kind: 'god',
  },
  godMother: {
    label: 'Mẹ đỡ đầu',
    childLabel: 'con đỡ đầu',
    gender: 'F',
    field: 'godMotherId',
    kind: 'god',
  },
};

export interface Check {
  ok: boolean;
  reason?: string;
}

const OK: Check = { ok: true };

/** Cha me quyet dinh cho dung trong cay: ruot truoc, khong co thi den nuoi. */
export function placementParents(m: Member | undefined): string[] {
  if (!m) return [];
  return [m.fatherId, m.motherId, m.adoptiveFatherId, m.adoptiveMotherId].filter(
    (x): x is string => Boolean(x),
  );
}

/**
 * Nguoi nay co phai con chau cua goc khong, tinh theo ca ruot lan nuoi.
 * Nuoi cung tinh vi no quyet dinh cho dung trong cay, nen cung tao vong lap duoc.
 */
export function isDescendantOf(graph: FamilyGraph, candidateId: string, rootId: string): boolean {
  const seen = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur || seen.has(cur)) continue;
    seen.add(cur);
    for (const m of graph.members.values()) {
      if (!placementParents(m).includes(cur)) continue;
      if (m.id === candidateId) return true;
      queue.push(m.id);
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
  const info = SLOTS[slot];
  if (childId === parentId) {
    return { ok: false, reason: `Không thể chọn chính người này làm ${info.label.toLowerCase()}.` };
  }

  const parent = graph.members.get(parentId);
  const child = graph.members.get(childId);
  if (!parent || !child) return { ok: false, reason: 'Không tìm thấy người này trong gia phả.' };

  if (parent.gender !== info.gender) {
    return {
      ok: false,
      reason: `${parent.fullName} là ${parent.gender === 'M' ? 'nam' : 'nữ'}, không đặt làm ${info.label.toLowerCase()} được.`,
    };
  }

  // Mot nguoi khong the vua o o nay vua o o khac cua cung mot dua tre.
  const dangGiuOKhac = PARENT_SLOTS.filter((s) => s !== slot).find(
    (s) => child[SLOTS[s].field] === parentId,
  );
  if (dangGiuOKhac) {
    return {
      ok: false,
      reason: `${parent.fullName} đang là ${SLOTS[dangGiuOKhac].label.toLowerCase()} của ${child.fullName}.`,
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
  parents: Array<{ slot: ParentSlot; person?: Member }>;
  spouse?: { member: Member; marriageId: string };
  /** Con ruot */
  children: Member[];
  /** Con nuoi va con do dau, kem loai */
  otherChildren: Array<{ person: Member; kind: ParentKind }>;
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

  const otherChildren: CurrentRelations['otherChildren'] = [];
  graph.members.forEach((m) => {
    if (m.adoptiveFatherId === id || m.adoptiveMotherId === id) {
      otherChildren.push({ person: m, kind: 'adoptive' });
    } else if (m.godFatherId === id || m.godMotherId === id) {
      otherChildren.push({ person: m, kind: 'god' });
    }
  });

  return {
    parents: PARENT_SLOTS.map((slot) => {
      const pid = me?.[SLOTS[slot].field];
      return { slot, person: pid ? graph.members.get(pid) : undefined };
    }),
    spouse: marriage && spouseMember ? { member: spouseMember, marriageId: marriage.id } : undefined,
    children: getChildren(graph, id)
      .map((cid) => graph.members.get(cid))
      .filter((m): m is Member => Boolean(m)),
    otherChildren,
  };
}
