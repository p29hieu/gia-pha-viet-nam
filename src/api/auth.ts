import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { requireAuth } from './firebase';

export interface Account {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
}

function toAccount(user: User): Account {
  return {
    uid: user.uid,
    displayName: user.displayName ?? '',
    email: user.email ?? '',
    photoURL: user.photoURL ?? '',
  };
}

export function watchAccount(onChange: (account: Account | null) => void): () => void {
  return onAuthStateChanged(requireAuth(), (user) => onChange(user ? toAccount(user) : null));
}

/**
 * Dùng cửa sổ bật lên chứ không dùng chuyển hướng.
 *
 * Safari trên iOS chặn lưu trữ của bên thứ ba, làm luồng signInWithRedirect
 * đứt quãng trừ khi tự dựng trình xử lý trên tên miền riêng. Cửa sổ bật lên do
 * người dùng tự bấm thì Safari cho qua, nên đây là đường ổn định nhất.
 * Nếu vẫn bị chặn thì mới lùi về chuyển hướng.
 */
export async function signInWithGoogle(): Promise<Account> {
  const auth = requireAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const credential = await signInWithPopup(auth, provider);
    return toAccount(credential.user);
  } catch (err) {
    const code = (err as { code?: string }).code ?? '';
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      // Trình duyệt rời trang ngay sau lệnh trên, dòng dưới không bao giờ chạy tới.
      return new Promise<Account>(() => undefined);
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw new Error('Bạn đã đóng cửa sổ đăng nhập.');
    }
    if (code === 'auth/unauthorized-domain') {
      throw new Error('Tên miền này chưa được cấp phép trong Firebase Authentication.');
    }
    throw new Error(`Không đăng nhập được. ${(err as Error).message}`);
  }
}

export async function signOutAccount(): Promise<void> {
  await signOut(requireAuth());
}
