import { useMemo, useState } from 'react';
import type { Check } from '../../domain/relations';
import type { Member } from '../../domain/types';
import { lifespan, matchesName } from '../../lib/text';
import { Avatar } from '../ui/Avatar';

interface Props {
  title: string;
  lead: string;
  members: Member[];
  /** Kiểm tra từng ứng viên; không chọn được thì nêu lý do ngay tại dòng đó. */
  check: (candidate: Member) => Check;
  onPick: (id: string) => void;
  onCancel: () => void;
}

const MAX_HIEN = 40;

export function MemberPicker({ title, lead, members, check, onPick, onCancel }: Props) {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    return members
      .filter((m) => matchesName(m.fullName, query))
      .map((m) => ({ member: m, check: check(m) }))
      // Người chọn được xếp lên trước cho đỡ phải lướt.
      .sort((a, b) => Number(b.check.ok) - Number(a.check.ok))
      .slice(0, MAX_HIEN);
  }, [members, query, check]);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
      <button className="sheet__backdrop" type="button" onClick={onCancel} aria-label="Đóng" />
      <div className="sheet__panel">
        <div className="sheet__grip" aria-hidden="true" />
        <header className="sheet__head">
          <h2 className="sheet__title">{title}</h2>
          <p className="sheet__lead">{lead}</p>
          <input
            className="field__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên…"
            aria-label="Tìm người trong gia phả"
            autoFocus
          />
        </header>

        <div className="sheet__body">
          {rows.length === 0 && <p className="detail__empty">Không tìm thấy ai tên như vậy.</p>}
          <ul className="picker__list">
            {rows.map(({ member, check: c }) => (
              <li key={member.id}>
                <button
                  className="picker__item"
                  type="button"
                  disabled={!c.ok}
                  onClick={() => onPick(member.id)}
                >
                  <Avatar member={member} size={40} />
                  <span className="picker__info">
                    <span className="picker__name">{member.fullName}</span>
                    <span className="picker__meta">
                      {c.ok
                        ? `${member.gender === 'M' ? 'Nam' : 'Nữ'}${
                            lifespan(member.birthDate, member.deathDate)
                              ? ` · ${lifespan(member.birthDate, member.deathDate)}`
                              : ''
                          }`
                        : c.reason}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <footer className="sheet__actions">
          <button className="btn" type="button" onClick={onCancel}>
            Huỷ
          </button>
        </footer>
      </div>
    </div>
  );
}
