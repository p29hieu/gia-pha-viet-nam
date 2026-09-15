import {
  collection,
  collectionGroup,
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
import { requireDb } from './firebase';

/**
 * Mức quyền, từ thấp lên cao.
 *
 * viewer    — chỉ đọc
 * commenter — đọc và ghi chú
 * editor    — sửa người và quan hệ
 * owner     — thêm quyền mời và duyệt người vào
 */
export type Role = 'owner' | 'editor' | 'commenter' | 'viewer';

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

/** Một cây gia phả mà người đăng nhập có quyền vào. */
export interface ClanSummary {
  id: string;
  name: string;
  role: Role;
  memberId: string;
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

const clanRef = (clanId: string) => doc(requireDb(), 'clans', clanId);
const membersRef = (clanId: string) => collection(requireDb(), 'clans', clanId, 'members');
const marriagesRef = (clanId: string) => collection(requireDb(), 'clans', clanId, 'marriages');
const notesRef = (clanId: string) => collection(requireDb(), 'clans', clanId, 'notes');
const membershipsRef = (clanId: string) => collection(requireDb(), 'clans', clanId, 'memberships');
const joinRequestsRef = (clanId: string) =>
  collection(requireDb(), 'clans', clanId, 'joinRequests');

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

// ---------------------------------------------------------------- chọn cây

/**
 * Những cây gia phả mà người này có quyền vào.
 *
 * Không hỏi được từ phía `clans` vì luật cấm liệt kê (`allow list: if false`) —
 * cho liệt kê là lộ danh sách mọi dòng họ trên hệ thống. Nên hỏi ngược từ phía
 * membership: tìm mọi document membership mang uid của mình, ở bất kỳ cây nào,
 * rồi mới lấy tên từng cây.
 */
export async function listMyClans(uid: string): Promise<ClanSummary[]> {
  try {
    const snap = await getDocs(
      query(collectionGroup(requireDb(), 'memberships'), where('uid', '==', uid)),
    );

    const rows = await Promise.all(
      snap.docs.map(async (d) => {
        const clanId = d.ref.parent.parent?.id;
        if (!clanId) return null;
        const info = await getDoc(clanRef(clanId));
        const data = d.data();
        return {
          id: clanId,
          name: (info.data()?.name as string) ?? 'Gia phả dòng họ',
          role: (data.role as Role) ?? 'viewer',
          memberId: (data.memberId as string) ?? '',
        };
      }),
    );

    return rows
      .filter((r): r is ClanSummary => r !== null)
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  } catch (err) {
    throw friendly(err, 'Không đọc được danh sách gia phả của bạn.');
  }
}

// ---------------------------------------------------------------- vào dòng họ

export async function readAccess(clanId: string, account: Account): Promise<Access> {
  const clanSnap = await getDoc(clanRef(clanId));
  if (!clanSnap.exists()) return { state: 'no-clan' };
  const clanName = (clanSnap.data().name as string) ?? 'Gia phả dòng họ';

  try {
    const mine = await getDoc(doc(membershipsRef(clanId), account.uid));
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
    // Chưa là thành viên thì luật chặn đọc — chính lời từ chối đó là câu trả lời.
    if (!isDenied(err)) throw friendly(err, 'Không đọc được thông tin thành viên.');
  }

  const pending = await getDoc(doc(joinRequestsRef(clanId), account.uid));
  return pending.exists() ? { state: 'pending', clanName } : { state: 'outsider', clanName };
}

/**
 * Dựng một cây gia phả mới; người tạo tự nhận làm chủ.
 * Trả về id của cây để tầng trên đưa vào URL.
 */
export async function createClan(account: Account, name: string): Promise<string> {
  const now = new Date().toISOString();
  try {
    const ref = doc(collection(requireDb(), 'clans'));
    await setDoc(ref, {
      name: name.trim() || 'Gia phả dòng họ',
      ownerUid: account.uid,
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(membershipsRef(ref.id), account.uid), {
      uid: account.uid,
      role: 'owner',
      displayName: account.displayName,
      email: account.email,
      photoURL: account.photoURL,
      memberId: '',
      joinedAt: now,
    });
    return ref.id;
  } catch (err) {
    throw friendly(err, 'Không tạo được dòng họ.');
  }
}

export async function requestJoin(clanId: string, account: Account): Promise<void> {
  try {
    await setDoc(doc(joinRequestsRef(clanId), account.uid), {
      displayName: account.displayName,
      email: account.email,
      photoURL: account.photoURL,
      requestedAt: new Date().toISOString(),
    });
  } catch (err) {
    throw friendly(err, 'Không gửi được yêu cầu.');
  }
}

export async function listJoinRequests(clanId: string): Promise<JoinRequest[]> {
  const snap = await getDocs(joinRequestsRef(clanId));
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<JoinRequest, 'uid'>) }));
}

