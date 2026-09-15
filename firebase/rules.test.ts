import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
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
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Luật Firestore là lớp bảo vệ DUY NHẤT của gia phả.
 *
 * Cấu hình Firebase phía client vốn công khai — ai mở trang cũng đọc được, rồi
 * gọi thẳng API mà không cần đi qua giao diện. Nên mọi thứ giao diện ẩn đi đều
 * phải được luật chặn lại một lần nữa. Bộ test này chạy trên emulator để chứng
 * minh điều đó trước khi luật được đẩy lên bản thật.
 */

const PROJECT = 'giapha-rules-test';
let env: RulesTestEnvironment;

// Nhân vật trong các tình huống
const CHU = 'chu';
const QUAN = 'quantri';
const BINH = 'binhluan';
const XEM = 'chixem';
const LA = 'nguoila';

const CAY = 'nha1';
const CAY_KHAC = 'nha2';

function db(uid: string | null) {
  return uid === null
    ? env.unauthenticatedContext().firestore()
    : env
        .authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true })
        .firestore();
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: {
      rules: readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  // Dựng sẵn hiện trạng bằng quyền quản trị, bỏ qua luật.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'clans', CAY), { name: 'Nhà Một', ownerUid: CHU });
    await setDoc(doc(d, 'clans', CAY_KHAC), { name: 'Nhà Hai', ownerUid: LA });

    const ai = async (uid: string, role: string, clan = CAY) =>
      setDoc(doc(d, 'clans', clan, 'memberships', uid), { uid, role, memberId: '' });
    await ai(CHU, 'owner');
    await ai(QUAN, 'admin');
    await ai(BINH, 'commenter');
    await ai(XEM, 'viewer');
    await ai(LA, 'owner', CAY_KHAC);

    await setDoc(doc(d, 'clans', CAY, 'members', 'm_01'), {
      fullName: 'Nguyễn Văn A',
      gender: 'M',
    });
    await setDoc(doc(d, 'clans', CAY, 'notes', 'n_chu'), {
      memberId: 'm_01',
      authorUid: CHU,
      authorName: 'Chủ',
      content: 'ghi chú của chủ họ',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });
});

describe('người ngoài không đọc được gì', () => {
  it('chưa đăng nhập thì không đọc được người trong họ', async () => {
    await assertFails(getDoc(doc(db(null), 'clans', CAY, 'members', 'm_01')));
  });

  it('đăng nhập nhưng chưa được duyệt cũng không đọc được', async () => {
    await assertFails(getDoc(doc(db(LA), 'clans', CAY, 'members', 'm_01')));
  });

  it('không đọc được ghi chú của họ khác', async () => {
    await assertFails(getDoc(doc(db(LA), 'clans', CAY, 'notes', 'n_chu')));
  });

  it('không liệt kê được danh sách mọi dòng họ trên hệ thống', async () => {
    await assertFails(getDocs(collection(db(LA), 'clans')));
  });
});

