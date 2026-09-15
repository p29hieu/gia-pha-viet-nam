/**
 * Cổng dữ liệu duy nhất của ứng dụng.
 *
 * Có Firebase thì dùng Firestore; chưa cấu hình thì chạy bằng gia phả mẫu lưu
 * trong localStorage. Phần còn lại của ứng dụng không cần biết mình đang đứng
 * trên nền nào — nhờ vậy đổi nền tảng chỉ phải sửa đúng file này.
 */
import { SAMPLE_MARRIAGES, SAMPLE_MEMBERS } from '../domain/sampleData';
import type { Marriage, Member, Note } from '../domain/types';
import type { Account } from './auth';
import { FIREBASE_READY } from './firebase';
import * as fs from './firestoreClient';

export { FIREBASE_READY };
export type { Account } from './auth';
export type { Access, JoinRequest, Membership, Role } from './firestoreClient';

export const IS_DEMO = !FIREBASE_READY;
export const DEMO_CODE = 'GP-DEMO-2026';

export interface NewMemberInput extends Omit<Member, 'id'> {
  spouseId?: string;
}

export interface ClanData {
  members: Member[];
  marriages: Marriage[];
  notes: Note[];
}

// Tài khoản hiện tại, do tầng đăng nhập đặt vào sau khi xác thực xong.
let account: Account | null = null;

export function setAccount(next: Account | null): void {
  account = next;
}

function requireAccount(): Account {
  if (!account) throw new Error('Chưa đăng nhập');
  return account;
}

// ------------------------------------------------------------------ demo

interface DemoState {
  members: Member[];
  marriages: Marriage[];
  notes: Note[];
  myMemberId: string;
}

const DEMO_KEY = 'giapha_demo_state_v1';

function loadDemo(): DemoState {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch {
    // localStorage có thể bị chặn — rơi về dữ liệu gốc
  }
  return { members: SAMPLE_MEMBERS, marriages: SAMPLE_MARRIAGES, notes: [], myMemberId: '' };
}

function saveDemo(state: DemoState): void {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(state));
  } catch {
    // demo vẫn chạy được trong phiên hiện tại
  }
}

function demoId(prefix: string): string {
  return prefix + Math.random().toString(36).slice(2, 10);
}

export function demoMyMemberId(): string {
  return loadDemo().myMemberId;
}

// ------------------------------------------------------------------ đọc / ghi

export async function loadClanData(): Promise<ClanData> {
  if (IS_DEMO) {
    const s = loadDemo();
    return { members: s.members, marriages: s.marriages, notes: s.notes };
  }
  return fs.loadClanData();
}

export async function setMyPosition(memberId: string): Promise<void> {
  if (IS_DEMO) {
    saveDemo({ ...loadDemo(), myMemberId: memberId });
    return;
  }
  await fs.setMyPosition(requireAccount().uid, memberId);
}

export async function addMember(input: NewMemberInput): Promise<string> {
  if (IS_DEMO) {
    const s = loadDemo();
    const id = demoId('m_');
    const { spouseId, ...member } = input;
    const next: DemoState = { ...s, members: [...s.members, { ...member, id }] };
    if (spouseId) {
      next.marriages = [
        ...s.marriages,
        {
          id: demoId('w_'),
          husbandId: member.gender === 'M' ? id : spouseId,
          wifeId: member.gender === 'M' ? spouseId : id,
          status: 'married',
        },
      ];
    }
    saveDemo(next);
    return id;
  }
  return fs.addMember(requireAccount(), input);
}

export async function updateMember(id: string, patch: Partial<Member>): Promise<void> {
  if (IS_DEMO) {
    const s = loadDemo();
    saveDemo({ ...s, members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
    return;
  }
  await fs.updateMember(id, patch);
}

export async function deleteMember(id: string): Promise<void> {
  if (IS_DEMO) {
    const s = loadDemo();
    saveDemo({
      ...s,
      members: s.members.filter((m) => m.id !== id),
      marriages: s.marriages.filter((w) => w.husbandId !== id && w.wifeId !== id),
      notes: s.notes.filter((n) => n.memberId !== id),
      myMemberId: s.myMemberId === id ? '' : s.myMemberId,
    });
    return;
  }
  await fs.deleteMember(id);
}

export async function addMarriage(husbandId: string, wifeId: string): Promise<string> {
  if (IS_DEMO) {
    const st = loadDemo();
    const id = demoId('w_');
    saveDemo({ ...st, marriages: [...st.marriages, { id, husbandId, wifeId, status: 'married' }] });
    return id;
  }
  return fs.addMarriage(husbandId, wifeId);
}

export async function deleteMarriage(id: string): Promise<void> {
  if (IS_DEMO) {
    const st = loadDemo();
    saveDemo({ ...st, marriages: st.marriages.filter((w) => w.id !== id) });
    return;
  }
  await fs.deleteMarriage(id);
}

export async function addNote(memberId: string, content: string): Promise<Note> {
  if (IS_DEMO) {
    const note: Note = {
      id: demoId('n_'),
      memberId,
      authorName: 'Bản demo',
      content,
      createdAt: new Date().toISOString(),
      mine: true,
    };
    const s = loadDemo();
    saveDemo({ ...s, notes: [...s.notes, note] });
    return note;
  }
  return fs.addNote(requireAccount(), memberId, content);
}

export async function deleteNote(id: string): Promise<void> {
  if (IS_DEMO) {
    const s = loadDemo();
    saveDemo({ ...s, notes: s.notes.filter((n) => n.id !== id) });
    return;
  }
  await fs.deleteNote(id);
}

export function resetDemo(): void {
  try {
    localStorage.removeItem(DEMO_KEY);
  } catch {
    // bỏ qua
  }
}
