import { describe, expect, it } from 'vitest';
import { checkCanDelete, diffMember } from './edit';
import { buildGraph } from './graph';
import { SAMPLE_MARRIAGES, SAMPLE_MEMBERS } from './sampleData';
import type { Member } from './types';

const graph = buildGraph(SAMPLE_MEMBERS, SAMPLE_MARRIAGES);

describe('chặn xoá', () => {
  it('không cho xoá người còn con nối vào', () => {
    const check = checkCanDelete(graph, 'bo');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('cha/mẹ của');
    expect(check.children.length).toBeGreaterThan(0);
  });

  it('nêu đích danh vài người con để người dùng biết đường xử lý', () => {
    const check = checkCanDelete(graph, 'bo');
    expect(check.reason).toContain('Nguyễn Văn Anh');
  });

  it('cho xoá người không có con', () => {
    expect(checkCanDelete(graph, 'chau_noi').allowed).toBe(true);
  });

  it('cảnh báo sẽ gỡ liên kết vợ chồng', () => {
    const check = checkCanDelete(graph, 'con_dau');
    expect(check.allowed).toBe(false); // con_dau là mẹ của chau_noi
  });

  it('liệt kê hệ quả khi xoá người đã kết hôn nhưng chưa có con', () => {
    const g = buildGraph(
      [
        { id: 'a', fullName: 'A', gender: 'M' },
        { id: 'b', fullName: 'B', gender: 'F' },
      ],
      [{ id: 'w', husbandId: 'a', wifeId: 'b', status: 'married' }],
    );
    const check = checkCanDelete(g, 'b', 2);
    expect(check.allowed).toBe(true);
    expect(check.consequences.join(' ')).toContain('1 liên kết vợ/chồng');
    expect(check.consequences.join(' ')).toContain('2 ghi chú');
    expect(check.consequences.join(' ')).toContain('Không khôi phục');
  });

  it('id không tồn tại thì từ chối thay vì sập', () => {
    expect(checkCanDelete(graph, 'khong_co').allowed).toBe(false);
  });
});

describe('so sánh thay đổi khi sửa', () => {
  const original: Member = {
    id: 'x',
    fullName: 'Nguyễn Văn A',
    gender: 'M',
    birthDate: '1960',
    address: 'Hà Nội',
  };

  it('chỉ gửi trường thực sự đổi', () => {
    expect(diffMember(original, { fullName: 'Nguyễn Văn B', birthDate: '1960' })).toEqual({
      fullName: 'Nguyễn Văn B',
    });
  });

  it('không có gì đổi thì trả về rỗng', () => {
    expect(diffMember(original, { fullName: 'Nguyễn Văn A', address: 'Hà Nội' })).toEqual({});
  });

  it('xoá giá trị cũ thành chuỗi rỗng', () => {
    expect(diffMember(original, { address: '' })).toEqual({ address: '' });
  });

  it('bỏ qua trường không nằm trong danh sách được sửa', () => {
    expect(diffMember(original, { id: 'y' } as Partial<Member>)).toEqual({});
  });

  it('ghi nhận ngày mất mới thêm', () => {
    expect(diffMember(original, { deathDate: '2020-03-01' })).toEqual({ deathDate: '2020-03-01' });
  });
});
