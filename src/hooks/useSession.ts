import { useCallback, useEffect, useState } from 'react';
import type { Account } from '../api/auth';
import { signInWithGoogle, signOutAccount, watchAccount } from '../api/auth';
import { IS_DEMO, setAccount } from '../api/client';
import * as fs from '../api/firestoreClient';
import type { Membership, Role } from '../api/firestoreClient';
import { demoMyMemberId } from '../api/client';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  /** Đăng nhập rồi nhưng dòng họ chưa được lập — người đầu tiên sẽ lập. */
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

export function useSession() {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  const applyAccess = useCallback(async (account: Account) => {
    try {
      const access = await fs.readAccess(account);
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

  useEffect(() => {
    if (IS_DEMO) {
      setState(demoSession());
      return;
    }
    return watchAccount((account) => {
      setAccount(account);
      if (!account) {
        setState({ status: 'signed-out' });
        return;
      }
      setState({ status: 'loading' });
      void applyAccess(account);
    });
  }, [applyAccess]);

  const signIn = useCallback(async () => {
    await signInWithGoogle();
    // watchAccount sẽ tự bắt được và nạp lại quyền truy cập.
  }, []);

  const signOut = useCallback(async () => {
    if (IS_DEMO) return;
    await signOutAccount();
  }, []);

  const createClan = useCallback(
    async (name: string) => {
      if (state.status !== 'no-clan') return;
      await fs.createClan(state.account, name);
      await applyAccess(state.account);
    },
    [state, applyAccess],
  );

  const requestJoin = useCallback(async () => {
    if (state.status !== 'outsider') return;
    await fs.requestJoin(state.account);
    await applyAccess(state.account);
  }, [state, applyAccess]);

  const recheck = useCallback(async () => {
    if ('account' in state && state.account) await applyAccess(state.account);
  }, [state, applyAccess]);

  /** Ghi vị trí của mình trong gia phả vào bản ghi thành viên. */
  const setMyPosition = useCallback(
    async (memberId: string) => {
      setState((s) =>
        s.status === 'member' ? { ...s, membership: { ...s.membership, memberId } } : s,
      );
      if (IS_DEMO) return;
      if (state.status !== 'member') return;
      await fs.setMyPosition(state.account.uid, memberId);
    },
    [state],
  );

  const role: Role = state.status === 'member' ? state.membership.role : 'viewer';

  return {
    state,
    role,
    canEdit: role === 'owner' || role === 'editor',
    isOwner: role === 'owner',
    signIn,
    signOut,
    createClan,
    requestJoin,
    recheck,
    setMyPosition,
  };
}
