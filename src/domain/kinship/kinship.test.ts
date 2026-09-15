import { describe, expect, it } from 'vitest';
import { buildGraph } from '../graph';
import { SAMPLE_MARRIAGES, SAMPLE_MEMBERS } from '../sampleData';
import { resolveKinship } from './index';

const graph = buildGraph(SAMPLE_MEMBERS, SAMPLE_MARRIAGES);
const from = (targetId: string) => resolveKinship(graph, 'ego', targetId);

describe('trực hệ bên trên', () => {
  const cases: Array<[string, string]> = [
    ['bo', 'bố'],
    ['me', 'mẹ'],
    ['noi_ong', 'ông nội'],
    ['noi_ba', 'bà nội'],
    ['ngoai_ong', 'ông ngoại'],
    ['ngoai_ba', 'bà ngoại'],
    ['p0_cu', 'cụ ông'],
    ['p0_cu_ba', 'cụ bà'],
  ];
  it.each(cases)('gọi %s là "%s"', (id, expected) => {
    expect(from(id).callThem).toBe(expected);
  });

  it('bố gọi lại là "con trai", mình xưng "con"', () => {
    const k = from('bo');
    expect(k.theyCallMe).toBe('con trai');
    expect(k.iCallMyself).toBe('con');
  });

  it('ông nội gọi lại là "cháu nội", mình xưng "cháu"', () => {
    const k = from('noi_ong');
    expect(k.theyCallMe).toBe('cháu nội');
    expect(k.iCallMyself).toBe('cháu');
  });
});

describe('trực hệ bên dưới', () => {
  const cases: Array<[string, string]> = [
    ['con_trai', 'con trai'],
    ['con_gai', 'con gái'],
    ['chau_noi', 'cháu nội'],
  ];
  it.each(cases)('gọi %s là "%s"', (id, expected) => {
    expect(from(id).callThem).toBe(expected);
  });
});

describe('anh chị em ruột', () => {
  it('anh sinh trước là "anh", mình xưng "em"', () => {
    const k = from('anh');
    expect(k.callThem).toBe('anh');
    expect(k.theyCallMe).toBe('em trai');
    expect(k.iCallMyself).toBe('em');
  });

  it('em gái sinh sau là "em gái"', () => {
    expect(from('em_gai').callThem).toBe('em gái');
  });

  it('em cùng cha khác mẹ vẫn là "em trai" và có cảnh báo', () => {
    const k = from('em_cung_cha');
    expect(k.callThem).toBe('em trai');
    expect(k.warnings.join(' ')).toContain('cùng cha khác mẹ');
  });
});

describe('hàng trên một bậc — quy tắc miền Bắc', () => {
  const cases: Array<[string, string]> = [
    ['bac_noi', 'bác'],
    ['chu', 'chú'],
    ['co', 'cô'],
    ['bac_ngoai', 'bác'],
    ['cau', 'cậu'],
    ['di', 'dì'],
  ];
  it.each(cases)('gọi %s là "%s"', (id, expected) => {
    expect(from(id).callThem).toBe(expected);
  });

  it('"bác" dùng cho cả anh của bố lẫn anh của mẹ', () => {
    expect(from('bac_noi').callThem).toBe('bác');
    expect(from('bac_ngoai').callThem).toBe('bác');
  });

  it('bác gọi lại mình là "cháu trai"', () => {
    expect(from('bac_noi').theyCallMe).toBe('cháu trai');
    expect(from('bac_noi').iCallMyself).toBe('cháu');
  });

  it('phân biệt đúng bên nội và bên ngoại', () => {
    expect(from('chu').side).toBe('noi');
    expect(from('cau').side).toBe('ngoai');
  });
});

describe('anh chị em họ — xét theo VAI VẾ, không theo tuổi', () => {
  it('con của bác là "anh họ" dù sinh sau mình 10 năm', () => {
    const k = from('con_bac');
    expect(k.callThem).toBe('anh họ');
    expect(k.warnings.join(' ')).toContain('vai trên');
  });

  it('con của cô là "em gái họ" dù sinh trước mình 10 năm', () => {
    const k = from('con_co');
    expect(k.callThem).toBe('em gái họ');
    expect(k.warnings.join(' ')).toContain('vai dưới');
  });

  it('hai chiều nhất quán: anh họ gọi mình là em trai họ', () => {
    expect(from('con_bac').theyCallMe).toBe('em trai họ');
  });

  it('con của bác bên ngoại là "chị họ"', () => {
    expect(from('con_bac_ngoai').callThem).toBe('chị họ');
  });
});

