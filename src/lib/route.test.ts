import { describe, expect, it } from 'vitest';
import { clanOf, parseHash, routeToHash, type Route } from './route';

describe('đọc URL', () => {
  it('chưa có gì thì về trang chọn cây', () => {
    expect(parseHash('')).toEqual({ kind: 'home' });
    expect(parseHash('#')).toEqual({ kind: 'home' });
    expect(parseHash('#/')).toEqual({ kind: 'home' });
  });

  it('đọc được id cây', () => {
    expect(parseHash('#/c/main')).toEqual({ kind: 'clan', clanId: 'main' });
  });

  it('bỏ qua dấu gạch chéo thừa ở cuối', () => {
    expect(parseHash('#/c/main/')).toEqual({ kind: 'clan', clanId: 'main' });
  });

  it('đọc được link mời', () => {
    expect(parseHash('#/c/main/moi/k7Qm2xR9')).toEqual({
      kind: 'invite',
      clanId: 'main',
      code: 'k7Qm2xR9',
    });
  });

  it('đọc được cặp đang so quan hệ', () => {
    expect(parseHash('#/c/main/so/m_01/m_02')).toEqual({
      kind: 'compare',
      clanId: 'main',
      aId: 'm_01',
      bId: 'm_02',
    });
  });

  it('so quan hệ mà thiếu người thứ hai thì lùi về xem cây, không hỏng', () => {
    expect(parseHash('#/c/main/so/m_01')).toEqual({ kind: 'clan', clanId: 'main' });
  });

  it('đường dẫn lạ thì về trang chọn cây', () => {
    expect(parseHash('#/linh-tinh')).toEqual({ kind: 'home' });
    expect(parseHash('#/c')).toEqual({ kind: 'home' });
  });

  it('hash hỏng không làm sập ứng dụng', () => {
    // '%' lẻ làm decodeURIComponent ném lỗi — phải giữ nguyên đoạn thô thay vì vỡ.
    expect(parseHash('#/c/%')).toEqual({ kind: 'clan', clanId: '%' });
  });
});

describe('viết URL', () => {
  const cases: Array<[string, Route]> = [
    ['#/', { kind: 'home' }],
    ['#/c/main', { kind: 'clan', clanId: 'main' }],
    ['#/c/main/moi/k7Qm2xR9', { kind: 'invite', clanId: 'main', code: 'k7Qm2xR9' }],
    ['#/c/main/so/m_01/m_02', { kind: 'compare', clanId: 'main', aId: 'm_01', bId: 'm_02' }],
  ];

  it.each(cases)('viết ra %s', (hash, route) => {
    expect(routeToHash(route)).toBe(hash);
  });

  it.each(cases)('đọc lại %s ra đúng thứ đã viết', (hash, route) => {
    expect(parseHash(hash)).toEqual(route);
  });

  it('id có ký tự lạ vẫn đi về nguyên vẹn', () => {
    const r: Route = { kind: 'clan', clanId: 'họ Đỗ/Phú Xuyên' };
    expect(parseHash(routeToHash(r))).toEqual(r);
  });
});

describe('lấy id cây từ đường dẫn', () => {
  it('trang chọn cây thì chưa có cây nào', () => {
    expect(clanOf({ kind: 'home' })).toBeNull();
  });

  it('các trang còn lại đều nêu rõ cây', () => {
    expect(clanOf({ kind: 'clan', clanId: 'main' })).toBe('main');
    expect(clanOf({ kind: 'invite', clanId: 'main', code: 'x' })).toBe('main');
    expect(clanOf({ kind: 'compare', clanId: 'main', aId: 'a', bId: 'b' })).toBe('main');
  });
});
