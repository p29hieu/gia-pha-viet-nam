import { useState } from 'react';

interface Props {
  onSignIn: () => Promise<void>;
}

export function SignInCard({ onSignIn }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handle() {
    setBusy(true);
    setError('');
    try {
      await onSignIn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <div className="login__card">
        <p className="login__eyebrow">Gia phả dòng họ</p>
        <h1 className="login__title">
          Cây có cội,
          <br />
          nước có nguồn
        </h1>
        <p className="login__lead">
          Đăng nhập bằng tài khoản Google để xem gia phả và tra cứu danh xưng trong họ.
        </p>

        {error && (
          <p className="login__error" role="alert">
            {error}
          </p>
        )}

        <button className="btn btn--block btn--google" type="button" onClick={handle} disabled={busy}>
          <GoogleMark />
          {busy ? 'Đang mở…' : 'Đăng nhập bằng Google'}
        </button>

        <p className="login__hint">
          Chỉ người trong họ được chủ họ duyệt mới xem được dữ liệu.
        </p>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.8-6.8C35.6 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.1 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.3-4.7 7l7.6 5.9c4.4-4.1 6.8-10.2 6.8-17.4z"
      />
      <path
        fill="#FBBC05"
        d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C1 16.4 0 20.1 0 24s1 7.6 2.6 10.8l7.9-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.6-3.6-13.5-8.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}
