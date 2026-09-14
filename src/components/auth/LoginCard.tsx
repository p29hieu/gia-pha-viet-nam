import { useState, type FormEvent } from 'react';
import { DEMO_CODE, IS_DEMO, login } from '../../api/client';

interface Props {
  onSuccess: (token: string) => void;
}

export function LoginCard({ onSuccess }: Props) {
  const [code, setCode] = useState(IS_DEMO ? DEMO_CODE : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const session = await login(code);
      onSuccess(session.token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="login__card" onSubmit={handleSubmit}>
        <p className="login__eyebrow">Gia phả dòng họ</p>
        <h1 className="login__title">
          Cây có cội,
          <br />
          nước có nguồn
        </h1>
        <p className="login__lead">
          Nhập mã số được người quản lý dòng họ cấp để xem gia phả và tra cứu danh xưng.
        </p>

        <label className="field">
          <span className="field__label">Mã số của bạn</span>
          <input
            className="field__input field__input--code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="GP-XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
          />
        </label>

        {error && (
          <p className="login__error" role="alert">
            {error}
          </p>
        )}

        <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
          {busy ? 'Đang kiểm tra…' : 'Vào xem gia phả'}
        </button>

        {IS_DEMO && (
          <p className="login__hint">
            Đang chạy bằng <strong>dữ liệu mẫu</strong>. Mã dùng thử: <code>{DEMO_CODE}</code>
          </p>
        )}
      </form>
    </main>
  );
}
