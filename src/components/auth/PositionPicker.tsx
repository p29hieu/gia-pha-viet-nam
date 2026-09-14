import { useMemo, useState } from 'react';
import type { Member } from '../../domain/types';
import { lifespan, matchesName } from '../../lib/text';
import { Avatar } from '../ui/Avatar';

interface Props {
  members: Member[];
  onPick: (memberId: string) => void;
}

/** Sau khi đăng nhập, người dùng tự chỉ ra mình là ai trong gia phả. */
export function PositionPicker({ members, onPick }: Props) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const list = members.filter((m) => matchesName(m.fullName, query));
    return list.slice(0, 60);
  }, [members, query]);

  return (
    <main className="picker">
      <header className="picker__head">
        <p className="picker__eyebrow">Bước cuối</p>
        <h1 className="picker__title">Bạn là ai trong dòng họ?</h1>
        <p className="picker__lead">
          Chọn đúng tên mình để hệ thống biết cách tính danh xưng giữa bạn và mọi người.
        </p>
        <input
          className="field__input picker__search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Gõ tên của bạn, có dấu hoặc không dấu…"
          aria-label="Tìm tên của bạn"
        />
      </header>

      {results.length === 0 ? (
        <p className="picker__empty">
          Không tìm thấy ai tên như vậy. Hãy thử gõ ngắn hơn, hoặc nhờ người quản lý thêm bạn vào
          gia phả trước.
        </p>
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
                    {lifespan(m.birthDate, m.deathDate) && ` · ${lifespan(m.birthDate, m.deathDate)}`}
                    {m.occupation && ` · ${m.occupation}`}
                  </span>
                </span>
                <span className="picker__pick">Đây là tôi</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
