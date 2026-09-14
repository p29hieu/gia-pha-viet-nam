import {
  compareSeniority,
  findBloodConnection,
  getSpouses,
  type BloodConnection,
  type FamilyGraph,
} from '../graph';
import type { Kinship, KinPathStep, Member } from '../types';
import {
  ancestorTerm,
  cousinTerm,
  descendantTerm,
  grandparentSiblingTerm,
  parentSiblingTerm,
  siblingTerm,
  spouseOfTerm,
  toSelfPronoun,
} from './terms';

const UNKNOWN_TERM = 'chưa rõ';

/**
 * Tính danh xưng hai chiều giữa `egoId` ("tôi") và `targetId`.
 * Chiều ngược được tính bằng chính hàm này với hai đầu đảo lại, nên hai chiều
 * luôn nhất quán với nhau mà không cần bảng tra riêng.
 */
export function resolveKinship(graph: FamilyGraph, egoId: string, targetId: string): Kinship {
  const forward = resolveOneWay(graph, egoId, targetId);
  if (egoId === targetId) return forward;
  const backward = resolveOneWay(graph, targetId, egoId);
  return {
    ...forward,
    theyCallMe: backward.callThem,
    iCallMyself: toSelfPronoun(backward.callThem),
  };
}

function resolveOneWay(graph: FamilyGraph, egoId: string, targetId: string): Kinship {
  const ego = graph.members.get(egoId);
  const target = graph.members.get(targetId);
  if (!ego || !target) return unknown('Không tìm thấy người này trong gia phả');

  if (egoId === targetId) {
    return {
      callThem: 'chính bạn',
      theyCallMe: 'chính bạn',
      iCallMyself: 'tôi',
      category: 'ban-than',
      side: null,
      generationGap: 0,
      commonAncestorId: egoId,
      path: [{ memberId: egoId, label: 'Bạn' }],
      explanation: 'Đây chính là bạn.',
      warnings: [],
    };
  }

  if (getSpouses(graph, egoId).includes(targetId)) {
    const term = target.gender === 'M' ? 'chồng' : 'vợ';
    return {
      callThem: term,
      theyCallMe: ego.gender === 'M' ? 'chồng' : 'vợ',
      iCallMyself: 'tôi',
      category: 'hon-nhan',
      side: target.gender === 'M' ? 'chong' : 'vo',
      generationGap: 0,
      commonAncestorId: null,
      path: [
        { memberId: egoId, label: 'Bạn' },
        { memberId: targetId, label: term },
      ],
      explanation: `${target.fullName} là ${term} của bạn.`,
      warnings: [],
    };
  }

  const blood = findBloodConnection(graph, egoId, targetId);
  if (blood) return fromBlood(graph, blood, ego, target);

  // Người đó là vợ/chồng của một người có huyết thống với mình → dâu / rể.
  for (const spouseId of getSpouses(graph, targetId)) {
    const conn = findBloodConnection(graph, egoId, spouseId);
    const relative = graph.members.get(spouseId);
    if (!conn || !relative) continue;
    const via = fromBlood(graph, conn, ego, relative);
    // Vợ/chồng sau của bố mẹ mình là mẹ kế / bố dượng, không phải bố mẹ ruột —
    // nếu là ruột thì đã bắt được ở nhánh huyết thống phía trên rồi.
    const isStepParent = via.callThem === 'bố' || via.callThem === 'mẹ';
    const term = isStepParent
      ? target.gender === 'F'
        ? 'mẹ kế'
        : 'bố dượng'
      : spouseOfTerm(via.callThem, target.gender);
    return {
      ...via,
      callThem: term,
      category: 'hon-nhan',
      path: [...via.path, { memberId: targetId, label: term }],
      explanation:
        `${target.fullName} là ${target.gender === 'M' ? 'chồng' : 'vợ'} của ` +
        `${relative.fullName} — ${via.callThem} của bạn.`,
    };
  }

  // Người đó có huyết thống với vợ/chồng mình → họ hàng bên vợ / bên chồng.
  for (const mySpouseId of getSpouses(graph, egoId)) {
    const conn = findBloodConnection(graph, mySpouseId, targetId);
    const mySpouse = graph.members.get(mySpouseId);
    if (!conn || !mySpouse) continue;
    const via = fromBlood(graph, conn, mySpouse, target);
    const suffix = mySpouse.gender === 'F' ? 'vợ' : 'chồng';
    const term = inLawTerm(via.callThem, suffix);
    return {
      ...via,
      callThem: term,
      category: 'ben-vo-chong',
      side: suffix === 'vợ' ? 'vo' : 'chong',
      path: [{ memberId: egoId, label: 'Bạn' }, ...via.path.slice(0)],
      explanation:
        `${target.fullName} là ${via.callThem} của ${mySpouse.fullName} — ` +
        `${suffix} bạn. Bạn gọi là ${term}.`,
    };
  }

  return unknown('Chưa xác định được quan hệ. Có thể còn thiếu dữ liệu cha/mẹ ở một nhánh.');
}

