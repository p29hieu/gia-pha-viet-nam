import { describe, expect, it } from 'vitest';
import {
  findMarriage,
  marriagesOf,
  multipleSpouses,
  orderCouple,
  pendingParentLink,
  spouseIn,
} from './marriage';
import type { Marriage, Member } from './types';

const bo: Member = { id: 'bo', fullName: 'Bố', gender: 'M' };
const me: Member = { id: 'me', fullName: 'Mẹ', gender: 'F' };
const con: Member = { id: 'con', fullName: 'Con', gender: 'M', fatherId: 'bo', motherId: 'me' };
const cuoi: Marriage = { id: 'w1', husbandId: 'bo', wifeId: 'me', status: 'married' };

describe('tìm liên kết vợ chồng', () => {
  it('tìm được dù đưa vào theo thứ tự nào', () => {
    expect(findMarriage([cuoi], 'bo', 'me')?.id).toBe('w1');
    expect(findMarriage([cuoi], 'me', 'bo')?.id).toBe('w1');
  });

  it('không có thì trả undefined', () => {
    expect(findMarriage([cuoi], 'bo', 'ai_do')).toBeUndefined();
  });

  it('liệt kê mọi liên kết của một người', () => {
    const w2: Marriage = { id: 'w2', husbandId: 'bo', wifeId: 'me_hai', status: 'married' };
    expect(marriagesOf([cuoi, w2], 'bo').map((m) => m.id)).toEqual(['w1', 'w2']);
    expect(marriagesOf([cuoi, w2], 'me').map((m) => m.id)).toEqual(['w1']);
  });

  it('lấy được người bạn đời từ một liên kết', () => {
    expect(spouseIn(cuoi, 'bo')).toBe('me');
    expect(spouseIn(cuoi, 'me')).toBe('bo');
  });
});

describe('xếp vai chồng vợ', () => {
  it('nam làm chồng dù đưa vào sau', () => {
    expect(orderCouple(me, bo)).toEqual({ husbandId: 'bo', wifeId: 'me' });
    expect(orderCouple(bo, me)).toEqual({ husbandId: 'bo', wifeId: 'me' });
  });

  it('cùng giới thì giữ nguyên thứ tự đưa vào', () => {
    const x: Member = { id: 'x', fullName: 'X', gender: 'M' };
    expect(orderCouple(bo, x)).toEqual({ husbandId: 'bo', wifeId: 'x' });
  });
});

describe('nối cha mẹ thành cặp', () => {
  it('đủ cả cha lẫn mẹ mà chưa nối thì báo cần nối', () => {
    const link = pendingParentLink([bo, me, con], [], 'con');
    expect(link?.a.id).toBe('bo');
    expect(link?.b.id).toBe('me');
  });

  it('đã nối rồi thì thôi', () => {
    expect(pendingParentLink([bo, me, con], [cuoi], 'con')).toBeNull();
  });

  it('mới có mỗi cha thì chưa nối', () => {
    const chiCoCha: Member = { ...con, motherId: undefined };
    expect(pendingParentLink([bo, me, chiCoCha], [], 'con')).toBeNull();
  });

  it('cha mẹ trỏ tới người không có trong gia phả thì bỏ qua', () => {
    const lac: Member = { ...con, motherId: 'khong_co' };
    expect(pendingParentLink([bo, me, lac], [], 'con')).toBeNull();
  });

  it('không tìm thấy đứa con thì trả null', () => {
    expect(pendingParentLink([bo, me], [], 'con')).toBeNull();
  });
});

describe('một người chỉ được một dây hôn phối', () => {
  it('không ai vi phạm thì trả về rỗng', () => {
    expect(multipleSpouses([cuoi]).size).toBe(0);
  });

  it('chỉ ra đúng người đang có hai dây', () => {
    const w2: Marriage = { id: 'w2', husbandId: 'bo', wifeId: 'me_hai', status: 'married' };
    const viPham = multipleSpouses([cuoi, w2]);
    expect([...viPham.keys()]).toEqual(['bo']);
    expect(viPham.get('bo')).toHaveLength(2);
  });

  it('bắt được cả khi người đó đứng vai vợ ở một dây và vai chồng ở dây kia', () => {
    const w2: Marriage = { id: 'w2', husbandId: 'x', wifeId: 'me', status: 'married' };
    expect([...multipleSpouses([cuoi, w2]).keys()]).toEqual(['me']);
  });

  it('danh sách rỗng thì không có vi phạm', () => {
    expect(multipleSpouses([]).size).toBe(0);
  });
});
