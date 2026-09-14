import { describe, expect, it } from 'vitest';
import { buildGraph } from './graph';
import { computeLayout, hasParentsInTree, primaryParent } from './layout';
import { SAMPLE_MARRIAGES, SAMPLE_MEMBERS } from './sampleData';

const graph = buildGraph(SAMPLE_MEMBERS, SAMPLE_MARRIAGES);
const layout = computeLayout(graph);

describe('bố cục cây', () => {
  it('gốc là những người không có cha mẹ trong dữ liệu', () => {
    expect(layout.roots).toContain('p0_cu');
    expect(layout.roots).toContain('ngoai_ong');
  });

  it('vợ kết hôn vào họ không trở thành gốc riêng', () => {
    expect(layout.roots).not.toContain('noi_ba');
    expect(layout.roots).not.toContain('bac_noi_vo');
  });

  it('con treo dưới cha', () => {
    expect(layout.childrenOf.get('bo')).toContain('ego');
    expect(layout.childrenOf.get('noi_ong')).toContain('bo');
  });

  it('mỗi người chỉ có đúng một nút gốc trong cây', () => {
    const counts = new Map<string, number>();
    layout.childrenOf.forEach((ids) =>
      ids.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1)),
    );
    const duplicated = [...counts.entries()].filter(([, n]) => n > 1);
    expect(duplicated).toEqual([]);
  });

  it('mọi người đều xuất hiện: hoặc là gốc, hoặc là con của ai đó', () => {
    const placed = new Set(layout.roots);
    layout.childrenOf.forEach((ids) => ids.forEach((id) => placed.add(id)));
    layout.spousesOf.forEach((ids) => ids.forEach((id) => placed.add(id)));
    const missing = SAMPLE_MEMBERS.filter((m) => !placed.has(m.id)).map((m) => m.id);
    expect(missing).toEqual([]);
  });

  it('cả hai vợ của bố đều hiển thị cạnh bố', () => {
    const spouses = layout.spousesOf.get('bo') ?? [];
    expect(spouses).toContain('me');
    expect(spouses).toContain('me_ke');
  });

  it('mẹ được đánh dấu là thẻ nhắc lại vì có nhánh riêng bên ngoại', () => {
    expect(layout.echoed.has('me')).toBe(true);
    expect(layout.echoed.has('me_ke')).toBe(false);
  });

  it('con của con rể treo dưới nhánh của cô, không bị rơi mất', () => {
    expect(layout.childrenOf.get('co')).toContain('con_co');
  });
});

describe('trợ giúp bố cục', () => {
  it('nhận ra ai có cha mẹ trong dữ liệu', () => {
    expect(hasParentsInTree(graph, 'ego')).toBe(true);
    expect(hasParentsInTree(graph, 'p0_cu')).toBe(false);
  });

  it('ưu tiên cha khi xác định nơi treo', () => {
    expect(primaryParent(graph, 'ego')).toBe('bo');
  });

  it('không có cha thì lấy mẹ', () => {
    const g = buildGraph(
      [
        { id: 'm1', fullName: 'Mẹ đơn thân', gender: 'F' },
        { id: 'c1', fullName: 'Con', gender: 'M', motherId: 'm1' },
      ],
      [],
    );
    expect(primaryParent(g, 'c1')).toBe('m1');
  });
});
