import { compareSeniority, getSpouses, type FamilyGraph } from './graph';
import { placementParents } from './relations';

/**
 * Bố cục cây theo lối gia phả truyền thống.
 *
 * Mỗi người có đúng MỘT nút gốc của riêng mình, treo dưới cha (hoặc mẹ nếu không
 * rõ cha). Vợ/chồng luôn hiển thị ngay cạnh để nhìn ra cặp đôi; ai đã có nhánh
 * riêng ở nơi khác thì được đánh dấu để người xem biết đó là thẻ nhắc lại.
 */

function inTree(graph: FamilyGraph, id: string | undefined): boolean {
  return Boolean(id && graph.members.has(id));
}

export function hasParentsInTree(graph: FamilyGraph, id: string): boolean {
  return placementParents(graph.members.get(id)).some((p) => inTree(graph, p));
}

/**
 * Người này treo dưới ai trong cây.
 * Ưu tiên cha ruột, rồi mẹ ruột, rồi cha nuôi, rồi mẹ nuôi. Cha mẹ đỡ đầu
 * không quyết định chỗ đứng trong cây vì đó không phải quan hệ gia đình.
 */
export function primaryParent(graph: FamilyGraph, id: string): string | null {
  return placementParents(graph.members.get(id)).find((p) => inTree(graph, p)) ?? null;
}

export interface TreeLayout {
  roots: string[];
  /** id của nút -> vợ/chồng hiển thị cùng hàng */
  spousesOf: Map<string, string[]>;
  /** id của nút -> con treo bên dưới */
  childrenOf: Map<string, string[]>;
  /** Người vừa có nhánh riêng, vừa xuất hiện lại với tư cách vợ/chồng */
  echoed: Set<string>;
}

export function computeLayout(graph: FamilyGraph): TreeLayout {
  const all = [...graph.members.values()];
  const parentless = all.filter((m) => !hasParentsInTree(graph, m.id));
  const parentlessIds = new Set(parentless.map((m) => m.id));

  // Người kết hôn vào họ (không có cha mẹ trong dữ liệu) chỉ xuất hiện cạnh vợ/chồng.
  const marriedIn = new Set<string>();
  parentless.forEach((p) => {
    if (getSpouses(graph, p.id).some((s) => hasParentsInTree(graph, s))) marriedIn.add(p.id);
  });

  // Hai người đều không có cha mẹ mà lấy nhau: một người làm gốc, người kia đứng cạnh.
  const roots: string[] = [];
  const ordered = [...parentless].sort((a, b) => {
    if (a.gender !== b.gender) return a.gender === 'M' ? -1 : 1;
    return compareSeniority(a, b) ?? 0;
  });
  ordered.forEach((p) => {
    if (marriedIn.has(p.id)) return;
    roots.push(p.id);
    getSpouses(graph, p.id).forEach((s) => {
      if (parentlessIds.has(s) && !roots.includes(s)) marriedIn.add(s);
    });
  });

  const nodeIds = all.filter((m) => !marriedIn.has(m.id)).map((m) => m.id);
  const nodeSet = new Set(nodeIds);

  const spousesOf = new Map<string, string[]>();
  const echoed = new Set<string>();
  nodeIds.forEach((id) => {
    const list = getSpouses(graph, id);
    if (list.length === 0) return;
    spousesOf.set(id, list);
    list.forEach((s) => {
      if (nodeSet.has(s)) echoed.add(s);
    });
  });

  // Con treo dưới nút của cha; nếu cha chỉ xuất hiện cạnh vợ thì treo dưới người vợ đó.
  const hostOfMarriedIn = new Map<string, string>();
  spousesOf.forEach((list, owner) =>
    list.forEach((s) => {
      if (marriedIn.has(s)) hostOfMarriedIn.set(s, owner);
    }),
  );

  const childrenOf = new Map<string, string[]>();
  all.forEach((m) => {
    const parent = primaryParent(graph, m.id);
    if (!parent) return;
    const host = marriedIn.has(parent) ? (hostOfMarriedIn.get(parent) ?? parent) : parent;
    const list = childrenOf.get(host);
    if (list) list.push(m.id);
    else childrenOf.set(host, [m.id]);
  });

  childrenOf.forEach((ids, key) => {
    childrenOf.set(
      key,
      ids.sort((a, b) => compareSeniority(graph.members.get(a), graph.members.get(b)) ?? 0),
    );
  });

  return { roots, spousesOf, childrenOf, echoed };
}
