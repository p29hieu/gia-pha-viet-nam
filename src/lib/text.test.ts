import { describe, expect, it } from 'vitest';
import { formatVnDate, lifespan, matchesName, removeDiacritics, searchKey } from './text';

describe('bỏ dấu tiếng Việt', () => {
  it('bỏ dấu thanh và dấu mũ', () => {
    expect(removeDiacritics('Nguyễn Văn Bình')).toBe('Nguyen Van Binh');
  });

  it('chuyển đ thành d', () => {
    expect(removeDiacritics('Đặng Thị Đào')).toBe('Dang Thi Dao');
  });

  it('searchKey trả về chữ thường', () => {
    expect(searchKey('  Lê Thị Mai ')).toBe('le thi mai');
  });
});

describe('tìm theo tên', () => {
  it('gõ không dấu vẫn khớp', () => {
    expect(matchesName('Nguyễn Văn Bình', 'nguyen binh')).toBe(true);
  });

  it('gõ có dấu vẫn khớp', () => {
    expect(matchesName('Nguyễn Văn Bình', 'Bình')).toBe(true);
  });

  it('không khớp khi thiếu một từ', () => {
    expect(matchesName('Nguyễn Văn Bình', 'nguyen hoa')).toBe(false);
  });

  it('truy vấn rỗng khớp tất cả', () => {
    expect(matchesName('Bất kỳ', '   ')).toBe(true);
  });
});

describe('định dạng ngày', () => {
  it.each([
    ['1930', '1930'],
    ['1930-05', '05/1930'],
    ['1930-05-12', '12/05/1930'],
  ])('%s -> %s', (input, expected) => {
    expect(formatVnDate(input)).toBe(expected);
  });

  it('giá trị rỗng trả về chuỗi rỗng', () => {
    expect(formatVnDate(undefined)).toBe('');
  });
});

describe('khoảng đời', () => {
  it('có cả năm sinh và năm mất', () => {
    expect(lifespan('1900', '1975')).toBe('1900 – 1975');
  });

  it('chỉ có năm sinh', () => {
    expect(lifespan('1960')).toBe('1960');
  });

  it('không có gì', () => {
    expect(lifespan()).toBe('');
  });
});
