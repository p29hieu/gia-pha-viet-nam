import { useState } from 'react';
import type { Account } from '../../api/auth';

interface Props {
  account: Account;
  clanName: string;
  pending: boolean;
  onRequest: () => Promise<void>;
  onRecheck: () => Promise<void>;
  onSignOut: () => void;
}

/** Đã đăng nhập nhưng chưa được chủ họ duyệt cho vào. */
export function JoinGate({ account, clanName, pending, onRequest, onRecheck, onSignOut }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <div className="login__card">
        <p className="login__eyebrow">{clanName}</p>
        <h1 className="login__title">{pending ? 'Đang chờ duyệt' : 'Xin vào dòng họ'}</h1>
        <p className="login__lead">
          {pending
            ? 'Chủ họ đã nhận được yêu cầu của bạn. Khi nào được duyệt thì bạn sẽ xem được gia phả.'
            : 'Gia phả chỉ mở cho người trong họ. Gửi yêu cầu để chủ họ duyệt cho bạn vào.'}
        </p>

        {error && (
          <p className="login__error" role="alert">
            {error}
          </p>
        )}

        {pending ? (
          <button
            className="btn btn--block"
            type="button"
            disabled={busy}
            onClick={() => void run(onRecheck)}
          >
            {busy ? 'Đang kiểm tra…' : 'Kiểm tra lại'}
          </button>
        ) : (
          <button
            className="btn btn--primary btn--block"
            type="button"
            disabled={busy}
            onClick={() => void run(onRequest)}
          >
            {busy ? 'Đang gửi…' : 'Gửi yêu cầu vào họ'}
          </button>
        )}

        <p className="login__hint">
          {account.email || account.displayName}.{' '}
          <button className="linkish" type="button" onClick={onSignOut}>
            Đổi tài khoản
          </button>
        </p>
      </div>
    </main>
  );
}
