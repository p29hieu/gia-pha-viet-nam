import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { Marriage, Member, Note } from '../domain/types';
import type { Account } from './auth';
import { CLAN_ID, requireDb } from './firebase';

export type Role = 'owner' | 'editor' | 'viewer';

export interface Membership {
  uid: string;
  role: Role;
  displayName: string;
  email: string;
  photoURL: string;
  /** Vị trí của người này trong gia phả */
  memberId: string;
}

export interface JoinRequest {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  requestedAt: string;
}

/** Người đăng nhập đang ở đâu trong quy trình vào dòng họ. */
export type Access =
  | { state: 'member'; clanName: string; membership: Membership }
  | { state: 'pending'; clanName: string }
  | { state: 'outsider'; clanName: string }
  | { state: 'no-clan' };

export interface ClanData {
  members: Member[];
  marriages: Marriage[];
  notes: Note[];
}

// ---------------------------------------------------------------- tiện ích

const clanRef = () => doc(requireDb(), 'clans', CLAN_ID);
const membersRef = () => collection(requireDb(), 'clans', CLAN_ID, 'members');
const marriagesRef = () => collection(requireDb(), 'clans', CLAN_ID, 'marriages');
const notesRef = () => collection(requireDb(), 'clans', CLAN_ID, 'notes');
const membershipsRef = () => collection(requireDb(), 'clans', CLAN_ID, 'memberships');
const joinRequestsRef = () => collection(requireDb(), 'clans', CLAN_ID, 'joinRequests');

/** Firestore từ chối giá trị undefined, nên phải lọc trước khi ghi. */
function clean<T extends object>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined) out[k] = v;
  });
  return out;
}

function isDenied(err: unknown): boolean {
  return (err as { code?: string }).code === 'permission-denied';
}

function friendly(err: unknown, fallback: string): Error {
  const code = (err as { code?: string }).code ?? '';
  if (code === 'permission-denied') {
    return new Error('Bạn không có quyền làm việc này.');
  }
  if (code === 'unavailable') {
    return new Error('Không kết nối được máy chủ. Kiểm tra lại đường truyền.');
  }
  return new Error(`${fallback} ${(err as Error).message ?? ''}`.trim());
}

// ---------------------------------------------------------------- vào dòng họ

export async function readAccess(account: Account): Promise<Access> {
  const clanSnap = await getDoc(clanRef());
  if (!clanSnap.exists()) return { state: 'no-clan' };
  const clanName = (clanSnap.data().name as string) ?? 'Gia phả dòng họ';

  try {
    const mine = await getDoc(doc(membershipsRef(), account.uid));
    if (mine.exists()) {
      const d = mine.data();
      return {
        state: 'member',
        clanName,
        membership: {
          uid: account.uid,
          role: (d.role as Role) ?? 'viewer',
          displayName: (d.displayName as string) ?? account.displayName,
          email: (d.email as string) ?? account.email,
          photoURL: (d.photoURL as string) ?? account.photoURL,
          memberId: (d.memberId as string) ?? '',
        },
      };
    }
  } catch (err) {
    // Rules chặn đọc khi chưa là thành viên — đó chính là câu trả lời.
    if (!isDenied(err)) throw friendly(err, 'Không đọc được thông tin thành viên.');
  }

  const pending = await getDoc(doc(joinRequestsRef(), account.uid));
  return pending.exists() ? { state: 'pending', clanName } : { state: 'outsider', clanName };
}

/** Người đầu tiên dựng dòng họ và tự nhận làm chủ. */
export async function createClan(account: Account, name: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    await setDoc(clanRef(), {
      name: name.trim() || 'Gia phả dòng họ',
      ownerUid: account.uid,
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(membershipsRef(), account.uid), {
      role: 'owner',
      displayName: account.displayName,
      email: account.email,
      photoURL: account.photoURL,
      memberId: '',
      joinedAt: now,
    });
  } catch (err) {
    throw friendly(err, 'Không tạo được dòng họ.');
  }
}

export async function requestJoin(account: Account): Promise<void> {
  try {
    await setDoc(doc(joinRequestsRef(), account.uid), {
      displayName: account.displayName,
      email: account.email,
      photoURL: account.photoURL,
      requestedAt: new Date().toISOString(),
    });
  } catch (err) {
    throw friendly(err, 'Không gửi được yêu cầu.');
  }
}

export async function listJoinRequests(): Promise<JoinRequest[]> {
  const snap = await getDocs(joinRequestsRef());
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<JoinRequest, 'uid'>) }));
}

