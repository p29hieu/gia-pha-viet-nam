import { useState, type FormEvent } from 'react';
import type { Account } from '../../api/auth';

interface Props {
  account: Account;
  onCreate: (name: string) => Promise<void>;
  onSignOut: () => void;
}

/** Chưa ai lập dòng họ — người đăng nhập đầu tiên đứng ra lập và làm chủ. */
export function ClanSetup({ account, onCreate, onSignOut }: Props) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onCreate(name);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="login__card" onSubmit={submit}>
        <p className="login__eyebrow">Bắt đầu</p>
        <h1 className="login__title">Lập gia phả dòng họ</h1>
        <p className="login__lead">
          Chưa có dòng họ nào ở đây. Bạn đứng ra lập thì sẽ là chủ họ: duyệt người vào, phân quyền
          xem hay sửa.
        </p>

        <label className="field">
          <span className="field__label">Tên dòng họ</span>
          <input
            className="field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dòng họ Đỗ — Nam Định"
            required
            autoFocus
          />
        </label>

        {error && (
          <p className="login__error" role="alert">
            {error}
          </p>
        )}

        <button className="btn btn--primary btn--block" type="submit" disabled={busy || !name.trim()}>
          {busy ? 'Đang lập…' : 'Lập dòng họ'}
        </button>

        <p className="login__hint">
          Đang đăng nhập bằng {account.email || account.displayName}.{' '}
          <button className="linkish" type="button" onClick={onSignOut}>
            Đổi tài khoản
          </button>
        </p>
      </form>
    </main>
  );
}