describe('hàng trên hai bậc', () => {
  it('em trai của ông nội là "ông trẻ"', () => {
    expect(from('noi_ong_em').callThem).toBe('ông trẻ');
  });

  it('con của ông trẻ là "chú họ"', () => {
    expect(from('chu_ho').callThem).toBe('chú họ');
  });
});

describe('quan hệ qua hôn nhân — dâu rể', () => {
  const cases: Array<[string, string]> = [
    ['ego_vo', 'vợ'],
    ['anh_vo', 'chị dâu'],
    ['em_gai_chong', 'em rể'],
    ['bac_noi_vo', 'bác gái'],
    ['chu_vo', 'thím'],
    ['cau_vo', 'mợ'],
    ['co_chong', 'chú'],
    ['di_chong', 'chú'],
    ['con_dau', 'con dâu'],
  ];
  it.each(cases)('gọi %s là "%s"', (id, expected) => {
    expect(from(id).callThem).toBe(expected);
  });
});

describe('bố mẹ kế và con riêng', () => {
  it('vợ hai của bố là "mẹ kế", không phải "mẹ"', () => {
    expect(from('me_ke').callThem).toBe('mẹ kế');
  });

  it('mẹ ruột vẫn là "mẹ"', () => {
    expect(from('me').callThem).toBe('mẹ');
  });

  it('mẹ kế gọi mình là "con riêng của chồng"', () => {
    expect(from('me_ke').theyCallMe).toBe('con riêng của chồng');
  });

  it('em cùng cha khác mẹ là con của mẹ kế nhưng vẫn là em ruột theo đằng cha', () => {
    expect(from('em_cung_cha').callThem).toBe('em trai');
  });
});

describe('họ hàng bên vợ', () => {
  const cases: Array<[string, string]> = [
    ['vo_bo', 'bố vợ'],
    ['vo_me', 'mẹ vợ'],
    ['vo_anh', 'anh vợ'],
  ];
  it.each(cases)('gọi %s là "%s"', (id, expected) => {
    expect(from(id).callThem).toBe(expected);
  });
});

describe('cháu bàng hệ', () => {
  it('con của anh ruột là "cháu trai"', () => {
    expect(from('chau_anh').callThem).toBe('cháu trai');
  });

  it('cháu gọi lại mình là "chú" vì mình là em của bố nó', () => {
    expect(from('chau_anh').theyCallMe).toBe('chú');
  });
});

describe('có họ thông qua ai', () => {
  it('chuỗi liên kết tới anh họ đi qua bố và ông nội', () => {
    const k = from('con_bac');
    expect(k.path.map((s) => s.memberId)).toEqual(['ego', 'bo', 'noi_ong', 'bac_noi', 'con_bac']);
    expect(k.commonAncestorId).toBe('noi_ong');
  });

  it('câu diễn giải nêu tổ tiên chung', () => {
    expect(from('con_bac').explanation).toContain('Nguyễn Văn Bình');
  });

  it('chuỗi tới bố chỉ có hai chặng', () => {
    expect(from('bo').path.map((s) => s.memberId)).toEqual(['ego', 'bo']);
  });
});

describe('ca biên', () => {
  it('chính mình', () => {
    expect(from('ego').callThem).toBe('chính bạn');
  });

  it('người không có liên hệ nào', () => {
    const g = buildGraph(
      [
        ...SAMPLE_MEMBERS,
        { id: 'nguoi_la', fullName: 'Người Lạ', gender: 'M' as const, birthDate: '1960' },
      ],
      SAMPLE_MARRIAGES,
    );
    const k = resolveKinship(g, 'ego', 'nguoi_la');
    expect(k.category).toBe('khong-xac-dinh');
    expect(k.warnings.length).toBeGreaterThan(0);
  });

  it('id không tồn tại không làm sập engine', () => {
    expect(resolveKinship(graph, 'ego', 'khong_co').category).toBe('khong-xac-dinh');
  });

  it('thiếu năm sinh và thứ tự sinh thì cảnh báo chứ không đoán bừa', () => {
    const g = buildGraph(
      [
        { id: 'x_bo', fullName: 'Bố X', gender: 'M' },
        { id: 'x1', fullName: 'X Một', gender: 'M', fatherId: 'x_bo' },
        { id: 'x2', fullName: 'X Hai', gender: 'M', fatherId: 'x_bo' },
      ],
      [],
    );
    const k = resolveKinship(g, 'x1', 'x2');
    expect(k.warnings.join(' ')).toContain('chưa chắc chắn');
  });
});