function fromBlood(
  graph: FamilyGraph,
  conn: BloodConnection,
  ego: Member,
  target: Member,
): Kinship {
  const { dEgo, dTarget, side } = conn;
  const warnings: string[] = [];
  const gap = dEgo - dTarget;
  const isClose = Math.min(dEgo, dTarget) <= 1;

  let term: string;

  if (dTarget === 0) {
    term = ancestorTerm(dEgo, target.gender, side);
  } else if (dEgo === 0) {
    term = descendantTerm(dTarget, target.gender, side);
  } else if (gap === 0 && dEgo === 1) {
    const cmp = compareSeniority(target, ego);
    if (cmp === null) warnings.push('Thiếu năm sinh hoặc thứ tự sinh nên chưa chắc chắn vai anh/em.');
    term = siblingTerm(target.gender, (cmp ?? 0) < 0);
    if (!sharesBothParents(ego, target)) {
      warnings.push(halfSiblingLabel(ego, target));
    }
  } else if (gap === 0) {
    const senior = compareBranch(graph, conn);
    if (senior === null) warnings.push('Thiếu dữ liệu thứ bậc của đời trên nên chưa chắc chắn vai.');
    term = cousinTerm(target.gender, (senior ?? 0) < 0);
    addSeniorityWarning(target, ego, (senior ?? 0) < 0, warnings);
  } else if (gap > 0) {
    const senior = compareBranch(graph, conn);
    const older = (senior ?? 0) < 0;
    if (gap === 1) {
      term = parentSiblingTerm(target.gender, side, older);
    } else if (gap === 2) {
      term = grandparentSiblingTerm(target.gender, older);
    } else {
      term = ancestorTerm(gap, target.gender, side);
    }
    if (!isClose) term = `${term} họ`;
  } else {
    term = descendantTerm(-gap + 1, target.gender, null);
    if (!isClose) term = `${term} họ`;
  }

  return {
    callThem: term,
    theyCallMe: UNKNOWN_TERM,
    iCallMyself: UNKNOWN_TERM,
    category: 'huyet-thong',
    side,
    generationGap: gap,
    commonAncestorId: conn.commonAncestorId,
    path: buildPath(graph, conn, side),
    explanation: explain(graph, conn, target, term),
    warnings,
  };
}

/** So thứ bậc của hai nhánh ngay dưới tổ tiên chung. Âm nghĩa là nhánh của target ở vai trên. */
function compareBranch(graph: FamilyGraph, conn: BloodConnection): number | null {
  const egoBranch = graph.members.get(conn.egoPath[conn.dEgo - 1] ?? '');
  const targetBranch = graph.members.get(conn.targetPath[conn.dTarget - 1] ?? '');
  return compareSeniority(targetBranch, egoBranch);
}

