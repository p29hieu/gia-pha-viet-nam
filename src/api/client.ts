import { SAMPLE_MARRIAGES, SAMPLE_MEMBERS } from '../domain/sampleData';
import type { Marriage, Member, Note } from '../domain/types';

const API_URL = import.meta.env.VITE_API_URL?.trim();

/** Chưa cấu hình VITE_API_URL thì chạy bằng gia phả mẫu, không cần Google Sheet. */
export const IS_DEMO = !API_URL;
export const DEMO_CODE = 'GP-DEMO-2026';

export type Role = 'admin' | 'editor' | 'viewer';

export interface Session {
  token: string;
  role: Role;
  label: string;
  memberId: string;
}

export interface BootstrapData {
  me: { code: string; role: Role; memberId: string; label: string };
  members: Member[];
  marriages: Marriage[];
  notes: Note[];
  clanName: string;
}

export interface NewMemberInput extends Omit<Member, 'id'> {
  spouseId?: string;
}

export class ApiError extends Error {}

/**
 * Apps Script không trả lời preflight OPTIONS, nên phải gửi POST dạng
 * "simple request" bằng Content-Type: text/plain để trình duyệt bỏ qua preflight.
 */
async function call<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  if (!API_URL) throw new ApiError('Chưa cấu hình địa chỉ máy chủ');
  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
      redirect: 'follow',
    });
  } catch {
    throw new ApiError('Không kết nối được máy chủ. Kiểm tra lại đường truyền.');
  }
  if (!res.ok) throw new ApiError(`Máy chủ trả về lỗi ${res.status}`);

  const body = (await res.json()) as { ok: boolean; error?: string } & T;
  if (!body.ok) throw new ApiError(body.error ?? 'Có lỗi xảy ra');
  return body;
}

// ------------------------------------------------------------------ demo mode

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
    // bỏ qua, demo vẫn chạy trong phiên hiện tại
  }
}

function demoId(prefix: string): string {
  return prefix + Math.random().toString(36).slice(2, 10);
}

// ------------------------------------------------------------------ public API

export async function login(code: string): Promise<Session> {
  const clean = code.trim().toUpperCase();
  if (IS_DEMO) {
    if (clean !== DEMO_CODE) {
      throw new ApiError(`Mã không đúng. Bản demo dùng mã ${DEMO_CODE}`);
    }
    return { token: 'demo', role: 'admin', label: 'Bản demo', memberId: loadDemo().myMemberId };
  }
  return call<Session>('login', { code: clean });
}

export async function bootstrap(token: string): Promise<BootstrapData> {
  if (IS_DEMO) {
    const s = loadDemo();
    return {
      me: { code: DEMO_CODE, role: 'admin', memberId: s.myMemberId, label: 'Bản demo' },
      members: s.members,
      marriages: s.marriages,
      notes: s.notes,
      clanName: 'Dòng họ Nguyễn (dữ liệu mẫu)',
    };
  }
  const res = await call<{
    me: BootstrapData['me'];
    members: Member[];
    marriages: Marriage[];
    notes: Note[];
    config: Array<{ key: string; value: string }>;
  }>('bootstrap', { token });

  return {
    me: res.me,
    members: res.members.map(normalizeMember),
    marriages: res.marriages,
    notes: res.notes,
    clanName: res.config.find((c) => c.key === 'clanName')?.value ?? 'Gia phả dòng họ',
  };
}

/** Sheet trả mọi ô dưới dạng chuỗi; chuyển về đúng kiểu cho tầng domain. */
function normalizeMember(raw: Member & { birthOrder?: unknown }): Member {
  const order = Number(raw.birthOrder);
  return {
    ...raw,
    birthOrder: Number.isFinite(order) && order > 0 ? order : undefined,
    fatherId: raw.fatherId || undefined,
    motherId: raw.motherId || undefined,
    birthDate: raw.birthDate || undefined,
    deathDate: raw.deathDate || undefined,
  };
}

export async function setMyPosition(token: string, memberId: string): Promise<void> {
  if (IS_DEMO) {
    saveDemo({ ...loadDemo(), myMemberId: memberId });
    return;
  }
  await call('setMyPosition', { token, memberId });
}

export async function addMember(token: string, member: NewMemberInput): Promise<string> {
  if (IS_DEMO) {
    const s = loadDemo();
    const id = demoId('m_');
    const next: DemoState = { ...s, members: [...s.members, { ...member, id }] };
    if (member.spouseId) {
      next.marriages = [
        ...s.marriages,
        {
          id: demoId('w_'),
          husbandId: member.gender === 'M' ? id : member.spouseId,
          wifeId: member.gender === 'M' ? member.spouseId : id,
          status: 'married',
        },
      ];
    }
    saveDemo(next);
    return id;
  }
  const res = await call<{ id: string }>('addMember', { token, member });
  return res.id;
}

export async function updateMember(
  token: string,
  id: string,
  patch: Partial<Member>,
): Promise<void> {
  if (IS_DEMO) {
    const s = loadDemo();
    saveDemo({
      ...s,
      members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
    return;
  }
  await call('updateMember', { token, id, patch });
}

export async function addNote(token: string, memberId: string, content: string): Promise<Note> {
  const note: Note = {
    id: demoId('n_'),
    memberId,
    authorName: 'Bản demo',
    content,
    createdAt: new Date().toISOString(),
  };
  if (IS_DEMO) {
    const s = loadDemo();
    saveDemo({ ...s, notes: [...s.notes, note] });
    return note;
  }
  const res = await call<{ note: Note }>('addNote', { token, memberId, content });
  return res.note;
}

export function resetDemo(): void {
  try {
    localStorage.removeItem(DEMO_KEY);
  } catch {
    // bỏ qua
  }
}