describe('tính đối xứng', () => {
  it('mọi cặp đều cho kết quả khớp nhau hai chiều', () => {
    const ids = SAMPLE_MEMBERS.map((m) => m.id);
    for (const id of ids) {
      if (id === 'ego') continue;
      const forward = resolveKinship(graph, 'ego', id);
      const backward = resolveKinship(graph, id, 'ego');
      expect(forward.theyCallMe).toBe(backward.callThem);
      expect(backward.theyCallMe).toBe(forward.callThem);
    }
  });
});

describe('nuôi tính như huyết thống, đỡ đầu thì không', () => {
  // ego được bác (anh của bố) nhận làm con nuôi, và có mẹ đỡ đầu là cô.
  const g = buildGraph(
    SAMPLE_MEMBERS.map((m) =>
      m.id === 'em_cung_cha' ? { ...m, adoptiveFatherId: 'bac_noi', godMotherId: 'co' } : m,
    ),
    SAMPLE_MARRIAGES,
  );

  it('cha nuôi được gọi là "bố nuôi", nói rõ là nuôi', () => {
    const k = resolveKinship(g, 'em_cung_cha', 'bac_noi');
    expect(k.callThem).toBe('bố nuôi');
    expect(k.theyCallMe).toBe('con nuôi');
  });

  it('vợ của bố nuôi chính là mẹ nuôi', () => {
    expect(resolveKinship(g, 'em_cung_cha', 'bac_noi_vo').callThem).toBe('mẹ nuôi');
  });

  it('con của cha nuôi thành anh chị em', () => {
    const k = resolveKinship(g, 'em_cung_cha', 'con_bac');
    expect(['anh', 'em trai']).toContain(k.callThem);
  });

  it('bố nuôi vẫn giữ được quan hệ ruột thịt sẵn có với người khác', () => {
    expect(resolveKinship(g, 'em_cung_cha', 'bo').callThem).toBe('bố');
  });

  it('mẹ đỡ đầu KHÔNG tính huyết thống: danh xưng giữ nguyên theo họ hàng', () => {
    const k = resolveKinship(g, 'em_cung_cha', 'co');
    expect(k.callThem).toBe('cô');
    expect(k.care?.callThem).toBe('mẹ đỡ đầu');
    expect(k.care?.theyCallMe).toBe('con đỡ đầu');
  });

  it('không có quan hệ nào khác thì đỡ đầu thành câu trả lời chính', () => {
    const g2 = buildGraph(
      [
        { id: 'a', fullName: 'A', gender: 'F' },
        { id: 'b', fullName: 'B', gender: 'M', godMotherId: 'a' },
      ],
      [],
    );
    const k = resolveKinship(g2, 'b', 'a');
    expect(k.callThem).toBe('mẹ đỡ đầu');
    expect(k.category).toBe('nuoi-duong');
  });

  it('người đỡ đầu không lọt vào cây huyết thống', () => {
    const g2 = buildGraph(
      [
        { id: 'a', fullName: 'A', gender: 'F' },
        { id: 'b', fullName: 'B', gender: 'M', godMotherId: 'a' },
        { id: 'c', fullName: 'C', gender: 'M', motherId: 'a' },
      ],
      [],
    );
    // B và C KHÔNG thành anh em chỉ vì A đỡ đầu B — đây chính là điểm cần chặn.
    expect(resolveKinship(g2, 'b', 'c').category).toBe('khong-xac-dinh');
    // Nhưng nếu A nhận nuôi B thì hai đứa thành anh em thật.
    const g3 = buildGraph(
      [
        { id: 'a', fullName: 'A', gender: 'F' },
        { id: 'b', fullName: 'B', gender: 'M', adoptiveMotherId: 'a', birthDate: '1990' },
        { id: 'c', fullName: 'C', gender: 'M', motherId: 'a', birthDate: '1995' },
      ],
      [],
    );
    expect(resolveKinship(g3, 'b', 'c').callThem).toBe('em trai');
  });

  it('không có quan hệ nuôi hay đỡ đầu thì trường care để trống', () => {
    expect(resolveKinship(g, 'ego', 'bo').care).toBeUndefined();
  });
});
