import { describe, expect, it } from 'vitest';
import { buildGraph } from './graph';
import {
  canSetParent,
  canSetSpouse,
  isDescendantOf,
  isDirectLine,
  placementParents,
  readRelations,
} from './relations';
import { SAMPLE_MARRIAGES, SAMPLE_MEMBERS } from './sampleData';

const graph = buildGraph(SAMPLE_MEMBERS, SAMPLE_MARRIAGES);

describe('nhận ra con cháu', () => {
  it('con là con cháu của cha', () => {
    expect(isDescendantOf(graph, 'ego', 'bo')).toBe(true);
  });

  it('cháu chắt cũng tính là con cháu', () => {
    expect(isDescendantOf(graph, 'chau_noi', 'noi_ong')).toBe(true);
  });

  it('cha không phải con cháu của con', () => {
    expect(isDescendantOf(graph, 'bo', 'ego')).toBe(false);
  });

  it('người ngoài nhánh thì không', () => {
    expect(isDescendantOf(graph, 'ngoai_ong', 'noi_ong')).toBe(false);
  });
});

describe('cùng huyết thống trực hệ', () => {
  it('ông nội và cháu là trực hệ', () => {
    expect(isDirectLine(graph, 'noi_ong', 'ego')).toBe(true);
  });

  it('anh em ruột không phải trực hệ', () => {
    expect(isDirectLine(graph, 'ego', 'anh')).toBe(false);
  });
});

describe('đặt cha mẹ', () => {
  it('không cho đặt chính mình làm cha mẹ', () => {
    expect(canSetParent(graph, 'ego', 'ego', 'father').ok).toBe(false);
  });

  it('chặn vòng lặp: con không làm cha của bố mình được', () => {
    const c = canSetParent(graph, 'bo', 'ego', 'father');
    expect(c.ok).toBe(false);
    expect(c.reason).toContain('vòng lặp');
  });

  it('không đặt nữ làm bố', () => {
    const c = canSetParent(graph, 'ego', 'co', 'father');
    expect(c.ok).toBe(false);
    expect(c.reason).toContain('không đặt làm bố được');
  });

  it('không đặt nam làm mẹ', () => {
    expect(canSetParent(graph, 'ego', 'chu', 'mother').ok).toBe(false);
  });

  it('đặt bác làm bố thì được về mặt cấu trúc', () => {
    expect(canSetParent(graph, 'ego', 'bac_noi', 'father').ok).toBe(true);
  });

  it('người không có trong gia phả thì từ chối', () => {
    expect(canSetParent(graph, 'ego', 'khong_co', 'father').ok).toBe(false);
  });
});

describe('cha mẹ nuôi và đỡ đầu', () => {
  const withCare = buildGraph(
    [
      ...SAMPLE_MEMBERS.map((m) =>
        m.id === 'ego' ? { ...m, adoptiveFatherId: 'bac_noi', godMotherId: 'co' } : m,
      ),
    ],
    SAMPLE_MARRIAGES,
  );

  it('đọc ra đủ sáu ô cha mẹ', () => {
    const r = readRelations(withCare, 'ego');
    const theoO = Object.fromEntries(r.parents.map((p) => [p.slot, p.person?.fullName ?? null]));
    expect(theoO.father).toBe('Nguyễn Văn Hai');
    expect(theoO.adoptiveFather).toBe('Nguyễn Văn Cả');
    expect(theoO.godMother).toBe('Nguyễn Thị Ba');
    expect(theoO.adoptiveMother).toBeNull();
  });

  it('người nhận nuôi thấy được con nuôi của mình', () => {
    const r = readRelations(withCare, 'bac_noi');
    expect(r.otherChildren.map((c) => c.person.fullName)).toContain('Nguyễn Văn An');
    expect(r.otherChildren[0]?.kind).toBe('adoptive');
  });

  it('không cho một người vừa là bố ruột vừa là bố nuôi của cùng đứa trẻ', () => {
    const c = canSetParent(withCare, 'ego', 'bo', 'adoptiveFather');
    expect(c.ok).toBe(false);
    expect(c.reason).toContain('đang là bố');
  });

  it('cha mẹ nuôi cũng tính khi chặn vòng lặp', () => {
    const g = buildGraph(
      [
        { id: 'a', fullName: 'A', gender: 'M' },
        { id: 'b', fullName: 'B', gender: 'M', adoptiveFatherId: 'a' },
      ],
      [],
    );
    expect(canSetParent(g, 'a', 'b', 'father').ok).toBe(false);
  });

  it('chỗ đứng trong cây ưu tiên ruột rồi mới đến nuôi', () => {
    expect(placementParents({ id: 'x', fullName: 'X', gender: 'M', fatherId: 'f', adoptiveFatherId: 'af' })).toEqual([
      'f',
      'af',
    ]);
  });

  it('cha mẹ đỡ đầu không quyết định chỗ đứng trong cây', () => {
    expect(placementParents({ id: 'x', fullName: 'X', gender: 'M', godFatherId: 'g' })).toEqual([]);
  });
});

describe('đặt vợ chồng', () => {
  it('không tự cưới chính mình', () => {
    expect(canSetSpouse(graph, 'ego', 'ego').ok).toBe(false);
  });

  it('đã là vợ chồng rồi thì báo lại', () => {
    const c = canSetSpouse(graph, 'ego', 'ego_vo');
    expect(c.ok).toBe(false);
    expect(c.reason).toContain('đã là vợ chồng');
  });

  it('chặn cưới người cùng huyết thống trực hệ', () => {
    const c = canSetSpouse(graph, 'ego', 'bo');
    expect(c.ok).toBe(false);
    expect(c.reason).toContain('trực hệ');
  });

  it('hai người không cùng trực hệ thì cho phép', () => {
    expect(canSetSpouse(graph, 'em_gai', 'con_bac').ok).toBe(true);
  });
});

describe('đọc quan hệ trực tiếp', () => {
  it('đọc đúng cha mẹ, vợ và con', () => {
    const r = readRelations(graph, 'ego');
    const theoO = Object.fromEntries(r.parents.map((p) => [p.slot, p.person?.fullName ?? null]));
    expect(theoO.father).toBe('Nguyễn Văn Hai');
    expect(theoO.mother).toBe('Lê Thị Mai');
    expect(r.spouse?.member.fullName).toBe('Trần Thị Vân');
    expect(r.children.map((c) => c.fullName)).toEqual([
      'Nguyễn Văn Minh',
      'Nguyễn Thị Hương',
    ]);
  });

  it('người chưa có ai thì mọi ô cha mẹ đều trống', () => {
    const r = readRelations(graph, 'p0_cu');
    expect(r.parents.every((p) => !p.person)).toBe(true);
    expect(r.spouse?.member.fullName).toBe('Đặng Thị Cụ');
  });

  it('id không tồn tại không làm sập', () => {
    const r = readRelations(graph, 'khong_co');
    expect(r.children).toEqual([]);
  });
});
