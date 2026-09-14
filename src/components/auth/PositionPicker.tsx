import { useMemo, useState, type FormEvent } from 'react';
import type { Gender, Member } from '../../domain/types';
import { lifespan, matchesName } from '../../lib/text';
import { Avatar } from '../ui/Avatar';

export interface SelfDraft {
  fullName: string;
  gender: Gender;
  birthDate?: string;
}

interface Props {
  members: Member[];
  canEdit: boolean;
  busy: boolean;
  error: string;
  onPick: (memberId: string) => void;
  onCreateSelf: (draft: SelfDraft) => void;
}

/**
 * Sau khi đăng nhập, người dùng tự chỉ ra mình là ai trong gia phả.
 * Gia phả mới tinh thì chưa có ai để chọn, nên phải có đường tạo người đầu tiên
 * ngay tại đây — nếu không thì màn này là ngõ cụt.
 */
export function PositionPicker({ members, canEdit, busy, error, onPick, onCreateSelf }: Props) {
  const [query, setQuery] = useState('');
  const isEmpty = members.length === 0;
  const [creating, setCreating] = useState(isEmpty);

  const results = useMemo(
    () => members.filter((m) => matchesName(m.fullName, query)).slice(0, 60),
    [members, query],
  );

  return (
    <main className="picker">
      <header className="picker__head">
        <p className="picker__eyebrow">{isEmpty ? 'Bắt đầu' : 'Bước cuối'}</p>
        <h1 className="picker__title">
          {isEmpty ? 'Gia phả chưa có ai' : 'Bạn là ai trong dòng họ?'}
        </h1>
        <p className="picker__lead">
          {isEmpty
            ? 'Hãy bắt đầu từ chính bạn. Sau đó thêm dần bố mẹ, ông bà, anh chị em từ màn hình cây gia phả.'
            : 'Chọn đúng tên mình để hệ thống biết cách tính danh xưng giữa bạn và mọi người.'}
        </p>

        {!isEmpty && !creating && (
          <input
            className="field__input picker__search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Gõ tên của bạn, có dấu hoặc không dấu…"
            aria-label="Tìm tên của bạn"
          />
        )}
      </header>

      {creating ? (
        <SelfForm
          busy={busy}
          error={error}
          canCancel={!isEmpty}
          onCancel={() => setCreating(false)}
          onSubmit={onCreateSelf}
        />
      ) : (
        <>
          {results.length === 0 ? (
            <p className="picker__empty">Không tìm thấy ai tên như vậy.</p>
          ) : (
            <ul className="picker__list">
              {results.map((m) => (
                <li key={m.id}>
                  <button className="picker__item" type="button" onClick={() => onPick(m.id)}>
                    <Avatar member={m} size={44} />
                    <span className="picker__info">
                      <span className="picker__name">{m.fullName}</span>
                      <span className="picker__meta">
                        {m.gender === 'M' ? 'Nam' : 'Nữ'}
                        {lifespan(m.birthDate, m.deathDate) &&
                          ` · ${lifespan(m.birthDate, m.deathDate)}`}
                        {m.occupation && ` · ${m.occupation}`}
                      </span>
                    </span>
                    <span className="picker__pick">Đây là tôi</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {canEdit && (
            <p className="picker__alt">
              Chưa có tên bạn trong gia phả?{' '}
              <button className="linkish" type="button" onClick={() => setCreating(true)}>
                Thêm tôi vào
              </button>
            </p>
          )}
        </>
      )}
    </main>
  );
}

function SelfForm({
  busy,
  error,
  canCancel,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  error: string;
  canCancel: boolean;
  onCancel: () => void;
  onSubmit: (draft: SelfDraft) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<Gender>('M');
  const [birthDate, setBirthDate] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      fullName: fullName.trim(),
      gender,
      birthDate: birthDate.trim() || undefined,
    });
  }

  return (
    <form className="picker__form" onSubmit={submit}>
      <label className="field">
        <span className="field__label">Họ và tên của bạn</span>
        <input
          className="field__input"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          autoFocus
          autoComplete="name"
        />
      </label>

      <fieldset className="chips">
        <legend className="field__label">Giới tính</legend>
        {(['M', 'F'] as Gender[]).map((g) => (
          <label className={`chip${gender === g ? ' chip--on' : ''}`} key={g}>
            <input type="radio" name="gender" checked={gender === g} onChange={() => setGender(g)} />
            {g === 'M' ? 'Nam' : 'Nữ'}
          </label>
        ))}
      </fieldset>

      <label className="field">
        <span className="field__label">Năm sinh</span>
        <input
          className="field__input"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          placeholder="1960 · 1960-05 · 1960-05-12"
          autoComplete="off"
        />
      </label>

      {error && (
        <p className="alert alert--danger" role="alert">
          {error}
        </p>
      )}

      <div className="picker__form-actions">
        {canCancel && (
          <button className="btn" type="button" onClick={onCancel}>
            Quay lại
          </button>
        )}
        <button className="btn btn--primary" type="submit" disabled={busy || !fullName.trim()}>
          {busy ? 'Đang lưu…' : 'Bắt đầu gia phả từ tôi'}
        </button>
      </div>
    </form>
  );
}