export async function approveJoinRequest(
  clanId: string,
  req: JoinRequest,
  role: Role,
): Promise<void> {
  try {
    await setDoc(doc(membershipsRef(clanId), req.uid), {
      uid: req.uid,
      role,
      displayName: req.displayName,
      email: req.email,
      photoURL: req.photoURL,
      memberId: '',
      joinedAt: new Date().toISOString(),
    });
    await deleteDoc(doc(joinRequestsRef(clanId), req.uid));
  } catch (err) {
    throw friendly(err, 'Không duyệt được yêu cầu.');
  }
}

export async function rejectJoinRequest(clanId: string, uid: string): Promise<void> {
  await deleteDoc(doc(joinRequestsRef(clanId), uid));
}

// ---------------------------------------------------------------- dữ liệu gia phả

export async function loadClanData(clanId: string): Promise<ClanData> {
  try {
    const [memberSnap, marriageSnap, noteSnap] = await Promise.all([
      getDocs(membersRef(clanId)),
      getDocs(marriagesRef(clanId)),
      getDocs(notesRef(clanId)),
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

export async function setMyPosition(clanId: string, uid: string, memberId: string): Promise<void> {
  try {
    await updateDoc(doc(membershipsRef(clanId), uid), { memberId });
  } catch (err) {
    throw friendly(err, 'Không lưu được vị trí của bạn.');
  }
}

export interface NewMemberInput extends Omit<Member, 'id'> {
  spouseId?: string;
}

export async function addMember(
  clanId: string,
  account: Account,
  input: NewMemberInput,
): Promise<string> {
  const { spouseId, ...member } = input;
  const now = new Date().toISOString();
  try {
    const ref = doc(membersRef(clanId));
    await setDoc(ref, clean({ ...member, createdAt: now, updatedAt: now, createdBy: account.uid }));
    if (spouseId) {
      await setDoc(
        doc(marriagesRef(clanId)),
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

export async function updateMember(
  clanId: string,
  id: string,
  patch: Partial<Member>,
): Promise<void> {
  try {
    await updateDoc(
      doc(membersRef(clanId), id),
      clean({ ...patch, updatedAt: new Date().toISOString() }),
    );
  } catch (err) {
    throw friendly(err, 'Không lưu được thay đổi.');
  }
}

/**
 * Firestore không tự xoá theo tầng, nên phải tự dọn hôn nhân và ghi chú dính
 * tới người này. Gom vào một batch để không có trạng thái dở dang.
 */
export async function deleteMember(clanId: string, id: string): Promise<void> {
  try {
    const [asHusband, asWife, memberNotes] = await Promise.all([
      getDocs(query(marriagesRef(clanId), where('husbandId', '==', id))),
      getDocs(query(marriagesRef(clanId), where('wifeId', '==', id))),
      getDocs(query(notesRef(clanId), where('memberId', '==', id))),
    ]);

    const batch = writeBatch(requireDb());
    [...asHusband.docs, ...asWife.docs, ...memberNotes.docs].forEach((d) => batch.delete(d.ref));
    batch.delete(doc(membersRef(clanId), id));
    await batch.commit();
  } catch (err) {
    throw friendly(err, 'Không xoá được thành viên.');
  }
}

export async function addMarriage(
  clanId: string,
  husbandId: string,
  wifeId: string,
): Promise<string> {
  try {
    const ref = doc(marriagesRef(clanId));
    await setDoc(ref, { husbandId, wifeId, status: 'married' });
    return ref.id;
  } catch (err) {
    throw friendly(err, 'Không nối được vợ chồng.');
  }
}

export async function deleteMarriage(clanId: string, id: string): Promise<void> {
  try {
    await deleteDoc(doc(marriagesRef(clanId), id));
  } catch (err) {
    throw friendly(err, 'Không huỷ được liên kết vợ chồng.');
  }
}

export async function addNote(
  clanId: string,
  account: Account,
  memberId: string,
  content: string,
): Promise<Note> {
  const now = new Date().toISOString();
  try {
    const ref = doc(notesRef(clanId));
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

export async function deleteNote(clanId: string, id: string): Promise<void> {
  try {
    await deleteDoc(doc(notesRef(clanId), id));
  } catch (err) {
    throw friendly(err, 'Không xoá được ghi chú.');
  }
}