function sharesBothParents(a: Member, b: Member): boolean {
  return Boolean(a.fatherId && a.fatherId === b.fatherId && a.motherId && a.motherId === b.motherId);
}

function halfSiblingLabel(a: Member, b: Member): string {
  if (a.fatherId && a.fatherId === b.fatherId) return 'Anh chị em cùng cha khác mẹ.';
  if (a.motherId && a.motherId === b.motherId) return 'Anh chị em cùng mẹ khác cha.';
  return 'Anh chị em cùng một bên cha hoặc mẹ.';
}

/**
 * Miền Bắc xét vai anh/em họ theo thứ bậc của bố mẹ chứ không theo tuổi,
 * nên khi tuổi đi ngược vai thì nói rõ để người dùng không tưởng là lỗi.
 */
function addSeniorityWarning(
  target: Member,
  ego: Member,
  targetIsSenior: boolean,
  warnings: string[],
): void {
  const byAge = compareSeniority(target, ego);
  if (byAge === null) return;
  const targetOlder = byAge < 0;
  if (targetIsSenior === targetOlder) return;
  warnings.push(
    targetIsSenior
      ? 'Ít tuổi hơn bạn nhưng vai trên, vì bố/mẹ họ là anh/chị của bố/mẹ bạn.'
      : 'Nhiều tuổi hơn bạn nhưng vai dưới, vì bố/mẹ họ là em của bố/mẹ bạn.',
  );
}

function buildPath(graph: FamilyGraph, conn: BloodConnection, side: BloodConnection['side']): KinPathStep[] {
  const steps: KinPathStep[] = [];
  const egoId = conn.egoPath[0];
  if (egoId) steps.push({ memberId: egoId, label: 'Bạn' });

  for (let i = 1; i <= conn.dEgo; i++) {
    const id = conn.egoPath[i];
    const m = id ? graph.members.get(id) : undefined;
    if (!id || !m) continue;
    steps.push({ memberId: id, label: ancestorTerm(i, m.gender, side) });
  }
  for (let i = conn.dTarget - 1; i >= 0; i--) {
    const id = conn.targetPath[i];
    const m = id ? graph.members.get(id) : undefined;
    if (!id || !m) continue;
    steps.push({ memberId: id, label: m.gender === 'M' ? 'con trai' : 'con gái' });
  }
  return steps;
}

function explain(
  graph: FamilyGraph,
  conn: BloodConnection,
  target: Member,
  term: string,
): string {
  const head = `${target.fullName} là ${term} của bạn.`;
  if (conn.dEgo === 0 || conn.dTarget === 0) return head;
  const ancestor = graph.members.get(conn.commonAncestorId);
  if (!ancestor) return head;
  const ancestorLabel = ancestorTerm(conn.dEgo, ancestor.gender, conn.side);
  return `${head} Hai bên chung ${ancestorLabel} ${ancestor.fullName}.`;
}

function inLawTerm(spouseTerm: string, suffix: 'vợ' | 'chồng'): string {
  const direct = ['bố', 'mẹ', 'anh', 'chị', 'em trai', 'em gái'];
  if (direct.includes(spouseTerm)) {
    return `${spouseTerm.replace(/\s+(trai|gái)$/, '')} ${suffix}`;
  }
  // Con của vợ/chồng với người khác — con riêng, không phải con mình.
  if (spouseTerm.startsWith('con')) return `con riêng của ${suffix}`;
  return `${spouseTerm} bên ${suffix}`;
}

function unknown(message: string): Kinship {
  return {
    callThem: UNKNOWN_TERM,
    theyCallMe: UNKNOWN_TERM,
    iCallMyself: 'tôi',
    category: 'khong-xac-dinh',
    side: null,
    generationGap: 0,
    commonAncestorId: null,
    path: [],
    explanation: message,
    warnings: [message],
  };
}

export { toSelfPronoun };
