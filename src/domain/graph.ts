import type { Marriage, Member, Side } from './types';

export interface FamilyGraph {
  members: Map<string, Member>;
  /** parentId -> danh sách con */
  childrenOf: Map<string, string[]>;
  /** memberId -> danh sách vợ/chồng */
  spousesOf: Map<string, string[]>;
  marriages: Marriage[];
}

const MAX_ANCESTOR_DEPTH = 15;

export function buildGraph(members: Member[], marriages: Marriage[] = []): FamilyGraph {
  const byId = new Map<string, Member>();
  members.forEach((m) => byId.set(m.id, m));

  const childrenOf = new Map<string, string[]>();
  const push = (key: string | undefined, childId: string) => {
    if (!key) return;
    const list = childrenOf.get(key);
    if (list) list.push(childId);
    else childrenOf.set(key, [childId]);
  };
  members.forEach((m) => {
    push(m.fatherId, m.id);
    push(m.motherId, m.id);
    // Cha mẹ nuôi được tính như cha mẹ khi lần ra quan hệ: anh của bố nuôi vẫn
    // là bác. Cha mẹ đỡ đầu thì không — đó không phải quan hệ gia đình.
    push(m.adoptiveFatherId, m.id);
    push(m.adoptiveMotherId, m.id);
  });

  const spousesOf = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    const list = spousesOf.get(a);
    if (list) list.push(b);
    else spousesOf.set(a, [b]);
  };
  marriages.forEach((w) => {
    if (!byId.has(w.husbandId) || !byId.has(w.wifeId)) return;
    link(w.husbandId, w.wifeId);
    link(w.wifeId, w.husbandId);
  });

  // Sắp xếp con theo thứ tự sinh để cây hiển thị đúng và vai vế tính đúng.
  childrenOf.forEach((ids, key) => {
    childrenOf.set(
      key,
      [...new Set(ids)].sort((x, y) => compareSeniority(byId.get(x), byId.get(y)) ?? 0),
    );
  });

  return { members: byId, childrenOf, spousesOf, marriages };
}

export function getMember(graph: FamilyGraph, id: string | undefined): Member | undefined {
  return id ? graph.members.get(id) : undefined;
}

export function getSpouses(graph: FamilyGraph, id: string): string[] {
  return graph.spousesOf.get(id) ?? [];
}

export function getChildren(graph: FamilyGraph, id: string): string[] {
  return graph.childrenOf.get(id) ?? [];
}

/**
 * Cha mẹ dùng để lần ra quan hệ: gồm cả ruột lẫn nuôi.
 * Cha mẹ đỡ đầu KHÔNG nằm ở đây vì không phải quan hệ gia đình.
 */
export function getParents(graph: FamilyGraph, id: string): string[] {
  const m = graph.members.get(id);
  if (!m) return [];
  return [m.fatherId, m.motherId, m.adoptiveFatherId, m.adoptiveMotherId].filter(
    (x): x is string => Boolean(x),
  );
}

/** Người này là cha/mẹ NUÔI của người kia, hay ngược lại, hay không phải. */
export function adoptiveDirection(
  a: Member,
  b: Member,
): 'b-la-cha-me-nuoi' | 'b-la-con-nuoi' | null {
  if (a.adoptiveFatherId === b.id || a.adoptiveMotherId === b.id) return 'b-la-cha-me-nuoi';
  if (b.adoptiveFatherId === a.id || b.adoptiveMotherId === a.id) return 'b-la-con-nuoi';
  return null;
}

/** Anh chị em ruột hoặc nửa ruột (chung ít nhất một cha hoặc mẹ) */
export function getSiblings(graph: FamilyGraph, id: string): string[] {
  const out = new Set<string>();
  getParents(graph, id).forEach((p) => getChildren(graph, p).forEach((c) => out.add(c)));
  out.delete(id);
  return [...out].sort((x, y) => compareSeniority(graph.members.get(x), graph.members.get(y)) ?? 0);
}

export interface AncestorHit {
  depth: number;
  /** [id, ..., ancestorId] — chặng đầu là chính mình */
  path: string[];
}

/** BFS ngược lên trên. Bao gồm chính mình ở depth 0. */
export function collectAncestors(graph: FamilyGraph, id: string): Map<string, AncestorHit> {
  const found = new Map<string, AncestorHit>();
  if (!graph.members.has(id)) return found;

  const queue: AncestorHit[] = [{ depth: 0, path: [id] }];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur) break;
    const node = cur.path[cur.path.length - 1];
    if (!node) continue;
    const seen = found.get(node);
    if (seen && seen.depth <= cur.depth) continue;
    found.set(node, cur);
    if (cur.depth >= MAX_ANCESTOR_DEPTH) continue;
    getParents(graph, node).forEach((p) => {
      queue.push({ depth: cur.depth + 1, path: [...cur.path, p] });
    });
  }
  return found;
}