export async function approveJoinRequest(req: JoinRequest, role: Role): Promise<void> {
  try {
    await setDoc(doc(membershipsRef(), req.uid), {
      role,
      displayName: req.displayName,
      email: req.email,
      photoURL: req.photoURL,
      memberId: '',
      joinedAt: new Date().toISOString(),
    });
    await deleteDoc(doc(joinRequestsRef(), req.uid));
  } catch (err) {
    throw friendly(err, 'Không duyệt được yêu cầu.');
  }
}

export async function rejectJoinRequest(uid: string): Promise<void> {
  await deleteDoc(doc(joinRequestsRef(), uid));
}

// ---------------------------------------------------------------- dữ liệu gia phả

export async function loadClanData(): Promise<ClanData> {
  try {
    const [memberSnap, marriageSnap, noteSnap] = await Promise.all([
      getDocs(membersRef()),
      getDocs(marriagesRef()),
      getDocs(notesRef()),
    ]);
    return {
      members: memberSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Member, 'id'>) })),
      marriages: marriageSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Marriage, 'id'>),
      })),
      notes: noteSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Note, 'id'>) })),
    };
  } catch (err) {
    throw friendly(err, 'Không tải được gia phả.');
  }
}

export async function setMyPosition(uid: string, memberId: string): Promise<void> {
  try {
    await updateDoc(doc(membershipsRef(), uid), { memberId });
  } catch (err) {
    throw friendly(err, 'Không lưu được vị trí của bạn.');
  }
}

export interface NewMemberInput extends Omit<Member, 'id'> {
  spouseId?: string;
}

export async function addMember(account: Account, input: NewMemberInput): Promise<string> {
  const { spouseId, ...member } = input;
  const now = new Date().toISOString();
  try {
    const ref = doc(membersRef());
    await setDoc(ref, clean({ ...member, createdAt: now, updatedAt: now, createdBy: account.uid }));
    if (spouseId) {
      await setDoc(
        doc(marriagesRef()),
        clean({
          husbandId: member.gender === 'M' ? ref.id : spouseId,
          wifeId: member.gender === 'M' ? spouseId : ref.id,
          status: 'married',
        }),
      );
    }
    return ref.id;
  } catch (err) {
    throw friendly(err, 'Không thêm được thành viên.');
  }
}

export async function updateMember(id: string, patch: Partial<Member>): Promise<void> {
  try {
    await updateDoc(doc(membersRef(), id), clean({ ...patch, updatedAt: new Date().toISOString() }));
  } catch (err) {
    throw friendly(err, 'Không lưu được thay đổi.');
  }
}

/**
 * Firestore không tự xoá theo tầng, nên phải tự dọn hôn nhân và ghi chú dính
 * tới người này. Gom vào một batch để không có trạng thái dở dang.
 */
export async function deleteMember(id: string): Promise<void> {
  try {
    const [asHusband, asWife, memberNotes] = await Promise.all([
      getDocs(query(marriagesRef(), where('husbandId', '==', id))),
      getDocs(query(marriagesRef(), where('wifeId', '==', id))),
      getDocs(query(notesRef(), where('memberId', '==', id))),
    ]);

    const batch = writeBatch(requireDb());
    [...asHusband.docs, ...asWife.docs, ...memberNotes.docs].forEach((d) => batch.delete(d.ref));
    batch.delete(doc(membersRef(), id));
    await batch.commit();
  } catch (err) {
    throw friendly(err, 'Không xoá được thành viên.');
  }
}

export async function addMarriage(husbandId: string, wifeId: string): Promise<string> {
  try {
    const ref = doc(marriagesRef());
    await setDoc(ref, { husbandId, wifeId, status: 'married' });
    return ref.id;
  } catch (err) {
    throw friendly(err, 'Khong noi duoc vo chong.');
  }
}

export async function deleteMarriage(id: string): Promise<void> {
  try {
    await deleteDoc(doc(marriagesRef(), id));
  } catch (err) {
    throw friendly(err, 'Khong huy duoc lien ket vo chong.');
  }
}

export async function addNote(
  account: Account,
  memberId: string,
  content: string,
): Promise<Note> {
  const now = new Date().toISOString();
  try {
    const ref = doc(notesRef());
    await setDoc(ref, {
      memberId,
      authorUid: account.uid,
      authorName: account.displayName || account.email,
      content,
      createdAt: now,
    });
    return {
      id: ref.id,
      memberId,
      authorName: account.displayName || account.email,
      content,
      createdAt: now,
      mine: true,
    };
  } catch (err) {
    throw friendly(err, 'Không lưu được ghi chú.');
  }
}

export async function deleteNote(id: string): Promise<void> {
  try {
    await deleteDoc(doc(notesRef(), id));
  } catch (err) {
    throw friendly(err, 'Không xoá được ghi chú.');
  }
}