describe('mức chỉ xem', () => {
  it('xem được người trong họ', async () => {
    await assertSucceeds(getDoc(doc(db(XEM), 'clans', CAY, 'members', 'm_01')));
  });

  it('tìm kiếm được — tức là liệt kê được cả danh sách người', async () => {
    await assertSucceeds(getDocs(collection(db(XEM), 'clans', CAY, 'members')));
  });

  it('KHÔNG sửa được thông tin người', async () => {
    await assertFails(
      updateDoc(doc(db(XEM), 'clans', CAY, 'members', 'm_01'), { fullName: 'Tên khác' }),
    );
  });

  it('KHÔNG ghi chú được', async () => {
    await assertFails(
      setDoc(doc(db(XEM), 'clans', CAY, 'notes', 'n_moi'), {
        memberId: 'm_01',
        authorUid: XEM,
        content: 'thử',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    );
  });
});

describe('mức bình luận', () => {
  it('ghi chú được', async () => {
    await assertSucceeds(
      setDoc(doc(db(BINH), 'clans', CAY, 'notes', 'n_moi'), {
        memberId: 'm_01',
        authorUid: BINH,
        content: 'thử',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    );
  });

  it('KHÔNG mạo danh người khác khi ghi chú', async () => {
    await assertFails(
      setDoc(doc(db(BINH), 'clans', CAY, 'notes', 'n_gia'), {
        memberId: 'm_01',
        authorUid: CHU,
        content: 'giả danh chủ họ',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    );
  });

  it('KHÔNG sửa được thông tin người', async () => {
    await assertFails(
      updateDoc(doc(db(BINH), 'clans', CAY, 'members', 'm_01'), { fullName: 'Tên khác' }),
    );
  });

  it('KHÔNG xoá được ghi chú của người khác', async () => {
    await assertFails(deleteDoc(doc(db(BINH), 'clans', CAY, 'notes', 'n_chu')));
  });

  it('KHÔNG duyệt được người xin vào', async () => {
    await assertFails(
      setDoc(doc(db(BINH), 'clans', CAY, 'memberships', 'ai_do'), {
        uid: 'ai_do',
        role: 'viewer',
        memberId: '',
      }),
    );
  });
});

describe('mức toàn quyền', () => {
  it('sửa được thông tin người', async () => {
    await assertSucceeds(
      updateDoc(doc(db(QUAN), 'clans', CAY, 'members', 'm_01'), { fullName: 'Tên mới' }),
    );
  });

  it('duyệt được người mới vào', async () => {
    await assertSucceeds(
      setDoc(doc(db(QUAN), 'clans', CAY, 'memberships', 'ai_do'), {
        uid: 'ai_do',
        role: 'viewer',
        memberId: '',
      }),
    );
  });

  it('KHÔNG phong được ai làm chủ họ', async () => {
    await assertFails(
      setDoc(doc(db(QUAN), 'clans', CAY, 'memberships', 'ai_do'), {
        uid: 'ai_do',
        role: 'owner',
        memberId: '',
      }),
    );
  });

  it('KHÔNG tự phong mình làm chủ họ', async () => {
    await assertFails(
      updateDoc(doc(db(QUAN), 'clans', CAY, 'memberships', QUAN), { role: 'owner' }),
    );
  });

  it('KHÔNG hạ quyền được chủ họ', async () => {
    await assertFails(
      updateDoc(doc(db(QUAN), 'clans', CAY, 'memberships', CHU), { role: 'viewer' }),
    );
  });

  it('KHÔNG xoá được bản ghi của chủ họ', async () => {
    await assertFails(deleteDoc(doc(db(QUAN), 'clans', CAY, 'memberships', CHU)));
  });

  it('KHÔNG sang tay được quyền chủ cây', async () => {
    await assertFails(updateDoc(doc(db(QUAN), 'clans', CAY), { ownerUid: QUAN }));
  });
});

describe('chủ họ', () => {
  it('KHÔNG tự hạ quyền mình — hạ xong là dòng họ không ai mở khoá được', async () => {
    await assertFails(
      updateDoc(doc(db(CHU), 'clans', CAY, 'memberships', CHU), { role: 'viewer' }),
    );
  });

  it('đổi được mức quyền của người khác', async () => {
    await assertSucceeds(
      setDoc(doc(db(CHU), 'clans', CAY, 'memberships', XEM), {
        uid: XEM,
        role: 'commenter',
        memberId: '',
      }),
    );
  });
});

describe('ghi bản ghi thành viên', () => {
  it('KHÔNG bịa được trường uid khác id document', async () => {
    // Nếu lọt, luật tìm-cây-của-tôi ở dưới sẽ tin vào một giá trị bịa.
    await assertFails(
      setDoc(doc(db(QUAN), 'clans', CAY, 'memberships', 'ai_do'), {
        uid: 'nguoi_khac',
        role: 'viewer',
        memberId: '',
      }),
    );
  });
});

describe('tìm các cây của mình', () => {
  it('thấy đúng cây mình có chân', async () => {
    const snap = await assertSucceeds(
      getDocs(query(collectionGroup(db(BINH), 'memberships'), where('uid', '==', BINH))),
    );
    expect(snap.docs.map((d) => d.ref.parent.parent?.id)).toEqual([CAY]);
  });

  it('KHÔNG quét được bản ghi thành viên của người khác', async () => {
    await assertFails(
      getDocs(query(collectionGroup(db(BINH), 'memberships'), where('uid', '==', CHU))),
    );
  });

  it('KHÔNG quét được toàn bộ bản ghi thành viên của mọi dòng họ', async () => {
    await assertFails(getDocs(collectionGroup(db(BINH), 'memberships')));
  });

  it('người ở họ khác không nhìn thấy cây này', async () => {
    const snap = await assertSucceeds(
      getDocs(query(collectionGroup(db(LA), 'memberships'), where('uid', '==', LA))),
    );
    expect(snap.docs.map((d) => d.ref.parent.parent?.id)).toEqual([CAY_KHAC]);
  });
});

describe('giá trị cũ "editor" vẫn được công nhận là toàn quyền', () => {
  it('sửa được người như admin', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'clans', CAY, 'memberships', 'cu'), {
        uid: 'cu',
        role: 'editor',
        memberId: '',
      });
    });
    await assertSucceeds(
      updateDoc(doc(db('cu'), 'clans', CAY, 'members', 'm_01'), { fullName: 'Tên mới' }),
    );
  });
});