export interface BloodConnection {
  commonAncestorId: string;
  dEgo: number;
  dTarget: number;
  /** [egoId, ..., commonAncestorId] */
  egoPath: string[];
  /** [targetId, ..., commonAncestorId] */
  targetPath: string[];
  side: Side | null;
}

/**
 * Tìm tổ tiên chung gần nhất. Ưu tiên tổng số đời nhỏ nhất, sau đó tới dEgo nhỏ nhất —
 * để "bố" thắng "ông nội" khi cả hai cùng là tổ tiên chung.
 */
export function findBloodConnection(
  graph: FamilyGraph,
  egoId: string,
  targetId: string,
): BloodConnection | null {
  const egoAnc = collectAncestors(graph, egoId);
  const targetAnc = collectAncestors(graph, targetId);

  let best: BloodConnection | null = null;
  egoAnc.forEach((egoHit, ancestorId) => {
    const targetHit = targetAnc.get(ancestorId);
    if (!targetHit) return;
    const candidate: BloodConnection = {
      commonAncestorId: ancestorId,
      dEgo: egoHit.depth,
      dTarget: targetHit.depth,
      egoPath: egoHit.path,
      targetPath: targetHit.path,
      side: null,
    };
    if (!best) {
      best = candidate;
      return;
    }
    const b: BloodConnection = best;
    const bSum = b.dEgo + b.dTarget;
    const cSum = candidate.dEgo + candidate.dTarget;
    if (cSum < bSum || (cSum === bSum && candidate.dEgo < b.dEgo)) best = candidate;
  });

  if (!best) return null;
  const conn: BloodConnection = best;
  conn.side = resolveSide(graph, conn);
  return conn;
}

function resolveSide(graph: FamilyGraph, conn: BloodConnection): Side | null {
  // Người đó là hậu duệ của mình: nội/ngoại tính theo con trai hay con gái của mình.
  if (conn.dEgo === 0) {
    const childOfEgo = conn.targetPath[conn.dTarget - 1];
    const child = getMember(graph, childOfEgo);
    if (!child) return null;
    return child.gender === 'M' ? 'noi' : 'ngoai';
  }
  // Còn lại: tính theo bước đầu tiên mình đi lên — qua bố là nội, qua mẹ là ngoại.
  const ego = graph.members.get(conn.egoPath[0] ?? '');
  const firstStep = conn.egoPath[1];
  if (!ego || !firstStep) return null;
  if (firstStep === ego.fatherId) return 'noi';
  if (firstStep === ego.motherId) return 'ngoai';
  return null;
}

function parseYear(date: string | undefined): number | null {
  if (!date) return null;
  const m = /^(\d{4})/.exec(date.trim());
  return m && m[1] ? Number(m[1]) : null;
}

function dateValue(date: string | undefined): number | null {
  if (!date) return null;
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(date.trim());
  if (!m || !m[1]) return null;
  return Number(m[1]) * 10000 + Number(m[2] ?? '00') * 100 + Number(m[3] ?? '00');
}

/**
 * Âm nghĩa là a sinh trước b (a là anh/chị). Trả null khi không đủ dữ liệu.
 * Ưu tiên birthOrder khi hai người là anh chị em cùng cha mẹ, vì gia phả cũ
 * thường nhớ thứ tự con nhưng không nhớ năm sinh.
 */
export function compareSeniority(a: Member | undefined, b: Member | undefined): number | null {
  if (!a || !b) return null;
  const sameParents =
    (a.fatherId && a.fatherId === b.fatherId) || (a.motherId && a.motherId === b.motherId);
  if (sameParents && a.birthOrder != null && b.birthOrder != null && a.birthOrder !== b.birthOrder) {
    return a.birthOrder - b.birthOrder;
  }
  const av = dateValue(a.birthDate);
  const bv = dateValue(b.birthDate);
  if (av != null && bv != null && av !== bv) return av - bv;
  if (a.birthOrder != null && b.birthOrder != null && a.birthOrder !== b.birthOrder) {
    return a.birthOrder - b.birthOrder;
  }
  return null;
}

export function birthYear(m: Member | undefined): number | null {
  return parseYear(m?.birthDate);
}
