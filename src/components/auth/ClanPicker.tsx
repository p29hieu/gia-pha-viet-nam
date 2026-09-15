import { useState, type FormEvent } from 'react';
import type { Account } from '../../api/auth';
import type { ClanSummary } from '../../api/firestoreClient';
import { ROLE_LABEL } from '../../domain/perm';

interface Props {
  account: Account;
  clans: ClanSummary[];
  /** Trả về id cây vừa lập để tầng trên mở luôn. */
  onCreate: (name: string) => Promise<string>;
  onOpen: (clanId: string) => void;
  onSignOut: () => void;
}

/**
 * Chọn cây gia phả sau khi đăng nhập.
 *
 * Một người có thể ở nhiều dòng họ — họ nội, họ ngoại, họ bên vợ — nên sau khi
 * đăng nhập phải hỏi vào cây nào. Người mới tinh chưa có cây nào thì màn này
 * chính là chỗ lập cây đầu tiên.
 */
export function ClanPicker({ account, clans, onCreate, onOpen, onSignOut }: Props) {
  const chuaCoCay = clans.length === 0;
  const [dangLap, setDangLap] = useState(chuaCoCay);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onOpen(await onCreate(name));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <div className="login__card">
        <p className="login__eyebrow">{chuaCoCay ? 'Bắt đầu' : 'Chọn gia phả'}</p>
        <h1 className="login__title">
          {chuaCoCay ? 'Lập gia phả dòng họ' : 'Bạn muốn mở cây nào?'}
        </h1>

        {chuaCoCay ? (
          <p className="login__lead">
            Chưa có dòng họ nào của bạn ở đây. Bạn đứng ra lập thì sẽ là chủ họ: mời người nhà vào,
            phân quyền xem, bình luận hay sửa.
          </p>
        ) : (
          <p className="login__lead">
            Một người có thể ở nhiều dòng họ — họ nội, họ ngoại, họ bên vợ. Mỗi cây có đường link
            riêng, gửi được cho người nhà.
          </p>
        )}

        {clans.length > 0 && (
          <ul className="clans">
            {clans.map((c) => (
              <li key={c.id}>
                <button className="clans__item" type="button" onClick={() => onOpen(c.id)}>
                  <span className="clans__name">{c.name}</span>
                  <span className="clans__role">{ROLE_LABEL[c.role]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {dangLap ? (
          <form onSubmit={submit}>
            <label className="field">
              <span className="field__label">Tên dòng họ</span>
              <input
                className="field__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dòng họ Đỗ — Phú Xuyên"
                required
                autoFocus
              />
            </label>

            {error && (
              <p className="login__error" role="alert">
                {error}
              </p>
            )}

            <button
              className="btn btn--primary btn--block"
              type="submit"
              disabled={busy || !name.trim()}
            >
              {busy ? 'Đang lập…' : 'Lập dòng họ'}
            </button>

            {!chuaCoCay && (
              <button
                className="linkish clans__cancel"
                type="button"
                onClick={() => setDangLap(false)}
              >
                Thôi, quay lại danh sách
              </button>
            )}
          </form>
        ) : (
          <button className="btn btn--block" type="button" onClick={() => setDangLap(true)}>
            + Lập cây gia phả mới
          </button>
        )}

        <p className="login__hint">
          Đang đăng nhập bằng {account.email || account.displayName}.{' '}
          <button className="linkish" type="button" onClick={onSignOut}>
            Đổi tài khoản
          </button>
        </p>
      </div>
    </main>
  );
}
