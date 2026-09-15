import { describe, expect, it } from 'vitest';
import * as opt from './optimistic';
import type { FamilySnapshot } from './optimistic';
import type { Member } from './types';

const base: FamilySnapshot = {
  members: [
    { id: 'a', fullName: 'Ông A', gender: 'M' },
    { id: 'b', fullName: 'Bà B', gender: 'F' },
    { id: 'c', fullName: 'Con C', gender: 'M', fatherId: 'a', motherId: 'b' },
  ],
  marriages: [{ id: 'w1', husbandId: 'a', wifeId: 'b', status: 'married' }],
  notes: [
    { id: 'n1', memberId: 'c', authorName: 'x', content: 'ghi chú', createdAt: '2026-01-01' },
  ],
  myMemberId: 'c',
};

const newMember = (id: string, over: Partial<Member> = {}): Member => ({
  id,
  fullName: 'Người Mới',
  gender: 'M',
  ...over,
});

describe('id tạm', () => {
  it('nhận ra được id tạm', () => {
    expect(opt.isTempId(opt.tempId())).toBe(true);
    expect(opt.isTempId('m_abc123')).toBe(false);
  });

  it('mỗi lần sinh một id khác nhau', () => {
    const ids = new Set(Array.from({ length: 50 }, () => opt.tempId()));
    expect(ids.size).toBe(50);
  });
});

describe('thêm người', () => {
  it('không đụng vào dữ liệu cũ', () => {
    const next = opt.addMember(base, newMember('x'));
    expect(base.members).toHaveLength(3);
    expect(next.members).toHaveLength(4);
  });

  it('kèm vợ/chồng thì tạo luôn liên kết hôn nhân', () => {
    const next = opt.addMember(base, newMember('x', { gender: 'F' }), 'a');
    expect(next.marriages).toHaveLength(2);
    expect(next.marriages[1]).toMatchObject({ husbandId: 'a', wifeId: 'x' });
  });

  it('nam thêm vợ thì xếp đúng vai chồng', () => {
    const next = opt.addMember(base, newMember('x', { gender: 'M' }), 'b');
    expect(next.marriages[1]).toMatchObject({ husbandId: 'x', wifeId: 'b' });
  });
});

describe('đổi id tạm thành id thật', () => {
  it('đổi trên chính người đó', () => {
    const withTemp = opt.addMember(base, newMember('tmp_1'));
    const next = opt.commitId(withTemp, 'tmp_1', 'm_real');
    expect(next.members.map((m) => m.id)).toContain('m_real');
    expect(next.members.map((m) => m.id)).not.toContain('tmp_1');
  });

  it('đổi cả ở con đang nhận làm cha', () => {
    const snap: FamilySnapshot = {
      ...base,
      members: [...base.members, newMember('tmp_1'), newMember('d', { fatherId: 'tmp_1' })],
    };
    const next = opt.commitId(snap, 'tmp_1', 'm_real');
    expect(next.members.find((m) => m.id === 'd')?.fatherId).toBe('m_real');
  });

  it('đổi CHÍNH id của bản ghi hôn nhân, không chỉ hai đầu', () => {
    const snap: FamilySnapshot = {
      members: [],
      marriages: [{ id: 'tmpw_1', husbandId: 'a', wifeId: 'b', status: 'married' }],
      notes: [],
      myMemberId: '',
    };
    const next = opt.commitId(snap, 'tmpw_1', 'w_real');
    expect(next.marriages[0]?.id).toBe('w_real');
    expect(next.marriages[0]?.husbandId).toBe('a');
  });

  it('đổi CHÍNH id của ghi chú', () => {
    const snap: FamilySnapshot = {
      members: [],
      marriages: [],
      notes: [{ id: 'tmpn_1', memberId: 'a', authorName: '', content: 'x', createdAt: '' }],
      myMemberId: '',
    };
    expect(opt.commitId(snap, 'tmpn_1', 'n_real').notes[0]?.id).toBe('n_real');
  });

  it('đổi cả trong hôn nhân, ghi chú và vị trí của mình', () => {
    const snap: FamilySnapshot = {
      members: [newMember('tmp_1')],
      marriages: [{ id: 'w', husbandId: 'tmp_1', wifeId: 'b', status: 'married' }],
      notes: [{ id: 'n', memberId: 'tmp_1', authorName: '', content: '', createdAt: '' }],
      myMemberId: 'tmp_1',
    };
    const next = opt.commitId(snap, 'tmp_1', 'm_real');
    expect(next.marriages[0]?.husbandId).toBe('m_real');
    expect(next.notes[0]?.memberId).toBe('m_real');
    expect(next.myMemberId).toBe('m_real');
  });
});

describe('sửa người', () => {
  it('chỉ đổi đúng người được chỉ định', () => {
    const next = opt.updateMember(base, 'c', { fullName: 'Tên Mới' });
    expect(next.members.find((m) => m.id === 'c')?.fullName).toBe('Tên Mới');
    expect(next.members.find((m) => m.id === 'a')?.fullName).toBe('Ông A');
  });

  it('giữ nguyên các trường không nằm trong patch', () => {
    const next = opt.updateMember(base, 'c', { address: 'Hà Nội' });
    expect(next.members.find((m) => m.id === 'c')).toMatchObject({
      fullName: 'Con C',
      address: 'Hà Nội',
    });
  });
});

describe('xoá người', () => {
  it('xoá kèm hôn nhân và ghi chú liên quan', () => {
    const next = opt.removeMember(base, 'a');
    expect(next.members.map((m) => m.id)).toEqual(['b', 'c']);
    expect(next.marriages).toHaveLength(0);
  });

  it('xoá người đang là vị trí của mình thì bỏ luôn vị trí', () => {
    const next = opt.removeMember(base, 'c');
    expect(next.myMemberId).toBe('');
    expect(next.notes).toHaveLength(0);
  });

  it('xoá người khác thì vị trí của mình giữ nguyên', () => {
    expect(opt.removeMember(base, 'a').myMemberId).toBe('c');
  });
});

describe('ghi chú', () => {
  it('thêm rồi xoá trả về đúng trạng thái ban đầu', () => {
    const note = { id: 'n2', memberId: 'a', authorName: '', content: 'x', createdAt: '' };
    const added = opt.addNote(base, note);
    expect(added.notes).toHaveLength(2);
    expect(opt.removeNote(added, 'n2').notes).toEqual(base.notes);
  });
});
