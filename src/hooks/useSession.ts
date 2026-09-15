import { useCallback, useEffect, useState } from 'react';
import type { Account } from '../api/auth';
import { signInWithGoogle, signOutAccount, watchAccount } from '../api/auth';
import {
  DEMO_CLAN_ID,
  IS_DEMO,
  demoMyMemberId,
  listMyClans,
  setAccount,
  setClan,
  setMyPosition as luuViTri,
} from '../api/client';
import * as fs from '../api/firestoreClient';
import type { ClanSummary, Membership, Role } from '../api/firestoreClient';
import { NO_PERMISSIONS, permissionsOf } from '../domain/perm';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  /** Đăng nhập rồi nhưng URL chưa chỉ cây nào — chờ người dùng chọn. */
  | { status: 'choosing'; account: Account }
  /** URL trỏ tới một cây không tồn tại. */
  | { status: 'no-clan'; account: Account }
  /** Chưa gửi yêu cầu vào họ. */
  | { status: 'outsider'; account: Account; clanName: string }
  /** Đã gửi yêu cầu, đang chờ chủ họ duyệt. */
  | { status: 'pending'; account: Account; clanName: string }
  | { status: 'member'; account: Account; clanName: string; membership: Membership }
  | { status: 'error'; message: string };

const DEMO_ACCOUNT: Account = {
  uid: 'demo',
  displayName: 'Bản demo',
  email: '',
  photoURL: '',
};

function demoSession(): SessionState {
  return {
    status: 'member',
    account: DEMO_ACCOUNT,
    clanName: 'Dòng họ Nguyễn (dữ liệu mẫu)',
    membership: {
      uid: 'demo',
      role: 'owner',
      displayName: 'Bản demo',
      email: '',
      photoURL: '',
      memberId: demoMyMemberId(),
    },
  };
}

/**
 * Phiên làm việc: ai đang đăng nhập, đang mở cây nào, và được làm những gì.
 *
 * `clanId` đến từ URL. Null nghĩa là chưa chọn cây — khi đó hook chỉ lo tải
 * danh sách cây của người dùng để màn chọn cây có cái mà hiện.
 */
export function useSession(clanId: string | null) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [myClans, setMyClans] = useState<ClanSummary[]>([]);

  const loadMyClans = useCallback(async () => {
    try {
      setMyClans(await listMyClans());
    } catch {
      // Không đọc được danh sách thì màn chọn cây hiện rỗng kèm lời nhắc; không
      // nên vì thế mà chặn luôn người đang có sẵn id cây trong URL.
      setMyClans([]);
    }
  }, []);

  const applyAccess = useCallback(async (account: Account, id: string) => {
    try {
      const access = await fs.readAccess(id, account);
      if (access.state === 'no-clan') setState({ status: 'no-clan', account });
      else if (access.state === 'member')
        setState({
          status: 'member',
          account,
          clanName: access.clanName,
          membership: access.membership,
        });
      else setState({ status: access.state, account, clanName: access.clanName });
    } catch (err) {
      setState({ status: 'error', message: (err as Error).message });
    }
  }, []);

  // Cây đang mở phải được đặt vào tầng api TRƯỚC mọi lời gọi đọc/ghi.
  useEffect(() => {
    setClan(IS_DEMO ? DEMO_CLAN_ID : clanId);
  }, [clanId]);

  useEffect(() => {
    if (IS_DEMO) {
      setState(demoSession());
      void loadMyClans();
      return;
    }
    return watchAccount((account) => {
      setAccount(account);
      if (!account) {
        setState({ status: 'signed-out' });
        setMyClans([]);
        return;
      }
      void loadMyClans();
      if (!clanId) {
        setState({ status: 'choosing', account });
        return;
      }
      setState({ status: 'loading' });
      void applyAccess(account, clanId);
    });
  }, [applyAccess, loadMyClans, clanId]);

  const signIn = useCallback(async () => {
    await signInWithGoogle();
    // watchAccount sẽ tự bắt được và nạp lại quyền truy cập.
  }, []);

  const signOut = useCallback(async () => {
    if (IS_DEMO) return;
    await signOutAccount();
  }, []);

  /** Dựng cây mới; trả về id để tầng trên đưa vào URL. */
  const createClan = useCallback(
    async (name: string): Promise<string> => {
      if (!('account' in state) || !state.account) throw new Error('Chưa đăng nhập');
      const id = await fs.createClan(state.account, name);
      await loadMyClans();
      return id;
    },
    [state, loadMyClans],
  );

  const requestJoin = useCallback(async () => {
    if (state.status !== 'outsider' || !clanId) return;
    await fs.requestJoin(clanId, state.account);
    await applyAccess(state.account, clanId);
  }, [state, applyAccess, clanId]);

  const recheck = useCallback(async () => {
    if (!('account' in state) || !state.account) return;
    await loadMyClans();
    if (clanId) await applyAccess(state.account, clanId);
  }, [state, applyAccess, loadMyClans, clanId]);

  /** Ghi vị trí của mình trong gia phả vào bản ghi thành viên. */
  const setMyPosition = useCallback(
    async (memberId: string) => {
      setState((s) =>
        s.status === 'member' ? { ...s, membership: { ...s.membership, memberId } } : s,
      );
      // Đi qua cổng client để chế độ demo cũng ghi xuống localStorage — trước
      // đây demo thoát sớm nên tải lại trang là quên mất mình là ai.
      if (state.status !== 'member') return;
      await luuViTri(memberId);
    },
    [state],
  );

  const role: Role | null = state.status === 'member' ? state.membership.role : null;
  const perms = role ? permissionsOf(role) : NO_PERMISSIONS;

  return {
    state,
    role,
    myClans,
    refreshClans: loadMyClans,
    ...perms,
    signIn,
    signOut,
    createClan,
    requestJoin,
    recheck,
    setMyPosition,
  };
}
